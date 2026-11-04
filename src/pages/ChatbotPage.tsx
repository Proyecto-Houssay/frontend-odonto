import { useState } from 'react'
import type { FormEvent } from 'react'
import { apiRequest, ApiError } from '../lib/api'

type Citation = { id: string; documento: string; version: string; fragmento: string }
type ChatResponse = {
  respuesta: string
  intencion: string
  timestamp: string
  citas: Citation[]
}
type Message = { id: string; role: 'user' | 'assistant'; text: string; citations?: Citation[]; noEvidence?: boolean }

const SIN_EVIDENCIA = 'No tengo información suficiente'

export function ChatbotPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [question, setQuestion] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent) {
    event.preventDefault()
    const text = question.trim()
    if (!text || loading) return

    setQuestion('')
    setError('')
    setMessages((current) => [...current, { id: crypto.randomUUID(), role: 'user', text }])
    setLoading(true)
    try {
      const response = await apiRequest<ChatResponse>('/api/chatbot/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mensaje: text }),
      })
      setMessages((current) => [...current, {
        id: crypto.randomUUID(), role: 'assistant', text: response.respuesta,
        citations: response.citas ?? [],
        noEvidence: !response.citas?.length && response.respuesta.startsWith(SIN_EVIDENCIA),
      }])
    } catch (caught) {
      const message = caught instanceof ApiError ? caught.message : 'Ocurrió un error inesperado.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-[calc(100vh-6rem)] max-w-5xl flex-col gap-5 px-4 py-8 sm:px-6">
      <header>
        <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">Asistente Novadent</p>
        <h1 className="mt-1 text-3xl font-bold text-slate-950">Consultas con fuentes</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          El asistente responde información general usando documentos aprobados y muestra de dónde proviene.
          No brinda diagnósticos ni reemplaza la consulta con un profesional.
        </p>
      </header>

      <section aria-label="Conversación" aria-live="polite" className="flex-1 space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        {messages.length === 0 && (
          <div className="rounded-xl bg-blue-50 p-4 text-sm text-blue-950">
            Escribí una pregunta general sobre servicios, horarios o información documentada de la clínica.
          </div>
        )}
        {messages.map((message) => (
          <article key={message.id} className={`max-w-3xl rounded-2xl p-4 ${message.role === 'user' ? 'ml-auto bg-blue-700 text-white' : 'bg-slate-100 text-slate-900'}`}>
            <p className="whitespace-pre-wrap text-sm leading-6">{message.text}</p>
            {message.noEvidence && <p className="mt-3 text-xs font-semibold text-amber-800">Sin evidencia suficiente en las fuentes.</p>}
            {!!message.citations?.length && (
              <div className="mt-4 border-t border-slate-300 pt-3">
                <h2 className="mb-2 text-xs font-bold uppercase tracking-wide">Fuentes</h2>
                <ul className="space-y-2">
                  {message.citations.map((citation, index) => (
                    <li key={citation.id} id={`cita-${message.id}-${index}`}>
                      <a className="text-xs font-semibold underline underline-offset-2" href={`#cita-${message.id}-${index}`}>
                        {citation.documento} · versión {citation.version}
                      </a>
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
        <input id="chat-question" maxLength={1000} value={question} onChange={(event) => setQuestion(event.target.value)}
          placeholder="Escribí tu pregunta…" disabled={loading}
          className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100" />
        <button type="submit" disabled={loading || !question.trim()}
          className="rounded-xl bg-blue-700 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50">
          Enviar
        </button>
      </form>
    </main>
  )
}
