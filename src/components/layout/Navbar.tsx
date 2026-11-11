import { LogOut, Menu, Moon, Sun } from 'lucide-react'
import { useAuth } from '../../auth/useAuth'
import { roleFromToken } from '../../auth/role'
import { NotificationCenter } from './NotificationCenter'
import { useTheme } from '../../lib/useTheme'

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
  const { theme, toggleTheme } = useTheme()
  const role = session?.role || roleFromToken(session?.token || '')
  const initials = (session?.username || 'U').slice(0, 2).toUpperCase()

  return (
    <header className="sticky top-0 z-30 flex min-h-16 items-center justify-between gap-4 border-b border-[#94A3B8] bg-[#E2E8F0]/86 px-4 shadow-xs backdrop-blur-xl lg:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <button type="button" onClick={onToggleSidebar} className="rounded-xl p-2 text-[#475569] hover:bg-[#DBEAFE] lg:hidden" aria-label="Abrir menú">
          <Menu className="h-6 w-6" />
        </button>
        <div className="min-w-0">
          <p className="text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[#1D4ED8]">NovaDent · {role ? labels[role] : 'Sistema odontológico'}</p>
          <h1 className="truncate text-lg font-extrabold text-[#1E293B] sm:text-xl">Tu espacio de trabajo</h1>
        </div>
      </div>
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Selector de Modo Oscuro / Modo Claro */}
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Activar modo claro' : 'Activar modo oscuro'}
          title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          className="flex h-10 items-center gap-1.5 rounded-xl border border-[#94A3B8] bg-[#E2E8F0]/80 px-2.5 py-1.5 text-xs font-semibold text-[#1E293B] transition hover:border-[#1D4ED8] hover:bg-[#DBEAFE] hover:text-[#1D4ED8] focus-visible:outline-2 focus-visible:outline-blue-600"
        >
          {theme === 'dark' ? <Sun size={17} className="text-amber-500" /> : <Moon size={17} className="text-slate-600" />}
          <span className="hidden md:inline">{theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}</span>
        </button>

        <NotificationCenter />
        <div className="flex items-center gap-2 rounded-xl border border-[#CBD5E1] bg-[#DBEAFE]/80 p-1.5 pr-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1D4ED8] text-sm font-bold text-white">{initials}</span>
          <span className="hidden max-w-40 truncate text-sm font-semibold text-[#1E293B] sm:block">{session?.username}</span>
        </div>
        <button type="button" onClick={logout} className="flex min-h-10 items-center gap-2 rounded-xl border border-[#94A3B8] bg-[#E2E8F0]/80 px-3 text-sm font-semibold text-[#1E293B] transition hover:border-red-300 hover:bg-red-50 hover:text-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600" aria-label="Cerrar sesión">
          <LogOut aria-hidden="true" className="h-4 w-4" /><span className="hidden sm:inline">Salir</span>
        </button>
      </div>
    </header>
  )
}
