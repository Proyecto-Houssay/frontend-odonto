import React, { useState, useRef, useEffect, type FormEvent } from 'react'
import {
  Send,
  Bot,
  User,
  Sparkles,
  AlertTriangle,
  BadgeDollarSign,
  Calendar,
  BookOpen,
  RotateCcw,
  Clock,
  ShieldCheck
} from 'lucide-react'
import { askChatbot, type ChatMessage } from '../../lib/chatbot'
import { useAuth } from '../../auth/useAuth'

const SUGGESTED_QUERIES = [
  { text: 'Me duele la muela de juicio hace 3 días', category: 'triage' },
  { text: '¿Cuánto sale una limpieza con OSDE?', category: 'precio' },
  { text: '¿Qué hago si se me cayó un diente por un golpe?', category: 'triage' },
  { text: '¿Cuáles son los horarios y cómo funciona la lista de espera?', category: 'turno' },
]

export const ChatbotView: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { session } = useAuth()
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: '¡Hola! Te doy la bienvenida al Asistente Virtual de Clínica Novadent 🦷✨\n\nEstoy disponible las 24 horas para ayudarte y orientarte con:\n• 🚨 **Dolor o urgencias dentales** (muelas de juicio, traumatismos, inflamación aguda).\n• 💲 **Precios y coberturas** de obras sociales (OSDE, Swiss Medical, Galeno, IOMA, PAMI) o aranceles particulares.\n• 📅 **Turnos disponibles** y cómo anotarte en nuestra lista de espera inteligente si la agenda está completa.\n\n¿En qué te puedo asesorar hoy?',
      timestamp: new Date(),
      intencion: 'consulta_general',
      accionesSugeridas: [
        'Me duele la muela de juicio hace 3 días',
        '¿Cuánto sale una limpieza con OSDE?',
        '¿Qué hago si se me cayó un diente por un golpe?'
      ]
    }
  ])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isVercelFallbackMode, setIsVercelFallbackMode] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView?.({ behavior: 'smooth' })
  }, [messages, isLoading])

  const handleSend = async (messageText?: string) => {
    const textToSend = (messageText ?? inputValue).trim()
    if (!textToSend || isLoading) return

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: textToSend,
      timestamp: new Date()
    }

    setMessages((prev) => [...prev, userMsg])
    if (!messageText) setInputValue('')
    setIsLoading(true)

    try {
      const { response, isFallback } = await askChatbot(textToSend, session?.token)
      if (isFallback) {
        setIsVercelFallbackMode(true)
      }

      const botMsg: ChatMessage = {
        id: `bot-${Date.now()}`,
        role: 'assistant',
        text: response.respuesta,
        timestamp: new Date(),
        intencion: response.intencion,
        citas: response.citas,
        accionesSugeridas: response.accionesSugeridas,
        isFallback
      }

      setMessages((prev) => [...prev, botMsg])
    } catch {
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        text: 'Ocurrió un error al procesar tu consulta. Por favor reintentá en unos momentos.',
        timestamp: new Date(),
        intencion: 'error'
      }
      setMessages((prev) => [...prev, errorMsg])
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    handleSend()
  }

  const handleReset = () => {
    setMessages([
      {
        id: 'welcome-reset',
        role: 'assistant',
        text: 'Conversación reiniciada. ¿En qué más puedo orientarte sobre precios, turnos o urgencias?',
        timestamp: new Date(),
        intencion: 'consulta_general'
      }
    ])
  }

  const renderBadge = (intencion?: ChatMessage['intencion']) => {
    switch (intencion) {
      case 'urgencia':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800 border border-red-200">
            <AlertTriangle className="w-3 h-3 text-red-600" /> Triage Urgencia
          </span>
        )
      case 'precio':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <BadgeDollarSign className="w-3 h-3 text-emerald-600" /> Nomenclador y Precios
          </span>
        )
      case 'turno':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
            <Calendar className="w-3 h-3 text-blue-600" /> Agenda y Turnos
          </span>
        )
      case 'tratamiento':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-200">
            <BookOpen className="w-3 h-3 text-purple-600" /> Tratamiento Clínico
          </span>
        )
      default:
        return null
    }
  }

  return (
    <div className={`flex flex-col bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden ${compact ? 'h-[520px]' : 'h-[calc(100vh-12rem)] min-h-[560px]'}`}>
      {/* Barra superior de estado */}
      <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-md">
              <Bot className="w-6 h-6" />
            </div>
            <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-emerald-500 border-2 border-slate-900 rounded-full" title="Conectado 24/7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-base tracking-tight text-white">Asistente Virtual Novadent</h2>
              <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                En Línea 24/7
              </span>
            </div>
            <p className="text-xs text-slate-300 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-400" /> Triage de Urgencias y Precios de Obra Social
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isVercelFallbackMode && (
            <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 text-[11px] rounded bg-emerald-950/80 text-emerald-300 border border-emerald-700/50">
              <ShieldCheck className="w-3 h-3" /> Preview Vercel Activa
            </span>
          )}
          <button
            type="button"
            onClick={handleReset}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            title="Reiniciar chat"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Sugerencias Rápidas */}
      <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 overflow-x-auto flex items-center gap-2 text-xs">
        <span className="text-slate-500 font-medium whitespace-nowrap flex items-center gap-1">
          <Sparkles className="w-3.5 h-3.5 text-blue-600" /> Probar:
        </span>
        {SUGGESTED_QUERIES.map((sq, i) => (
          <button
            key={i}
            type="button"
            onClick={() => handleSend(sq.text)}
            disabled={isLoading}
            className="whitespace-nowrap px-3 py-1 bg-white hover:bg-blue-50 text-slate-700 hover:text-blue-700 rounded-full border border-slate-200 hover:border-blue-300 transition-colors shadow-2xs font-medium"
          >
            {sq.text}
          </button>
        ))}
      </div>

      {/* Contenedor de mensajes */}
      <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-4 bg-slate-50/50">
        {messages.map((msg) => {
          const isUser = msg.role === 'user'
          return (
            <div
              key={msg.id}
              className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-2xs ${
                  isUser ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-100'
                }`}
              >
                {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>

              <div
                className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3 shadow-2xs text-sm ${
                  isUser
                    ? 'bg-blue-600 text-white rounded-tr-none'
                    : 'bg-white text-slate-800 border border-slate-200 rounded-tl-none'
                }`}
              >
                {!isUser && msg.intencion && (
                  <div className="mb-2 flex items-center gap-2">
                    {renderBadge(msg.intencion)}
                    {msg.isFallback && (
                      <span className="text-[10px] text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded font-mono">
                        Base RAG Local
                      </span>
                    )}
                  </div>
                )}

                <div className="whitespace-pre-wrap leading-relaxed text-sm">
                  {msg.text}
                </div>

                {/* Citas y Evidencia Documental (RAG) */}
                {!isUser && msg.citas && msg.citas.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-100 text-xs">
                    <p className="font-semibold text-slate-700 mb-1.5 flex items-center gap-1">
                      <BookOpen className="w-3.5 h-3.5 text-blue-600" /> Fuentes citadas:
                    </p>
                    <div className="space-y-1.5">
                      {msg.citas.map((c, idx) => (
                        <div key={idx} className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-600">
                          <div className="font-semibold text-slate-800 text-[11px]">{c.documento} · versión {c.version}</div>
                          <details className="mt-1">
                            <summary className="cursor-pointer text-[10px] font-medium text-blue-600 hover:underline">
                              Ver fragmento citado
                            </summary>
                            <p className="mt-1 text-[11px] italic bg-white p-2 rounded border border-slate-100 text-slate-700">
                              "{c.fragmento}"
                            </p>
                          </details>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Acciones sugeridas / Botones de acción rápida */}
                {!isUser && msg.accionesSugeridas && msg.accionesSugeridas.length > 0 && (
                  <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-wrap gap-1.5">
                    {msg.accionesSugeridas.map((action, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleSend(action)}
                        className="text-xs px-2.5 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-md border border-blue-200 font-medium transition-colors"
                      >
                        {action}
                      </button>
                    ))}
                  </div>
                )}

                <div className={`mt-1.5 text-[10px] flex items-center justify-end gap-1 ${isUser ? 'text-blue-200' : 'text-slate-600'}`}>
                  <Clock className="w-2.5 h-2.5" />
                  {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          )
        })}

        {isLoading && (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center">
              <Bot className="w-4 h-4 animate-pulse" />
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-none px-4 py-3 shadow-2xs">
              <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                <span className="w-2 h-2 rounded-full bg-blue-600 animate-ping" />
                Consultando base de conocimiento RAG y verificando fuentes…
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input de consulta */}
      <form onSubmit={handleSubmit} className="p-3 sm:p-4 bg-white border-t border-slate-200 flex items-center gap-2">
        <label htmlFor="chat-question" className="sr-only">
          Tu pregunta
        </label>
        <input
          id="chat-question"
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Consultá precios (OSDE, Swiss), muelas de juicio, turnos o urgencias…"
          disabled={isLoading}
          maxLength={1000}
          className="flex-1 px-4 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-colors disabled:bg-slate-100"
        />
        <button
          type="submit"
          disabled={isLoading || !inputValue.trim()}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-xl transition-colors flex items-center gap-2 shadow-2xs"
        >
          <span>Enviar</span>
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  )
}
