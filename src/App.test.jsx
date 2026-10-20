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
  window.history.replaceState({}, '', '/')
})

describe('odontogram routes', () => {
  it('exposes the explicit API-backed route with manual credentials and local-only guidance', async () => {
    window.history.replaceState({}, '', '/odontograma/backend')
    render(<App />)

    expect(await screen.findByLabelText('ID de paciente')).toBeInTheDocument()
    expect(screen.getByLabelText('Token Bearer (solo en memoria)')).toBeInTheDocument()
    expect(screen.getByRole('note')).toHaveTextContent('Una página abierta desde Vercel no puede acceder al backend ni a la base local')
    expect(screen.queryByText(/Modo demostración/)).not.toBeInTheDocument()
  })
})
