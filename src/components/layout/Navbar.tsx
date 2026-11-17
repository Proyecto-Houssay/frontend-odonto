import { LogOut, Menu, Moon, Sun } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
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
  const navigate = useNavigate()
  const { theme, toggleTheme } = useTheme()
  const role = session?.role || roleFromToken(session?.token || '')
  const initials = (session?.username || 'U').slice(0, 2).toUpperCase()

  const handleLogout = () => {
    logout()
    navigate('/', { replace: true })
  }

  return (
    <header className="sticky top-0 z-30 flex min-h-14 sm:min-h-16 items-center justify-between gap-2 sm:gap-4 border-b border-[#94A3B8] bg-[#E2E8F0]/90 px-3 sm:px-4 shadow-xs backdrop-blur-xl lg:px-6">
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="rounded-xl p-2 text-[#1E293B] hover:bg-[#DBEAFE] lg:hidden shrink-0"
          aria-label="Abrir menú"
        >
          <Menu className="h-5 w-5 sm:h-6 sm:w-6" />
        </button>
        <div className="min-w-0">
          <p className="text-[0.68rem] sm:text-[0.72rem] font-bold uppercase tracking-[0.16em] sm:tracking-[0.18em] text-[#1D4ED8] truncate">
            NovaDent · {role ? labels[role] : 'Sistema odontológico'}
          </p>
          <h1 className="truncate text-base font-extrabold text-[#0F172A] sm:text-xl">
            Tu espacio de trabajo
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
        {/* Selector de Modo Oscuro (naranja con luna negra) / Modo Claro (celeste con sol amarillo) */}
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Activar modo claro' : 'Activar modo oscuro'}
          title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          style={
            theme === 'dark'
              ? { backgroundColor: '#38bdf8', color: '#082f49', borderColor: '#0284c7' }
              : { backgroundColor: '#f97316', color: '#09090b', borderColor: '#c2410c' }
          }
          className={`flex min-h-9 sm:min-h-10 items-center gap-1.5 sm:gap-2 rounded-xl border-2 px-2.5 sm:px-3 py-1 text-xs font-extrabold shadow-sm transition focus-visible:outline-2 focus-visible:outline-offset-2 ${
            theme === 'dark'
              ? 'border-sky-500 bg-sky-300 text-slate-950 hover:bg-sky-200 focus-visible:outline-sky-400'
              : 'border-orange-700 bg-orange-500 text-slate-950 hover:bg-orange-600 focus-visible:outline-orange-600'
          }`}
        >
          {theme === 'dark' ? (
            <Sun
              aria-hidden="true"
              size={18}
              className="text-yellow-300 fill-yellow-400 drop-shadow-[0_1px_1px_rgba(0,0,0,0.45)]"
              style={{ color: '#fde047', fill: '#facc15' }}
            />
          ) : (
            <Moon
              aria-hidden="true"
              size={18}
              className="text-black fill-black"
              style={{ color: '#000000', fill: '#000000' }}
            />
          )}
          <span className="hidden md:inline">{theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}</span>
        </button>

        <NotificationCenter />

        <div className="flex items-center gap-1.5 sm:gap-2 rounded-xl border border-[#CBD5E1] bg-[#DBEAFE]/85 p-1 sm:p-1.5 sm:pr-3">
          <span className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-lg bg-[#1D4ED8] text-xs sm:text-sm font-bold text-white shrink-0">
            {initials}
          </span>
          <span className="hidden max-w-40 truncate text-sm font-bold text-[#0F172A] sm:block">
            {session?.username}
          </span>
        </div>

        {/* Botón Salir siempre en color rojo intenso */}
        <button
          type="button"
          onClick={handleLogout}
          aria-label="Cerrar sesión"
          style={{ backgroundColor: '#dc2626', color: '#ffffff', borderColor: '#b91c1c' }}
          className="flex min-h-9 sm:min-h-10 items-center gap-1.5 sm:gap-2 rounded-xl border border-red-700 bg-red-600 px-2.5 sm:px-3.5 py-1 text-xs sm:text-sm font-bold text-white shadow-sm transition hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
        >
          <LogOut aria-hidden="true" className="h-4 w-4 text-white shrink-0" />
          <span className="hidden sm:inline">Salir</span>
        </button>
      </div>
    </header>
  )
}
