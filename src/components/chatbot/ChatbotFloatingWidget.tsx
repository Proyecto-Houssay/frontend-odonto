import React, { useState } from 'react'
import { X, Bot, Sparkles, ChevronDown } from 'lucide-react'
import { ChatbotPage } from '../../pages/ChatbotPage'

export const ChatbotFloatingWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end">
      {/* Ventana flotante del Chatbot */}
      {isOpen && (
        <div className="mb-4 w-[92vw] sm:w-[420px] max-w-[440px] shadow-2xl rounded-2xl overflow-hidden border border-slate-300 bg-white/95 backdrop-blur-xl animate-in fade-in slide-in-from-bottom-5 duration-200">
          <div className="bg-slate-900 px-4 py-2 text-white flex items-center justify-between border-b border-slate-800">
            <div className="flex items-center gap-2 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Asistente RAG Novadent</span>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800"
              title="Minimizar asistente"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>
          <div className="p-3">
            <ChatbotPage compact />
          </div>
        </div>
      )}

      {/* Botón flotante disparador */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="group relative flex items-center gap-2.5 px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200 font-medium text-sm focus:outline-none focus:ring-4 focus:ring-blue-500/30"
        aria-label={isOpen ? 'Cerrar asistente IA' : 'Abrir asistente IA'}
      >
        {isOpen ? (
          <>
            <X className="w-5 h-5" />
            <span>Cerrar Asistente</span>
          </>
        ) : (
          <>
            <div className="relative">
              <Bot className="w-5 h-5" />
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 border-2 border-indigo-600 rounded-full animate-pulse" />
            </div>
            <span>Asistente IA</span>
          </>
        )}
      </button>
    </div>
  )
}
