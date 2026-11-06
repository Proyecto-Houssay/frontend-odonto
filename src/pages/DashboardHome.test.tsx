import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { DashboardHome } from './DashboardHome'

function renderDashboard(role: 'ADMINISTRADOR' | 'ODONTOLOGO' | 'RECEPCIONISTA') {
  return render(<MemoryRouter><DashboardHome role={role} token="staff-token" /></MemoryRouter>)
}

const fetchMock = vi.fn()
beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockImplementation((path: string) => {
    if (path.endsWith('/pacientes')) return Promise.resolve({ ok: true, status: 200, text: async () => JSON.stringify([{ id: 1, nombre: 'Ana', apellido: 'Nieto', dni: '12345678' }]) })
    if (path.endsWith('/turnos')) return Promise.resolve({ ok: true, status: 200, text: async () => JSON.stringify([{ id: 5, fecha: new Date().toISOString().slice(0, 10), hora: '10:00:00', motivo: 'Control', estado: 'PENDIENTE', paciente: { id: 1, nombre: 'Ana', apellido: 'Nieto' }, odontologo: { id: 3, nombre: 'Martín', apellido: 'Sánchez' } }]) })
    if (path.endsWith('/odontologos')) return Promise.resolve({ ok: true, status: 200, text: async () => JSON.stringify([{ id: 3, nombre: 'Martín', apellido: 'Sánchez', activo: true }]) })
    if (path.endsWith('/tratamientos')) return Promise.resolve({ ok: true, status: 200, text: async () => JSON.stringify([{ id: 8, descripcion: 'Limpieza dental', fecha: '2026-10-15', estado: 'EN_CURSO' }]) })
    throw new Error(`Unexpected API path: ${path}`)
  })
})
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks() })

describe('role dashboards', () => {
  it('shows administration shortcuts without sample statistics', () => {
    renderDashboard('ADMINISTRADOR')
    expect(screen.getByRole('heading', { name: 'Panel de administración' })).not.toBeNull()
    expect(screen.getAllByRole('link', { name: /Ver pacientes/i })[0].getAttribute('href')).toBe('/pacientes')
    expect(screen.getByTestId('role-shortcut-grid').className).toContain('xl:grid-cols-4')
    expect(screen.getByText('Agenda de turnos', { selector: 'h4' })).not.toBeNull()
    expect(screen.queryByText('128')).toBeNull()
  })

  it('uses live clinic totals and appointments, never fictional revenue', async () => {
    renderDashboard('ADMINISTRADOR')
    expect(await screen.findByTestId('metric-patients')).not.toBeNull()
    expect(screen.getByTestId('metric-patients').textContent).toContain('1')
    expect(screen.getAllByText(/Ana Nieto/).length).toBeGreaterThan(0)
    expect(screen.queryByText('$ 1.250.000')).toBeNull()
    expect(fetchMock).toHaveBeenCalledWith('/api/turnos', expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer staff-token' }) }))
  })

  it('does not send administrators from treatments to the patients page', () => {
    renderDashboard('ADMINISTRADOR')
    const treatmentsCard = screen.getByRole('heading', { name: 'Tratamientos registrados' }).closest('section')!
    expect(within(treatmentsCard).queryByRole('link', { name: /Ver pacientes/ })).toBeNull()
  })

  it('prioritizes clinical work for odontologists', () => {
    renderDashboard('ODONTOLOGO')
    expect(screen.getByRole('heading', { name: 'Espacio clínico' })).not.toBeNull()
    expect(screen.getByRole('link', { name: /Abrir odontograma/i }).getAttribute('href')).toBe('/odontograma')
    expect(screen.getByRole('link', { name: /Revisar reportes/i }).getAttribute('href')).toBe('/seguimiento')
  })

  it('does not offer clinical editing shortcuts to reception', () => {
    renderDashboard('RECEPCIONISTA')
    expect(screen.getByRole('heading', { name: 'Gestión de recepción' })).not.toBeNull()
    expect(screen.getAllByRole('link', { name: /Ver pacientes/i })[0].getAttribute('href')).toBe('/pacientes')
    expect(screen.queryByRole('link', { name: /Abrir odontograma/i })).toBeNull()
    expect(screen.queryByRole('link', { name: /Revisar reportes/i })).toBeNull()
  })

  it('shows real appointments and clinic patients on reception dashboard', async () => {
    renderDashboard('RECEPCIONISTA')
    expect((await screen.findAllByText(/Ana Nieto/)).length).toBeGreaterThan(0)
    expect(screen.getByText(/Control/)).not.toBeNull()
    expect(screen.queryByText('María González')).toBeNull()
  })
})
