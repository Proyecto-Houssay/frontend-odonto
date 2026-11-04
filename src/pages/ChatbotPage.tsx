import { useState, type FormEvent } from 'react'
import { ApiError, apiRequest } from '../lib/api'
import { useAuth } from '../auth/useAuth'

type Citation = { id: string; documento: string; version: string; fragmento: string }
type ChatResponse = {
  respuesta: string
  intencion: string
  timestamp: string
  citas?: Citation[]
}
type Message = {
  id: string
  role: 'user' | 'assistant'
  text: string
  citations?: Citation[]
  noEvidence?: boolean
}

const NO_EVIDENCE = 'No tengo información suficiente'

function createMessageId() {
  return globalThis.crypto?.randomUUID?.() ?? String(Date.now()) + '-' + String(Math.random()).slice(2)
}

export function ChatbotPage() {
  const { session } = useAuth()
  const [messages, setMessages] = useState<Message[]>([])
  const [question, setQuestion] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const text = question.trim()
    if (!text || loading || !session) return

    setQuestion('')
    setError('')
    setMessages((current) => [...current, { id: createMessageId(), role: 'user', text }])
    setLoading(true)
    try {
      const response = await apiRequest<ChatResponse>('/chatbot/ask', {
        method: 'POST',
        token: session.token,
        body: { mensaje: text },
      })
      setMessages((current) => [...current, {
        id: createMessageId(),
        role: 'assistant',
        text: response.respuesta,
        citations: response.citas ?? [],
        noEvidence: !response.citas?.length && response.respuesta.startsWith(NO_EVIDENCE),
      }])
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'No se pudo completar la consulta. Reintentá.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-5xl flex-col gap-5">
      <header>
        <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">Asistente Novadent</p>
        <h1 className="mt-1 text-3xl font-bold text-slate-950">Consultas con fuentes</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Responde consultas generales con documentos aprobados y muestra sus fuentes. No brinda diagnósticos ni reemplaza una consulta profesional.
        </p>
      </header>

      <section aria-label="Conversación" aria-live="polite" className="flex-1 space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        {messages.length === 0 && (
          <div className="rounded-xl bg-blue-50 p-4 text-sm text-blue-950">
            Preguntá sobre servicios, horarios u otra información documentada de la clínica.
          </div>
        )}
        {messages.map((message) => (
          <article
            key={message.id}
            className={'max-w-3xl rounded-2xl p-4 ' + (message.role === 'user' ? 'ml-auto bg-blue-700 text-white' : 'bg-slate-100 text-slate-900')}
          >
            <p className="whitespace-pre-wrap text-sm leading-6">{message.text}</p>
            {message.noEvidence && <p className="mt-3 text-xs font-semibold text-amber-800">Sin evidencia suficiente en las fuentes.</p>}
            {!!message.citations?.length && (
              <div className="mt-4 border-t border-slate-300 pt-3">
                <h2 className="mb-2 text-xs font-bold uppercase tracking-wide">Fuentes</h2>
                <ul className="space-y-2">
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
        {loading && <p role="status" className="text-sm text-slate-500">Buscando fuentes y preparando respuesta…</p>}
        {error && (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <p>{error}</p>
            <button type="button" className="mt-2 font-semibold underline" onClick={() => setError('')}>Cerrar</button>
          </div>
        )}
      </section>

      <form onSubmit={submit} className="flex gap-2">
        <label className="sr-only" htmlFor="chat-question">Tu pregunta</label>
        <input
          id="chat-question"
          maxLength={1000}
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Escribí tu pregunta…"
          disabled={loading}
          className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
        />
        <button
          type="submit"
          disabled={loading || !question.trim()}
          className="rounded-xl bg-blue-700 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Enviar
        </button>
      </form>
    </div>
  )
}
