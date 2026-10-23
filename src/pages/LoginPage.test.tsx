import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import App from '../App'

const fetchMock = vi.fn()

function response(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => 'application/json' },
    text: async () => typeof body === 'string' ? body : JSON.stringify(body),
  }
}

afterEach(() => {
  cleanup()
  window.history.replaceState({}, '', '/')
  sessionStorage.clear()
  vi.unstubAllGlobals()
  fetchMock.mockReset()
})

describe('account access', () => {
  it('registers with the public API without sending a client-selected role', async () => {
    fetchMock.mockResolvedValueOnce(response({ emailSent: false, message: 'Cuenta creada. No se envió correo.' }, 201))
    vi.stubGlobal('fetch', fetchMock)
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Crear una cuenta' }))
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Ana' } })
    fireEvent.change(screen.getByLabelText('Apellido'), { target: { value: 'Nieto' } })
    fireEvent.change(screen.getByLabelText('Nombre de usuario'), { target: { value: 'ana.nieto' } })
    fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: 'ana@example.com' } })
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'demo-password-123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }))

    expect(await screen.findByText('Cuenta creada. No se envió correo.')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/register', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        username: 'ana.nieto', nombre: 'Ana', apellido: 'Nieto',
        email: 'ana@example.com', password: 'demo-password-123',
      }),
    }))
  })

  it('requests recovery without implying that the email exists when SMTP is unavailable', async () => {
    fetchMock.mockResolvedValueOnce(response({
      message: 'Si el correo corresponde a una cuenta activa, vas a recibir un enlace.',
      emailConfigured: false,
    }))
    vi.stubGlobal('fetch', fetchMock)
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: '¿Olvidaste tu contraseña?' }))
    fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: 'ana@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar enlace de recuperación' }))

    expect(await screen.findByText(/Si el correo corresponde a una cuenta activa/)).toBeInTheDocument()
    expect(screen.getByText(/El envío de correos no está configurado/)).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/password-reset/request', expect.objectContaining({
      method: 'POST', body: JSON.stringify({ email: 'ana@example.com' }),
    }))
  })

  it('submits a new password with the one-time token from the reset link', async () => {
    window.history.replaceState({}, '', '/?token=one-time-token')
    sessionStorage.setItem('novadent.auth.session', JSON.stringify({
      token: 'old-session-token', tokenType: 'Bearer', username: 'ana', expiresAt: Date.now() + 60_000,
    }))
    fetchMock.mockResolvedValueOnce(response(null, 204))
    vi.stubGlobal('fetch', fetchMock)
    render(<App />)

    expect(screen.getByRole('heading', { name: 'Restablecer contraseña' })).toBeInTheDocument()
    await waitFor(() => expect(sessionStorage.getItem('novadent.auth.session')).toBeNull())
    fireEvent.change(screen.getByLabelText('Nueva contraseña'), { target: { value: 'new-password-123' } })
    fireEvent.change(screen.getByLabelText('Repetir contraseña'), { target: { value: 'new-password-123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar nueva contraseña' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/auth/password-reset/confirm', expect.objectContaining({
      method: 'POST', body: JSON.stringify({ token: 'one-time-token', newPassword: 'new-password-123' }),
    })))
    expect(await screen.findByText('La contraseña se actualizó. Ya podés iniciar sesión.')).toBeInTheDocument()
  })
})
