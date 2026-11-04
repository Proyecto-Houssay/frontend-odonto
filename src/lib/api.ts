export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
    this.name = 'ApiError'
  }
}

export type AppRole = 'ADMIN' | 'PATIENT' | 'ODONTOLOGO' | 'RECEPCIONISTA'
export type UserSession = { token: string; role: AppRole; expiresAt: number }
export type LoginResponse = { token: string; role: AppRole; expiresInSeconds: number }

const SESSION_KEY = 'novadent.session'

export function getSession(): UserSession | null {
  const raw = sessionStorage.getItem(SESSION_KEY)
  if (!raw) return null
  try {
    const session = JSON.parse(raw) as Partial<UserSession>
    const knownRole = ['ADMIN', 'PATIENT', 'ODONTOLOGO', 'RECEPCIONISTA'].includes(session.role ?? '')
    if (typeof session.token !== 'string' || !knownRole || !Number.isFinite(session.expiresAt) || (session.expiresAt ?? 0) <= Date.now()) {
      sessionStorage.removeItem(SESSION_KEY)
      return null
    }
    return session as UserSession
  } catch {
    sessionStorage.removeItem(SESSION_KEY)
    return null
  }
}

export function saveSession(response: LoginResponse): UserSession {
  const session = { token: response.token, role: response.role, expiresAt: Date.now() + response.expiresInSeconds * 1000 }
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))
  return session
}

export function clearSession() {
  sessionStorage.removeItem(SESSION_KEY)
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '')
  if (!apiBaseUrl) {
    throw new ApiError('Falta configurar VITE_API_BASE_URL para conectar con el backend.', 0)
  }

  let response: Response
  try {
    const headers = new Headers(init.headers)
    headers.set('Accept', 'application/json')
    const session = getSession()
    if (!path.startsWith('/api/auth/') && session) headers.set('Authorization', `Bearer ${session.token}`)
    if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
    response = await fetch(`${apiBaseUrl}${path}`, {
      ...init,
      headers,
      signal: init.signal ?? AbortSignal.timeout(12_000),
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      throw new ApiError('El backend tardó demasiado en responder. Reintentá.', 0)
    }
    throw new ApiError('No se pudo conectar con el backend. Comprobá que esté iniciado y reintentá.', 0)
  }

  if (!response.ok) {
    if (response.status === 401 && !path.startsWith('/api/auth/')) {
      clearSession()
      window.dispatchEvent(new Event('novadent:session-expired'))
    }
    const message = response.status === 401
      ? 'La sesión no está autorizada. Iniciá sesión nuevamente.'
      : response.status === 403
        ? 'Tu usuario no tiene permiso para esta operación.'
        : `El backend respondió con error ${response.status}.`
    throw new ApiError(message, response.status)
  }

  return response.json() as Promise<T>
}
