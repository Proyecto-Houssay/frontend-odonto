import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ChatbotPage } from './ChatbotPage'

vi.mock('../auth/useAuth', () => ({
  useAuth: () => ({ session: { token: 'patient-token' } }),
}))

const response = (body: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  text: async () => JSON.stringify(body),
}) as Response

describe('ChatbotPage', () => {
  const fetchMock = vi.fn()

  beforeEach(() => vi.stubGlobal('fetch', fetchMock))
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks() })

  it('replies locally to greetings like "hola" with useful guidance and actions without failing when AI/RAG is unavailable', async () => {
    fetchMock.mockRejectedValue(new Error('backend down'))
    render(<MemoryRouter><ChatbotPage /></MemoryRouter>)

    fireEvent.change(screen.getByLabelText('Tu pregunta'), { target: { value: 'hola' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }))

    expect(await screen.findByText(/soy el asistente de novadent/i)).not.toBeNull()
    expect(screen.queryByText(/No pude consultar las fuentes aprobadas ahora/i)).toBeNull()
    expect(screen.queryByText(/No pude conectar con el asistente/i)).toBeNull()
    expect(screen.getByRole('link', { name: 'Ver mis turnos' }).getAttribute('href')).toBe('/mis-turnos')
    expect(screen.getByRole('link', { name: 'Ver mi odontograma' }).getAttribute('href')).toBe('/mi-odontograma')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('renders a compact conversation panel with its own scroll and concrete empty-state suggestions', async () => {
    fetchMock.mockResolvedValue(response([{
      id: 22, fecha: '2099-11-20', hora: '14:00:00', motivo: 'Limpieza', estado: 'CONFIRMADO', odontologoNombre: 'Dr. Gómez',
    }]))
    render(<MemoryRouter><ChatbotPage /></MemoryRouter>)

    const conversation = screen.getByRole('region', { name: 'Conversación' })
    expect(conversation.className).toMatch(/overflow-y-auto/)
    expect(conversation.className).toMatch(/max-h-\[(?:320|360|380|400)px\]|sm:max-h-\[(?:360|380|400)px\]/)

    const suggestion = screen.getByRole('button', { name: /¿Cuándo es mi próximo turno\?/i })
    fireEvent.click(suggestion)

    expect(await screen.findByText(/20 de noviembre de 2099.*14:00/i)).not.toBeNull()
    expect(fetchMock).toHaveBeenCalledWith('/api/portal-paciente/turnos', expect.objectContaining({
      headers: expect.objectContaining({ Authorization: 'Bearer patient-token' }),
    }))
  })

  it('routes unanswered availability questions to the patient turnos instead of showing a dead-end error', async () => {
    fetchMock.mockResolvedValue(response({
      respuesta: 'Ahora no puedo confirmar los horarios ni la disponibilidad porque no hay una fuente vigente aprobada. Consultá tus turnos registrados o comunicate con recepción.',
      intencion: 'turno',
      accionesSugeridas: ['/mis-turnos'],
      citas: [],
    }))
    render(<MemoryRouter><ChatbotPage /></MemoryRouter>)

    fireEvent.change(screen.getByLabelText('Tu pregunta'), { target: { value: '¿Qué horarios tienen disponibles?' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }))

    expect(await screen.findByText(/no hay una fuente vigente aprobada/i)).not.toBeNull()
    expect(screen.getByRole('link', { name: 'Ver mis turnos' }).getAttribute('href')).toBe('/mis-turnos')
    expect(screen.queryByText(/No pude consultar las fuentes aprobadas ahora/i)).toBeNull()
    expect(screen.queryByText(/No se pudo procesar la consulta en este momento/i)).toBeNull()
  })

  it('explains clearly without inventing schedules when the backend returns a legacy provider error on schedule questions', async () => {
    fetchMock.mockResolvedValue(response({
      respuesta: 'No se pudo procesar la consulta en este momento. Reintentá más tarde.',
      intencion: 'error',
      accionesSugeridas: [],
      citas: [],
    }))
    render(<MemoryRouter><ChatbotPage /></MemoryRouter>)

    fireEvent.change(screen.getByLabelText('Tu pregunta'), { target: { value: '¿Qué horarios de atención tienen?' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }))

    expect(await screen.findByText(/no puedo confirmar los horarios ni la disponibilidad porque no hay una fuente vigente aprobada/i)).not.toBeNull()
    expect(screen.queryByText(/No pude consultar las fuentes aprobadas ahora/i)).toBeNull()
    expect(screen.getByRole('link', { name: 'Ver mis turnos' }).getAttribute('href')).toBe('/mis-turnos')
  })

  it('answers a patient-specific next-appointment question only from that session’s own turnos endpoint', async () => {
    fetchMock.mockResolvedValue(response([{
      id: 18, fecha: '2099-10-15', hora: '10:30:00', motivo: 'Control', estado: 'PROGRAMADO', odontologoNombre: 'Dra. Pérez',
    }]))
    render(<MemoryRouter><ChatbotPage /></MemoryRouter>)

    fireEvent.change(screen.getByLabelText('Tu pregunta'), { target: { value: '¿Cuándo es mi próximo turno?' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }))

    expect(await screen.findByText(/15 de octubre de 2099.*10:30/i)).not.toBeNull()
    const replyBubble = screen.getByText(/15 de octubre de 2099.*10:30/i).closest('article')
    expect(replyBubble?.className).toContain('bg-blue-50/90')
    expect(fetchMock).toHaveBeenCalledWith('/api/portal-paciente/turnos', expect.objectContaining({
      headers: expect.objectContaining({ Authorization: 'Bearer patient-token' }),
    }))
    expect(fetchMock).not.toHaveBeenCalledWith('/api/chatbot/ask', expect.anything())
  })

  it('guides the patient to complete their profile when /portal-paciente/turnos returns 409', async () => {
    fetchMock.mockResolvedValue(response({ message: 'Completá tu ficha antes de cargar un reporte' }, 409))
    render(<MemoryRouter><ChatbotPage /></MemoryRouter>)

    fireEvent.change(screen.getByLabelText('Tu pregunta'), { target: { value: '¿Cuándo es mi próximo turno?' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }))

    expect(await screen.findByText(/Todavía no tenés una ficha de paciente vinculada/i)).not.toBeNull()
    expect(screen.getByRole('link', { name: 'Ver mis turnos' }).getAttribute('href')).toBe('/mis-turnos')
  })

  it('provides useful navigation when the chatbot API is unreachable', async () => {
    fetchMock.mockRejectedValue(new Error('network unavailable'))
    render(<MemoryRouter><ChatbotPage /></MemoryRouter>)

    fireEvent.change(screen.getByLabelText('Tu pregunta'), { target: { value: '¿Hacen implantes?' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }))

    expect(await screen.findByText(/No pude conectar con el asistente/i)).not.toBeNull()
    expect(screen.getByRole('link', { name: 'Ver mis turnos' }).getAttribute('href')).toBe('/mis-turnos')
  })

  it('lists available doctors and allows booking a real appointment directly from the chatbot', async () => {
    const slot = {
      odontologoId: 3,
      odontologoNombre: 'Laura Pérez',
      especialidad: 'Ortodoncia',
      fecha: '2099-11-12',
      hora: '10:00:00',
      etiquetaFecha: 'mañana 12/11',
      etiquetaHora: '10:00',
    }
    fetchMock.mockImplementation((path: string, init?: RequestInit) => {
      if (path === '/api/chatbot/ask') {
        return Promise.resolve(response({
          respuesta: '¡Hola! Sí, mirá, tenemos estos turnos disponibles:',
          intencion: 'turno',
          accionesSugeridas: ['/mis-turnos'],
          citas: [],
          agenda: {
            requiereFichaPaciente: false,
            esStaff: false,
            doctores: [{ id: 3, nombre: 'Laura', apellido: 'Pérez', nombreCompleto: 'Laura Pérez', especialidad: 'Ortodoncia' }],
            slotsDisponibles: [slot],
            fechaConsultada: '2099-11-12',
            odontologoConsultadoId: 3,
          },
        }))
      }
      if (path.startsWith('/api/chatbot/turnos/disponibles')) {
        return Promise.resolve(response([slot]))
      }
      if (path === '/api/chatbot/turnos/reservar' && init?.method === 'POST') {
        return Promise.resolve(response({
          turnoId: 77,
          fecha: '2099-11-12',
          hora: '10:00:00',
          motivo: 'Limpieza dental',
          estado: 'PENDIENTE',
          odontologoId: 3,
          odontologoNombre: 'Laura Pérez',
          pacienteId: 5,
          pacienteNombre: 'Ana Nieto',
          mensaje: '¡Listo! Tu turno quedó confirmado para el jueves 12 de noviembre a las 10:00 hs con Dr./Dra. Laura Pérez (Turno #77).',
        }, 201))
      }
      throw new Error(`Unexpected path: ${path}`)
    })

    const bookedListener = vi.fn()
    window.addEventListener('novadent:turno-booked', bookedListener)
    render(<MemoryRouter><ChatbotPage /></MemoryRouter>)

    fireEvent.change(screen.getByLabelText('Tu pregunta'), { target: { value: 'Hola, ¿qué turnos tienen disponibles?' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }))

    expect(await screen.findByText(/¡Hola! Sí, mirá, tenemos estos turnos disponibles/i)).not.toBeNull()
    expect(screen.getByLabelText('Doctor disponible')).not.toBeNull()

    const slotButton = await screen.findByRole('button', { name: '10:00' })
    fireEvent.click(slotButton)
    fireEvent.change(screen.getByLabelText('Motivo de la consulta'), { target: { value: 'Limpieza dental' } })
    fireEvent.click(screen.getByRole('button', { name: /Confirmar turno/i }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/chatbot/turnos/reservar', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ odontologoId: 3, fecha: '2099-11-12', hora: '10:00:00', motivo: 'Limpieza dental' }),
    })))
    expect(await screen.findByText(/Turno #77 confirmado/i)).not.toBeNull()
    expect(bookedListener).toHaveBeenCalledTimes(1)
    window.removeEventListener('novadent:turno-booked', bookedListener)
  })
})
