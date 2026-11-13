import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import type { AuthContextValue, UserProfile } from '../lib/api'

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null)
  const [user, setUser] = useState<UserProfile | null>(null)

  const login = useCallback(async (usernameOrEmail: string, password: string) => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ usernameOrEmail, password }),
    })
    if (!response.ok) {
      const body = await response.json().catch(() => null)
      throw new Error(body?.message || 'Usuario o contraseña incorrectos.')
    }
    const auth = await response.json() as { token: string }
    const profileResponse = await fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${auth.token}`, Accept: 'application/json' },
    })
    if (!profileResponse.ok) throw new Error('No se pudo cargar el perfil de usuario.')
    const profile = await profileResponse.json() as UserProfile
    setToken(auth.token)
    setUser(profile)
  }, [])

  const logout = useCallback(() => {
    setToken(null)
    setUser(null)
  }, [])

  const value = useMemo(() => ({ token, user, login, logout }), [token, user, login, logout])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return context
}
