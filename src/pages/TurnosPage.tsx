import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import {
  Activity, ArrowLeft, ArrowRight, BellPlus, CalendarDays, Check, Clock3,
  ExternalLink, MessageCircle, Search, Send, Sparkles, Stethoscope, Video, X,
} from 'lucide-react'

type Appointment = {
  id: number
  fecha: string
  hora: string
  motivo?: string
  estado?: string
  telemedicina?: boolean
  estadoSala?: string
  consentimientoInformado?: boolean
  enlaceVideo?: string | null
  enlaceFuncional?: boolean
  paciente?: { id: number; nombre: string; apellido: string }
  odontologo?: { id: number; nombre: string; apellido: string; especialidad?: { nombre: string } }
}
type Dentist = { id: number; nombre: string; apellido: string; activo?: boolean; especialidad?: { nombre: string } }
type TeleAppointment = {
  id: number; turnoId: number; fecha: string; hora: string; estadoTurno?: string
  pacienteId?: number; pacienteNombre?: string; odontologoId?: number; odontologoNombre?: string
  estadoSala?: string; consentimientoInformado?: boolean; enlaceVideo?: string | null; enlaceFuncional?: boolean
}
type AvailabilityResponse = { odontologoId: number; fecha: string; horariosDisponibles: string[] }
type PatientOption = { id: number; nombre: string; apellido: string; dni?: string }
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
async function getJson<T>(path: string, sessionToken?: string): Promise<T> {
  const token = sessionToken || authToken()
  const response = await fetch(`/api${path}`, { headers: { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token.replace(/^Bearer\s+/i, '')}` } : {}) } })
  if (!response.ok) throw new Error(response.status === 401 ? 'Iniciá sesión para consultar la agenda.' : `No se pudo cargar la agenda (HTTP ${response.status}).`)
  return response.json() as Promise<T>
}
async function postJson<T>(path: string, body: unknown, sessionToken?: string): Promise<T> {
  const token = sessionToken || authToken()
  const response = await fetch(`/api${path}`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token.replace(/^Bearer\s+/i, '')}` } : {}) },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    const raw = await response.text()
    throw new Error(raw || `No se pudo completar la reserva (HTTP ${response.status}).`)
  }
  return response.json() as Promise<T>
}
async function askJosue(message: string, sessionToken?: string) {
  const token = sessionToken || authToken()
  const lower = message.toLowerCase()
  try {
    const response = await fetch('/api/chatbot/ask', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token.replace(/^Bearer\s+/i, '')}` } : {}) },
      body: JSON.stringify({ mensaje: message }),
    })
    if (!response.ok) throw new Error('chat unavailable')
    const data = await response.json() as { respuesta: string; intencion?: string; accionesSugeridas?: string[] }
    if (data.intencion === 'error' || /no se pudo procesar/i.test(data.respuesta || '')) {
      throw new Error('fallback')
    }
    return data
  } catch {
    if (/horario|libre|disponib|cu[aá]ndo|semana/i.test(lower)) {
      return {
        respuesta: 'Podés consultar los horarios disponibles de esta semana seleccionando un odontólogo y haciendo clic en "Ver horarios libres" arriba en la agenda, o eligiendo cualquier día en el calendario. Atendemos de lunes a viernes de 8:00 a 20:00.',
        accionesSugeridas: ['Ver turnos de hoy', 'Ir a Teletriaje'],
      }
    }
    if (/videollamada|teleconsulta|virtual|remota/i.test(lower)) {
      return {
        respuesta: 'Las teleconsultas se gestionan con prioridad clínica a través del módulo de Teletriaje. Podés iniciar una solicitud para que el equipo clínico evalúe el caso y asigne la sala virtual.',
        accionesSugeridas: ['Ir a Teletriaje'],
      }
    }
    if (/reprogram|cancel|cambiar/i.test(lower)) {
      return {
        respuesta: 'Para reprogramar o cancelar un turno, seleccioná la cita en el calendario o gestioná el cambio a través de recepción.',
        accionesSugeridas: ['Ver turnos de hoy'],
      }
    }
    return {
      respuesta: '¡Hola! Podés consultar los horarios disponibles en el calendario, solicitar turnos presenciales o abrir Teletriaje para iniciar una teleconsulta.',
      accionesSugeridas: ['Ir a Teletriaje', 'Ver turnos de hoy'],
    }
  }
}
function addReminder(appointment: Appointment) {
  const escapeIcs = (value: string) => value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;')
  const dateTime = `${appointment.fecha.replaceAll('-', '')}T${appointment.hora.replaceAll(':', '').slice(0, 4)}00`
  const title = appointment.telemedicina ? 'Teleconsulta odontológica' : 'Turno odontológico'
  const description = `${appointment.motivo || 'Consulta odontológica'}${appointment.odontologo ? ` · Dr./Dra. ${appointment.odontologo.nombre} ${appointment.odontologo.apellido}` : ''}${appointment.enlaceFuncional && appointment.enlaceVideo ? ` · Videollamada: ${appointment.enlaceVideo}` : ''}`
  const content = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Novadent//Agenda//ES', 'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT', `UID:novadent-turno-${appointment.id}@agenda`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}`,
    `DTSTART;TZID=America/Argentina/Buenos_Aires:${dateTime}`, `SUMMARY:${escapeIcs(title)}`, `DESCRIPTION:${escapeIcs(description)}`,
    'BEGIN:VALARM', 'TRIGGER:-PT30M', 'ACTION:DISPLAY', `DESCRIPTION:${escapeIcs(`En 30 minutos: ${title}`)}`, 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR', '',
  ].join('\r\n')
  const url = URL.createObjectURL(new Blob([content], { type: 'text/calendar;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `novadent-turno-${appointment.id}-${appointment.fecha}.ics`
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
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
function addMonthsClamped(date: Date, offset: number) {
  const target = new Date(date.getFullYear(), date.getMonth() + offset, 1, 12)
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
  target.setDate(Math.min(date.getDate(), lastDay))
  return target
}
function monthRangeLabel(date: Date) {
  const first = new Date(date.getFullYear(), date.getMonth(), 1, 12)
  const last = new Date(date.getFullYear(), date.getMonth() + 1, 0, 12)
  return `${formatDate(first, { day: 'numeric', month: 'short' })} – ${formatDate(last, { day: 'numeric', month: 'short', year: 'numeric' })}`
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

export function TurnosPage({ token }: { token: string }) {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [dentists, setDentists] = useState<Dentist[]>([])
  const [availableSlots, setAvailableSlots] = useState<string[]>([])
  const [availabilityLoading, setAvailabilityLoading] = useState(false)
  const [availabilityError, setAvailabilityError] = useState('')
  const [patients, setPatients] = useState<PatientOption[]>([])
  const [showAppointmentForm, setShowAppointmentForm] = useState(false)
  const [appointmentPatients, setAppointmentPatients] = useState<PatientOption[]>([])
  const [appointmentForm, setAppointmentForm] = useState({ pacienteId: '', odontologoId: '', fecha: dateKey(new Date()), hora: '', motivo: '' })
  const [appointmentSaving, setAppointmentSaving] = useState(false)
  const [appointmentError, setAppointmentError] = useState('')
  const [appointmentSuccess, setAppointmentSuccess] = useState('')
  const [selectedSlot, setSelectedSlot] = useState<{ fecha: string; hora: string; odontologoId: number } | null>(null)
  const [selectedPatientId, setSelectedPatientId] = useState('')
  const [bookingReason, setBookingReason] = useState('')
  const [bookingConsent, setBookingConsent] = useState(false)
  const [bookingBusy, setBookingBusy] = useState(false)
  const [bookingError, setBookingError] = useState('')
  const [bookingSuccess, setBookingSuccess] = useState('')
  const [week, setWeek] = useState(() => startOfWeek(new Date()))
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const current = new Date()
    return new Date(current.getFullYear(), current.getMonth(), 1, 12)
  })
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week')
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
      const periodStart = viewMode === 'month'
        ? new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1, 12)
        : week
      const periodEnd = viewMode === 'month'
        ? new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0, 12)
        : new Date(week)
      if (viewMode === 'week') periodEnd.setDate(week.getDate() + 6)
      const from = dateKey(periodStart), through = dateKey(periodEnd)
      const filter = dentistFilter === 'all' ? '' : `&odontologoId=${encodeURIComponent(dentistFilter)}`
      const [turnos, profesionales, virtuales] = await Promise.all([
        getJson<Appointment[]>('/turnos', token),
        getJson<Dentist[]>('/odontologos', token),
        getJson<TeleAppointment[]>(`/teletriaje/citas/agenda?desde=${from}&hasta=${through}${filter}`, token),
      ])
      const citasVirtuales = Array.isArray(virtuales) ? virtuales : []
      const turnosVirtuales = new Set(citasVirtuales.map((cita) => cita.turnoId))
      const turnosComunes = (Array.isArray(turnos) ? turnos : [])
        .filter((turno) => turno.fecha >= from && turno.fecha <= through && !turnosVirtuales.has(turno.id))
        .filter((turno) => dentistFilter === 'all' || String(turno.odontologo?.id) === dentistFilter)
      const citasMapeadas: Appointment[] = citasVirtuales.map((cita) => ({
        id: cita.turnoId,
        fecha: cita.fecha,
        hora: cita.hora,
        motivo: 'Teleconsulta odontológica',
        estado: cita.estadoTurno || 'CONFIRMADO',
        telemedicina: true,
        estadoSala: cita.estadoSala,
        consentimientoInformado: cita.consentimientoInformado,
        enlaceVideo: cita.enlaceVideo,
        enlaceFuncional: cita.enlaceFuncional,
        paciente: cita.pacienteNombre ? { id: cita.pacienteId || 0, nombre: cita.pacienteNombre, apellido: '' } : undefined,
        odontologo: cita.odontologoNombre ? { id: cita.odontologoId || 0, nombre: cita.odontologoNombre, apellido: '' } : undefined,
      }))
      setAppointments([...turnosComunes, ...citasMapeadas].sort((a, b) => `${a.fecha}${a.hora}`.localeCompare(`${b.fecha}${b.hora}`)))
      setDentists(Array.isArray(profesionales) ? profesionales : [])
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'No se pudo cargar la agenda.')
    } finally { setLoading(false) }
  }, [week, calendarMonth, viewMode, dentistFilter, token])

  useEffect(() => { void loadAgenda() }, [loadAgenda])

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const day = new Date(week)
    day.setDate(week.getDate() + i)
    return day
  }), [week])
  const monthDays = useMemo(() => {
    const first = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1, 12)
    const last = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0, 12)
    const start = startOfWeek(first)
    const end = startOfWeek(last)
    end.setDate(end.getDate() + 6)
    const days: Date[] = []
    for (const day = new Date(start); day <= end; day.setDate(day.getDate() + 1)) days.push(new Date(day))
    return days
  }, [calendarMonth])
  const visibleAppointments = useMemo(() => appointments.filter((appointment) =>
    appointment.fecha === selectedDay,
  ).sort((a, b) => a.hora.localeCompare(b.hora)), [appointments, selectedDay, dentistFilter])
  const upcomingCount = appointments.filter((appointment) => appointment.fecha >= dateKey(new Date()) && !(appointment.estado || '').toLowerCase().includes('cancel')).length
  const telemedicineCount = appointments.filter((appointment) => appointment.telemedicina).length
  const dayLabel = formatDate(new Date(`${selectedDay}T12:00:00`), { weekday: 'long', day: 'numeric', month: 'long' })

  const submitQuestion = async (text = question) => {
    const clean = text.trim()
    if (!clean || chatBusy) return
    setChat((current) => [...current, { role: 'user', text: clean }])
    setQuestion('')
    setChatBusy(true)
    const result = await askJosue(clean, token)
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

  const jumpPeriod = (offset: number) => {
    if (viewMode === 'week') {
      jumpWeek(offset)
      return
    }
    const selectedDate = new Date(`${selectedDay}T12:00:00`)
    const nextDate = addMonthsClamped(selectedDate, offset)
    setSelectedDay(dateKey(nextDate))
    setWeek(startOfWeek(nextDate))
    setCalendarMonth(new Date(nextDate.getFullYear(), nextDate.getMonth(), 1, 12))
  }

  const findAvailableSlots = async () => {
    if (dentistFilter === 'all') {
      setAvailabilityError('Elegí un profesional para calcular sus horarios disponibles.')
      return
    }
    setAvailabilityLoading(true)
    setAvailabilityError('')
    setAvailableSlots([])
    try {
      const result = await getJson<AvailabilityResponse>(`/turnos/disponibilidad/fecha/${selectedDay}?odontologoId=${encodeURIComponent(dentistFilter)}`, token)
      setAvailableSlots(result.horariosDisponibles || [])
    } catch (error) {
      setAvailabilityError(error instanceof Error ? error.message : 'No se pudieron consultar los horarios.')
    } finally { setAvailabilityLoading(false) }
  }

  const startBooking = async (hora: string) => {
    setBookingError('')
    setBookingSuccess('')
    setSelectedSlot({ fecha: selectedDay, hora, odontologoId: Number(dentistFilter) })
    setBookingConsent(false)
    try {
      const foundPatients = await getJson<PatientOption[]>('/pacientes', token)
      setPatients(Array.isArray(foundPatients) ? foundPatients : [])
    } catch (error) {
      setBookingError(error instanceof Error ? error.message : 'No se pudo cargar la lista de pacientes.')
    }
  }

  const confirmTelemedicineBooking = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedSlot || !selectedPatientId || !bookingReason.trim() || !bookingConsent) return
    setBookingBusy(true)
    setBookingError('')
    try {
      const result = await postJson<{ fecha: string; hora: string; enlaceFuncional?: boolean }>('/teletriaje/reservas', {
        solicitud: {
          pacienteId: Number(selectedPatientId), motivoConsulta: bookingReason.trim(),
          prioridadSugerida: 'VERDE', signosAlarma: false, origen: 'AUTONOMO',
        },
        reserva: {
          odontologoId: selectedSlot.odontologoId, fecha: selectedSlot.fecha, hora: selectedSlot.hora,
          motivo: bookingReason.trim(), consentimientoInformado: true, requiereVideollamada: true,
        },
      }, token)
      setBookingSuccess(`Teleconsulta confirmada para el ${result.fecha} a las ${result.hora.slice(0, 5)}. ${result.enlaceFuncional ? 'El enlace de videollamada está listo.' : 'La sala virtual queda pendiente de configuración.'}`)
      setSelectedSlot(null)
      setAvailableSlots([])
      setBookingReason('')
      setSelectedPatientId('')
      setBookingConsent(false)
      await loadAgenda()
    } catch (error) {
      setBookingError(error instanceof Error ? error.message : 'No se pudo reservar; el horario puede haberse ocupado. Volvé a consultar disponibilidad.')
      setAvailableSlots([])
    } finally { setBookingBusy(false) }
  }

  const openAppointmentForm = async () => {
    setAppointmentError('')
    setAppointmentSuccess('')
    setShowAppointmentForm((open) => !open)
    if (appointmentPatients.length) return
    try {
      const foundPatients = await getJson<PatientOption[]>('/pacientes', token)
      setAppointmentPatients(Array.isArray(foundPatients) ? foundPatients : [])
    } catch (error) {
      setAppointmentError(error instanceof Error ? error.message : 'No se pudo cargar la lista de pacientes.')
    }
  }

  const createAppointment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setAppointmentSaving(true)
    setAppointmentError('')
    setAppointmentSuccess('')
    try {
      await postJson<Appointment>('/turnos', {
        pacienteId: Number(appointmentForm.pacienteId),
        odontologoId: Number(appointmentForm.odontologoId),
        fecha: appointmentForm.fecha,
        hora: appointmentForm.hora,
        motivo: appointmentForm.motivo.trim(),
        estado: 'PENDIENTE',
      }, token)
      const appointmentDate = new Date(`${appointmentForm.fecha}T12:00:00`)
      setWeek(startOfWeek(appointmentDate))
      setSelectedDay(appointmentForm.fecha)
      setCalendarMonth(new Date(appointmentDate.getFullYear(), appointmentDate.getMonth(), 1, 12))
      setAppointmentSuccess('Turno presencial registrado correctamente.')
      setAppointmentForm({ pacienteId: '', odontologoId: '', fecha: dateKey(new Date()), hora: '', motivo: '' })
      setShowAppointmentForm(false)
    } catch (error) {
      setAppointmentError(error instanceof Error ? error.message : 'No se pudo registrar el turno.')
    } finally {
      setAppointmentSaving(false)
    }
  }

  return (
    <div className="space-y-6 pb-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-teal-700"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-50"><Activity size={16} /></span> ATENCIÓN CONECTADA</div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Agenda inteligente</h1>
          <p className="mt-1 text-sm text-slate-500">Turnos, teleconsulta y asistencia en un solo lugar.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void openAppointmentForm()} className="inline-flex items-center justify-center gap-2 rounded-xl border border-teal-200 bg-white px-4 py-3 text-sm font-semibold text-teal-800 shadow-sm transition hover:bg-teal-50"><CalendarDays size={17} /> Nuevo turno presencial</button>
          <a href="/teletriaje" className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-800"><Video size={17} /> Solicitar teleconsulta <ArrowRight size={16} /></a>
        </div>
      </header>

      {bookingSuccess && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{bookingSuccess}</div>}
      {appointmentSuccess && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{appointmentSuccess}</div>}
      {showAppointmentForm && <form onSubmit={(event) => void createAppointment(event)} className="grid gap-4 rounded-2xl border border-teal-100 bg-white p-5 shadow-sm sm:grid-cols-2">
        <h2 className="text-lg font-bold text-slate-900 sm:col-span-2">Registrar turno presencial</h2>
        <label className="grid gap-1 text-sm font-medium text-slate-700">Paciente<select required value={appointmentForm.pacienteId} onChange={(event) => setAppointmentForm({ ...appointmentForm, pacienteId: event.target.value })} className="rounded-lg border border-slate-200 bg-white px-3 py-2"><option value="">Seleccionar paciente</option>{appointmentPatients.map((patient) => <option key={patient.id} value={patient.id}>{patient.nombre} {patient.apellido}</option>)}</select></label>
        <label className="grid gap-1 text-sm font-medium text-slate-700">Odontólogo<select required value={appointmentForm.odontologoId} onChange={(event) => setAppointmentForm({ ...appointmentForm, odontologoId: event.target.value })} className="rounded-lg border border-slate-200 bg-white px-3 py-2"><option value="">Seleccionar odontólogo</option>{dentists.filter((dentist) => dentist.activo !== false).map((dentist) => <option key={dentist.id} value={dentist.id}>{dentist.nombre} {dentist.apellido}</option>)}</select></label>
        <label className="grid gap-1 text-sm font-medium text-slate-700">Fecha<input required type="date" min={dateKey(new Date())} value={appointmentForm.fecha} onChange={(event) => setAppointmentForm({ ...appointmentForm, fecha: event.target.value })} className="rounded-lg border border-slate-200 px-3 py-2" /></label>
        <label className="grid gap-1 text-sm font-medium text-slate-700">Hora<input required type="time" value={appointmentForm.hora} onChange={(event) => setAppointmentForm({ ...appointmentForm, hora: event.target.value })} className="rounded-lg border border-slate-200 px-3 py-2" /></label>
        <label className="grid gap-1 text-sm font-medium text-slate-700 sm:col-span-2">Motivo<input required maxLength={200} value={appointmentForm.motivo} onChange={(event) => setAppointmentForm({ ...appointmentForm, motivo: event.target.value })} className="rounded-lg border border-slate-200 px-3 py-2" /></label>
        {appointmentError && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 sm:col-span-2">{appointmentError}</p>}
        <div className="flex gap-2 sm:col-span-2"><button type="submit" disabled={appointmentSaving || !appointmentPatients.length} className="rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{appointmentSaving ? 'Guardando…' : 'Guardar turno'}</button><button type="button" onClick={() => setShowAppointmentForm(false)} className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700">Cancelar</button></div>
      </form>}

      <section className="grid gap-3 sm:grid-cols-3">
        <SummaryCard icon={<CalendarDays size={18} />} label="Turnos próximos" value={String(upcomingCount)} detail="Citas en agenda" color="teal" />
        <SummaryCard icon={<Video size={18} />} label="Teleconsultas" value={String(telemedicineCount)} detail="Modalidad virtual" color="violet" />
        <SummaryCard icon={<Clock3 size={18} />} label="Día seleccionado" value={String(visibleAppointments.length)} detail="Turnos para esta fecha" color="blue" />
      </section>

      <div className={`grid items-start gap-5 ${chatOpen ? '2xl:grid-cols-[minmax(0,1fr)_360px]' : 'grid-cols-1'}`}>
        <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div><p className="text-xs font-medium uppercase tracking-wider text-slate-400">Vista {viewMode === 'month' ? 'mensual' : 'semanal'}</p><h2 className="mt-1 text-lg font-bold capitalize text-slate-800">{viewMode === 'month' ? monthRangeLabel(calendarMonth) : formatDate(week, { month: 'long', year: 'numeric' })}</h2></div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="relative"><span className="sr-only">Filtrar por odontólogo</span><Stethoscope className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} /><select value={dentistFilter} onChange={(event) => setDentistFilter(event.target.value)} className="max-w-48 rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-700 outline-none focus:border-teal-500"><option value="all">Todo el equipo</option>{dentists.map((dentist) => <option key={dentist.id} value={dentist.id}>Dra./Dr. {dentist.apellido}</option>)}</select></label>
              <div role="group" aria-label="Vista de agenda" className="flex rounded-lg border border-slate-200 p-0.5"><button type="button" aria-pressed={viewMode === 'week'} onClick={() => { setWeek(startOfWeek(new Date(`${selectedDay}T12:00:00`))); setViewMode('week') }} className={`rounded-md px-2 py-1.5 text-xs font-semibold ${viewMode === 'week' ? 'bg-teal-50 text-teal-700' : 'text-slate-500 hover:bg-slate-100'}`}>Semana</button><button type="button" aria-pressed={viewMode === 'month'} onClick={() => { const selected = new Date(`${selectedDay}T12:00:00`); setCalendarMonth(new Date(selected.getFullYear(), selected.getMonth(), 1, 12)); setViewMode('month') }} className={`rounded-md px-2 py-1.5 text-xs font-semibold ${viewMode === 'month' ? 'bg-teal-50 text-teal-700' : 'text-slate-500 hover:bg-slate-100'}`}>Mes</button></div>
              <div className="flex rounded-lg border border-slate-200 p-0.5"><button onClick={() => jumpPeriod(-1)} aria-label="Período anterior" className="rounded-md p-2 text-slate-500 hover:bg-slate-100"><ArrowLeft size={16} /></button><button onClick={() => { const today = new Date(); setWeek(startOfWeek(today)); setCalendarMonth(new Date(today.getFullYear(), today.getMonth(), 1, 12)); setSelectedDay(dateKey(today)) }} className="px-2 text-xs font-semibold text-slate-600 hover:text-teal-700">Hoy</button><button onClick={() => jumpPeriod(1)} aria-label="Período siguiente" className="rounded-md p-2 text-slate-500 hover:bg-slate-100"><ArrowRight size={16} /></button></div>
              {!chatOpen && <button onClick={() => setChatOpen(true)} className="inline-flex items-center gap-2 rounded-lg bg-violet-50 px-3 py-2 text-sm font-semibold text-violet-700"><Sparkles size={15} /> Asistente</button>}
            </div>
          </div>

          {viewMode === 'month' && <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/70">{weekdays.map((day) => <span key={day} className="px-1 py-2 text-center text-[10px] font-semibold uppercase text-slate-400">{day}</span>)}</div>}
          <div className={viewMode === 'month' ? 'grid grid-cols-7 border-b border-slate-100 bg-white' : 'grid grid-cols-7 border-b border-slate-100 bg-slate-50/70'}>
            {(viewMode === 'month' ? monthDays : weekDays).map((day, index) => {
              const key = dateKey(day), isSelected = key === selectedDay, isToday = key === dateKey(new Date())
              const count = appointments.filter((appointment) => appointment.fecha === key).length
              const dayIsInMonth = day.getMonth() === calendarMonth.getMonth()
              return <button key={key} onClick={() => { setSelectedDay(key); setWeek(startOfWeek(day)); if (day.getMonth() !== calendarMonth.getMonth() || day.getFullYear() !== calendarMonth.getFullYear()) setCalendarMonth(new Date(day.getFullYear(), day.getMonth(), 1, 12)) }} aria-label={`Seleccionar ${formatDate(day, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`} aria-pressed={isSelected} className={`relative flex ${viewMode === 'month' ? 'min-h-[64px]' : 'min-h-[78px]'} flex-col items-center justify-center gap-1 border-r border-b border-slate-100 px-1 transition last:border-r-0 ${isSelected ? 'bg-teal-50' : 'hover:bg-slate-50'} ${viewMode === 'month' && !dayIsInMonth ? 'opacity-45' : ''}`}><span className={`text-[11px] font-semibold uppercase ${isSelected ? 'text-teal-700' : 'text-slate-400'}`}>{viewMode === 'week' ? weekdays[index] : ''}</span><span className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${isSelected ? 'bg-teal-700 text-white' : isToday ? 'border border-teal-200 text-teal-700' : 'text-slate-700'}`}>{day.getDate()}</span><span className="text-[10px] text-slate-400">{count ? `${count} ${count === 1 ? 'turno' : 'turnos'}` : '—'}</span></button>
            })}
          </div>

          <div className="px-4 pb-5 pt-4 sm:px-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><div><h3 className="text-base font-bold capitalize text-slate-800">{dayLabel}</h3><p className="text-xs text-slate-400">Agenda del día · turnos presenciales y teleconsultas</p></div><div className="flex items-center gap-2"><button onClick={() => void findAvailableSlots()} disabled={availabilityLoading} className="inline-flex items-center gap-1.5 rounded-lg border border-teal-200 px-3 py-2 text-xs font-semibold text-teal-700 hover:bg-teal-50 disabled:opacity-50"><Sparkles size={14} />{availabilityLoading ? 'Calculando…' : 'Ver horarios libres'}</button><button onClick={() => void loadAgenda()} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-teal-700" aria-label="Actualizar agenda"><Activity size={16} /></button></div></div>
            {availabilityError && <p role="status" className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{availabilityError}</p>}
            {availableSlots.length > 0 && <div className="mb-4 rounded-xl border border-teal-100 bg-teal-50/60 p-3"><div className="flex items-center justify-between gap-2"><p className="text-xs font-semibold text-teal-900">Horarios disponibles · {dentists.find((item) => String(item.id) === dentistFilter)?.apellido}</p><button onClick={() => setAvailableSlots([])} className="text-[11px] text-teal-700 underline">Ocultar</button></div><div className="mt-2 flex flex-wrap gap-2">{availableSlots.map((slot) => <button key={slot} onClick={() => void startBooking(slot)} className="rounded-lg border border-teal-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-teal-800 hover:border-teal-500">{slot.slice(0, 5)} · reservar</button>)}</div><p className="mt-2 text-[10px] text-teal-700">Al elegir una franja, revisá los datos y confirmá el consentimiento antes de reservar.</p></div>}
            {loading ? <div className="space-y-3">{[1, 2, 3].map((item) => <div key={item} className="h-[68px] animate-pulse rounded-xl bg-slate-100" />)}</div> : loadError ? <div className="rounded-xl border border-amber-100 bg-amber-50 p-4 text-sm text-amber-800"><p className="font-semibold">No pudimos sincronizar la agenda</p><p className="mt-1">{loadError}</p><button onClick={() => void loadAgenda()} className="mt-3 font-semibold underline">Reintentar</button></div> : <div className="space-y-2">
              {visibleAppointments.length ? visibleAppointments.map((appointment) => <article key={appointment.id} className="group flex gap-3 rounded-xl border border-slate-100 p-3 transition hover:border-teal-200 hover:bg-teal-50/30 sm:gap-4"><div className="w-14 shrink-0 border-r border-slate-100 pr-3 pt-1 text-right"><span className="text-sm font-bold text-slate-700">{appointment.hora.slice(0, 5)}</span><span className="mt-1 block text-[10px] text-slate-400">30 min</span></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="truncate text-sm font-semibold text-slate-800">{appointment.paciente ? `${appointment.paciente.nombre} ${appointment.paciente.apellido}`.trim() : 'Paciente'}</p><span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${stateColor(appointment.estado)}`}>{appointment.estado || 'Confirmado'}</span>{appointment.telemedicina && <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-medium text-violet-700"><Video size={11} /> Teleconsulta</span>}</div><p className="mt-1 truncate text-xs text-slate-500">{appointment.motivo || 'Consulta odontológica'} · {appointment.odontologo ? `Dr. ${appointment.odontologo.nombre} ${appointment.odontologo.apellido}`.trim() : 'Profesional asignado'}</p>{appointment.telemedicina && <p className="mt-1 text-[10px] text-slate-400">{appointment.consentimientoInformado ? 'Consentimiento registrado · ' : 'Consentimiento pendiente · '}Sala: {appointment.estadoSala === 'DISPONIBLE' ? 'Enlace listo' : appointment.estadoSala === 'EXPIRADA' ? 'Enlace expirado' : appointment.estadoSala === 'REVOCADA' ? 'Enlace revocado' : 'Pendiente de proveedor de videollamada'}</p>}<div className="mt-2 flex flex-wrap gap-2"><button onClick={() => addReminder(appointment)} className="inline-flex items-center gap-1 rounded-md bg-slate-50 px-2 py-1 text-[10px] font-medium text-slate-600 hover:bg-slate-100"><BellPlus size={12} /> Agregar recordatorio</button>{appointment.telemedicina && appointment.enlaceFuncional && appointment.enlaceVideo && <a href={appointment.enlaceVideo} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-md bg-violet-50 px-2 py-1 text-[10px] font-semibold text-violet-700 hover:bg-violet-100"><ExternalLink size={12} /> Entrar a videollamada</a>}</div></div><span className="hidden self-center text-xs text-slate-400 sm:block">#{appointment.id}</span></article>) : <div className="rounded-xl border border-dashed border-slate-200 px-4 py-10 text-center"><div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-slate-50 text-slate-400"><CalendarDays size={20} /></div><h4 className="mt-3 text-sm font-semibold text-slate-700">Agenda libre para este día</h4><p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-slate-500">Pedile al asistente que busque alternativas o iniciá una solicitud de teleconsulta.</p><button onClick={() => { setChatOpen(true); setTimeout(() => void submitQuestion('Buscame horarios disponibles para una teleconsulta'), 0) }} className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-teal-700 hover:text-teal-900"><Sparkles size={14} /> Buscar con el asistente</button></div>}
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
      {selectedSlot && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" role="presentation"><section role="dialog" aria-modal="true" aria-labelledby="booking-title" className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-wide text-teal-700">Confirmación explícita</p><h2 id="booking-title" className="mt-1 text-xl font-bold text-slate-900">Reservar teleconsulta</h2><p className="mt-1 text-sm text-slate-500">{selectedSlot.fecha} · {selectedSlot.hora.slice(0, 5)} · {dentists.find((item) => item.id === selectedSlot.odontologoId)?.nombre} {dentists.find((item) => item.id === selectedSlot.odontologoId)?.apellido}</p></div><button type="button" onClick={() => setSelectedSlot(null)} aria-label="Cerrar" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X size={18} /></button></div><form onSubmit={(event) => void confirmTelemedicineBooking(event)} className="mt-5 space-y-4"><label className="block text-sm font-medium text-slate-700">Paciente<select required value={selectedPatientId} onChange={(event) => setSelectedPatientId(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"><option value="">Seleccionar paciente</option>{patients.map((patient) => <option key={patient.id} value={patient.id}>{patient.nombre} {patient.apellido} · {patient.dni}</option>)}</select></label><label className="block text-sm font-medium text-slate-700">Motivo de consulta<textarea required maxLength={255} value={bookingReason} onChange={(event) => setBookingReason(event.target.value)} rows={3} placeholder="Contá brevemente el motivo de la consulta" className="mt-1.5 w-full resize-y rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-teal-500" /></label><label className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-600"><input required type="checkbox" checked={bookingConsent} onChange={(event) => setBookingConsent(event.target.checked)} className="mt-1 accent-teal-700" /><span>Confirmo que el paciente recibió y aceptó el consentimiento informado para teleconsulta y solicita la reserva de esta fecha y horario.</span></label>{bookingError && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{bookingError}</p>}<div className="flex justify-end gap-2"><button type="button" onClick={() => setSelectedSlot(null)} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100">Cancelar</button><button type="submit" disabled={bookingBusy || !patients.length} className="rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50">{bookingBusy ? 'Confirmando…' : 'Confirmar reserva'}</button></div></form></section></div>}
    </div>
  )
}

function SummaryCard({ icon, label, value, detail, color }: { icon: ReactNode; label: string; value: string; detail: string; color: 'teal' | 'violet' | 'blue' }) {
  const colors = { teal: 'bg-teal-50 text-teal-700', violet: 'bg-violet-50 text-violet-700', blue: 'bg-blue-50 text-blue-700' }
  return <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-start justify-between"><div><p className="text-xs font-medium text-slate-500">{label}</p><p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{value}</p></div><span className={`flex h-9 w-9 items-center justify-center rounded-xl ${colors[color]}`}>{icon}</span></div><p className="mt-1 text-[11px] text-slate-400">{detail}</p></div>
}
