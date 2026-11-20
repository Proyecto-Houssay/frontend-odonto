import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { AuthProvider } from '../auth/AuthProvider'
import { FaceCheckin, calibrateBiometricSimilarity } from './FaceCheckin'

function renderWithSession(role = 'RECEPCIONISTA', initialDni = '') {
  const token = `header.${btoa(JSON.stringify({ role }))}.signature`
  sessionStorage.setItem('novadent.auth.session', JSON.stringify({
    token, username: 'staff', role, expiresAt: Date.now() + 60_000,
  }))
  return render(
    <AuthProvider>
      <FaceCheckin initialDni={initialDni} onVerified={() => undefined} />
    </AuthProvider>
  )
}

afterEach(() => {
  cleanup()
  sessionStorage.clear()
  vi.unstubAllGlobals()
})

describe('FaceCheckin component', () => {
  it('does not render when no authenticated session is present', () => {
    render(<FaceCheckin onVerified={() => undefined} />)
    expect(screen.queryByText(/Check-in de pacientes/i)).toBeNull()
  })

  it('renders check-in interface and instructions for authenticated staff', () => {
    renderWithSession('RECEPCIONISTA')
    expect(screen.getByRole('heading', { name: /Check-in de pacientes/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/Elegir foto de referencia/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/DNI para buscar la ficha/i)).toBeInTheDocument()
    expect(screen.getByText(/Consiento la comparación facial/i)).toBeInTheDocument()
  })

  it('enforces explicit consent before permitting camera activation or verification', () => {
    renderWithSession('RECEPCIONISTA')
    const cameraButton = screen.getByRole('button', { name: /Permitir cámara/i })
    const verifyButton = screen.getByRole('button', { name: /Verificar rostro/i })
    const consentCheckbox = screen.getByRole('checkbox', { name: /Consiento la comparación facial/i })

    expect(cameraButton).toBeDisabled()
    expect(verifyButton).toBeDisabled()
    expect(consentCheckbox).not.toBeChecked()

    fireEvent.click(consentCheckbox)
    expect(consentCheckbox).toBeChecked()
    expect(cameraButton).not.toBeDisabled()
    expect(verifyButton).not.toBeDisabled()
  })

  it('updates DNI input correctly and allows clearing initialDni without snapping back', () => {
    renderWithSession('PACIENTE', '46701892')
    const dniInput = screen.getByPlaceholderText(/Ingresá el DNI/i) as HTMLInputElement
    expect(dniInput.value).toBe('46701892')

    // Clearing the input via backspace must NOT snap back to 46701892
    fireEvent.change(dniInput, { target: { value: '' } })
    expect(dniInput.value).toBe('')

    // Typing a new DNI works cleanly
    fireEvent.change(dniInput, { target: { value: '44721264' } })
    expect(dniInput.value).toBe('44721264')

    // Using the clear button resets the DNI input
    const clearBtn = screen.getByRole('button', { name: /Limpiar \/ Escribir otro DNI/i })
    fireEvent.click(clearBtn)
    expect(dniInput.value).toBe('')
  })

  it('calibrates physical DNI card similarity scores accurately', () => {
    expect(calibrateBiometricSimilarity(0.36)).toBeGreaterThanOrEqual(0.84)
    expect(calibrateBiometricSimilarity(0.58)).toBeGreaterThanOrEqual(0.92)
    expect(calibrateBiometricSimilarity(0.20)).toBeLessThan(0.75)
  })
})
