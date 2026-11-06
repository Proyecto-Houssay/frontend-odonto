import React from 'react'
import {
  ShieldCheck,
  HeartPulse,
  BadgeAlert,
  Calendar,
  BadgeDollarSign,
  PhoneCall,
  Clock
} from 'lucide-react'
import { ChatbotView } from '../components/chatbot/ChatbotView'

export const ChatbotPage: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Banner de Bienvenida al Paciente */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-lg relative overflow-hidden">
        {/* Decoración de fondo */}
        <div className="absolute -right-10 -bottom-10 opacity-10 pointer-events-none">
          <HeartPulse className="w-80 h-80 text-blue-200" />
        </div>

        <div className="relative z-10 max-w-4xl">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Atención 24/7 al Paciente
            </span>
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-blue-500/20 text-blue-300 border border-blue-400/30">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-300" />
              Orientación Clínica Oficial
            </span>
          </div>

          <p className="text-xs uppercase tracking-widest text-blue-300 font-semibold mb-1">
            Portal del Paciente · Clínica Novadent
          </p>

          {/* Heading con soporte para los tests y título principal */}
          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white mb-2">
            Consultas con fuentes
          </h1>

          <p className="text-sm sm:text-base text-slate-200 leading-relaxed max-w-3xl mb-6">
            ¡Hola! Te damos la bienvenida a tu asistente odontológico inteligente. Estamos para ayudarte día y noche a resolver dudas sobre tratamientos, calcular la cobertura de tu obra social y guiarte con primeros auxilios si tenés dolor o una urgencia dental.
          </p>

          {/* 3 Pilares pensados para el paciente */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-4 transition hover:bg-white/15">
              <div className="flex items-center gap-2 text-red-300 font-bold text-sm mb-1.5">
                <BadgeAlert className="w-4 h-4 text-red-400" /> Triage y Urgencias
              </div>
              <p className="text-xs text-slate-200 leading-relaxed">
                ¿Dolor agudo o traumatismo? Evaluamos tus síntomas al instante y priorizamos tu atención de guardia.
              </p>
            </div>

            <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-4 transition hover:bg-white/15">
              <div className="flex items-center gap-2 text-emerald-300 font-bold text-sm mb-1.5">
                <BadgeDollarSign className="w-4 h-4 text-emerald-400" /> Coberturas y Precios
              </div>
              <p className="text-xs text-slate-200 leading-relaxed">
                Consultá tu cobertura según tu prepaga (OSDE, Swiss, Galeno, IOMA, PAMI) y los aranceles vigentes.
              </p>
            </div>

            <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-4 transition hover:bg-white/15">
              <div className="flex items-center gap-2 text-blue-300 font-bold text-sm mb-1.5">
                <Calendar className="w-4 h-4 text-blue-400" /> Turnos y Espera
              </div>
              <p className="text-xs text-slate-200 leading-relaxed">
                Coordiná tu visita o ingresá a nuestra lista de espera con aviso inmediato ante cancelaciones.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Consola Interactiva del Chatbot */}
      <ChatbotView />

      {/* Banner de Contacto directo de Emergencia para el paciente */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700 shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-sm">¿Tenés una urgencia médica grave fuera de horario?</h3>
            <p className="text-xs text-slate-600">
              Nuestra guardia pasiva atiende traumatismos dentales y hemorragias las 24 horas del día.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-600 text-white text-xs font-semibold shadow-xs">
            <PhoneCall className="w-3.5 h-3.5" /> Guardia 24hs: 0800-NOVADENT
          </span>
        </div>
      </div>
    </div>
  )
}
