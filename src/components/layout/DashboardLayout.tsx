import React, { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Navbar } from './Navbar'
import { ChatbotFloatingWidget } from '../chatbot/ChatbotFloatingWidget'

export const DashboardLayout: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const location = useLocation()
  const isChatbotRoute = location.pathname.startsWith('/chatbot')

  return (
    <div className="min-h-screen bg-slate-50 flex relative">
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
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Widget flotante del Chatbot IA accesible en todo el sistema excepto en la vista completa */}
      {!isChatbotRoute && <ChatbotFloatingWidget />}
    </div>
  )
}
