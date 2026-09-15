import React from 'react'
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  Stethoscope,
  Calendar,
  ClipboardList,
  UserCheck,
  BarChart3,
  X,
  HeartPulse
} from 'lucide-react'

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

interface NavItem {
  label: string
  to: string
  icon: React.ElementType
}

const navItems: NavItem[] = [
  { label: 'Inicio', to: '/', icon: LayoutDashboard },
  { label: 'Pacientes', to: '/pacientes', icon: Users },
  { label: 'Odontólogos', to: '/odontologos', icon: Stethoscope },
  { label: 'Turnos', to: '/turnos', icon: Calendar },
  { label: 'Historias Clínicas', to: '/historias-clinicas', icon: ClipboardList },
  { label: 'Gestión de Usuarios', to: '/usuarios', icon: UserCheck },
  { label: 'Informes y Caja', to: '/informes', icon: BarChart3 },
]

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  return (
    <>
      {/* Backdrop para móviles */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Menú lateral */}
      <aside
        className={`fixed top-0 left-0 z-50 h-full w-64 bg-slate-900 text-slate-100 flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:z-auto ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Cabecera del Sidebar */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md">
              <HeartPulse className="w-6 h-6" />
            </div>
            <div>
              <span className="font-bold text-lg text-white tracking-wide">Novadent</span>
              <p className="text-xs text-slate-400">Sistema Odontológico</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 lg:hidden"
            aria-label="Cerrar menú"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Lista de navegación */}
        <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
          <p className="px-3 text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
            Módulos del Sistema
          </p>
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                onClick={() => {
                  if (window.innerWidth < 1024) onClose()
                }}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`
                }
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            )
          })}
        </nav>

        {/* Pie del Sidebar */}
        <div className="p-4 border-t border-slate-800">
          <div className="bg-slate-800/60 rounded-xl p-3 text-xs text-slate-400 flex flex-col gap-1">
            <span className="font-semibold text-slate-200">Sprint 1 - Novadent</span>
            <span>Versión 0.1.0 (Desarrollo)</span>
          </div>
        </div>
      </aside>
    </>
  )
}
