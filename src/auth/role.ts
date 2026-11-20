export type UserRole = 'ADMINISTRADOR' | 'ODONTOLOGO' | 'RECEPCIONISTA' | 'PACIENTE'

const ROLES: UserRole[] = ['ADMINISTRADOR', 'ODONTOLOGO', 'RECEPCIONISTA', 'PACIENTE']

// UI routing only. The backend must enforce every authorization decision.
export function roleFromToken(token: string): UserRole | null {
  try {
    const payload = token.split('.')[1]
    if (!payload) return null
    const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))) as { role?: unknown }
    return ROLES.includes(decoded.role as UserRole) ? decoded.role as UserRole : null
  } catch {
    return null
  }
}
