import { createContext } from 'react'

export const AUTH_SESSION_KEY = 'novadent.auth.session'

export type AppRole = 'ADMINISTRADOR' | 'ODONTOLOGO' | 'RECEPCIONISTA' | 'PACIENTE'

export type AuthSession = {
  token: string
  tokenType: string
  username: string
  role: AppRole
  expiresAt: number
}

export type AuthContextValue = {
  session: AuthSession | null
  login: (usernameOrEmail: string, password: string) => Promise<void>
  logout: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)
