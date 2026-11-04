import { useState } from 'react'
import type { FormEvent } from 'react'
import { apiRequest, ApiError, saveSession } from '../lib/api'
import type { LoginResponse, UserSession } from '../lib/api'

export function LoginPage({ onLogin }: { onLogin: (session: UserSession) => void }) {
  const [usernameOrEmail, setUsernameOrEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      const response = await apiRequest<LoginResponse>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ usernameOrEmail, password }),
      })
      onLogin(saveSession(response))
    } catch (caught) {
      setError(caught instanceof ApiError && caught.status === 401
        ? 'El usuario o la contraseña no son correctos.'
        : caught instanceof ApiError ? caught.message : 'No se pudo iniciar sesión.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-md items-center px-4 py-8">
      <form onSubmit={submit} className="w-full space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <header>
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">Novadent</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-950">Iniciar sesión</h1>
          <p className="mt-2 text-sm text-slate-600">Ingresá con las credenciales asignadas por la clínica.</p>
        </header>
        <label className="grid gap-1 text-sm font-medium">Usuario o email
          <input autoComplete="username" required value={usernameOrEmail} onChange={(event) => setUsernameOrEmail(event.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 font-normal" />
        </label>
        <label className="grid gap-1 text-sm font-medium">Contraseña
          <input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 font-normal" />
        </label>
        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        <button disabled={loading} className="w-full rounded-lg bg-blue-700 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">
          {loading ? 'Ingresando…' : 'Ingresar'}
        </button>
      </form>
    </main>
  )
}
