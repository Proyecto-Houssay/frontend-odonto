import React, { useContext, useState, lazy, Suspense } from 'react'
import { X, Bot, Sparkles, ChevronDown } from 'lucide-react'
import { AuthContext } from '../../auth/context'
import { roleFromToken, type UserRole } from '../../auth/role'

const ChatbotPage = lazy(() => import('../../pages/ChatbotPage').then(m => ({ default: m.ChatbotPage })))

const WIDGET_LABELS: Record<UserRole, { button: string; header: string }> = {
  ODONTOLOGO: {
    button: 'Copiloto Clínico',
    header: 'Copiloto Clínico · Odontología',
  },
  ADMINISTRADOR: {
    button: 'Asistente Admin',
    header: 'Asistente de Gestión y RAG',
  },
  RECEPCIONISTA: {
    button: 'Asistente Recepción',
    header: 'Asistente de Recepción',
  },
  PACIENTE: {
    button: 'Asistente IA',
    header: 'Consultas rápidas con fuentes',
  },
}

export const ChatbotFloatingWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false)
  const auth = useContext(AuthContext)
  const session = auth?.session
  const role: UserRole =
    session?.role || (session?.token ? roleFromToken(session.token) : null) || 'PACIENTE'
  const labels = WIDGET_LABELS[role]

  return (
    <>
      {/* Overlay oscuro en mobile para cerrar tocando afuera */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-xs sm:hidden"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      <div className="fixed bottom-3 right-3 sm:bottom-5 sm:right-5 z-50 flex flex-col items-end pointer-events-none">
        {/* Ventana flotante / Bottom-sheet responsivo */}
        {isOpen && (
          <div className="pointer-events-auto fixed inset-x-0 bottom-0 sm:static sm:inset-auto mb-0 sm:mb-4 w-full sm:w-[420px] sm:max-w-[440px] max-h-[85vh] sm:max-h-none shadow-2xl rounded-t-2xl sm:rounded-2xl overflow-hidden border border-slate-300 bg-white/95 backdrop-blur-xl animate-in fade-in slide-in-from-bottom-5 duration-200 flex flex-col">
            <div className="bg-slate-900 px-4 py-2.5 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-2 text-xs font-semibold">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>{labels.header}</span>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800"
                title="Cerrar asistente"
              >
                <X className="w-4 h-4 sm:hidden" />
                <ChevronDown className="w-4 h-4 hidden sm:block" />
              </button>
            </div>
            <div className="p-3 overflow-y-auto max-h-[calc(85vh-45px)] sm:max-h-none">
              <Suspense fallback={<p className="p-4 text-center text-xs font-semibold text-slate-600 animate-pulse">Cargando asistente…</p>}>
                <ChatbotPage compact />
              </Suspense>
            </div>
          </div>
        )}

        {/* Botón flotante disparador */}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="pointer-events-auto group relative flex items-center gap-2 px-3.5 py-2.5 sm:px-4 sm:py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200 font-medium text-xs sm:text-sm focus:outline-none focus:ring-4 focus:ring-blue-500/30"
          aria-label={isOpen ? 'Cerrar asistente IA' : 'Abrir asistente IA'}
        >
          {isOpen ? (
            <>
              <X className="w-4 h-4 sm:w-5 sm:h-5" />
              <span>Cerrar Asistente</span>
            </>
          ) : (
            <>
              <div className="relative">
                <Bot className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 border-2 border-indigo-600 rounded-full animate-pulse" />
              </div>
              <span>{labels.button}</span>
            </>
          )}
        </button>
      </div>
    </>
  )
}
