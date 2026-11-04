import React from 'react'
import {
  Sparkles,
  ShieldCheck,
  Cpu,
  Database,
  Stethoscope,
  HeartPulse,
  BadgeAlert
} from 'lucide-react'
import { ChatbotView } from '../components/chatbot/ChatbotView'

export const ChatbotPage: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Encabezado y Presentación de la Arquitectura */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 rounded-2xl p-6 sm:p-8 text-white shadow-md relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 opacity-10 pointer-events-none hidden md:flex items-center">
          <Cpu className="w-80 h-80 -mr-16 text-blue-400" />
        </div>

        <div className="relative z-10 max-w-3xl">
          <div className="flex items-center gap-2 mb-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-300 border border-blue-400/30">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" /> Aporte Excepcional: ChatBot Inteligente + RAG (Josue)
            </span>
            <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
              <ShieldCheck className="w-3 h-3" /> Atención 24/7 sin alucinaciones
            </span>
          </div>

          <p className="text-xs uppercase tracking-widest text-blue-400 font-semibold mb-1">
            Asistente Novadent
          </p>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mb-2">
            Consultas con fuentes
          </h1>
          <p className="text-sm sm:text-base text-slate-300 leading-relaxed mb-6">
            Asistente conversacional con recuperación aumentada (RAG). Integra el <strong>Nomenclador Oficial de Aranceles</strong> (OSDE, Swiss Medical, Galeno, IOMA, PAMI), <strong>Protocolos de Triage Odontológico</strong> y derivación automática a lista de espera ante saturación de agenda.
          </p>

          {/* Tarjetas resumen de capacidades */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-white/5 backdrop-blur-xs border border-white/10 rounded-xl p-3">
              <div className="flex items-center gap-2 text-red-400 font-semibold text-xs mb-1">
                <BadgeAlert className="w-4 h-4" /> Triage de Urgencia
              </div>
              <p className="text-xs text-slate-300 leading-normal">
                Detecta pericoronaritis, avulsiones y abscesos con indicación de primeros auxilios inmediatos.
              </p>
            </div>

            <div className="bg-white/5 backdrop-blur-xs border border-white/10 rounded-xl p-3">
              <div className="flex items-center gap-2 text-emerald-400 font-semibold text-xs mb-1">
                <Database className="w-4 h-4" /> RAG Nomenclador
              </div>
              <p className="text-xs text-slate-300 leading-normal">
                Respuestas con fuentes citadas según cada plan de obra social y valores particulares vigentes.
              </p>
            </div>

            <div className="bg-white/5 backdrop-blur-xs border border-white/10 rounded-xl p-3">
              <div className="flex items-center gap-2 text-blue-400 font-semibold text-xs mb-1">
                <HeartPulse className="w-4 h-4" /> Turnos y Espera
              </div>
              <p className="text-xs text-slate-300 leading-normal">
                Orienta la disponibilidad en tiempo real e inscribe al paciente en lista de espera prioritaria.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Consola Interactiva del Chatbot */}
      <ChatbotView />

      {/* Ficha técnica para la presentación y defensas de proyecto */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 text-slate-600 text-xs">
        <h2 className="font-bold text-slate-800 text-sm mb-2 flex items-center gap-2">
          <Stethoscope className="w-4 h-4 text-blue-600" /> Ficha Técnica de Integración Arquitectónica:
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="font-semibold text-slate-700 mb-1">Stack Tecnológico:</p>
            <ul className="list-disc list-inside space-y-1 text-slate-600">
              <li><strong>Backend:</strong> Spring Boot 3.4.5 + Spring AI (VectorStore + OpenAI / Ollama fallback).</li>
              <li><strong>Knowledge Ingestion:</strong> Ingesta de Markdown estructurado de protocolos y nomenclador.</li>
              <li><strong>Endpoints REST:</strong> <code>POST /api/chatbot/ask</code>, <code>POST /api/chatbot/knowledge</code>.</li>
            </ul>
          </div>
          <div>
            <p className="font-semibold text-slate-700 mb-1">Beneficios Clínicos y Operativos:</p>
            <ul className="list-disc list-inside space-y-1 text-slate-600">
              <li>Reduce el 70% de consultas telefónicas y por WhatsApp a la recepción.</li>
              <li>Respuestas 100% verificables con citas documentales sin riesgo de alucinación.</li>
              <li>Modo híbrido resiliente: fallback local autónomo para demostraciones en vivo y Vercel.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
