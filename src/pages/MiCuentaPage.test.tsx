import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { MiCuentaPage } from './MiCuentaPage'

vi.mock('../auth/useAuth', () => ({
  useAuth: () => ({
    session: { token: 'user-token', role: 'RECEPCIONISTA', username: 'ana.gomez' },
  }),
}))

const jsonResponse = (body: unknown, status = 200) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    text: async () => (body === null ? '' : JSON.stringify(body)),
  }) as Response

describe('MiCuentaPage', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('loads own profile and inbox, updates display name after 200 OK, and marks a message as read', async () => {
    let perfil = {
      id: 5,
      username: 'ana.gomez',
      nombreMostrar: 'Ana Gómez',
      email: 'ana.gomez@novadent.com',
      rol: 'RECEPCIONISTA',
      fotoBase64: null,
    }

    const mensajes = [
      {
        id: 101,
        destinatarioId: 5,
        remitenteId: 1,
        remitenteNombre: 'Administración NovaDent',
        asunto: 'Actualización de horarios de recepción',
        contenido: 'A partir del lunes el turno mañana inicia a las 08:00 hs.',
        leido: false,
        creadoEn: '2026-11-18T10:30:00',
        leidoEn: null as string | null,
      },
    ]

    fetchMock.mockImplementation((path: string, options?: { method?: string; body?: string }) => {
      if (path === '/api/mi-cuenta/perfil' && (!options?.method || options.method === 'GET')) {
        return Promise.resolve(jsonResponse(perfil))
      }
      if (path === '/api/mi-cuenta/perfil' && options?.method === 'PUT') {
        const parsed = JSON.parse(options.body || '{}')
        perfil = { ...perfil, nombreMostrar: parsed.nombreMostrar }
        return Promise.resolve(jsonResponse(perfil))
      }
      if (path === '/api/mi-cuenta/mensajes' && (!options?.method || options.method === 'GET')) {
        return Promise.resolve(jsonResponse([...mensajes]))
      }
      if (path === '/api/mi-cuenta/mensajes/101/leido' && options?.method === 'PUT') {
        mensajes[0] = { ...mensajes[0], leido: true, leidoEn: '2026-11-18T11:00:00' }
        return Promise.resolve(jsonResponse(mensajes[0]))
      }
      return Promise.resolve(jsonResponse([]))
    })

    render(
      <MemoryRouter>
        <MiCuentaPage />
      </MemoryRouter>
    )

    // Verifica perfil y rol de solo lectura
    expect(await screen.findByTestId('profile-username')).not.toBeNull()
    expect(screen.getByTestId('profile-username').textContent).toBe('@ana.gomez')
    expect(screen.getByTestId('profile-role').textContent).toContain('RECEPCIONISTA')
    expect(screen.getByTestId('unread-count-badge').textContent).toBe('1 sin leer')

    // Actualizar nombre para mostrar
    const nameInput = screen.getByLabelText('Nombre para mostrar')
    fireEvent.change(nameInput, { target: { value: 'Ana M. Gómez' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar nombre para mostrar' }))

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/mi-cuenta/perfil',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ nombreMostrar: 'Ana M. Gómez' }),
        })
      )
    )
    expect(await screen.findByText('Nombre para mostrar guardado correctamente.')).not.toBeNull()

    // Marcar mensaje como leído
    expect(screen.getByText('Actualización de horarios de recepción')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Marcar como leído/i }))

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/mi-cuenta/mensajes/101/leido',
        expect.objectContaining({ method: 'PUT' })
      )
    )
    expect(await screen.findByText(/marcado como leído/i)).not.toBeNull()
    expect(screen.getByTestId('unread-count-badge').textContent).toBe('0 sin leer')
  })

  it('rejects invalid file format and shows empty inbox state honestly', async () => {
    fetchMock.mockImplementation((path: string) => {
      if (path === '/api/mi-cuenta/perfil') {
        return Promise.resolve(
          jsonResponse({
            id: 5,
            username: 'ana.gomez',
            nombreMostrar: 'Ana Gómez',
            email: 'ana.gomez@novadent.com',
            rol: 'RECEPCIONISTA',
            fotoBase64: null,
          })
        )
      }
      if (path === '/api/mi-cuenta/mensajes') {
        return Promise.resolve(jsonResponse([]))
      }
      return Promise.resolve(jsonResponse([]))
    })

    render(
      <MemoryRouter>
        <MiCuentaPage />
      </MemoryRouter>
    )

    expect(await screen.findByText('No tenés mensajes en tu buzón')).not.toBeNull()

    // Intentar seleccionar un archivo PDF inválido
    const fileInput = screen.getByLabelText(/Foto de perfil/i)
    const invalidFile = new File(['contenido-pdf'], 'documento.pdf', {
      type: 'application/pdf',
    })
    fireEvent.change(fileInput, { target: { files: [invalidFile] } })

    expect(
      await screen.findByText(/Formato de archivo no válido\. Solo se permiten imágenes PNG o JPEG/i)
    ).not.toBeNull()
    expect(fetchMock).not.toHaveBeenCalledWith(
      '/api/mi-cuenta/foto',
      expect.objectContaining({ method: 'PUT' })
    )
  })

  it('displays error banner when backend returns 401/403 without faking success', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ mensaje: 'No tenés permiso para realizar esta acción.' }, 403)
    )

    render(
      <MemoryRouter>
        <MiCuentaPage />
      </MemoryRouter>
    )

    expect(
      await screen.findByText('No tenés permiso para realizar esta acción.')
    ).not.toBeNull()
  })
})
