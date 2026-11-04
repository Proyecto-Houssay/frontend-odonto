import React, { useState } from 'react'
import { X, Bot, Sparkles, ChevronDown } from 'lucide-react'
import { ChatbotView } from './ChatbotView'

export const ChatbotFloatingWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end">
      {/* Ventana flotante del Chatbot */}
      {isOpen && (
        <div className="mb-4 w-[92vw] sm:w-[420px] max-w-[440px] shadow-2xl rounded-2xl overflow-hidden border border-slate-300 animate-in fade-in slide-in-from-bottom-5 duration-200">
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
          <ChatbotView compact />
        </div>
      )}

      {/* Botón flotante disparador */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="group relative flex items-center gap-2.5 px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200 font-medium text-sm focus:outline-none focus:ring-4 focus:ring-blue-500/30"
        aria-label={isOpen ? 'Cerrar asistente IA' : 'Abrir asistente IA'}
      >
        <span className="relative flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
        </span>

        {isOpen ? (
          <>
            <X className="w-5 h-5" />
            <span className="hidden sm:inline">Cerrar Asistente</span>
          </>
        ) : (
          <>
            <Bot className="w-5 h-5" />
            <span className="hidden sm:inline">Asistente IA (RAG)</span>
          </>
        )}
      </button>
    </div>
  )
}
