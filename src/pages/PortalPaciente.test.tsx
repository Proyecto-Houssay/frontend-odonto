import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { PortalPaciente } from './PortalPaciente'

const response = (body: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  text: async () => typeof body === 'string' ? body : JSON.stringify(body),
}) as Response

function renderPortal(path = '/') {
  return render(<MemoryRouter initialEntries={[path]}><PortalPaciente token="patient-token" onLogout={() => {}} /></MemoryRouter>)
}

describe('PortalPaciente', () => {
  const fetchMock = vi.fn()
  beforeEach(() => { vi.stubGlobal('fetch', fetchMock); localStorage.clear(); delete document.documentElement.dataset.theme })
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks(); localStorage.clear(); delete document.documentElement.dataset.theme })

  it('uses a distinct page title for each patient section', async () => {
    fetchMock.mockImplementation((path: string) => Promise.resolve(response(path.endsWith('/perfil')
      ? { id: 7, nombre: 'Ana', apellido: 'Nieto', dni: '44239570', email: 'ana@example.com' }
      : [])))
    renderPortal()

    expect(await screen.findByRole('heading', { level: 1, name: 'Inicio' })).not.toBeNull()
    expect(screen.getByRole('main').style.backgroundImage).toContain('/images/novadent-consultorio.png')
    fireEvent.click(screen.getByRole('link', { name: 'Mis turnos' }))
    expect(screen.getByRole('heading', { level: 1, name: 'Tus turnos' })).not.toBeNull()
    fireEvent.click(screen.getByRole('link', { name: 'Mis tratamientos' }))
    expect(screen.getByRole('heading', { level: 1, name: 'Tus tratamientos' })).not.toBeNull()
    fireEvent.click(screen.getByRole('link', { name: 'Mis reportes' }))
    expect(screen.getByRole('heading', { level: 1, name: 'Tus reportes' })).not.toBeNull()
  })

  it('creates a patient profile before accepting a self-reported observation', async () => {
    fetchMock.mockResolvedValueOnce(response({ message: 'No profile' }, 404))
      .mockResolvedValueOnce(response({ id: 7, nombre: 'Ana', apellido: 'Nieto', dni: '44239570', email: 'ana@example.com' }, 201))
      .mockResolvedValueOnce(response({ id: 1, pacienteId: 7, pieza: 11, dolor: 3, sintomas: 'Molestia', estado: 'PENDIENTE' }, 201))
      .mockResolvedValueOnce(response([{ id: 1, pacienteId: 7, pieza: 11, dolor: 3, sintomas: 'Molestia', estado: 'PENDIENTE', fotoDisponible: false }]))

    renderPortal()
    fireEvent.change(await screen.findByLabelText('DNI'), { target: { value: '44239570' } })
    fireEvent.change(screen.getByLabelText('Fecha de nacimiento'), { target: { value: '2004-08-11' } })
    fireEvent.click(screen.getByRole('button', { name: 'Crear mi ficha' }))

    fireEvent.change(await screen.findByLabelText('Pieza dental'), { target: { value: '11' } })
    fireEvent.change(screen.getByLabelText('Síntomas'), { target: { value: 'Molestia' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar reporte' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/portal-paciente/reportes', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ Authorization: 'Bearer patient-token' }),
      body: expect.stringContaining('"pieza":11'),
    })))
    expect(await screen.findByText('Reporte enviado. Un odontólogo debe revisarlo; esto no es un diagnóstico.')).not.toBeNull()
  })

  it('offers an obvious photo picker while preserving the native file input', async () => {
    fetchMock.mockResolvedValueOnce(response({ id: 7, nombre: 'Ana', apellido: 'Nieto', dni: '44239570', email: 'ana@example.com' }))
      .mockResolvedValueOnce(response([]))

    renderPortal()

    const fileInput = await screen.findByLabelText('Foto opcional (PNG/JPEG, hasta 1 MB)')
    expect((fileInput as HTMLInputElement).type).toBe('file')
    expect(screen.getByText('Seleccionar foto')).not.toBeNull()
  })

  it('shows the real next appointment and navigates to distinct URL-backed views', async () => {
    const appointment = { id: 9, fecha: '2099-10-15', hora: '10:00:00', motivo: 'Control', estado: 'PROGRAMADO', odontologoNombre: 'Dra. Pérez' }
    const treatment = { id: 12, fecha: '2026-10-15', descripcion: 'Limpieza dental', estado: 'EN_CURSO' }
    const report = { id: 3, pacienteId: 7, pieza: 11, dolor: 3, sintomas: 'Molestia leve', estado: 'PENDIENTE' }
    fetchMock.mockImplementation((path: string) => {
      if (path.endsWith('/perfil')) return Promise.resolve(response({ id: 7, nombre: 'Ana', apellido: 'Nieto', dni: '44239570', email: 'ana@example.com' }))
      if (path.endsWith('/reportes')) return Promise.resolve(response([report]))
      if (path.endsWith('/turnos')) return Promise.resolve(response([appointment]))
      if (path.endsWith('/tratamientos')) return Promise.resolve(response([treatment]))
      throw new Error(`Unexpected API path: ${path}`)
    })
    renderPortal()

    expect(await screen.findByRole('heading', { name: 'Próximo turno' })).not.toBeNull()
    expect(screen.getByText('Dra. Pérez')).not.toBeNull()
    expect(screen.getByTestId('patient-summary-grid').className).toContain('lg:grid-cols-[1fr_auto]')
    fireEvent.click(screen.getByRole('link', { name: 'Mis turnos' }))
    expect(await screen.findByRole('heading', { name: 'Mis turnos' })).not.toBeNull()
    expect(screen.getByText('Control')).not.toBeNull()
    expect(screen.getByRole('link', { name: 'Mis turnos' }).getAttribute('aria-current')).toBe('page')
    expect(screen.queryByRole('button', { name: 'Diente 11' })).toBeNull()
    fireEvent.click(screen.getByRole('link', { name: 'Mis tratamientos' }))
    expect(await screen.findByRole('heading', { name: 'Mis tratamientos' })).not.toBeNull()
    expect(screen.getByText('Limpieza dental')).not.toBeNull()
    fireEvent.click(screen.getByRole('link', { name: 'Mis reportes' }))
    expect(await screen.findByRole('heading', { name: 'Mis reportes' })).not.toBeNull()
    expect(screen.getByText('Molestia leve')).not.toBeNull()
    fireEvent.click(screen.getByRole('link', { name: 'Mis datos' }))
    expect(await screen.findByRole('heading', { name: 'Mis datos' })).not.toBeNull()
    expect(screen.getByLabelText('Teléfono de contacto')).not.toBeNull()
    fireEvent.click(screen.getByRole('link', { name: 'Mi seguimiento' }))
    expect(await screen.findByRole('heading', { name: 'Mi seguimiento dental' })).not.toBeNull()
    expect(screen.getByRole('heading', { name: 'Evolución de mis observaciones' })).not.toBeNull()
    expect(screen.queryByRole('button', { name: 'Diente 11' })).toBeNull()
  })

  it('shows honest empty states for appointments and treatments', async () => {
    fetchMock.mockImplementation((path: string) => {
      if (path.endsWith('/perfil')) return Promise.resolve(response({ id: 7, nombre: 'Ana', apellido: 'Nieto', dni: '44239570', email: 'ana@example.com' }))
      return Promise.resolve(response([]))
    })
    renderPortal('/mis-turnos')
    expect(await screen.findByText('Todavía no tenés turnos registrados.')).not.toBeNull()
    fireEvent.click(screen.getByRole('link', { name: 'Mis tratamientos' }))
    expect(await screen.findByText('Todavía no tenés tratamientos registrados.')).not.toBeNull()
  })

  it('provides a dedicated read-only clinical odontogram instead of the report form', async () => {
    fetchMock.mockImplementation((path: string) => {
      if (path.endsWith('/perfil')) return Promise.resolve(response({ id: 7, nombre: 'Ana', apellido: 'Nieto', dni: '44239570', email: 'ana@example.com' }))
      if (path.endsWith('/odontograma')) return Promise.resolve(response({ registradoEn: null, piezas: [] }))
      return Promise.resolve(response([]))
    })
    renderPortal()
    fireEvent.click(await screen.findByRole('link', { name: 'Mi odontograma' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Mi odontograma' })).not.toBeNull()
    expect(await screen.findByText('Todavía no hay un odontograma profesional registrado para tu ficha.')).not.toBeNull()
    expect(screen.queryByLabelText('Síntomas')).toBeNull()
  })

  it('keeps DNI and email in My Data instead of exposing them on the home screen', async () => {
    fetchMock.mockImplementation((path: string) => Promise.resolve(response(path.endsWith('/perfil')
      ? { id: 7, nombre: 'Ana', apellido: 'Nieto', dni: '44239570', email: 'ana@example.com' }
      : [])))
    renderPortal()

    await screen.findByRole('heading', { level: 1, name: 'Inicio' })
    expect(screen.queryByText('44239570')).toBeNull()
    expect(screen.queryByText('ana@example.com')).toBeNull()
    expect(screen.queryByRole('button', { name: /^Diente / })).toBeNull()
    expect(screen.getByRole('heading', { name: 'Resumen de hoy' })).not.toBeNull()

    fireEvent.click(screen.getByRole('link', { name: 'Mis datos' }))
    expect(await screen.findByText('44239570')).not.toBeNull()
    expect(screen.getByText('ana@example.com')).not.toBeNull()
  })

  it('offers a persistent accessible dark-mode toggle', async () => {
    fetchMock.mockImplementation((path: string) => Promise.resolve(response(path.endsWith('/perfil')
      ? { id: 7, nombre: 'Ana', apellido: 'Nieto', dni: '44239570', email: 'ana@example.com' }
      : [])))
    renderPortal()

    const toggle = await screen.findByRole('button', { name: 'Activar modo oscuro' })
    fireEvent.click(toggle)
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(localStorage.getItem('novadent-theme')).toBe('dark')
    expect(screen.getByRole('button', { name: 'Activar modo claro' })).not.toBeNull()
  })
})
