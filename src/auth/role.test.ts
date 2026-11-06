import { describe, expect, it } from 'vitest'
import { roleFromToken } from './role'

describe('roleFromToken', () => {
  it('reads only known roles from the JWT payload', () => {
    const token = `header.${btoa(JSON.stringify({ role: 'PACIENTE' }))}.signature`
    expect(roleFromToken(token)).toBe('PACIENTE')
    expect(roleFromToken('not-a-token')).toBeNull()
    expect(roleFromToken(`header.${btoa(JSON.stringify({ role: 'ADMINISTRADOR_FAKE' }))}.signature`)).toBeNull()
  })
})
