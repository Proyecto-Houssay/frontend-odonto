import React, { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Navbar } from './Navbar'
import { useAuth } from '../../auth/AuthContext'
import { LoginPage } from '../../pages/LoginPage'

export const DashboardLayout: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const { user, logout } = useAuth()

  if (!user) return <LoginPage />

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Barra lateral de navegación */}
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        role={user.rol}
      />

      {/* Contenedor vertical derecho */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Barra superior de navegación */}
        <Navbar user={user} onLogout={logout} onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)} />

        {/* Ventana dinámica donde se inyectan las vistas de cada módulo */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
