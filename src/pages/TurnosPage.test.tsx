import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { TurnosPage } from './TurnosPage'

const response = (body: unknown, status = 200) => ({ ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(body), json: async () => body }) as Response
const today = new Date()
const localDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
const patient = { id: 1, nombre: 'Ana', apellido: 'Nieto' }
const dentist = { id: 3, nombre: 'Martín', apellido: 'Sánchez', activo: true }
const appointment = { id: 8, fecha: localDate, hora: '10:00:00', motivo: 'Control', estado: 'PENDIENTE', paciente: patient, odontologo: dentist }

describe('staff appointments', () => {
  const fetchMock = vi.fn()
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockImplementation((path: string, options?: RequestInit) => {
      if (path.endsWith('/turnos') && options?.method === 'POST') return Promise.resolve(response(appointment, 201))
      if (path.includes('/teletriaje/citas/agenda')) return Promise.resolve(response([]))
      if (path.endsWith('/turnos')) return Promise.resolve(response([appointment]))
      if (path.endsWith('/pacientes')) return Promise.resolve(response([patient]))
      if (path.endsWith('/odontologos')) return Promise.resolve(response([dentist]))
      throw new Error(`Unexpected API path: ${path}`)
    })
  })
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks() })

  it('renders a real weekly agenda with patient and dentist from the backend', async () => {
    render(<TurnosPage token="staff-token" />)
    expect(await screen.findByText('Ana Nieto')).not.toBeNull()
    expect(screen.getByText(/Martín Sánchez/)).not.toBeNull()
    expect(screen.getByText(/Control/)).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Semana' })).not.toBeNull()
    expect(fetchMock).toHaveBeenCalledWith('/api/turnos', expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer staff-token' }) }))
  })

  it('creates an appointment using selected real patient and dentist IDs', async () => {
    render(<TurnosPage token="staff-token" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Nuevo turno presencial' }))
    expect(await screen.findByRole('option', { name: 'Ana Nieto' })).not.toBeNull()
    expect(await screen.findByRole('option', { name: 'Martín Sánchez' })).not.toBeNull()
    fireEvent.change(screen.getByLabelText('Paciente'), { target: { value: '1' } })
    fireEvent.change(screen.getByLabelText('Odontólogo'), { target: { value: '3' } })
    fireEvent.change(screen.getByLabelText('Fecha'), { target: { value: localDate } })
    fireEvent.change(screen.getByLabelText('Hora'), { target: { value: '11:00' } })
    fireEvent.change(screen.getByLabelText('Motivo'), { target: { value: 'Consulta' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar turno' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/turnos', expect.objectContaining({ method: 'POST', body: expect.stringContaining('"pacienteId":1') })))
    expect(await screen.findByRole('status')).not.toBeNull()
  })

  it('advances from January 31 to February without overflowing into March', async () => {
    render(<TurnosPage token="staff-token" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Mes' }))
    fireEvent.click(screen.getByRole('button', { name: 'Nuevo turno presencial' }))
    expect(await screen.findByRole('option', { name: 'Ana Nieto' })).not.toBeNull()
    expect(await screen.findByRole('option', { name: 'Martín Sánchez' })).not.toBeNull()
    fireEvent.change(screen.getByLabelText('Paciente'), { target: { value: '1' } })
    fireEvent.change(screen.getByLabelText('Odontólogo'), { target: { value: '3' } })
    fireEvent.change(screen.getByLabelText('Fecha'), { target: { value: '2027-01-31' } })
    fireEvent.change(screen.getByLabelText('Hora'), { target: { value: '11:00' } })
    fireEvent.change(screen.getByLabelText('Motivo'), { target: { value: 'Consulta' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar turno' }))
    await screen.findByRole('status')
    fireEvent.click(screen.getByRole('button', { name: 'Período siguiente' }))
    expect(screen.getAllByRole('heading')[1].textContent).toMatch(/1 feb.*28 de feb/i)
    fireEvent.click(screen.getByRole('button', { name: 'Período anterior' }))
    expect(screen.getAllByRole('heading')[1].textContent).toMatch(/1 ene.*31 de ene/i)
  })
})
