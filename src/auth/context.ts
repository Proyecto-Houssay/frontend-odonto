import { createContext } from 'react'

export const AUTH_SESSION_KEY = 'novadent.auth.session'

export type AuthSession = {
  token: string
  tokenType: string
  username: string
  expiresAt: number
}

export type AuthContextValue = {
  session: AuthSession | null
  login: (usernameOrEmail: string, password: string) => Promise<void>
  logout: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)
