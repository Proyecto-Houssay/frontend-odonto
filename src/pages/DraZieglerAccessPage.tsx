import { useState, type FormEvent } from 'react'
import { AlertCircle, ScanEye } from 'lucide-react'
import { DraZieglerPage } from './DraZieglerPage'

export function DraZieglerAccessPage() {
  const [token, setToken] = useState('')
  const [usernameOrEmail, setUsernameOrEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ usernameOrEmail, password }),
      })
      const payload = await response.json() as { token?: string; message?: string }
      if (!response.ok || !payload.token) throw new Error(payload.message || 'No se pudo iniciar sesión.')
      setToken(payload.token)
      setPassword('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo conectar con el backend.')
    } finally {
      setLoading(false)
    }
  }

  if (token) return <DraZieglerPage token={token} />

  return <main className="mx-auto max-w-md px-4 py-16">
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-3"><span className="rounded-xl bg-cyan-50 p-2 text-cyan-800"><ScanEye size={22} /></span><div><p className="text-xs font-semibold uppercase tracking-wide text-cyan-700">Novadent</p><h1 className="text-xl font-semibold text-slate-900">Dra. Ziegler</h1></div></div>
      <p className="mt-3 text-sm text-slate-600">Iniciá sesión con una cuenta de odontólogo o administrador para analizar imágenes.</p>
      <form className="mt-5 space-y-4" onSubmit={(event) => void signIn(event)}>
        <label className="block text-sm font-medium text-slate-700">Usuario o correo<input required autoComplete="username" value={usernameOrEmail} onChange={(event) => setUsernameOrEmail(event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3" /></label>
        <label className="block text-sm font-medium text-slate-700">Contraseña<input required type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3" /></label>
        {error && <p role="alert" className="flex gap-2 rounded-lg bg-rose-50 p-3 text-sm text-rose-800"><AlertCircle size={18} className="shrink-0" />{error}</p>}
        <button disabled={loading} className="w-full rounded-xl bg-cyan-700 px-4 py-3 text-sm font-semibold text-white disabled:bg-slate-300">{loading ? 'Ingresando…' : 'Ingresar'}</button>
      </form>
    </section>
  </main>
}
