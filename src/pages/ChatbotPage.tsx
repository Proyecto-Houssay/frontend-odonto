import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, ShieldCheck, Sparkles, Stethoscope } from 'lucide-react'
import { ApiError, apiRequest } from '../lib/api'
import { useAuth } from '../auth/useAuth'

type Citation = { id: string; documento: string; version: string; fragmento: string }
type ChatResponse = {
  respuesta: string
  intencion: string
  timestamp: string
  citas?: Citation[]
  accionesSugeridas?: string[]
}
type TurnoPropio = { id: number; fecha: string; hora: string; motivo: string; estado: string; odontologoNombre: string }
type ChatAction = { to: string; label: string }
type Message = {
  id: string
  role: 'user' | 'assistant'
  text: string
  citations?: Citation[]
  actions?: ChatAction[]
  noEvidence?: boolean
}

const NO_EVIDENCE = 'No tengo información suficiente'
const LOCAL_GREETING_RESPONSE = '¡Hola! Soy el asistente de NovaDent. Puedo ayudarte a consultar tu próximo turno registrado, abrir tu odontograma o responder consultas cuando haya fuentes aprobadas de la clínica. No brindo diagnósticos ni invento horarios o precios.'
const SCHEDULE_FALLBACK_RESPONSE = 'Ahora no puedo confirmar los horarios ni la disponibilidad porque no hay una fuente vigente aprobada. Consultá tus turnos registrados o comunicate con recepción.'

const ACTIONS: Record<string, ChatAction> = {
  '/mis-turnos': { to: '/mis-turnos', label: 'Ver mis turnos' },
  '/mi-odontograma': { to: '/mi-odontograma', label: 'Ver mi odontograma' },
  '/': { to: '/', label: 'Registrar una observación' },
}

const SUGGESTIONS = [
  '¿Cuándo es mi próximo turno?',
  '¿Qué horarios tienen disponibles?',
  'Hola, ¿en qué me podés ayudar?',
] as const

function createMessageId() {
  return globalThis.crypto?.randomUUID?.() ?? String(Date.now()) + '-' + String(Math.random()).slice(2)
}

function normalizar(text: string) {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('es-AR')
}

function limpiarTexto(text: string) {
  return normalizar(text).replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
}

function esSaludoLocal(text: string) {
  const clean = limpiarTexto(text)
  if (!clean) return false
  if (/\b(turno|cita|horario|disponib|precio|costo|obra social|dolor|diente|odontograma|tratamiento|implante|limpieza)\b/.test(clean)) {
    return false
  }
  return /^(hola|buenas|buen dia|buenos dias|buenas tardes|buenas noches|que tal|como estas|gracias|muchas gracias|ayuda)(\s+(como estas|que tal|buen dia|buenos dias|buenas tardes|buenas noches|gracias|por favor|asistente|novadent))*$/.test(clean)
    || clean.includes('en que me podes ayudar')
    || clean.includes('que podes hacer')
}

function preguntaTurnoPropio(text: string) {
  const normalized = normalizar(text)
  return /\bmis?\b.*\b(turnos?|citas?)\b/.test(normalized)
    || /\b(cuando|cual|que)\b.*\b(mi|mis)\b.*\b(turno|cita)/.test(normalized)
    || /\bproximo\b.*\bturno\b/.test(normalized)
}

function preguntaHorarioODisponibilidad(text: string) {
  const normalized = normalizar(text)
  return /\b(horarios?|disponibilidad|disponibles?|atienden|abren|dias de atencion|turnos libres)\b/.test(normalized)
}

function formatoFecha(fecha: string) {
  return new Date(fecha + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })
}

function accionesDesde(values?: string[]) {
  return (values || []).map(value => ACTIONS[value]).filter((value): value is ChatAction => Boolean(value))
}

function respuestaTurnos(turnos: TurnoPropio[]): string {
  const now = new Date()
  const next = turnos
    .filter(item => item.estado !== 'CANCELADO')
    .filter(item => new Date(item.fecha + 'T' + item.hora).getTime() >= now.getTime())
    .sort((a, b) => new Date(a.fecha + 'T' + a.hora).getTime() - new Date(b.fecha + 'T' + b.hora).getTime())[0]
  if (!next) return 'No tenés turnos futuros registrados en tu ficha. Para confirmar o solicitar uno, consultá con recepción.'
  return 'Tu próximo turno registrado es el ' + formatoFecha(next.fecha) + ' a las ' + next.hora.slice(0, 5)
    + ' hs (' + next.motivo + '), con ' + next.odontologoNombre + '.'
}

export function ChatbotPage({ compact = false }: { compact?: boolean } = {}) {
  const { session } = useAuth()
  const [messages, setMessages] = useState<Message[]>([])
  const [question, setQuestion] = useState('')
  const [loading, setLoading] = useState(false)

  async function sendQuestion(rawText: string) {
    const text = rawText.trim()
    if (!text || loading || !session) return

    setQuestion('')
    setMessages(current => [...current, { id: createMessageId(), role: 'user', text }])

    if (esSaludoLocal(text)) {
      setMessages(current => [...current, {
        id: createMessageId(),
        role: 'assistant',
        text: LOCAL_GREETING_RESPONSE,
        actions: [ACTIONS['/mis-turnos'], ACTIONS['/mi-odontograma'], ACTIONS['/']],
      }])
      return
    }

    setLoading(true)
    try {
      if (preguntaTurnoPropio(text)) {
        try {
          const turnos = await apiRequest<TurnoPropio[]>('/portal-paciente/turnos', { token: session.token })
          setMessages(current => [...current, {
            id: createMessageId(), role: 'assistant', text: respuestaTurnos(turnos),
            actions: [ACTIONS['/mis-turnos']],
          }])
        } catch (turnosError) {
          const missingProfile = turnosError instanceof ApiError && (turnosError.status === 404 || turnosError.status === 409)
          setMessages(current => [...current, {
            id: createMessageId(),
            role: 'assistant',
            text: missingProfile
              ? 'Todavía no tenés una ficha de paciente vinculada a tu cuenta. Completá tus datos en el portal para consultar tus turnos registrados.'
              : 'No pude consultar tus turnos en este momento. No compartas tus datos personales por el chat; podés revisar el listado de tu cuenta.',
            actions: [ACTIONS['/mis-turnos']],
          }])
        }
      } else {
        const response = await apiRequest<ChatResponse>('/chatbot/ask', {
          method: 'POST',
          token: session.token,
          body: { mensaje: text },
        })
        const providerFailed = response.intencion === 'error'
        const isSchedule = preguntaHorarioODisponibilidad(text) || response.intencion === 'turno'
        const answer = providerFailed
          ? (isSchedule
              ? SCHEDULE_FALLBACK_RESPONSE
              : 'Ahora no hay fuentes aprobadas disponibles para responder esa consulta y no voy a inventar datos. Podés consultar tus turnos o tu odontograma desde tu cuenta.')
          : response.respuesta
        const actions = providerFailed
          ? (isSchedule ? [ACTIONS['/mis-turnos']] : [ACTIONS['/mis-turnos'], ACTIONS['/mi-odontograma']])
          : (accionesDesde(response.accionesSugeridas).length > 0
              ? accionesDesde(response.accionesSugeridas)
              : (isSchedule ? [ACTIONS['/mis-turnos']] : []))
        setMessages(current => [...current, {
          id: createMessageId(),
          role: 'assistant',
          text: answer,
          citations: providerFailed ? [] : response.citas ?? [],
          actions,
          noEvidence: !providerFailed && !response.citas?.length && answer.startsWith(NO_EVIDENCE),
        }])
      }
    } catch {
      const ownTurnQuestion = preguntaTurnoPropio(text)
      const isSchedule = preguntaHorarioODisponibilidad(text)
      setMessages(current => [...current, {
        id: createMessageId(),
        role: 'assistant',
        text: ownTurnQuestion
          ? 'No pude consultar tus turnos en este momento. No compartas tus datos personales por el chat; podés revisar el listado de tu cuenta.'
          : isSchedule
            ? 'No pude conectar con el asistente y no puedo confirmar horarios ni disponibilidad sin una fuente vigente aprobada. Podés revisar tus turnos registrados o comunicarte con recepción.'
            : 'No pude conectar con el asistente y no voy a inventar una respuesta. Probá de nuevo más tarde o usá las opciones de tu cuenta.',
        actions: [ACTIONS['/mis-turnos'], ACTIONS['/mi-odontograma']],
      }])
    } finally {
      setLoading(false)
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await sendQuestion(question)
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-3">
      {!compact && (
        <header className="space-y-1 rounded-2xl border border-slate-200/80 bg-white/80 px-4 py-3 shadow-sm backdrop-blur-xl sm:px-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Asistente Novadent</p>
          <h1 className="text-xl font-bold text-slate-950 sm:text-2xl">Consultas con fuentes</h1>
          <p className="max-w-3xl text-xs leading-5 text-slate-600 sm:text-sm">
            Responde consultas generales con documentos aprobados y muestra sus fuentes. No brinda diagnósticos ni reemplaza una consulta profesional.
          </p>
        </header>
      )}

      <section
        aria-label="Conversación"
        aria-live="polite"
        className="max-h-[340px] min-h-[200px] space-y-3 overflow-y-auto rounded-2xl border border-slate-200 bg-white/80 p-3.5 shadow-sm backdrop-blur-xl sm:max-h-[380px] sm:p-4"
      >
        {messages.length === 0 && (
          <div className="space-y-2.5 rounded-xl border border-blue-100 bg-blue-50/80 p-3 text-xs text-blue-950 sm:text-sm">
            <p className="leading-5">
              Escribí un saludo, consultá tu próximo turno o preguntá por información documentada. Los horarios y precios solo se informan si hay una fuente vigente aprobada.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {SUGGESTIONS.map(item => (
                <button
                  key={item}
                  type="button"
                  disabled={loading}
                  onClick={() => void sendQuestion(item)}
                  className="rounded-lg border border-blue-200 bg-white px-2.5 py-1.5 text-left text-xs font-semibold text-blue-900 transition hover:border-blue-400 hover:bg-blue-100/70 disabled:opacity-50"
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map(message => (
          <article key={message.id} className={'max-w-2xl rounded-2xl border p-3.5 ' + (message.role === 'user' ? 'ml-auto border-blue-600 bg-blue-700 text-white' : 'border-blue-100 bg-blue-50/90 text-slate-900')}>
            <p className="whitespace-pre-wrap text-sm leading-6">{message.text}</p>
            {message.noEvidence && <p className="mt-2.5 text-xs font-semibold text-amber-800">Sin evidencia suficiente en las fuentes.</p>}
            {!!message.actions?.length && <div className="mt-2.5 flex flex-wrap gap-2">
              {message.actions.map(action => <Link key={action.to} to={action.to} className="inline-flex min-h-8 items-center rounded-lg border border-blue-300 bg-white/90 px-3 py-1.5 text-xs font-semibold text-blue-900 hover:bg-blue-50">{action.label}</Link>)}
            </div>}
            {!!message.citations?.length && (
              <div className="mt-3 border-t border-slate-300 pt-2.5">
                <h2 className="mb-1.5 text-xs font-bold uppercase tracking-wide">Fuentes</h2>
                <ul className="space-y-1.5">
                  {message.citations.map((citation, index) => (
                    <li key={citation.id || String(index)}>
                      <span className="text-xs font-semibold">{citation.documento} · versión {citation.version}</span>
                      <details className="mt-1 text-xs">
                        <summary className="cursor-pointer">Ver fragmento citado</summary>
                        <p className="mt-1 rounded-lg bg-white/70 p-2 leading-5">{citation.fragmento}</p>
                      </details>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </article>
        ))}
        {loading && <p role="status" className="text-xs text-slate-500 sm:text-sm">Buscando fuentes y preparando respuesta…</p>}
      </section>

      <form onSubmit={submit} className="flex gap-2">
        <label className="sr-only" htmlFor="chat-question">Tu pregunta</label>
        <input id="chat-question" maxLength={1000} value={question}
          onChange={event => setQuestion(event.target.value)}
          placeholder="Escribí tu pregunta…" disabled={loading}
          className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white/90 px-3.5 py-2.5 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100" />
        <button type="submit" disabled={loading || !question.trim()}
          className="rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50">Enviar</button>
      </form>

      {!compact && session?.role === 'ADMINISTRADOR' && (
        <details className="group rounded-2xl border border-slate-200/80 bg-white/80 p-4 text-xs text-slate-600 shadow-2xs backdrop-blur-xl transition-all">
          <summary className="flex cursor-pointer list-none items-center justify-between font-bold text-slate-800 text-sm">
            <div className="flex items-center gap-2">
              <Stethoscope className="h-4 w-4 text-blue-600" />
              <span>Ficha Técnica y Arquitectura RAG</span>
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-800">
                Spring AI
              </span>
            </div>
            <ChevronDown className="h-4 w-4 text-slate-400 transition-transform group-open:rotate-180" />
          </summary>

          <div className="mt-3 grid grid-cols-1 gap-4 border-t border-slate-200/70 pt-3 md:grid-cols-2">
            <div>
              <p className="mb-1 flex items-center gap-1 font-semibold text-slate-700">
                <Sparkles className="h-3 w-3 text-amber-500" /> Stack Tecnológico:
              </p>
              <ul className="list-inside list-disc space-y-1 text-slate-600">
                <li><strong>Backend:</strong> Spring Boot 3.5.6 + Spring AI (VectorStore + OpenAI).</li>
                <li><strong>Fuentes controladas:</strong> solo documentos explícitamente aprobados e indexados.</li>
                <li><strong>Endpoints REST:</strong> <code>POST /api/chatbot/ask</code> y <code>POST /api/chatbot/knowledge</code>.</li>
              </ul>
            </div>
            <div>
              <p className="mb-1 flex items-center gap-1 font-semibold text-slate-700">
                <ShieldCheck className="h-3 w-3 text-emerald-600" /> Seguridad y Privacidad:
              </p>
              <ul className="list-inside list-disc space-y-1 text-slate-600">
                <li>Consultas de turnos propios aisladas en <code>GET /api/portal-paciente/turnos</code>.</li>
                <li>Respuestas verificables con citas documentales sin inventar horarios, precios ni consejos médicos.</li>
                <li>Respaldo local para saludos y navegación cuando el proveedor de IA no está configurado.</li>
              </ul>
            </div>
          </div>
        </details>
      )}
    </div>
  )
}
