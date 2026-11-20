import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { UsuariosPage } from './UsuariosPage'

vi.mock('../auth/useAuth', () => ({
  useAuth: () => ({ session: { token: 'admin-token', role: 'ADMINISTRADOR', username: 'admin' } }),
}))

const jsonResponse = (body: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  text: async () => (body === null ? '' : JSON.stringify(body)),
}) as Response

describe('UsuariosPage', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('lists users, creates a new user, toggles active state, and links a patient account', async () => {
    const initialUsers = [
      {
        id: 1,
        username: 'admin',
        nombre: 'Sofía',
        apellido: 'Ríos',
        email: 'sofia@novadent.com',
        rol: 'ADMINISTRADOR',
        activo: true,
        telefono: '1122334455',
      },
      {
        id: 2,
        username: 'pac.ana',
        nombre: 'Ana',
        apellido: 'Nieto',
        email: 'ana@example.com',
        rol: 'PACIENTE',
        activo: true,
        telefono: '1199887766',
      },
    ]

    const patients = [
      { id: 10, nombre: 'Ana', apellido: 'Nieto', dni: '44239570', email: 'ana@example.com' },
    ]

    fetchMock.mockImplementation((path: string, options?: { method?: string; body?: string }) => {
      if (path === '/api/usuarios' && (!options?.method || options.method === 'GET')) {
        return Promise.resolve(jsonResponse(initialUsers))
      }
      if (path === '/api/pacientes') {
        return Promise.resolve(jsonResponse(patients))
      }
      if (path === '/api/usuarios' && options?.method === 'POST') {
        const parsed = JSON.parse(options.body || '{}')
        const created = { id: 3, ...parsed }
        initialUsers.push(created)
        return Promise.resolve(jsonResponse(created, 201))
      }
      if (path === '/api/admin/vinculos-paciente/2' && options?.method === 'PUT') {
        return Promise.resolve(jsonResponse({ id: 10, dni: '44239570' }))
      }
      return Promise.resolve(jsonResponse([]))
    })

    render(
      <MemoryRouter>
        <UsuariosPage />
      </MemoryRouter>
    )

    expect(await screen.findByText('Sofía Ríos')).not.toBeNull()
    expect(screen.getByText('Ana Nieto')).not.toBeNull()
    expect(screen.getByTestId('kpi-total-users').textContent).toBe('2')

    // Crear un nuevo usuario
    fireEvent.click(screen.getByRole('button', { name: /\+ Nuevo Usuario/i }))
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Lucas' } })
    fireEvent.change(screen.getByLabelText('Apellido'), { target: { value: 'Méndez' } })
    fireEvent.change(screen.getByLabelText('Nombre de usuario'), { target: { value: 'lmendez' } })
    fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: 'lmendez@novadent.com' } })
    fireEvent.change(screen.getByLabelText('Rol del sistema'), { target: { value: 'ODONTOLOGO' } })
    fireEvent.change(screen.getByLabelText('Contraseña inicial'), { target: { value: 'clave123' } })
    fireEvent.change(screen.getByLabelText('Confirmar contraseña'), { target: { value: 'clave123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Crear usuario' }))

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/usuarios',
        expect.objectContaining({ method: 'POST' })
      )
    )
    expect(await screen.findByText('Lucas Méndez')).not.toBeNull()

    // Vincular ficha clínica a cuenta PACIENTE
    fireEvent.click(screen.getByRole('button', { name: /Vincular ficha/i }))
    fireEvent.click(screen.getByRole('button', { name: /Confirmar vínculo/i }))

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/admin/vinculos-paciente/2',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ pacienteId: 10, dniConfirmado: '44239570' }),
        })
      )
    )
    expect(await screen.findByText(/Ficha clínica vinculada correctamente/i)).not.toBeNull()
  })

  it('validates that initial password and confirmation match when creating a user', async () => {
    fetchMock.mockResolvedValue(jsonResponse([]))
    render(
      <MemoryRouter>
        <UsuariosPage />
      </MemoryRouter>
    )

    fireEvent.click(await screen.findByRole('button', { name: /\+ Nuevo Usuario/i }))
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Lucas' } })
    fireEvent.change(screen.getByLabelText('Apellido'), { target: { value: 'Méndez' } })
    fireEvent.change(screen.getByLabelText('Nombre de usuario'), { target: { value: 'lmendez' } })
    fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: 'lmendez@novadent.com' } })
    fireEvent.change(screen.getByLabelText('Contraseña inicial'), { target: { value: 'clave123' } })
    fireEvent.change(screen.getByLabelText('Confirmar contraseña'), { target: { value: 'otraClave' } })
    fireEvent.click(screen.getByRole('button', { name: 'Crear usuario' }))

    expect(await screen.findByText('Las contraseñas no coinciden.')).not.toBeNull()
    expect(fetchMock).not.toHaveBeenCalledWith('/api/usuarios', expect.objectContaining({ method: 'POST' }))
  })
})
