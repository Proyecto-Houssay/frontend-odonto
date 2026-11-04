import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import App from './App'

afterEach(() => {
  cleanup()
  sessionStorage.clear()
  window.history.replaceState({}, '', '/')
  vi.unstubAllGlobals()
})

describe('App authentication and role navigation', () => {
  it('requires login and only exposes the chatbot to a PATIENT', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:8080')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      token: 'patient-token', role: 'PATIENT', expiresInSeconds: 3600,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })))

    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Informes' })).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Usuario o email'), { target: { value: 'patient-test' } })
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'secret' } })
    fireEvent.click(screen.getByRole('button', { name: 'Ingresar' }))

    expect(await screen.findByRole('heading', { name: 'Consultas con fuentes' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Asistente' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Informes' })).not.toBeInTheDocument()
  })

  it('redirects an unauthenticated visit to reports to the login screen', async () => {
    window.history.replaceState({}, '', '/informes')
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument()
  })
})
