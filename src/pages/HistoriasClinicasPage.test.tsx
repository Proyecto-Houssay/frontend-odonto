import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { HistoriasClinicasPage } from './HistoriasClinicasPage'

vi.mock('../auth/useAuth', () => ({
  useAuth: () => ({ session: { token: 'mock-staff-jwt' } }),
}))

const mockPacientes = [
  { id: 1, nombre: 'Carlos', apellido: 'Gómez', dni: '38123456', email: 'carlos@test.com' },
  { id: 2, nombre: 'María', apellido: 'López', dni: '40987654', email: 'maria@test.com' },
]

const mockHistorias = [
  { id: 1, pacienteId: 1, fechaApertura: '2026-11-10', observaciones: 'Paciente con antecedentes de hipertensión.' },
]

describe('HistoriasClinicasPage', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockImplementation((url: string, options?: RequestInit) => {
      const urlStr = String(url)

      if (urlStr.endsWith('/historias-clinicas') && options?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          status: 201,
          text: async () => JSON.stringify({
            id: 2,
            pacienteId: 2,
            fechaApertura: '2026-11-10',
            observaciones: 'Nueva ficha creada en test',
          }),
        })
      }

      if (urlStr.includes('/historias-clinicas/1/detalle')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            id: 1,
            pacienteId: 1,
            fechaApertura: '2026-11-10',
            observaciones: 'Paciente con antecedentes de hipertensión.',
            diagnosticos: [
              { id: 101, fecha: '2026-11-10', descripcion: 'Control inicial', tratamientos: [] },
            ],
          }),
        })
      }

      if (urlStr.endsWith('/historias-clinicas')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          text: async () => JSON.stringify(mockHistorias),
        })
      }

      if (urlStr.endsWith('/pacientes')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          text: async () => JSON.stringify(mockPacientes),
        })
      }

      return Promise.resolve({
        ok: true,
        status: 200,
        text: async () => JSON.stringify([]),
      })
    })
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('renderiza la lista de historias clínicas con el nombre del paciente', async () => {
    render(
      <MemoryRouter>
        <HistoriasClinicasPage />
      </MemoryRouter>
    )

    expect(await screen.findByText('Historias Clínicas')).toBeInTheDocument()
    expect(await screen.findByText('Carlos Gómez')).toBeInTheDocument()
    expect(screen.getByText(/38123456/)).toBeInTheDocument()
    expect(screen.getByText(/Paciente con antecedentes de hipertensión/)).toBeInTheDocument()
  })

  it('permite abrir el modal de Nueva Ficha y registrarla con éxito', async () => {
    render(
      <MemoryRouter>
        <HistoriasClinicasPage />
      </MemoryRouter>
    )

    // Clic en el botón "Nueva Ficha"
    const newBtn = await screen.findByRole('button', { name: /Nueva Ficha/i })
    fireEvent.click(newBtn)

    // El modal debe estar en pantalla
    expect(await screen.findByText('Nueva Ficha Odontológica')).toBeInTheDocument()

    // El paciente 2 (María López) está libre y debe seleccionarse
    const select = screen.getByLabelText(/Paciente \*/i)
    fireEvent.change(select, { target: { value: '2' } })

    const obsInput = screen.getByLabelText(/Antecedentes Médicos \/ Observaciones/i)
    fireEvent.change(obsInput, { target: { value: 'Nueva ficha creada en test' } })

    // Enviar formulario
    const submitBtn = screen.getByRole('button', { name: /Crear Ficha/i })
    fireEvent.click(submitBtn)

    // Esperar a que se llame a la API POST
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/historias-clinicas',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"pacienteId":2'),
        })
      )
    })
  })

  it('permite abrir el modal de detalle de evoluciones clínicas', async () => {
    render(
      <MemoryRouter>
        <HistoriasClinicasPage />
      </MemoryRouter>
    )

    const evolBtn = await screen.findByRole('button', { name: /Evoluciones/i })
    fireEvent.click(evolBtn)

    expect(await screen.findByText(/Evoluciones Clínicas · Ficha #1/i)).toBeInTheDocument()
    expect(await screen.findByText('Control inicial')).toBeInTheDocument()
  })
})
