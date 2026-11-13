import { useState, type FormEvent } from 'react'
import { Activity, ArrowRight, HeartPulse, ShieldCheck } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'

export function LoginPage() {
  const { login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      await login(username, password)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo iniciar sesión.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white grid lg:grid-cols-[1.1fr_.9fr]">
      <section className="relative hidden lg:flex flex-col justify-between overflow-hidden p-12 xl:p-16 bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-900">
        <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <div className="rounded-2xl bg-cyan-400 p-3 text-slate-950"><HeartPulse size={27} /></div>
          <div><p className="text-xl font-bold tracking-wide">NOVADENT</p><p className="text-xs text-blue-200">Gestión clínica conectada</p></div>
        </div>
        <div className="relative max-w-xl">
          <p className="mb-5 flex items-center gap-2 text-sm font-medium text-cyan-200"><Activity size={16} /> PLATAFORMA ODONTOLÓGICA</p>
          <h1 className="text-5xl font-semibold leading-tight xl:text-6xl">Una clínica más simple, desde un solo lugar.</h1>
          <p className="mt-6 max-w-lg text-lg leading-8 text-blue-100/75">Turnos, pacientes e historias clínicas conectados con el backend de Novadent.</p>
        </div>
        <div className="relative flex items-center gap-3 text-sm text-blue-100/70"><ShieldCheck size={18} className="text-cyan-300" /> Acceso protegido con token de sesión</div>
      </section>
      <section className="flex min-h-screen items-center justify-center p-6 sm:p-10">
        <form onSubmit={submit} className="w-full max-w-md space-y-7">
          <div className="flex items-center gap-3 lg:hidden"><div className="rounded-xl bg-cyan-400 p-2 text-slate-950"><HeartPulse /></div><span className="font-bold tracking-widest">NOVADENT</span></div>
          <div><p className="text-sm font-semibold uppercase tracking-[.18em] text-cyan-300">Bienvenido</p><h2 className="mt-3 text-3xl font-semibold">Iniciá sesión</h2><p className="mt-2 text-sm text-slate-400">Usá tus credenciales de Novadent para continuar.</p></div>
          <label className="block space-y-2 text-sm font-medium text-slate-200">Usuario o correo electrónico<input required autoComplete="username" value={username} onChange={e => setUsername(e.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20" placeholder="usuario@clinica.com" /></label>
          <label className="block space-y-2 text-sm font-medium text-slate-200">Contraseña<input required type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20" placeholder="••••••••••••" /></label>
          {error && <p role="alert" className="rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">{error}</p>}
          <button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-400 px-4 py-3.5 font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-wait disabled:opacity-70">{busy ? 'Conectando…' : 'Entrar'} {!busy && <ArrowRight size={18} />}</button>
          <p className="text-center text-xs leading-5 text-slate-500">Conexión segura al backend local · El token permanece solo en memoria</p>
        </form>
      </section>
    </main>
  )
}
