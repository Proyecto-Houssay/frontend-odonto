import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider } from '../../auth/AuthProvider'
import { Sidebar } from './Sidebar'

function renderAs(role: string) {
  const token = `header.${btoa(JSON.stringify({ role }))}.signature`
  sessionStorage.setItem('novadent.auth.session', JSON.stringify({ token, username: 'demo', role, expiresAt: Date.now() + 60_000 }))
  render(<MemoryRouter><AuthProvider><Sidebar isOpen={false} onClose={() => {}} /></AuthProvider></MemoryRouter>)
}

afterEach(() => { cleanup(); sessionStorage.clear() })

describe('staff navigation', () => {
  it('allows reception to navigate to the read-only odontogram but not clinical follow-up', () => {
    renderAs('RECEPCIONISTA')
    expect(screen.getByRole('link', { name: 'Pacientes' })).not.toBeNull()
    expect(screen.getByRole('link', { name: 'Odontograma' })).not.toBeNull()
    expect(screen.queryByRole('link', { name: 'Seguimiento' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Dr. Annie (IA)' })).toBeNull()
  })

  it('shows clinical shortcuts and the larger brand to the odontologist', () => {
    renderAs('ODONTOLOGO')
    expect(screen.getByRole('link', { name: 'Odontograma' })).not.toBeNull()
    expect(screen.getByRole('link', { name: 'Seguimiento' })).not.toBeNull()
    expect(screen.getByRole('link', { name: 'Dr. Annie (IA)' })).not.toBeNull()
    expect(screen.getByLabelText('NovaDent · Consultorio odontológico')).not.toBeNull()
  })
})
