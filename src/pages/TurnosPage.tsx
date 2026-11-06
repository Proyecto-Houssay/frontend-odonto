import React, { useEffect, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { apiRequest } from '../lib/api'

type Person = { id: number; nombre: string; apellido: string; activo?: boolean }
type Appointment = { id: number; fecha: string; hora: string; motivo: string; estado: string; paciente: Person; odontologo: Person }
type View = 'Hoy' | 'Semana' | 'Mes'

function localDay(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function dateAt(value: string) { return new Date(`${value}T12:00:00`) }
const label = (value: string) => dateAt(value).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })

export const TurnosPage: React.FC<{ token: string }> = ({ token }) => {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [patients, setPatients] = useState<Person[]>([])
  const [dentists, setDentists] = useState<Person[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [view, setView] = useState<View>('Semana')
  const [anchor, setAnchor] = useState(localDay(new Date()))
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ pacienteId: '', odontologoId: '', fecha: '', hora: '', motivo: '' })

  useEffect(() => {
    const controller = new AbortController()
    Promise.all([
      apiRequest<Appointment[]>('/turnos', { token, signal: controller.signal }),
      apiRequest<Person[]>('/pacientes', { token, signal: controller.signal }),
      apiRequest<Person[]>('/odontologos', { token, signal: controller.signal }),
    ]).then(([items, patientItems, dentistItems]) => {
      setAppointments(items); setPatients(patientItems); setDentists(dentistItems)
    }).catch((failure: unknown) => {
      if (!(failure instanceof DOMException && failure.name === 'AbortError')) setError(failure instanceof Error ? failure.message : 'No se pudo cargar la agenda.')
    }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [token])

  const current = dateAt(anchor)
  const start = new Date(current)
  const end = new Date(current)
  if (view === 'Semana') {
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7))
    end.setTime(start.getTime()); end.setDate(end.getDate() + 6)
  } else if (view === 'Mes') {
    start.setDate(1); end.setMonth(end.getMonth() + 1, 0)
  }
  const visible = appointments.filter(item => item.fecha >= localDay(start) && item.fecha <= localDay(end))
    .sort((a, b) => `${a.fecha}T${a.hora}`.localeCompare(`${b.fecha}T${b.hora}`))
  const weekDays = Array.from({ length: 7 }, (_, index) => { const day = new Date(start); day.setDate(day.getDate() + index); return localDay(day) })

  function move(direction: -1 | 1) {
    const next = dateAt(anchor)
    if (view === 'Mes') { next.setDate(1); next.setMonth(next.getMonth() + direction) }
    else next.setDate(next.getDate() + direction * (view === 'Semana' ? 7 : 1))
    setAnchor(localDay(next))
  }

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(''); setNotice('')
    try {
      const created = await apiRequest<Appointment>('/turnos', { method: 'POST', token, body: {
        pacienteId: Number(form.pacienteId), odontologoId: Number(form.odontologoId), fecha: form.fecha,
        hora: form.hora, motivo: form.motivo.trim(), estado: 'PENDIENTE',
      } })
      setAppointments(previous => [...previous, created]); setAnchor(form.fecha); setShowForm(false)
      setForm({ pacienteId: '', odontologoId: '', fecha: '', hora: '', motivo: '' })
      setNotice('Turno registrado correctamente.')
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'No se pudo registrar el turno.') }
    finally { setSaving(false) }
  }

  const inputClass = 'w-full rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:outline-2 focus-visible:outline-blue-600'
  return <div className="space-y-5">
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div><h2 className="flex items-center gap-2 text-2xl font-bold text-blue-950"><CalendarDays className="h-7 w-7 text-blue-600" />Gestión de turnos</h2><p className="text-sm text-slate-600">Agenda real del consultorio y asignación por profesional.</p></div>
      <button type="button" onClick={() => setShowForm(value => !value)} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 font-semibold text-white hover:bg-blue-700"><Plus className="h-4 w-4" />Nuevo turno</button>
    </header>
    {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {notice && <p role="status" className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">{notice}</p>}
    {showForm && <form onSubmit={create} className="grid gap-4 rounded-2xl border border-blue-100 bg-white/95 p-5 shadow-sm sm:grid-cols-2">
      <h3 className="sm:col-span-2 text-lg font-bold text-blue-950">Nuevo turno</h3>
      <label className="grid gap-1 text-sm font-semibold text-slate-700">Paciente<select className={inputClass} required value={form.pacienteId} onChange={event => setForm({ ...form, pacienteId: event.target.value })}><option value="">Seleccionar paciente</option>{patients.map(person => <option key={person.id} value={person.id}>{person.nombre} {person.apellido}</option>)}</select></label>
      <label className="grid gap-1 text-sm font-semibold text-slate-700">Odontólogo<select className={inputClass} required value={form.odontologoId} onChange={event => setForm({ ...form, odontologoId: event.target.value })}><option value="">Seleccionar odontólogo</option>{dentists.filter(person => person.activo !== false).map(person => <option key={person.id} value={person.id}>{person.nombre} {person.apellido}</option>)}</select></label>
      <label className="grid gap-1 text-sm font-semibold text-slate-700">Fecha<input className={inputClass} required type="date" min={localDay(new Date())} value={form.fecha} onChange={event => setForm({ ...form, fecha: event.target.value })} /></label>
      <label className="grid gap-1 text-sm font-semibold text-slate-700">Hora<input className={inputClass} required type="time" value={form.hora} onChange={event => setForm({ ...form, hora: event.target.value })} /></label>
      <label className="grid gap-1 text-sm font-semibold text-slate-700 sm:col-span-2">Motivo<input className={inputClass} maxLength={200} value={form.motivo} onChange={event => setForm({ ...form, motivo: event.target.value })} /></label>
      <div className="sm:col-span-2"><button type="submit" disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2.5 font-semibold text-white disabled:opacity-50">{saving ? 'Guardando…' : 'Guardar turno'}</button></div>
    </form>}
    <section className="rounded-2xl border border-blue-100 bg-white/95 p-5 shadow-sm" aria-label="Agenda de turnos">
      <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex rounded-lg border border-blue-100 bg-blue-50 p-1">{(['Hoy', 'Semana', 'Mes'] as View[]).map(option => <button type="button" key={option} onClick={() => { setView(option); setAnchor(localDay(new Date())) }} aria-pressed={view === option} className={`rounded-md px-3 py-1.5 text-sm font-medium ${view === option ? 'bg-blue-600 text-white' : 'text-blue-900 hover:bg-blue-100'}`}>{option}</button>)}</div><div className="flex items-center gap-2 text-sm font-semibold text-blue-950"><button type="button" onClick={() => move(-1)} aria-label="Período anterior" className="rounded-lg border p-1.5"><ChevronLeft className="h-4 w-4" /></button><span>{label(localDay(start))}{view !== 'Hoy' ? ` — ${label(localDay(end))}` : ''}</span><button type="button" onClick={() => move(1)} aria-label="Período siguiente" className="rounded-lg border p-1.5"><ChevronRight className="h-4 w-4" /></button></div></div>
      {loading ? <p role="status" className="mt-5 text-sm text-slate-600">Cargando turnos…</p> : view === 'Semana' ? <div className="mt-5 grid gap-2 md:grid-cols-7">{weekDays.map(day => <div key={day} className="min-h-28 rounded-xl border border-blue-100 bg-blue-50/40 p-2"><h3 className="mb-2 text-center text-xs font-bold uppercase text-blue-900">{dateAt(day).toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric' })}</h3>{visible.filter(item => item.fecha === day).map(item => <article key={item.id} className="mb-1 rounded-lg border border-blue-200 bg-white p-2 text-xs shadow-sm"><p className="font-bold text-blue-950">{item.hora.slice(0, 5)}</p><p className="font-bold text-blue-950">{item.paciente?.nombre} {item.paciente?.apellido}</p><p className="text-slate-600">{item.odontologo?.nombre} {item.odontologo?.apellido}</p><p className="text-slate-600">{item.motivo}</p><p className="font-semibold text-blue-700">{item.estado}</p></article>)}</div>)}</div> : <div className="mt-5 space-y-2">{visible.map(item => <article key={item.id} className="flex flex-wrap gap-x-5 gap-y-1 rounded-lg border border-blue-100 p-3 text-sm"><span className="font-semibold">{label(item.fecha)} · {item.hora.slice(0, 5)}</span><span>{item.paciente?.nombre} {item.paciente?.apellido}</span><span>{item.odontologo?.nombre} {item.odontologo?.apellido}</span><span>{item.motivo}</span><span className="text-blue-700">{item.estado}</span></article>)}</div>}
      {!loading && visible.length === 0 && <p className="mt-4 text-sm text-slate-600">No hay turnos registrados en este período.</p>}
    </section>
  </div>
}
