export type ApiError = Error & { status?: number }

export async function apiRequest<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init.body && !(init.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      Authorization: `Bearer ${token}`,
      ...init.headers,
    },
  })

  if (!response.ok) {
    const body = await response.text()
    const error = new Error(body || `La API respondió ${response.status}`) as ApiError
    error.status = response.status
    throw error
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export function errorMessage(error: unknown) {
  if (error && typeof error === 'object' && 'status' in error) {
    const status = (error as ApiError).status
    if (status === 401) return 'La sesión venció. Iniciá sesión nuevamente.'
    if (status === 403) return 'Tu rol no tiene permiso para consultar estos datos.'
  }
  return error instanceof Error ? error.message : 'No se pudo conectar con el backend.'
}

export type UserProfile = {
  id: number
  username: string
  nombre: string
  apellido: string
  email: string
  rol: 'ADMINISTRADOR' | 'ODONTOLOGO' | 'RECEPCIONISTA'
  activo: boolean
  telefono?: string
  perfilVinculado?: { tipo: string; perfilId: number | null; cargo?: string; matricula?: string; especialidad?: string }
}

export type AuthContextValue = {
  token: string | null
  user: UserProfile | null
  login: (usernameOrEmail: string, password: string) => Promise<void>
  logout: () => void
}
