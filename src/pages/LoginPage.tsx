import { useState, type FormEvent } from 'react'
import { HeartPulse, LoaderCircle } from 'lucide-react'
import { ApiError, apiRequest } from '../lib/api'
import { useAuth } from '../auth/useAuth'

type AccessMode = 'login' | 'register' | 'forgot' | 'reset' | 'reset-success'

type RegistrationResponse = { emailSent: boolean; message: string }
type PasswordResetResponse = { message: string; emailConfigured: boolean }

export function LoginPage() {
  const { login } = useAuth()
  const [resetToken, setResetToken] = useState(() => new URLSearchParams(window.location.search).get('token'))
  const [mode, setMode] = useState<AccessMode>(() => resetToken ? 'reset' : 'login')
  const [usernameOrEmail, setUsernameOrEmail] = useState('')
  const [username, setUsername] = useState('')
  const [nombre, setNombre] = useState('')
  const [apellido, setApellido] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [repeatPassword, setRepeatPassword] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function switchMode(nextMode: AccessMode) {
    setMode(nextMode)
    setError('')
    setNotice('')
    setPassword('')
    setRepeatPassword('')
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    setNotice('')
    try {
      if (mode === 'login') {
        await login(usernameOrEmail.trim(), password)
      } else if (mode === 'register') {
        const response = await apiRequest<RegistrationResponse>('/auth/register', {
          method: 'POST',
          body: { username: username.trim(), nombre: nombre.trim(), apellido: apellido.trim(), email: email.trim(), password },
        })
        setNotice(response.message)
        switchMode('login')
        setNotice(response.message)
        setUsernameOrEmail(username.trim())
      } else if (mode === 'forgot') {
        const response = await apiRequest<PasswordResetResponse>('/auth/password-reset/request', {
          method: 'POST', body: { email: email.trim() },
        })
        setNotice(response.message)
        if (!response.emailConfigured) {
          setNotice(`${response.message} El envío de correos no está configurado en el backend local.`)
        }
      } else if (mode === 'reset') {
        if (password !== repeatPassword) {
          throw new Error('Las contraseñas no coinciden.')
        }
        if (!resetToken) {
          throw new Error('El enlace no contiene un token de recuperación. Solicitá uno nuevo.')
        }
        await apiRequest<void>('/auth/password-reset/confirm', {
          method: 'POST', body: { token: resetToken, newPassword: password },
        })
        window.history.replaceState({}, '', '/')
        setResetToken(null)
        setMode('reset-success')
        setNotice('La contraseña se actualizó. Ya podés iniciar sesión.')
      }
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) {
        setError('Usuario o contraseña incorrectos.')
      } else {
        setError(failure instanceof Error ? failure.message : 'No se pudo completar la solicitud.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const heading = mode === 'register' ? 'Crear cuenta de acceso'
    : mode === 'forgot' ? 'Recuperar contraseña'
      : mode === 'reset' ? 'Restablecer contraseña'
        : mode === 'reset-success' ? 'Contraseña actualizada'
          : 'Ingresar a Novadent'

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 flex items-center justify-center">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-7 shadow-sm sm:p-9">
        <div className="mb-7 flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-white">
            <HeartPulse aria-hidden="true" className="h-7 w-7" />
          </span>
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">Novadent</p>
            <h1 className="text-2xl font-bold text-slate-900">{heading}</h1>
          </div>
        </div>

        {mode === 'reset-success' ? (
          <div className="space-y-5">
            <p role="status" className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">{notice}</p>
            <button className="min-h-11 w-full rounded-lg bg-blue-600 px-4 py-2.5 font-semibold text-white hover:bg-blue-700" onClick={() => switchMode('login')} type="button">
              Volver a iniciar sesión
            </button>
          </div>
        ) : (
          <>
            <p className="mb-6 text-sm text-slate-600">
              {mode === 'login' && 'Usá la cuenta registrada en el backend para continuar.'}
              {mode === 'register' && 'Creá una cuenta para acceder al sistema académico Novadent.'}
              {mode === 'forgot' && 'Ingresá el correo asociado a tu cuenta. Si corresponde, te enviaremos un enlace.'}
              {mode === 'reset' && 'Elegí una contraseña nueva para recuperar el acceso a tu cuenta.'}
            </p>
            <form className="space-y-5" onSubmit={handleSubmit}>
              {mode === 'register' ? (
                <>
                  <label className="block text-sm font-medium text-slate-700">
                    Nombre
                    <input autoComplete="given-name" className={inputClass} maxLength={100} required value={nombre} onChange={event => setNombre(event.target.value)} />
                  </label>
                  <label className="block text-sm font-medium text-slate-700">
                    Apellido
                    <input autoComplete="family-name" className={inputClass} maxLength={100} required value={apellido} onChange={event => setApellido(event.target.value)} />
                  </label>
                  <label className="block text-sm font-medium text-slate-700">
                    Nombre de usuario
                    <input autoComplete="username" className={inputClass} maxLength={50} required value={username} onChange={event => setUsername(event.target.value)} />
                  </label>
                  <label className="block text-sm font-medium text-slate-700">
                    Correo electrónico
                    <input autoComplete="email" className={inputClass} maxLength={254} required type="email" value={email} onChange={event => setEmail(event.target.value)} />
                  </label>
                  <PasswordInput label="Contraseña" autoComplete="new-password" value={password} onChange={setPassword} />
                </>
              ) : null}

              {mode === 'login' ? (
                <>
                  <label className="block text-sm font-medium text-slate-700">
                    Usuario o correo electrónico
                    <input autoComplete="username" className={inputClass} required value={usernameOrEmail} onChange={event => setUsernameOrEmail(event.target.value)} />
                  </label>
                  <PasswordInput label="Contraseña" autoComplete="current-password" value={password} onChange={setPassword} />
                </>
              ) : null}

              {mode === 'forgot' ? (
                <label className="block text-sm font-medium text-slate-700">
                  Correo electrónico
                  <input autoComplete="email" className={inputClass} required type="email" value={email} onChange={event => setEmail(event.target.value)} />
                </label>
              ) : null}

              {mode === 'reset' ? (
                <>
                  <PasswordInput label="Nueva contraseña" autoComplete="new-password" value={password} onChange={setPassword} />
                  <PasswordInput label="Repetir contraseña" autoComplete="new-password" value={repeatPassword} onChange={setRepeatPassword} />
                </>
              ) : null}

              {error ? <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}
              {notice ? <p role="status" className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-slate-700">{notice}</p> : null}

              <button className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60" disabled={submitting} type="submit">
                {submitting ? <><LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" />Procesando…</>
                  : mode === 'login' ? 'Ingresar'
                    : mode === 'register' ? 'Crear cuenta'
                      : mode === 'forgot' ? 'Enviar enlace de recuperación' : 'Guardar nueva contraseña'}
              </button>
            </form>

            <div className="mt-4 flex flex-col items-start gap-2 text-sm">
              {mode === 'login' ? (
                <>
                  <button className="font-medium text-blue-700 hover:text-blue-800 hover:underline" onClick={() => switchMode('forgot')} type="button">¿Olvidaste tu contraseña?</button>
                  <button className="font-medium text-blue-700 hover:text-blue-800 hover:underline" onClick={() => switchMode('register')} type="button">Crear una cuenta</button>
                </>
              ) : null}
              {mode === 'register' ? <button className="font-medium text-blue-700 hover:text-blue-800 hover:underline" onClick={() => switchMode('login')} type="button">Ya tengo cuenta · Iniciar sesión</button> : null}
              {mode === 'forgot' || mode === 'reset' ? <button className="font-medium text-blue-700 hover:text-blue-800 hover:underline" onClick={() => switchMode('login')} type="button">Volver a iniciar sesión</button> : null}
            </div>
          </>
        )}
        <p className="mt-6 text-xs text-slate-500">Sistema académico local · conexión al backend Novadent</p>
      </section>
    </main>
  )
}

const inputClass = 'mt-1.5 block min-h-11 w-full rounded-lg border border-slate-300 px-3 text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100'

function PasswordInput({
  label,
  autoComplete,
  value,
  onChange,
}: {
  label: string
  autoComplete: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {label}
      <input autoComplete={autoComplete} className={inputClass} minLength={8} required type="password" value={value} onChange={event => onChange(event.target.value)} />
    </label>
  )
}
