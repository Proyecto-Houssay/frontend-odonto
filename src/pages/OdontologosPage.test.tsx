import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { OdontologosPage } from './OdontologosPage'

vi.mock('../auth/useAuth', () => ({
  useAuth: () => ({ session: { token: 'admin-token', role: 'ADMINISTRADOR', username: 'admin' } }),
}))

const jsonResponse = (body: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  text: async () => (body === null ? '' : JSON.stringify(body)),
}) as Response

describe('OdontologosPage', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('loads dentists, specialties, and appointments, and allows registering a dentist and specialty', async () => {
    const dentists = [
      {
        id: 1,
        nombre: 'Martín',
        apellido: 'Sánchez',
        matricula: 'MN-4401',
        email: 'msanchez@novadent.com',
        telefono: '1144556677',
        activo: true,
        especialidad: { id: 10, nombre: 'Ortodoncia', descripcion: 'Alineación dental' },
      },
    ]

    const especialidades = [
      { id: 10, nombre: 'Ortodoncia', descripcion: 'Alineación dental' },
    ]

    const turnos = [
      { id: 100, fecha: '2099-11-15', hora: '10:00:00', estado: 'CONFIRMADO', odontologo: { id: 1 } },
    ]

    fetchMock.mockImplementation((path: string, options?: { method?: string; body?: string }) => {
      if (path === '/api/odontologos' && (!options?.method || options.method === 'GET')) {
        return Promise.resolve(jsonResponse([...dentists]))
      }
      if (path === '/api/especialidades' && (!options?.method || options.method === 'GET')) {
        return Promise.resolve(jsonResponse([...especialidades]))
      }
      if (path === '/api/turnos') {
        return Promise.resolve(jsonResponse(turnos))
      }
      if (path === '/api/especialidades' && options?.method === 'POST') {
        const parsed = JSON.parse(options.body || '{}')
        const created = { id: 11, ...parsed }
        especialidades.push(created)
        return Promise.resolve(jsonResponse(created, 201))
      }
      if (path === '/api/odontologos' && options?.method === 'POST') {
        const parsed = JSON.parse(options.body || '{}')
        const created = {
          id: 2,
          ...parsed,
          especialidad: especialidades.find(e => e.id === parsed.especialidad?.id) || especialidades[0],
        }
        dentists.push(created)
        return Promise.resolve(jsonResponse(created, 201))
      }
      if (path === '/api/odontologos/alta-completa' && options?.method === 'POST') {
        const parsed = JSON.parse(options.body || '{}')
        const created = {
          id: 3,
          nombre: String(parsed.nombre || ''),
          apellido: String(parsed.apellido || ''),
          matricula: String(parsed.matricula || ''),
          email: String(parsed.email || 'lmendez@novadent.com'),
          telefono: String(parsed.telefono || '1144556677'),
          activo: true,
          especialidad: {
            id: 12,
            nombre: String(parsed.nuevaEspecialidadNombre || 'Ortodoncia'),
            descripcion: 'Especialidad clínica',
          },
        }
        dentists.push(created)
        return Promise.resolve(jsonResponse(created, 201))
      }
      return Promise.resolve(jsonResponse([]))
    })

    render(
      <MemoryRouter>
        <OdontologosPage />
      </MemoryRouter>
    )

    expect(await screen.findByText(/Dr\.\/Dra\. Martín Sánchez/i)).not.toBeNull()
    expect(screen.getByText('MP MN-4401')).not.toBeNull()
    expect(screen.getByTestId('kpi-total-dentists').textContent).toBe('1')
    expect(screen.getByTestId('kpi-assigned-appointments').textContent).toBe('1')

    // Crear nueva especialidad
    fireEvent.click(screen.getByRole('button', { name: /Gestionar Especialidades/i }))
    fireEvent.change(screen.getByLabelText('Nombre de la especialidad'), { target: { value: 'Endodoncia' } })
    fireEvent.click(screen.getByRole('button', { name: 'Agregar especialidad' }))

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/especialidades',
        expect.objectContaining({ method: 'POST' })
      )
    )

    // Registrar nuevo odontólogo
    fireEvent.click(screen.getByRole('button', { name: /\+ Registrar Odontólogo/i }))
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Valeria' } })
    fireEvent.change(screen.getByLabelText('Apellido'), { target: { value: 'Paz' } })
    fireEvent.change(screen.getByLabelText('Matrícula profesional'), { target: { value: 'MN-9921' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar odontólogo' }))

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/odontologos',
        expect.objectContaining({ method: 'POST' })
      )
    )
    expect(await screen.findByRole('heading', { name: /Dr\.\/Dra\. Valeria Paz/i })).not.toBeNull()

    // Registrar odontólogo con nueva especialidad y cuenta de usuario (alta-completa)
    fireEvent.click(screen.getByRole('button', { name: /\+ Registrar Odontólogo/i }))
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Lucas' } })
    fireEvent.change(screen.getByLabelText('Apellido'), { target: { value: 'Méndez' } })
    fireEvent.change(screen.getByLabelText('Matrícula profesional'), { target: { value: 'MN-7788' } })
    fireEvent.change(screen.getByLabelText('Especialidad'), { target: { value: 'NUEVA' } })
    fireEvent.change(screen.getByLabelText('Nombre de la nueva especialidad'), { target: { value: 'Implantología' } })
    fireEvent.click(screen.getByLabelText('Crear cuenta de acceso (login) como Odontólogo'))
    fireEvent.change(screen.getByLabelText('Usuario de acceso (login)'), { target: { value: 'dr.mendez' } })
    fireEvent.change(screen.getByLabelText('Contraseña inicial'), { target: { value: 'Odonto123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar odontólogo' }))

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/odontologos/alta-completa',
        expect.objectContaining({ method: 'POST' })
      )
    )
    expect(await screen.findByRole('heading', { name: /Dr\.\/Dra\. Lucas Méndez/i })).not.toBeNull()
  })
})
