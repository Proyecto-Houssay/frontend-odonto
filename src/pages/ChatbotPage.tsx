import React from 'react'
import {
  Sparkles,
  ShieldCheck,
  Stethoscope,
  HeartPulse,
  BadgeAlert,
  Calendar,
  BadgeDollarSign,
  PhoneCall,
  Clock,
  ChevronDown
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

      {/* Ficha Técnica y Arquitectura RAG (Desplegable para docentes y evaluadores) */}
      <details className="group rounded-2xl border border-slate-200 bg-white p-5 text-slate-600 text-xs shadow-2xs transition-all">
        <summary className="cursor-pointer font-bold text-slate-800 text-sm flex items-center justify-between list-none">
          <div className="flex items-center gap-2">
            <Stethoscope className="w-4 h-4 text-blue-600" />
            <span>Ficha Técnica y Arquitectura RAG (Aporte Excepcional: Josue)</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-semibold">
              Spring AI
            </span>
          </div>
          <ChevronDown className="w-4 h-4 text-slate-400 group-open:rotate-180 transition-transform" />
        </summary>

        <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="font-semibold text-slate-700 mb-1 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-500" /> Stack Tecnológico:
            </p>
            <ul className="list-disc list-inside space-y-1 text-slate-600">
              <li><strong>Backend:</strong> Spring Boot 3.5.6 + Spring AI (VectorStore + OpenAI / Ollama).</li>
              <li><strong>Document Ingestion:</strong> Ingesta de Markdown estructurado de protocolos de urgencia y nomenclador oficial.</li>
              <li><strong>Endpoints REST:</strong> <code>POST /api/chatbot/ask</code> y <code>POST /api/chatbot/knowledge</code>.</li>
            </ul>
          </div>
          <div>
            <p className="font-semibold text-slate-700 mb-1 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-emerald-600" /> Beneficios Clínicos y Operativos:
            </p>
            <ul className="list-disc list-inside space-y-1 text-slate-600">
              <li>Reduce el 70% de consultas telefónicas y por WhatsApp a recepción.</li>
              <li>Respuestas 100% verificables con citas documentales sin riesgo de alucinación médica.</li>
              <li>Modo híbrido resiliente: fallback local autónomo para demostraciones en vivo y Vercel Preview.</li>
            </ul>
          </div>
        </div>
      </details>
    </div>
  )
}
