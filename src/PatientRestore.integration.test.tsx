import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import App from './App'

function response(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status,
    headers: { get: () => 'application/json' }, json: async () => body,
    text: async () => JSON.stringify(body) }
}

function session() {
  sessionStorage.setItem('novadent.auth.session', JSON.stringify({
    token: 'patient-test-token', tokenType: 'Bearer', username: 'paciente',
    role: 'PACIENTE', expiresAt: Date.now() + 60000,
  }))
}

afterEach(() => {
  cleanup()
  sessionStorage.clear()
  window.history.replaceState({}, '', '/')
  vi.unstubAllGlobals()
})

describe('patient portal and assistant integration', () => {
  it('retains the clinic image behind the login form', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: 'Ingresar a Novadent' })).toBeInTheDocument()
    expect(document.querySelector('img[src="/images/novadent-consultorio.png"]')).not.toBeNull()
  })

  it('restores the patient dashboard and lets the patient open the assistant', async () => {
    session()
    vi.stubGlobal('fetch', vi.fn(async (url: string) => url.endsWith('/perfil')
      ? response({ id: 1, nombre: 'Ana', apellido: 'Nieto', dni: '1', email: 'ana@example.com', fechaNacimiento: '2000-01-01' })
      : response([])))
    render(<App />)
    expect(await screen.findByRole('heading', { level: 1, name: 'Inicio' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Mi seguimiento/ })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('link', { name: /Asistente IA/ }))
    expect(await screen.findByRole('heading', { name: 'Consultas con fuentes' })).toBeInTheDocument()
  })

  it('keeps the assistant accessible when the patient has no linked profile', async () => {
    session()
    vi.stubGlobal('fetch', vi.fn(async () => response({ message: 'No encontrado' }, 404)))
    render(<App />)
    expect(await screen.findByRole('link', { name: /Asistente IA/ })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('link', { name: /Asistente IA/ }))
    expect(await screen.findByRole('heading', { name: 'Consultas con fuentes' })).toBeInTheDocument()
  })
})
