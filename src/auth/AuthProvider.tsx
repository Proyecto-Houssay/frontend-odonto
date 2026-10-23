import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { apiRequest } from '../lib/api'
import { AUTH_SESSION_KEY, AuthContext, type AuthSession } from './context'

type LoginResponse = {
  token: string
  tokenType: string
  expiresIn: number
}

function readStoredSession(): AuthSession | null {
  try {
    const raw = sessionStorage.getItem(AUTH_SESSION_KEY)
    if (!raw) return null
    const stored = JSON.parse(raw) as AuthSession
    if (!stored.token || !stored.username || !Number.isFinite(stored.expiresAt) || stored.expiresAt <= Date.now()) {
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
    const response = await apiRequest<LoginResponse>('/auth/login', {
      method: 'POST',
      body: { usernameOrEmail, password },
    })
    if (!response.token || !Number.isFinite(response.expiresIn) || response.expiresIn <= 0) {
      throw new Error('El backend respondió sin un token de sesión válido.')
    }
    setSession({
      token: response.token,
      tokenType: response.tokenType || 'Bearer',
      username: usernameOrEmail,
      expiresAt: Date.now() + response.expiresIn * 1000,
    })
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
