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
  it('shows reception modules without clinical odontogram or clinical follow-up', () => {
    renderAs('RECEPCIONISTA')
    expect(screen.getByRole('link', { name: 'Pacientes' })).not.toBeNull()
    expect(screen.getByRole('link', { name: 'Turnos' })).not.toBeNull()
    expect(screen.getByRole('link', { name: 'Check-in facial' })).not.toBeNull()
    expect(screen.getByRole('link', { name: 'Asistente IA' })).not.toBeNull()
    expect(screen.queryByRole('link', { name: 'Odontograma' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Seguimiento' })).toBeNull()
    expect(screen.queryByRole('link', { name: /Dra\. Ziegler/i })).toBeNull()
  })

  it('shows only administration and staff management modules to administrators', () => {
    renderAs('ADMINISTRADOR')
    expect(screen.getByRole('link', { name: 'Odontólogos' })).not.toBeNull()
    expect(screen.getByRole('link', { name: 'Personal y Directorio' })).not.toBeNull()
    expect(screen.getByRole('link', { name: 'Gestión de Usuarios' })).not.toBeNull()
    expect(screen.getByRole('link', { name: 'Informes' })).not.toBeNull()
    expect(screen.queryByRole('link', { name: 'Pacientes' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Odontograma' })).toBeNull()
  })

  it('shows clinical shortcuts and the larger brand to the odontologist', () => {
    renderAs('ODONTOLOGO')
    expect(screen.getByRole('link', { name: 'Odontograma' })).not.toBeNull()
    expect(screen.getByRole('link', { name: 'Seguimiento' })).not.toBeNull()
    expect(screen.getByRole('link', { name: /Dra\. Ziegler/i })).not.toBeNull()
    expect(screen.queryByRole('link', { name: 'Gestión de Usuarios' })).toBeNull()
    expect(screen.getByLabelText('NovaDent · Consultorio odontológico')).not.toBeNull()
  })
})
