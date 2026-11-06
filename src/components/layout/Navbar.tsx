import { LogOut, Menu } from 'lucide-react'
import { useAuth } from '../../auth/useAuth'
import { roleFromToken } from '../../auth/role'

interface NavbarProps {
  onToggleSidebar: () => void
}

const labels = {
  ADMINISTRADOR: 'Administración',
  ODONTOLOGO: 'Odontología',
  RECEPCIONISTA: 'Recepción',
  PACIENTE: 'Paciente',
}

export function Navbar({ onToggleSidebar }: NavbarProps) {
  const { session, logout } = useAuth()
  const role = session?.role || roleFromToken(session?.token || '')
  const initials = (session?.username || 'U').slice(0, 2).toUpperCase()

  return <header className="sticky top-0 z-30 flex min-h-16 items-center justify-between gap-4 border-b border-white/70 bg-white/80 px-4 shadow-sm backdrop-blur-xl lg:px-6">
    <div className="flex min-w-0 items-center gap-3">
      <button type="button" onClick={onToggleSidebar} className="rounded-xl p-2 text-slate-700 hover:bg-blue-50 lg:hidden" aria-label="Abrir menú">
        <Menu className="h-6 w-6" />
      </button>
      <div className="min-w-0">
        <p className="text-[0.7rem] font-bold uppercase tracking-[0.18em] text-blue-700">NovaDent · {role ? labels[role] : 'Sistema odontológico'}</p>
        <h1 className="truncate text-lg font-extrabold text-slate-950 sm:text-xl">Tu espacio de trabajo</h1>
      </div>
    </div>
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50/80 p-1.5 pr-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white">{initials}</span>
        <span className="hidden max-w-40 truncate text-sm font-semibold text-slate-800 sm:block">{session?.username}</span>
      </div>
      <button type="button" onClick={logout} className="flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600" aria-label="Cerrar sesión">
        <LogOut aria-hidden="true" className="h-4 w-4" /><span className="hidden sm:inline">Salir</span>
      </button>
    </div>
  </header>
}
