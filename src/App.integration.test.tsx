import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import App from './App'
import { CATALOG, CONSENT_TEXT, VERSION } from './pages/Odontograma.jsx'

const fetchMock = vi.fn()
const patient = {
  id: 1,
  nombre: 'Ana',
  apellido: 'Nieto',
  dni: '44239570',
  telefono: '1100000000',
  email: 'ana@example.com',
  fechaNacimiento: '1990-05-20',
}

vi.mock('react-signature-canvas', async () => {
  const { forwardRef, useImperativeHandle } = await import('react')
  return {
    default: forwardRef(function SignatureMock(_props, ref) {
      useImperativeHandle(ref, () => ({ isEmpty: () => true, clear() {}, toDataURL: () => '', getCanvas: () => null }))
      return <canvas aria-label="Área para dibujar firma manuscrita" />
    }),
  }
})

function response(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => 'application/json' },
    json: async () => body,
    text: async () => typeof body === 'string' ? body : JSON.stringify(body),
  }
}

async function login() {
  window.history.replaceState({}, '', '/')
  render(<App />)
  fireEvent.change(screen.getByLabelText('Usuario o correo electrónico'), { target: { value: 'admin' } })
  fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'demo-password' } })
  fireEvent.click(screen.getByRole('button', { name: 'Ingresar' }))
  await screen.findByRole('heading', { name: 'Bienvenido al Sistema Odontológico Novadent' })
}

afterEach(() => {
  cleanup()
  window.history.replaceState({}, '', '/')
  sessionStorage.clear()
  vi.unstubAllGlobals()
  fetchMock.mockReset()
})

describe('frontend backed by the local API', () => {
  it('logs in against Spring Boot, keeps the session for this tab, and logs out', async () => {
    fetchMock.mockResolvedValueOnce(response({ token: 'jwt-from-backend', tokenType: 'Bearer', expiresIn: 900 }))
    vi.stubGlobal('fetch', fetchMock)

    await login()

    expect(fetchMock).toHaveBeenCalledWith('/api/auth/login', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ usernameOrEmail: 'admin', password: 'demo-password' }),
    }))
    await waitFor(() => expect(sessionStorage.getItem('novadent.auth.session')).toContain('jwt-from-backend'))

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }))

    expect(await screen.findByRole('heading', { name: 'Ingresar a Novadent' })).toBeInTheDocument()
    expect(sessionStorage.getItem('novadent.auth.session')).toBeNull()
  })

  it('lists patients and creates one through the API contract', async () => {
    fetchMock
      .mockResolvedValueOnce(response({ token: 'jwt-from-backend', tokenType: 'Bearer', expiresIn: 900 }))
      .mockResolvedValueOnce(response([patient]))
      .mockResolvedValueOnce(response('Paciente registrado correctamente'))
      .mockResolvedValueOnce(response([{ ...patient, id: 2, nombre: 'Martino', apellido: 'Costigliolo' }]))
    vi.stubGlobal('fetch', fetchMock)

    await login()
    fireEvent.click(screen.getByRole('link', { name: 'Pacientes' }))
    expect(await screen.findByText('Ana Nieto')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Nuevo Paciente' }))
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Martino' } })
    fireEvent.change(screen.getByLabelText('Apellido'), { target: { value: 'Costigliolo' } })
    fireEvent.change(screen.getByLabelText('DNI'), { target: { value: '45340586' } })
    fireEvent.change(screen.getByLabelText('Teléfono'), { target: { value: '1122334455' } })
    fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: 'martino@example.com' } })
    fireEvent.change(screen.getByLabelText('Fecha de nacimiento'), { target: { value: '2004-08-11' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar paciente' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/pacientes', expect.objectContaining({ method: 'POST' })))
    expect(JSON.parse(fetchMock.mock.calls[2][1].body)).toEqual({
      nombre: 'Martino', apellido: 'Costigliolo', dni: '45340586', telefono: '1122334455',
      email: 'martino@example.com', fechaNacimiento: '2004-08-11',
    })
    expect(fetchMock.mock.calls[2][1].headers.Authorization).toBe('Bearer jwt-from-backend')
    expect(await screen.findByText('Martino Costigliolo')).toBeInTheDocument()
  })

  it('updates and deletes patients through PUT and DELETE', async () => {
    fetchMock
      .mockResolvedValueOnce(response({ token: 'jwt-from-backend', tokenType: 'Bearer', expiresIn: 900 }))
      .mockResolvedValueOnce(response([patient]))
      .mockResolvedValueOnce(response({ ...patient, nombre: 'Ana María' }))
      .mockResolvedValueOnce(response([ { ...patient, nombre: 'Ana María' } ]))
      .mockResolvedValueOnce(response(null, 204))
      .mockResolvedValueOnce(response([]))
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    await login()
    fireEvent.click(screen.getByRole('link', { name: 'Pacientes' }))
    const row = await screen.findByRole('row', { name: /Ana Nieto/ })
    fireEvent.click(within(row).getByRole('button', { name: 'Editar Ana Nieto' }))
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Ana María' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    expect(await screen.findByText('Ana María Nieto')).toBeInTheDocument()
    expect(fetchMock.mock.calls[2][0]).toBe('/api/pacientes/1')
    expect(fetchMock.mock.calls[2][1].method).toBe('PUT')

    fireEvent.click(screen.getByRole('button', { name: 'Eliminar Ana María Nieto' }))
    await waitFor(() => expect(fetchMock.mock.calls.some(([url, options]) => url === '/api/pacientes/1' && options.method === 'DELETE')).toBe(true))
    expect(await screen.findByText('No hay pacientes registrados.')).toBeInTheDocument()
  })

  it('passes the authenticated token to the backend odontogram without asking for it again', async () => {
    const catalog = { versionCatalogo: VERSION, versionConsentimiento: VERSION, textoConsentimiento: CONSENT_TEXT, afecciones: CATALOG }
    fetchMock
      .mockResolvedValueOnce(response({ token: 'jwt-from-backend', tokenType: 'Bearer', expiresIn: 900 }))
      .mockResolvedValueOnce(response(catalog))
    vi.stubGlobal('fetch', fetchMock)

    await login()
    fireEvent.click(screen.getByRole('link', { name: 'Odontograma' }))

    await screen.findByRole('heading', { name: 'Odontograma y presupuesto' })
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    expect(await screen.findByText(/Catálogo verificado/)).toBeInTheDocument()
    expect(fetchMock.mock.calls[1][0]).toBe('/api/odontograma/catalogo')
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe('Bearer jwt-from-backend')
    expect(screen.queryByLabelText('Token Bearer (solo en memoria)')).not.toBeInTheDocument()
  })
})
