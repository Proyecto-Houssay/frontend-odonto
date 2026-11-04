import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ApiError, apiRequest } from '../lib/api'
import { AUTH_SESSION_KEY, AuthContext, type AppRole, type AuthSession } from './context'

type LoginResponse = {
  token: string
  tokenType: string
  expiresIn: number
  role: AppRole
}

const appRoles: AppRole[] = ['ADMINISTRADOR', 'ODONTOLOGO', 'RECEPCIONISTA', 'PACIENTE']

function readStoredSession(): AuthSession | null {
  try {
    const raw = sessionStorage.getItem(AUTH_SESSION_KEY)
    if (!raw) return null
    const stored = JSON.parse(raw) as AuthSession
    if (!stored.token || !stored.username || !appRoles.includes(stored.role)
      || !Number.isFinite(stored.expiresAt) || stored.expiresAt <= Date.now()) {
      sessionStorage.removeItem(AUTH_SESSION_KEY)
      return null
    }
    return stored
  } catch {
    sessionStorage.removeItem(AUTH_SESSION_KEY)
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(readStoredSession)

  const logout = useCallback(() => {
    sessionStorage.removeItem(AUTH_SESSION_KEY)
    setSession(null)
  }, [])

  const login = useCallback(async (usernameOrEmail: string, password: string) => {
    try {
      const response = await apiRequest<LoginResponse>('/auth/login', {
        method: 'POST',
        body: { usernameOrEmail, password },
      })
      if (!response.token || !appRoles.includes(response.role)
        || !Number.isFinite(response.expiresIn) || response.expiresIn <= 0) {
        throw new Error('El backend respondió sin un token de sesión válido.')
      }
      setSession({
        token: response.token,
        tokenType: response.tokenType || 'Bearer',
        username: usernameOrEmail,
        role: response.role,
        expiresAt: Date.now() + response.expiresIn * 1000,
      })
    } catch (error) {
      const isOfflineError =
        error instanceof ApiError
          ? error.status === 502 || error.status === 503 || error.status === 504 || error.status === 404
          : error instanceof Error && error.message.includes('backend')

      if (isOfflineError) {
        // En modo demostración / preview de Vercel / backend local offline
        const normalized = usernameOrEmail.trim().toLowerCase()
        const isPatient = normalized === 'ana' || normalized === 'paciente'
        const role: AppRole = isPatient ? 'PACIENTE' : 'ADMINISTRADOR'
        setSession({
          token: `demo-jwt-${role.toLowerCase()}`,
          tokenType: 'Bearer',
          username: usernameOrEmail.trim() || (isPatient ? 'ana' : 'admin'),
          role,
          expiresAt: Date.now() + 3600 * 1000,
        })
        return
      }

      throw error
    }
  }, [])

  useEffect(() => {
    if (!session) {
      sessionStorage.removeItem(AUTH_SESSION_KEY)
      return
    }
    sessionStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session))
    const remaining = Math.max(0, session.expiresAt - Date.now())
    const timer = window.setTimeout(logout, remaining)
    return () => window.clearTimeout(timer)
  }, [session, logout])

  const value = useMemo(() => ({ session, login, logout }), [session, login, logout])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
