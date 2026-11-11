import React, { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Navbar } from './Navbar'
import { ChatbotFloatingWidget } from '../chatbot/ChatbotFloatingWidget'
import { useAuth } from '../../auth/useAuth'
import { roleFromToken } from '../../auth/role'

export const DashboardLayout: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const location = useLocation()
  const isChatbotRoute = location.pathname.startsWith('/chatbot')
  const { session } = useAuth()
  const role = session?.role || roleFromToken(session?.token || '')
  const isDentist = role === 'ODONTOLOGO'

  return (
    <div className="clinic-backdrop flex min-h-screen relative">
      {/* Barra lateral de navegación */}
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      {/* Contenedor vertical derecho */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Barra superior de navegación */}
        <Navbar onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)} />

        {/* Ventana dinámica donde se inyectan las vistas de cada módulo */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-5 lg:p-6">
          <div className="mx-auto w-full max-w-[1800px]">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Widget flotante del Chatbot IA accesible en todo el sistema excepto para odontólogo o vista completa */}
      {!isChatbotRoute && !isDentist && <ChatbotFloatingWidget />}
    </div>
  )
}
