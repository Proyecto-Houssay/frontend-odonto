import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import App from './App.tsx'

vi.mock('react-signature-canvas', async () => {
  const { forwardRef, useImperativeHandle } = await import('react')
  return { default: forwardRef(function SignatureMock(_props, ref) {
    useImperativeHandle(ref, () => ({ isEmpty: () => true, clear() {}, toDataURL: () => '', getCanvas: () => null }))
    return <canvas aria-label="Área para dibujar firma manuscrita" />
  }) }
})

afterEach(() => {
  cleanup()
  sessionStorage.clear()
  window.history.replaceState({}, '', '/')
})

describe('odontogram routes', () => {
  it('exposes the explicit API-backed route using the app session and local-only guidance', async () => {
    sessionStorage.setItem('novadent.auth.session', JSON.stringify({
      token: 'test-token', tokenType: 'Bearer', username: 'admin', expiresAt: Date.now() + 60000,
    }))
    window.history.replaceState({}, '', '/odontograma/backend')
    render(<App />)

    expect(await screen.findByLabelText('ID de paciente')).toBeInTheDocument()
    expect(screen.queryByLabelText('Token Bearer (solo en memoria)')).not.toBeInTheDocument()
    expect(screen.getByRole('note')).toHaveTextContent('Una página abierta desde Vercel no puede acceder al backend ni a la base local')
    expect(screen.queryByText(/Modo demostración/)).not.toBeInTheDocument()
  })
})
