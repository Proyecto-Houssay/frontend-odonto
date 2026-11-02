import React from 'react'
import { Menu, LogOut, Bell } from 'lucide-react'

interface NavbarProps {
  onToggleSidebar: () => void
}

export const Navbar: React.FC<NavbarProps> = ({ onToggleSidebar }) => {
  const handleLogout = () => {
    alert('Simulación: Sesión cerrada.')
  }

  return (
    <header className="h-16 bg-white border-b border-slate-200 sticky top-0 z-30 flex items-center justify-between px-4 lg:px-8">
      {/* Botón menú para móviles y título */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="p-2 rounded-xl text-slate-600 hover:bg-slate-100 lg:hidden"
          aria-label="Abrir menú"
        >
          <Menu className="w-6 h-6" />
        </button>
        <div>
          <h1 className="text-base lg:text-lg font-semibold text-slate-800">
            Panel de Control
          </h1>
          <p className="text-xs text-slate-500 hidden sm:block">
            Gestión integral de la clínica odontológica
          </p>
        </div>
      </div>

      {/* Zona derecha: Notificaciones y Perfil */}
      <div className="flex items-center gap-2 sm:gap-4">
        {/* Notificaciones */}
        <button
          type="button"
          className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-700 relative"
          aria-label="Notificaciones"
        >
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-blue-600 rounded-full" />
        </button>

        {/* Separador */}
        <div className="h-8 w-px bg-slate-200" />

        {/* Datos de usuario */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 font-semibold flex items-center justify-center text-sm">
            BA
          </div>
          <div className="hidden md:block text-left">
            <span className="block text-sm font-medium text-slate-700 leading-tight">
              Braian Aguilera
            </span>
            <span className="block text-xs text-slate-500">
              Administrador
            </span>
          </div>
        </div>

        {/* Botón Salir */}
        <button
          type="button"
          onClick={handleLogout}
          className="p-2 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors ml-1"
          title="Cerrar sesión"
          aria-label="Cerrar sesión"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>
    </header>
  )
}
