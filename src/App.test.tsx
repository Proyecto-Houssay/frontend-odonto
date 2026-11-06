import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { AUTH_SESSION_KEY } from './auth/context'
import App from './App'

afterEach(() => {
  cleanup()
  sessionStorage.clear()
  window.history.replaceState({}, '', '/')
  vi.unstubAllGlobals()
})

describe('App authentication and role navigation', () => {
  it('requires authentication before opening reports', async () => {
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Ingresar a Novadent' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Informes' })).not.toBeInTheDocument()
  })

  it('redirects an unauthenticated visit to reports to the login screen', async () => {
    window.history.replaceState({}, '', '/informes')
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Ingresar a Novadent' })).toBeInTheDocument()
  })

  it('exposes operational reports to staff and keeps the demo report separate', async () => {
    sessionStorage.setItem(AUTH_SESSION_KEY, JSON.stringify({
      token: 'admin-token', tokenType: 'Bearer', username: 'admin', role: 'ADMINISTRADOR', expiresAt: Date.now() + 60_000,
    }))

    render(<App />)

    expect(await screen.findByRole('link', { name: 'Informes', exact: true })).toHaveAttribute('href', '/informes')
    expect(screen.getByRole('link', { name: 'Informes (demo)' })).toHaveAttribute('href', '/informes/demo')
  })

  it('does not expose staff reports in the patient portal', async () => {
    sessionStorage.setItem(AUTH_SESSION_KEY, JSON.stringify({
      token: 'patient-token', tokenType: 'Bearer', username: 'patient', role: 'PACIENTE', expiresAt: Date.now() + 60_000,
    }))
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 200 })))

    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Inicio' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Informes' })).not.toBeInTheDocument()
  })
})
