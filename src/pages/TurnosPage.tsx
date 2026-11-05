import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  Activity, ArrowLeft, ArrowRight, CalendarDays, Check, Clock3, MessageCircle,
  Search, Send, Sparkles, Stethoscope, Video, X,
} from 'lucide-react'

type Appointment = {
  id: number
  fecha: string
  hora: string
  motivo?: string
  estado?: string
  paciente?: { id: number; nombre: string; apellido: string }
  odontologo?: { id: number; nombre: string; apellido: string; especialidad?: { nombre: string } }
}
type Dentist = { id: number; nombre: string; apellido: string; activo?: boolean; especialidad?: { nombre: string } }
type ChatAnswer = { accionesSugeridas?: string[] }
type ChatTurn = { role: 'user' | 'assistant'; text: string; answer?: ChatAnswer }

const SESSION_KEY = 'novadent.auth.session'
const weekdays = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const prompts = ['¿Qué horarios libres hay esta semana?', 'Quiero una consulta por videollamada', 'Necesito reprogramar un turno']

function authToken() {
  try {
    const stored = sessionStorage.getItem(SESSION_KEY)
    return stored ? (JSON.parse(stored) as { token?: string }).token : undefined
  } catch { return undefined }
}
async function getJson<T>(path: string): Promise<T> {
  const token = authToken()
  const response = await fetch(`/api${path}`, { headers: { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token.replace(/^Bearer\s+/i, '')}` } : {}) } })
  if (!response.ok) throw new Error(response.status === 401 ? 'Iniciá sesión para consultar la agenda.' : `No se pudo cargar la agenda (HTTP ${response.status}).`)
  return response.json() as Promise<T>
}
async function askJosue(message: string) {
  const token = authToken()
  try {
    const response = await fetch('/api/chatbot/ask', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token.replace(/^Bearer\s+/i, '')}` } : {}) },
      body: JSON.stringify({ mensaje: message }),
    })
    if (!response.ok) throw new Error('chat unavailable')
    return await response.json() as { respuesta: string; accionesSugeridas?: string[] }
  } catch {
    return { respuesta: 'No pude conectar con el asistente ahora. Podés abrir Teletriaje para iniciar una solicitud y el equipo te ayudará a coordinarla.', accionesSugeridas: ['Ir a Teletriaje'] }
  }
}
function dateKey(date: Date) {
  const y = date.getFullYear(), m = String(date.getMonth() + 1).padStart(2, '0'), d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
function startOfWeek(date: Date) {
  const start = new Date(date)
  start.setDate(date.getDate() - ((date.getDay() + 6) % 7))
  start.setHours(0, 0, 0, 0)
  return start
}
function formatDate(date: Date, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat('es-AR', options).format(date)
}
function stateColor(state?: string) {
  const value = (state || '').toLowerCase()
  if (value.includes('cancel')) return 'bg-slate-100 text-slate-500 border-slate-200'
  if (value.includes('complet')) return 'bg-emerald-50 text-emerald-700 border-emerald-100'
  return 'bg-sky-50 text-sky-700 border-sky-100'
}

export function TurnosPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [dentists, setDentists] = useState<Dentist[]>([])
  const [week, setWeek] = useState(() => startOfWeek(new Date()))
  const [selectedDay, setSelectedDay] = useState(dateKey(new Date()))
  const [dentistFilter, setDentistFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [chatOpen, setChatOpen] = useState(true)
  const [question, setQuestion] = useState('')
  const [chatBusy, setChatBusy] = useState(false)
  const [chat, setChat] = useState<ChatTurn[]>([{ role: 'assistant', text: '¡Hola! Soy el asistente de Josué. Puedo ayudarte a encontrar un horario, orientarte sobre teleconsulta o llevarte al flujo de reserva.' }])

  const loadAgenda = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const [turnos, profesionales] = await Promise.all([
        getJson<Appointment[]>('/turnos'),
        getJson<Dentist[]>('/odontologos'),
      ])
      setAppointments(Array.isArray(turnos) ? turnos : [])
      setDentists(Array.isArray(profesionales) ? profesionales : [])
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'No se pudo cargar la agenda.')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { void loadAgenda() }, [loadAgenda])

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const day = new Date(week)
    day.setDate(week.getDate() + i)
    return day
  }), [week])
  const visibleAppointments = useMemo(() => appointments.filter((appointment) =>
    appointment.fecha === selectedDay && (dentistFilter === 'all' || String(appointment.odontologo?.id) === dentistFilter),
  ).sort((a, b) => a.hora.localeCompare(b.hora)), [appointments, selectedDay, dentistFilter])
  const upcomingCount = appointments.filter((appointment) => appointment.fecha >= dateKey(new Date()) && !(appointment.estado || '').toLowerCase().includes('cancel')).length
  const telemedicineCount = appointments.filter((appointment) => /tele|video|virtual/i.test(`${appointment.motivo || ''} ${appointment.estado || ''}`)).length
  const dayLabel = formatDate(new Date(`${selectedDay}T12:00:00`), { weekday: 'long', day: 'numeric', month: 'long' })

  const submitQuestion = async (text = question) => {
    const clean = text.trim()
    if (!clean || chatBusy) return
    setChat((current) => [...current, { role: 'user', text: clean }])
    setQuestion('')
    setChatBusy(true)
    const result = await askJosue(clean)
    setChat((current) => [...current, { role: 'assistant', text: result.respuesta, answer: result }])
    setChatBusy(false)
  }

  const jumpWeek = (offset: number) => {
    const next = new Date(week)
    next.setDate(next.getDate() + offset * 7)
    setWeek(startOfWeek(next))
    const nextSelected = new Date(selectedDay + 'T12:00:00')
    nextSelected.setDate(nextSelected.getDate() + offset * 7)
    setSelectedDay(dateKey(nextSelected))
  }

  return (
    <div className="space-y-6 pb-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-teal-700"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-50"><Activity size={16} /></span> ATENCIÓN CONECTADA</div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Agenda inteligente</h1>
          <p className="mt-1 text-sm text-slate-500">Turnos, teleconsulta y asistencia en un solo lugar.</p>
        </div>
        <a href="/teletriaje" className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-800"><Video size={17} /> Solicitar teleconsulta <ArrowRight size={16} /></a>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <SummaryCard icon={<CalendarDays size={18} />} label="Turnos próximos" value={String(upcomingCount)} detail="Citas en agenda" color="teal" />
        <SummaryCard icon={<Video size={18} />} label="Teleconsultas" value={String(telemedicineCount)} detail="Modalidad virtual" color="violet" />
        <SummaryCard icon={<Clock3 size={18} />} label="Día seleccionado" value={String(visibleAppointments.length)} detail="Turnos para esta fecha" color="blue" />
      </section>

      <div className={`grid items-start gap-5 ${chatOpen ? '2xl:grid-cols-[minmax(0,1fr)_360px]' : 'grid-cols-1'}`}>
        <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div><p className="text-xs font-medium uppercase tracking-wider text-slate-400">Vista semanal</p><h2 className="mt-1 text-lg font-bold capitalize text-slate-800">{formatDate(week, { month: 'long', year: 'numeric' })}</h2></div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="relative"><span className="sr-only">Filtrar por odontólogo</span><Stethoscope className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} /><select value={dentistFilter} onChange={(event) => setDentistFilter(event.target.value)} className="max-w-48 rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-700 outline-none focus:border-teal-500"><option value="all">Todo el equipo</option>{dentists.map((dentist) => <option key={dentist.id} value={dentist.id}>Dra./Dr. {dentist.apellido}</option>)}</select></label>
              <div className="flex rounded-lg border border-slate-200 p-0.5"><button onClick={() => jumpWeek(-1)} aria-label="Semana anterior" className="rounded-md p-2 text-slate-500 hover:bg-slate-100"><ArrowLeft size={16} /></button><button onClick={() => { setWeek(startOfWeek(new Date())); setSelectedDay(dateKey(new Date())) }} className="px-2 text-xs font-semibold text-slate-600 hover:text-teal-700">Hoy</button><button onClick={() => jumpWeek(1)} aria-label="Semana siguiente" className="rounded-md p-2 text-slate-500 hover:bg-slate-100"><ArrowRight size={16} /></button></div>
              {!chatOpen && <button onClick={() => setChatOpen(true)} className="inline-flex items-center gap-2 rounded-lg bg-violet-50 px-3 py-2 text-sm font-semibold text-violet-700"><Sparkles size={15} /> Asistente</button>}
            </div>
          </div>

          <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/70">
            {weekDays.map((day, index) => {
              const key = dateKey(day), isSelected = key === selectedDay, isToday = key === dateKey(new Date())
              const count = appointments.filter((appointment) => appointment.fecha === key && (dentistFilter === 'all' || String(appointment.odontologo?.id) === dentistFilter)).length
              return <button key={key} onClick={() => setSelectedDay(key)} className={`relative flex min-h-[78px] flex-col items-center justify-center gap-1 border-r border-slate-100 px-1 transition last:border-r-0 ${isSelected ? 'bg-teal-50' : 'hover:bg-white'}`}><span className={`text-[11px] font-semibold uppercase ${isSelected ? 'text-teal-700' : 'text-slate-400'}`}>{weekdays[index]}</span><span className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${isSelected ? 'bg-teal-700 text-white' : isToday ? 'border border-teal-200 text-teal-700' : 'text-slate-700'}`}>{day.getDate()}</span><span className="text-[10px] text-slate-400">{count ? `${count} ${count === 1 ? 'turno' : 'turnos'}` : '—'}</span></button>
            })}
          </div>

          <div className="px-4 pb-5 pt-4 sm:px-5">
            <div className="mb-4 flex items-center justify-between"><div><h3 className="text-base font-bold capitalize text-slate-800">{dayLabel}</h3><p className="text-xs text-slate-400">Agenda del día</p></div><button onClick={() => void loadAgenda()} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-teal-700" aria-label="Actualizar agenda"><Activity size={16} /></button></div>
            {loading ? <div className="space-y-3">{[1, 2, 3].map((item) => <div key={item} className="h-[68px] animate-pulse rounded-xl bg-slate-100" />)}</div> : loadError ? <div className="rounded-xl border border-amber-100 bg-amber-50 p-4 text-sm text-amber-800"><p className="font-semibold">No pudimos sincronizar la agenda</p><p className="mt-1">{loadError}</p><button onClick={() => void loadAgenda()} className="mt-3 font-semibold underline">Reintentar</button></div> : <div className="space-y-2">
              {visibleAppointments.length ? visibleAppointments.map((appointment) => <article key={appointment.id} className="group flex gap-3 rounded-xl border border-slate-100 p-3 transition hover:border-teal-200 hover:bg-teal-50/30 sm:gap-4"><div className="w-14 shrink-0 border-r border-slate-100 pr-3 pt-1 text-right"><span className="text-sm font-bold text-slate-700">{appointment.hora.slice(0, 5)}</span><span className="mt-1 block text-[10px] text-slate-400">30 min</span></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="truncate text-sm font-semibold text-slate-800">{appointment.paciente ? `${appointment.paciente.nombre} ${appointment.paciente.apellido}` : 'Paciente'}</p><span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${stateColor(appointment.estado)}`}>{appointment.estado || 'Confirmado'}</span>{/tele|video|virtual/i.test(`${appointment.motivo || ''} ${appointment.estado || ''}`) && <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-medium text-violet-700"><Video size={11} /> Virtual</span>}</div><p className="mt-1 truncate text-xs text-slate-500">{appointment.motivo || 'Consulta odontológica'} · {appointment.odontologo ? `Dr. ${appointment.odontologo.nombre} ${appointment.odontologo.apellido}` : 'Profesional asignado'}</p></div><span className="hidden self-center text-xs text-slate-400 sm:block">#{appointment.id}</span></article>) : <div className="rounded-xl border border-dashed border-slate-200 px-4 py-10 text-center"><div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-slate-50 text-slate-400"><CalendarDays size={20} /></div><h4 className="mt-3 text-sm font-semibold text-slate-700">Agenda libre para este día</h4><p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-slate-500">Pedile al asistente que busque alternativas o iniciá una solicitud de teleconsulta.</p><button onClick={() => { setChatOpen(true); setTimeout(() => void submitQuestion('Buscame horarios disponibles para una teleconsulta'), 0) }} className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-teal-700 hover:text-teal-900"><Sparkles size={14} /> Buscar con el asistente</button></div>}
            </div>}
            <div className="mt-5 flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2.5 text-[11px] leading-5 text-slate-500"><Check size={14} className="mt-0.5 shrink-0 text-teal-600" />Los cambios de disponibilidad se validan nuevamente al confirmar la reserva.</div>
          </div>
        </section>

        {chatOpen && <aside className="flex max-h-[760px] min-h-[480px] flex-col overflow-hidden rounded-2xl border border-violet-100 bg-white shadow-sm">
          <div className="flex items-center justify-between bg-gradient-to-r from-violet-700 to-indigo-600 px-4 py-4 text-white"><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15"><Sparkles size={18} /></div><div><h2 className="text-sm font-bold">Asistente de Josué</h2><p className="mt-0.5 flex items-center gap-1 text-[10px] text-violet-100"><span className="h-1.5 w-1.5 rounded-full bg-emerald-300" /> Agenda y telemedicina</p></div></div><button onClick={() => setChatOpen(false)} aria-label="Cerrar asistente" className="rounded-lg p-2 text-white/80 hover:bg-white/10"><X size={17} /></button></div>
          <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50/60 p-3" aria-live="polite">
            {chat.map((message, index) => <div key={`${index}-${message.role}`} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[92%] rounded-2xl px-3 py-2.5 text-xs leading-5 ${message.role === 'user' ? 'rounded-br-md bg-violet-700 text-white' : 'rounded-bl-md border border-slate-100 bg-white text-slate-700 shadow-xs'}`}><p className="whitespace-pre-wrap">{message.text}</p>{message.answer?.accionesSugeridas?.slice(0, 2).map((action) => <button key={action} onClick={() => { if (/teletriaje/i.test(action)) window.location.assign('/teletriaje'); else if (/turno|agenda|calendario/i.test(action)) setSelectedDay(dateKey(new Date())); else void submitQuestion(action) }} className="mt-2 block w-full rounded-lg border border-violet-100 bg-violet-50 px-2 py-1.5 text-left text-[11px] font-medium text-violet-700 hover:bg-violet-100">{action} <ArrowRight className="ml-1 inline" size={12} /></button>)}</div></div>)}
            {chatBusy && <div className="w-fit rounded-2xl rounded-bl-md border border-slate-100 bg-white px-3 py-2 text-xs text-slate-400">Josué está pensando…</div>}
            {chat.length === 1 && <div className="space-y-2 pt-1">{prompts.map((prompt) => <button key={prompt} onClick={() => void submitQuestion(prompt)} className="block w-full rounded-xl border border-violet-100 bg-white px-3 py-2.5 text-left text-[11px] font-medium text-slate-600 transition hover:border-violet-300 hover:text-violet-700"><MessageCircle className="mr-2 inline text-violet-500" size={13} />{prompt}</button>)}</div>}
          </div>
          <form onSubmit={(event) => { event.preventDefault(); void submitQuestion() }} className="border-t border-slate-100 bg-white p-3"><div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 focus-within:border-violet-400 focus-within:bg-white"><Search size={15} className="shrink-0 text-slate-400" /><input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Preguntá por horarios…" className="min-w-0 flex-1 bg-transparent py-3 text-xs outline-none placeholder:text-slate-400" /><button type="submit" disabled={!question.trim() || chatBusy} aria-label="Enviar consulta" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-700 text-white transition hover:bg-violet-800 disabled:opacity-40"><Send size={14} /></button></div><p className="mt-2 text-center text-[9px] text-slate-400">La reserva se confirma en el flujo seguro de teletriaje.</p></form>
        </aside>}
      </div>
    </div>
  )
}

function SummaryCard({ icon, label, value, detail, color }: { icon: ReactNode; label: string; value: string; detail: string; color: 'teal' | 'violet' | 'blue' }) {
  const colors = { teal: 'bg-teal-50 text-teal-700', violet: 'bg-violet-50 text-violet-700', blue: 'bg-blue-50 text-blue-700' }
  return <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-start justify-between"><div><p className="text-xs font-medium text-slate-500">{label}</p><p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{value}</p></div><span className={`flex h-9 w-9 items-center justify-center rounded-xl ${colors[color]}`}>{icon}</span></div><p className="mt-1 text-[11px] text-slate-400">{detail}</p></div>
}
