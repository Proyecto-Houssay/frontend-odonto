import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { TeletriajePage, type Solicitud, type Cita } from './TeletriajePage'

describe('TeletriajePage - TR-37 y TR-38', () => {
  const mockSolicitudes: Solicitud[] = [
    {
      id: 1,
      pacienteId: 10,
      pacienteNombre: 'Juan Urgente',
      pacienteDni: '11111111',
      motivoConsulta: 'Dolor severo y trismo',
      prioridadSugerida: 'ROJO',
      prioridadValidada: 'ROJO',
      prioridadEfectiva: 'ROJO',
      estadoValidacion: 'VALIDADA',
      signosAlarma: true,
      derivacionHumana: true,
      origen: 'WEB',
      estado: 'DERIVADA_URGENTE',
      fechaCreacion: '2026-11-01T10:00:00'
    },
    {
      id: 2,
      pacienteId: 11,
      pacienteNombre: 'Ana Moderada',
      pacienteDni: '22222222',
      motivoConsulta: 'Caries en molar',
      prioridadSugerida: 'AMARILLO',
      prioridadEfectiva: 'AMARILLO',
      estadoValidacion: 'SUGERIDA',
      signosAlarma: false,
      derivacionHumana: false,
      origen: 'WEB',
      estado: 'PENDIENTE',
      fechaCreacion: '2026-11-01T11:00:00'
    },
    {
      id: 3,
      pacienteId: 12,
      pacienteNombre: 'Carlos Leve',
      pacienteDni: '33333333',
      motivoConsulta: 'Limpieza dental',
      prioridadSugerida: 'VERDE',
      prioridadEfectiva: 'VERDE',
      estadoValidacion: 'SUGERIDA',
      signosAlarma: false,
      derivacionHumana: false,
      origen: 'WEB',
      estado: 'PENDIENTE',
      fechaCreacion: '2026-11-01T12:00:00'
    }
  ]

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('TR-37: Muestra la cola ordenada con semáforo y distinción de sugerida vs validada', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockSolicitudes
      })
    )

    render(<TeletriajePage />)

    // Verificar que cargó los pacientes
    expect(await screen.findByText('Juan Urgente', {}, { timeout: 10000 })).toBeInTheDocument()
    expect(screen.getByText('Ana Moderada')).toBeInTheDocument()
    expect(screen.getByText('Carlos Leve')).toBeInTheDocument()

    // Verificar semáforo y etiquetas
    expect(screen.getByText(/Atención humana inmediata/)).toBeInTheDocument()
    expect(screen.getByText(/Validada por profesional/)).toBeInTheDocument()
    expect(screen.getAllByText(/Prioridad sugerida \(orientativa\)/).length).toBeGreaterThanOrEqual(2)
  })

  it('TR-37: Maneja estado vacío cuando no hay solicitudes en la cola', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => []
      })
    )

    render(<TeletriajePage />)

    expect(await screen.findByText('No hay solicitudes pendientes en la cola.', {}, { timeout: 10000 })).toBeInTheDocument()
  })

  it('TR-37: Maneja error 403 Forbidden cuando el rol no tiene autorización para la cola completa', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        text: async () => 'Acceso denegado'
      })
    )

    render(<TeletriajePage />)

    expect(await screen.findByText('Acceso Denegado (403)', {}, { timeout: 10000 })).toBeInTheDocument()
    expect(screen.getByText(/Solo el personal autorizado puede ver la cola completa/)).toBeInTheDocument()
  })

  it('TR-38: Maneja HTTP 409 sin falsa confirmación ante conflicto de horario', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (url, options = {}) => {
        const urlStr = String(url)
        if (urlStr.includes('/reservar') && options.method === 'POST') {
          return {
            ok: false,
            status: 409,
            text: async () => 'El profesional ya no cuenta con disponibilidad en la fecha y hora seleccionadas.'
          }
        }
        return {
          ok: true,
          status: 200,
          json: async () => [mockSolicitudes[1]]
        }
      })
    )

    render(<TeletriajePage />)

    // Esperar a que cargue la lista
    expect(await screen.findByText('Ana Moderada', {}, { timeout: 10000 })).toBeInTheDocument()

    // Hacer clic en "Reservar"
    fireEvent.click(screen.getByRole('button', { name: 'Reservar' }))

    // Completar el formulario de reserva
    const fechaInput = screen.getByLabelText(/Fecha del Turno:/)
    fireEvent.change(fechaInput, { target: { value: '2026-11-10' } })

    const consentCheckbox = screen.getByRole('checkbox', {
      name: /consentimiento informado/i
    })
    fireEvent.click(consentCheckbox)

    // Confirmar la reserva
    const submitBtn = screen.getByRole('button', { name: /Confirmar Reserva/i })
    fireEvent.submit(submitBtn.closest('form')!)

    // Verificar que se muestra el error 409 y NO la tarjeta de éxito
    await waitFor(() => {
      expect(screen.getByText(/Conflicto de horario \(409\)/)).toBeInTheDocument()
    })
    expect(screen.queryByText(/Reserva Transaccional Confirmada/)).not.toBeInTheDocument()
  })

  it('TR-38: Confirma reserva únicamente tras respuesta 201/200 del BE', async () => {
    const citaMock: Cita = {
      id: 50,
      turnoId: 888,
      pacienteId: 11,
      pacienteNombre: 'Ana Moderada',
      pacienteDni: '22222222',
      odontologoId: 1,
      odontologoNombre: 'Dr. Lucas Vazquez',
      fecha: '2026-11-10',
      hora: '10:00:00',
      consentimientoInformado: true,
      grabacionHabilitada: false,
      estadoSala: 'PENDIENTE_PROVEEDOR',
      enlaceFuncional: false,
      expirada: false,
      fechaCreacion: '2026-11-01T12:00:00'
    }

    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (url, options = {}) => {
        const urlStr = String(url)
        if (urlStr.includes('/reservar') && options.method === 'POST') {
          return {
            ok: true,
            status: 201,
            json: async () => citaMock
          }
        }
        return {
          ok: true,
          status: 200,
          json: async () => [mockSolicitudes[1]]
        }
      })
    )

    render(<TeletriajePage />)

    expect(await screen.findByText('Ana Moderada', {}, { timeout: 10000 })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Reservar' }))

    const fechaInput = screen.getByLabelText(/Fecha del Turno:/)
    fireEvent.change(fechaInput, { target: { value: '2026-11-10' } })

    const consentCheckbox = screen.getByRole('checkbox', {
      name: /consentimiento informado/i
    })
    fireEvent.click(consentCheckbox)

    const submitBtn = screen.getByRole('button', { name: /Confirmar Reserva/i })
    fireEvent.submit(submitBtn.closest('form')!)

    // Confirmación exitosa recibida del backend
    expect(await screen.findByText(/Reserva Transaccional Confirmada/, {}, { timeout: 10000 })).toBeInTheDocument()
    expect(screen.getAllByText(/Turno #888/).length).toBeGreaterThanOrEqual(1)
  })

  it('TR-38: Vista paciente muestra acción de video solo con enlace válido; oculta si está pendiente o expirado', async () => {
    const citaConVideo: Cita = {
      id: 90,
      turnoId: 101,
      pacienteId: 1,
      pacienteNombre: 'Juan Paciente',
      pacienteDni: '11111111',
      odontologoId: 5,
      odontologoNombre: 'Dr. Lucas',
      fecha: '2026-11-05',
      hora: '14:00:00',
      consentimientoInformado: true,
      grabacionHabilitada: false,
      estadoSala: 'DISPONIBLE',
      enlaceVideo: 'https://telemedicina.novadent.local/sala/uuid-activa',
      enlaceFuncional: true,
      expirada: false,
      fechaCreacion: '2026-11-01T12:00:00'
    }

    const citaExpirada: Cita = {
      id: 91,
      turnoId: 102,
      pacienteId: 1,
      pacienteNombre: 'Juan Paciente',
      pacienteDni: '11111111',
      odontologoId: 5,
      odontologoNombre: 'Dr. Lucas',
      fecha: '2026-11-01',
      hora: '09:00:00',
      consentimientoInformado: true,
      grabacionHabilitada: false,
      estadoSala: 'EXPIRADA',
      enlaceVideo: 'https://telemedicina.novadent.local/sala/uuid-vencida',
      enlaceFuncional: false,
      expirada: true,
      fechaCreacion: '2026-10-31T12:00:00'
    }

    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (url) => {
        const urlStr = String(url)
        if (urlStr.includes('/citas/paciente/')) {
          return { ok: true, status: 200, json: async () => [citaConVideo, citaExpirada] }
        }
        return { ok: true, status: 200, json: async () => [] }
      })
    )

    render(<TeletriajePage />)

    // Cambiar a rol PACIENTE
    fireEvent.click(screen.getByRole('button', { name: 'Paciente' }))

    // Debe mostrar la cita con enlace activo para ingresar a videollamada
    expect(await screen.findByText('Ingresar a Videollamada', {}, { timeout: 10000 })).toBeInTheDocument()

    // Para la cita expirada, debe indicar que caducó y NO mostrar segundo botón de videollamada
    expect(screen.getByText(/Enlace de teletriaje expirado \/ caducado/)).toBeInTheDocument()
    expect(screen.getByText(/Enlace caducado/)).toBeInTheDocument()
    expect(screen.getAllByText('Ingresar a Videollamada').length).toBe(1)
  })
})
