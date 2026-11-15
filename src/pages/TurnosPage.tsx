import { useCallback, useContext, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import {
  Activity, ArrowLeft, ArrowRight, BellPlus, CalendarDays, Check, Clock3,
  ExternalLink, MessageCircle, Search, Send, Sparkles, Stethoscope, Video, X,
} from 'lucide-react'
import { AuthContext } from '../auth/context'
import { roleFromToken } from '../auth/role'

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
  const value = (state || 'CONFIRMADO').toUpperCase().trim()
  if (value.includes('CANCEL') || value.includes('RECHAZ') || value.includes('AUSENT')) {
    return 'bg-red-600 text-white border-red-700 font-bold shadow-xs'
  }
  if (value.includes('CONFIRM') || value.includes('COMPLET') || value.includes('ATENDID')) {
    return 'bg-emerald-600 text-white border-emerald-700 font-bold shadow-xs'
  }
  return 'bg-orange-500 text-white border-orange-600 font-bold shadow-xs'
}
function appointmentCardAccent(state?: string) {
  const value = (state || 'CONFIRMADO').toUpperCase().trim()
  if (value.includes('CANCEL') || value.includes('RECHAZ') || value.includes('AUSENT')) {
    return 'border-l-4 border-l-red-500 bg-red-50/40 border-red-200/80'
  }
  if (value.includes('CONFIRM') || value.includes('COMPLET') || value.includes('ATENDID')) {
    return 'border-l-4 border-l-emerald-500 bg-emerald-50/40 border-emerald-200/80'
  }
  return 'border-l-4 border-l-orange-500 bg-orange-50/40 border-orange-200/80'
}

export function TurnosPage({ token }: { token?: string } = {}) {
  const auth = useContext(AuthContext)
  const role = auth?.session?.role || roleFromToken(auth?.session?.token || token || authToken() || '')
  const isDentist = role === 'ODONTOLOGO'

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
  const [chatOpen, setChatOpen] = useState(!isDentist)
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
  useEffect(() => {
    const onTurnoBooked = () => { void loadAgenda() }
    window.addEventListener('novadent:turno-booked', onTurnoBooked)
    return () => window.removeEventListener('novadent:turno-booked', onTurnoBooked)
  }, [loadAgenda])

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

  const updateAppointmentStatus = async (appointment: Appointment, nuevoEstado: 'CONFIRMADO' | 'EN_ESPERA' | 'RECHAZADO') => {
    const activeBearer = token || authToken()
    setAppointments((prev) =>
      prev.map((item) => (item.id === appointment.id ? { ...item, estado: nuevoEstado } : item))
    )
    try {
      const response = await fetch(`/api/turnos/${appointment.id}/estado`, {
        method: 'PUT',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...(activeBearer ? { Authorization: `Bearer ${activeBearer.replace(/^Bearer\s+/i, '')}` } : {}),
        },
        body: JSON.stringify({ estado: nuevoEstado }),
      })
      if (!response.ok && appointment.paciente?.id && appointment.odontologo?.id) {
        await fetch(`/api/turnos/${appointment.id}`, {
          method: 'PUT',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            ...(activeBearer ? { Authorization: `Bearer ${activeBearer.replace(/^Bearer\s+/i, '')}` } : {}),
          },
          body: JSON.stringify({
            fecha: appointment.fecha,
            hora: appointment.hora,
            motivo: appointment.motivo || 'Consulta odontológica',
            estado: nuevoEstado,
            pacienteId: appointment.paciente.id,
            odontologoId: appointment.odontologo.id,
          }),
        })
      }
      setAppointmentSuccess(`Estado del turno #${appointment.id} actualizado a ${nuevoEstado}.`)
    } catch {
      // Optimistic state update remains visible in session
    }
  }

  return (
    <div className="space-y-6 pb-8">
      <header className="flex flex-col gap-4 rounded-2xl border-2 border-[#B8AE99] bg-[#FAF5E8] p-5 shadow-sm lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-teal-800">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-100 text-teal-800">
              <Activity size={16} />
            </span>
            ATENCIÓN CONECTADA
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-950">Agenda inteligente</h1>
          <p className="mt-1 text-sm font-semibold text-slate-800">
            Turnos, teleconsulta y gestión de estados en un solo lugar.
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <button
            type="button"
            onClick={() => void openAppointmentForm()}
            className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-teal-700 bg-white px-4 py-3 text-sm font-extrabold text-teal-900 shadow-xs transition hover:bg-teal-50"
          >
            <CalendarDays size={17} /> Nuevo turno presencial
          </button>
          <a
            href="/teletriaje"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 py-3 text-sm font-extrabold text-white shadow-sm transition hover:bg-teal-800"
          >
            <Video size={17} /> Solicitar teleconsulta <ArrowRight size={16} />
          </a>
        </div>
      </header>

      {bookingSuccess && (
        <div role="status" className="rounded-xl border-2 border-emerald-500 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-950">
          {bookingSuccess}
        </div>
      )}
      {appointmentSuccess && (
        <div role="status" className="rounded-xl border-2 border-emerald-500 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-950">
          {appointmentSuccess}
        </div>
      )}
      {showAppointmentForm && (
        <form
          onSubmit={(event) => void createAppointment(event)}
          className="grid gap-4 rounded-2xl border-2 border-[#B8AE99] bg-[#FAF5E8] p-5 shadow-md sm:grid-cols-2"
        >
          <h2 className="text-lg font-extrabold text-slate-950 sm:col-span-2">Registrar turno presencial</h2>
          <label className="grid gap-1 text-sm font-bold text-slate-900">
            Paciente
            <select
              required
              value={appointmentForm.pacienteId}
              onChange={(event) => setAppointmentForm({ ...appointmentForm, pacienteId: event.target.value })}
              className="rounded-lg border-2 border-slate-400 bg-white px-3 py-2 font-semibold text-slate-900"
            >
              <option value="">Seleccionar paciente</option>
              {appointmentPatients.map((patient) => (
                <option key={patient.id} value={patient.id}>
                  {patient.nombre} {patient.apellido}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-bold text-slate-900">
            Odontólogo
            <select
              required
              value={appointmentForm.odontologoId}
              onChange={(event) => setAppointmentForm({ ...appointmentForm, odontologoId: event.target.value })}
              className="rounded-lg border-2 border-slate-400 bg-white px-3 py-2 font-semibold text-slate-900"
            >
              <option value="">Seleccionar odontólogo</option>
              {dentists
                .filter((dentist) => dentist.activo !== false)
                .map((dentist) => (
                  <option key={dentist.id} value={dentist.id}>
                    {dentist.nombre} {dentist.apellido}
                  </option>
                ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-bold text-slate-900">
            Fecha
            <input
              required
              type="date"
              min={dateKey(new Date())}
              value={appointmentForm.fecha}
              onChange={(event) => setAppointmentForm({ ...appointmentForm, fecha: event.target.value })}
              className="rounded-lg border-2 border-slate-400 bg-white px-3 py-2 font-semibold text-slate-900"
            />
          </label>
          <label className="grid gap-1 text-sm font-bold text-slate-900">
            Hora
            <input
              required
              type="time"
              value={appointmentForm.hora}
              onChange={(event) => setAppointmentForm({ ...appointmentForm, hora: event.target.value })}
              className="rounded-lg border-2 border-slate-400 bg-white px-3 py-2 font-semibold text-slate-900"
            />
          </label>
          <label className="grid gap-1 text-sm font-bold text-slate-900 sm:col-span-2">
            Motivo
            <input
              required
              maxLength={200}
              value={appointmentForm.motivo}
              onChange={(event) => setAppointmentForm({ ...appointmentForm, motivo: event.target.value })}
              className="rounded-lg border-2 border-slate-400 bg-white px-3 py-2 font-semibold text-slate-900"
            />
          </label>
          {appointmentError && (
            <p role="alert" className="rounded-lg border border-red-400 bg-red-50 px-3 py-2 text-sm font-bold text-red-900 sm:col-span-2">
              {appointmentError}
            </p>
          )}
          <div className="flex gap-2 sm:col-span-2">
            <button
              type="submit"
              disabled={appointmentSaving || !appointmentPatients.length}
              className="rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
            >
              {appointmentSaving ? 'Guardando…' : 'Guardar turno'}
            </button>
            <button
              type="button"
              onClick={() => setShowAppointmentForm(false)}
              className="rounded-lg border-2 border-slate-400 bg-white px-4 py-2.5 text-sm font-bold text-slate-900"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      <section className="grid gap-3.5 sm:grid-cols-3">
        <SummaryCard icon={<CalendarDays size={20} />} label="Turnos próximos" value={String(upcomingCount)} detail="Citas activas en agenda" color="teal" />
        <SummaryCard icon={<Video size={20} />} label="Teleconsultas" value={String(telemedicineCount)} detail="Modalidad virtual" color="violet" />
        <SummaryCard icon={<Clock3 size={20} />} label="Día seleccionado" value={String(visibleAppointments.length)} detail="Turnos para esta fecha" color="blue" />
      </section>

      <div className={`grid items-start gap-5 ${chatOpen && !isDentist ? '2xl:grid-cols-[minmax(0,1fr)_360px]' : 'grid-cols-1'}`}>
        <section className="min-w-0 overflow-hidden rounded-2xl border-2 border-[#B8AE99] bg-[#FAF5E8] shadow-md">
          <div className="flex flex-col gap-4 border-b-2 border-[#B8AE99] bg-[#F2E9D8] p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-wider text-teal-900">
                Vista {viewMode === 'month' ? 'mensual' : 'semanal'}
              </p>
              <h2 className="mt-0.5 text-xl font-extrabold capitalize text-slate-950">
                {viewMode === 'month' ? monthRangeLabel(calendarMonth) : formatDate(week, { month: 'long', year: 'numeric' })}
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="relative">
                <span className="sr-only">Filtrar por odontólogo</span>
                <Stethoscope className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-700" size={16} />
                <select
                  value={dentistFilter}
                  onChange={(event) => setDentistFilter(event.target.value)}
                  className="max-w-52 rounded-lg border-2 border-[#B8AE99] bg-white py-2 pl-9 pr-3 text-sm font-bold text-slate-900 outline-none focus:border-teal-700"
                >
                  <option value="all">Todo el equipo</option>
                  {dentists.map((dentist) => (
                    <option key={dentist.id} value={dentist.id}>
                      Dra./Dr. {dentist.apellido}
                    </option>
                  ))}
                </select>
              </label>
              <div role="group" aria-label="Vista de agenda" className="flex rounded-lg border-2 border-[#B8AE99] bg-white p-0.5">
                <button
                  type="button"
                  aria-pressed={viewMode === 'week'}
                  onClick={() => {
                    setWeek(startOfWeek(new Date(`${selectedDay}T12:00:00`)))
                    setViewMode('week')
                  }}
                  className={`rounded-md px-3 py-1.5 text-xs font-extrabold ${
                    viewMode === 'week' ? 'bg-teal-700 text-white' : 'text-slate-800 hover:bg-slate-100'
                  }`}
                >
                  Semana
                </button>
                <button
                  type="button"
                  aria-pressed={viewMode === 'month'}
                  onClick={() => {
                    const selected = new Date(`${selectedDay}T12:00:00`)
                    setCalendarMonth(new Date(selected.getFullYear(), selected.getMonth(), 1, 12))
                    setViewMode('month')
                  }}
                  className={`rounded-md px-3 py-1.5 text-xs font-extrabold ${
                    viewMode === 'month' ? 'bg-teal-700 text-white' : 'text-slate-800 hover:bg-slate-100'
                  }`}
                >
                  Mes
                </button>
              </div>
              <div className="flex rounded-lg border-2 border-[#B8AE99] bg-white p-0.5">
                <button
                  onClick={() => jumpPeriod(-1)}
                  aria-label="Período anterior"
                  className="rounded-md p-2 text-slate-800 hover:bg-slate-100"
                >
                  <ArrowLeft size={16} />
                </button>
                <button
                  onClick={() => {
                    const today = new Date()
                    setWeek(startOfWeek(today))
                    setCalendarMonth(new Date(today.getFullYear(), today.getMonth(), 1, 12))
                    setSelectedDay(dateKey(today))
                  }}
                  className="px-3 text-xs font-extrabold text-slate-900 hover:text-teal-800"
                >
                  Hoy
                </button>
                <button
                  onClick={() => jumpPeriod(1)}
                  aria-label="Período siguiente"
                  className="rounded-md p-2 text-slate-800 hover:bg-slate-100"
                >
                  <ArrowRight size={16} />
                </button>
              </div>
              {!chatOpen && !isDentist && (
                <button
                  onClick={() => setChatOpen(true)}
                  className="inline-flex items-center gap-2 rounded-lg border border-violet-300 bg-violet-100 px-3 py-2 text-sm font-bold text-violet-900"
                >
                  <Sparkles size={15} /> Asistente
                </button>
              )}
            </div>
          </div>

          {viewMode === 'month' && (
            <div className="grid grid-cols-7 border-b-2 border-[#B8AE99] bg-[#EBE1CC]">
              {weekdays.map((day) => (
                <span key={day} className="border-r border-[#B8AE99] px-1 py-2.5 text-center text-xs font-extrabold uppercase text-slate-900 last:border-r-0">
                  {day}
                </span>
              ))}
            </div>
          )}

          {/* Grilla de días con divisiones pronunciadas sobre fondo Blanco Hueso */}
          <div className="grid grid-cols-7 border-b-2 border-[#B8AE99] bg-[#FAF5E8]">
            {(viewMode === 'month' ? monthDays : weekDays).map((day, index) => {
              const key = dateKey(day)
              const isSelected = key === selectedDay
              const isToday = key === dateKey(new Date())
              const count = appointments.filter((appointment) => appointment.fecha === key).length
              const dayIsInMonth = day.getMonth() === calendarMonth.getMonth()
              return (
                <button
                  key={key}
                  onClick={() => {
                    setSelectedDay(key)
                    setWeek(startOfWeek(day))
                    if (day.getMonth() !== calendarMonth.getMonth() || day.getFullYear() !== calendarMonth.getFullYear()) {
                      setCalendarMonth(new Date(day.getFullYear(), day.getMonth(), 1, 12))
                    }
                  }}
                  aria-label={`Seleccionar ${formatDate(day, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`}
                  aria-pressed={isSelected}
                  className={`relative flex ${
                    viewMode === 'month' ? 'min-h-[78px]' : 'min-h-[96px]'
                  } flex-col items-center justify-center gap-1.5 border-r-2 border-b-2 border-[#B8AE99] px-1.5 py-2 transition last:border-r-0 ${
                    isSelected
                      ? 'bg-teal-100/90 ring-2 ring-inset ring-teal-700'
                      : 'bg-[#FAF5E8] hover:bg-[#EFE6D2]'
                  } ${viewMode === 'month' && !dayIsInMonth ? 'opacity-50' : ''}`}
                >
                  <span className={`text-xs font-extrabold uppercase tracking-wider ${isSelected ? 'text-teal-950' : 'text-slate-800'}`}>
                    {viewMode === 'week' ? weekdays[index] : ''}
                  </span>
                  <span
                    className={`flex h-9 w-9 items-center justify-center rounded-full text-base font-extrabold ${
                      isSelected
                        ? 'bg-teal-700 text-white shadow-xs'
                        : isToday
                          ? 'border-2 border-teal-700 bg-teal-50 text-teal-900'
                          : 'text-slate-950'
                    }`}
                  >
                    {day.getDate()}
                  </span>
                  {count > 0 ? (
                    <span className="rounded-full bg-teal-700 px-2.5 py-0.5 text-[11px] font-extrabold text-white shadow-xs">
                      {count} {count === 1 ? 'turno' : 'turnos'}
                    </span>
                  ) : (
                    <span className="text-xs font-bold text-slate-600">Libre</span>
                  )}
                </button>
              )
            })}
          </div>

          <div className="px-4 pb-5 pt-4 sm:px-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b-2 border-[#C8BCA6] pb-3">
              <div>
                <h3 className="text-lg font-extrabold capitalize text-slate-950">{dayLabel}</h3>
                <p className="text-xs font-bold text-slate-700">
                  Agenda del día · turnos presenciales y teleconsultas (Confirmado en verde · En espera en naranja · Rechazado en rojo)
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => void findAvailableSlots()}
                  disabled={availabilityLoading}
                  className="inline-flex items-center gap-1.5 rounded-lg border-2 border-teal-700 bg-white px-3.5 py-2 text-xs font-extrabold text-teal-900 hover:bg-teal-50 disabled:opacity-50"
                >
                  <Sparkles size={14} />
                  {availabilityLoading ? 'Calculando…' : 'Ver horarios libres'}
                </button>
                <button
                  onClick={() => void loadAgenda()}
                  className="rounded-lg border-2 border-[#B8AE99] bg-white p-2 text-slate-800 hover:bg-slate-100 hover:text-teal-800"
                  aria-label="Actualizar agenda"
                >
                  <Activity size={16} />
                </button>
              </div>
            </div>

            {availabilityError && (
              <p role="status" className="mb-3 rounded-lg border border-amber-400 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-950">
                {availabilityError}
              </p>
            )}
            {availableSlots.length > 0 && (
              <div className="mb-4 rounded-xl border-2 border-teal-600 bg-teal-50/90 p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-extrabold text-teal-950">
                    Horarios disponibles · {dentists.find((item) => String(item.id) === dentistFilter)?.apellido}
                  </p>
                  <button onClick={() => setAvailableSlots([])} className="text-xs font-bold text-teal-800 underline">
                    Ocultar
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {availableSlots.map((slot) => (
                    <button
                      key={slot}
                      onClick={() => void startBooking(slot)}
                      className="rounded-lg border-2 border-teal-700 bg-white px-3 py-1.5 text-xs font-extrabold text-teal-950 hover:bg-teal-100"
                    >
                      {slot.slice(0, 5)} · reservar
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-xs font-semibold text-teal-900">
                  Al elegir una franja, revisá los datos y confirmá el consentimiento antes de reservar.
                </p>
              </div>
            )}

            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((item) => (
                  <div key={item} className="h-[72px] animate-pulse rounded-xl bg-[#E8DEC6]" />
                ))}
              </div>
            ) : loadError ? (
              <div className="rounded-xl border-2 border-amber-500 bg-amber-50 p-4 text-sm font-bold text-amber-950">
                <p className="font-extrabold">No pudimos sincronizar la agenda</p>
                <p className="mt-1">{loadError}</p>
                <button onClick={() => void loadAgenda()} className="mt-3 font-extrabold underline">
                  Reintentar
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {visibleAppointments.length ? (
                  visibleAppointments.map((appointment) => (
                    <article
                      key={appointment.id}
                      className={`group flex flex-col gap-3 rounded-xl border-2 p-4 shadow-xs transition sm:flex-row sm:items-center sm:justify-between ${appointmentCardAccent(
                        appointment.estado
                      )}`}
                    >
                      <div className="flex gap-3 sm:gap-4">
                        <div className="w-16 shrink-0 border-r-2 border-[#B8AE99] pr-3 pt-0.5 text-right">
                          <span className="text-base font-extrabold text-slate-950">{appointment.hora.slice(0, 5)}</span>
                          <span className="mt-0.5 block text-xs font-bold text-slate-700">30 min</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-base font-extrabold text-slate-950">
                              {appointment.paciente
                                ? `${appointment.paciente.nombre} ${appointment.paciente.apellido}`.trim()
                                : 'Paciente'}
                            </p>
                            <span className={`rounded-full border px-3 py-0.5 text-xs ${stateColor(appointment.estado)}`}>
                              {appointment.estado || 'CONFIRMADO'}
                            </span>
                            {appointment.telemedicina && (
                              <span className="inline-flex items-center gap-1 rounded-full border border-violet-400 bg-violet-100 px-2.5 py-0.5 text-xs font-extrabold text-violet-900">
                                <Video size={12} /> Teleconsulta
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-sm font-bold text-slate-800">
                            {appointment.motivo || 'Consulta odontológica'} ·{' '}
                            {appointment.odontologo
                              ? `Dr. ${appointment.odontologo.nombre} ${appointment.odontologo.apellido}`.trim()
                              : 'Profesional asignado'}
                          </p>
                          {appointment.telemedicina && (
                            <p className="mt-1 text-xs font-semibold text-slate-700">
                              {appointment.consentimientoInformado
                                ? 'Consentimiento registrado · '
                                : 'Consentimiento pendiente · '}
                              Sala:{' '}
                              {appointment.estadoSala === 'DISPONIBLE'
                                ? 'Enlace listo'
                                : appointment.estadoSala === 'EXPIRADA'
                                  ? 'Enlace expirado'
                                  : appointment.estadoSala === 'REVOCADA'
                                    ? 'Enlace revocado'
                                    : 'Pendiente de proveedor de videollamada'}
                            </p>
                          )}
                          <div className="mt-2.5 flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => addReminder(appointment)}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-400 bg-white px-2.5 py-1 text-xs font-bold text-slate-900 hover:bg-slate-100"
                            >
                              <BellPlus size={13} /> Agregar recordatorio
                            </button>
                            {appointment.telemedicina && appointment.enlaceFuncional && appointment.enlaceVideo && (
                              <a
                                href={appointment.enlaceVideo}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 rounded-lg bg-violet-700 px-2.5 py-1 text-xs font-bold text-white hover:bg-violet-800"
                              >
                                <ExternalLink size={13} /> Entrar a videollamada
                              </a>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Botonera rápida de estado para el Odontólogo / Recepción / Admin */}
                      <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-300 pt-2.5 sm:border-t-0 sm:pt-0">
                        <button
                          type="button"
                          onClick={() => void updateAppointmentStatus(appointment, 'CONFIRMADO')}
                          style={{ backgroundColor: '#059669', color: '#ffffff' }}
                          className="rounded-lg border border-emerald-700 bg-emerald-600 px-2.5 py-1.5 text-xs font-extrabold text-white shadow-xs hover:bg-emerald-700"
                        >
                          ✓ Confirmar
                        </button>
                        <button
                          type="button"
                          onClick={() => void updateAppointmentStatus(appointment, 'EN_ESPERA')}
                          style={{ backgroundColor: '#f97316', color: '#ffffff' }}
                          className="rounded-lg border border-orange-600 bg-orange-500 px-2.5 py-1.5 text-xs font-extrabold text-white shadow-xs hover:bg-orange-600"
                        >
                          ⏳ En espera
                        </button>
                        <button
                          type="button"
                          onClick={() => void updateAppointmentStatus(appointment, 'RECHAZADO')}
                          style={{ backgroundColor: '#dc2626', color: '#ffffff' }}
                          className="rounded-lg border border-red-700 bg-red-600 px-2.5 py-1.5 text-xs font-extrabold text-white shadow-xs hover:bg-red-700"
                        >
                          ✕ Rechazar
                        </button>
                        <span className="ml-1 hidden text-xs font-extrabold text-slate-700 sm:inline">
                          #{appointment.id}
                        </span>
                      </div>
                    </article>
                  ))
                ) : (
                  <div className="rounded-xl border-2 border-dashed border-[#B8AE99] bg-[#F2E9D8]/70 px-4 py-10 text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-[#B8AE99] bg-[#FAF5E8] text-teal-800">
                      <CalendarDays size={22} />
                    </div>
                    <h4 className="mt-3 text-base font-extrabold text-slate-950">Agenda libre para este día</h4>
                    <p className="mx-auto mt-1 max-w-md text-sm font-medium leading-6 text-slate-800">
                      {isDentist
                        ? 'No tenés turnos asignados para este día.'
                        : 'Pedile al asistente que busque alternativas o iniciá una solicitud de teleconsulta.'}
                    </p>
                    {!isDentist && (
                      <button
                        onClick={() => {
                          setChatOpen(true)
                          setTimeout(() => void submitQuestion('Buscame horarios disponibles para una teleconsulta'), 0)
                        }}
                        className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-3.5 py-2 text-xs font-extrabold text-white hover:bg-teal-800"
                      >
                        <Sparkles size={14} /> Buscar con el asistente
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
            <div className="mt-5 flex items-start gap-2 rounded-lg border border-[#B8AE99] bg-[#F2E9D8] px-3.5 py-2.5 text-xs font-bold leading-5 text-slate-800">
              <Check size={15} className="mt-0.5 shrink-0 text-teal-800" />
              Los cambios de disponibilidad se validan nuevamente al confirmar la reserva.
            </div>
          </div>
        </section>

        {chatOpen && !isDentist && (
          <aside className="flex max-h-[760px] min-h-[480px] flex-col overflow-hidden rounded-2xl border-2 border-[#B8AE99] bg-[#FAF5E8] shadow-md">
            <div className="flex items-center justify-between bg-gradient-to-r from-violet-700 to-indigo-600 px-4 py-4 text-white">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15">
                  <Sparkles size={18} />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white">Asistente de Josué</h2>
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-violet-100">
                    <span className="h-2 w-2 rounded-full bg-emerald-300" /> Agenda y telemedicina
                  </p>
                </div>
              </div>
              <button
                onClick={() => setChatOpen(false)}
                aria-label="Cerrar asistente"
                className="rounded-lg p-2 text-white/90 hover:bg-white/15"
              >
                <X size={17} />
              </button>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto bg-[#F2E9D8] p-3" aria-live="polite">
              {chat.map((message, index) => (
                <div key={`${index}-${message.role}`} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[92%] rounded-2xl px-3.5 py-2.5 text-xs font-medium leading-5 ${
                      message.role === 'user'
                        ? 'rounded-br-md bg-violet-700 text-white'
                        : 'rounded-bl-md border border-[#B8AE99] bg-[#FAF5E8] text-slate-900 shadow-xs'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{message.text}</p>
                    {message.answer?.accionesSugeridas?.slice(0, 2).map((action) => (
                      <button
                        key={action}
                        onClick={() => {
                          if (/teletriaje/i.test(action)) window.location.assign('/teletriaje')
                          else if (/turno|agenda|calendario/i.test(action)) setSelectedDay(dateKey(new Date()))
                          else void submitQuestion(action)
                        }}
                        className="mt-2 block w-full rounded-lg border border-violet-300 bg-violet-50 px-2.5 py-1.5 text-left text-xs font-bold text-violet-900 hover:bg-violet-100"
                      >
                        {action} <ArrowRight className="ml-1 inline" size={12} />
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {chatBusy && (
                <div className="w-fit rounded-2xl rounded-bl-md border border-[#B8AE99] bg-[#FAF5E8] px-3 py-2 text-xs font-bold text-slate-700">
                  Josué está pensando…
                </div>
              )}
              {chat.length === 1 && (
                <div className="space-y-2 pt-1">
                  {prompts.map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => void submitQuestion(prompt)}
                      className="block w-full rounded-xl border border-[#B8AE99] bg-[#FAF5E8] px-3 py-2.5 text-left text-xs font-bold text-slate-900 transition hover:border-violet-500 hover:text-violet-800"
                    >
                      <MessageCircle className="mr-2 inline text-violet-600" size={14} />
                      {prompt}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <form
              onSubmit={(event) => {
                event.preventDefault()
                void submitQuestion()
              }}
              className="border-t-2 border-[#B8AE99] bg-[#FAF5E8] p-3"
            >
              <div className="flex items-center gap-2 rounded-xl border-2 border-[#B8AE99] bg-white px-3 focus-within:border-violet-600">
                <Search size={15} className="shrink-0 text-slate-600" />
                <input
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  placeholder="Preguntá por horarios…"
                  className="min-w-0 flex-1 bg-transparent py-3 text-xs font-semibold text-slate-900 outline-none placeholder:text-slate-500"
                />
                <button
                  type="submit"
                  disabled={!question.trim() || chatBusy}
                  aria-label="Enviar consulta"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-700 text-white transition hover:bg-violet-800 disabled:opacity-40"
                >
                  <Send size={14} />
                </button>
              </div>
              <p className="mt-2 text-center text-[11px] font-semibold text-slate-700">
                La reserva se confirma en el flujo seguro de teletriaje.
              </p>
            </form>
          </aside>
        )}
      </div>
      {selectedSlot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="presentation">
          <section role="dialog" aria-modal="true" aria-labelledby="booking-title" className="w-full max-w-lg rounded-2xl border-2 border-[#B8AE99] bg-[#FAF5E8] p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-wide text-teal-800">Confirmación explícita</p>
                <h2 id="booking-title" className="mt-1 text-xl font-extrabold text-slate-950">Reservar teleconsulta</h2>
                <p className="mt-1 text-sm font-bold text-slate-700">
                  {selectedSlot.fecha} · {selectedSlot.hora.slice(0, 5)} ·{' '}
                  {dentists.find((item) => item.id === selectedSlot.odontologoId)?.nombre}{' '}
                  {dentists.find((item) => item.id === selectedSlot.odontologoId)?.apellido}
                </p>
              </div>
              <button type="button" onClick={() => setSelectedSlot(null)} aria-label="Cerrar" className="rounded-lg p-2 text-slate-700 hover:bg-slate-200">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={(event) => void confirmTelemedicineBooking(event)} className="mt-5 space-y-4">
              <label className="block text-sm font-bold text-slate-900">
                Paciente
                <select
                  required
                  value={selectedPatientId}
                  onChange={(event) => setSelectedPatientId(event.target.value)}
                  className="mt-1.5 w-full rounded-xl border-2 border-slate-400 bg-white px-3 py-2.5 text-sm font-semibold text-slate-900"
                >
                  <option value="">Seleccionar paciente</option>
                  {patients.map((patient) => (
                    <option key={patient.id} value={patient.id}>
                      {patient.nombre} {patient.apellido} · {patient.dni}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-bold text-slate-900">
                Motivo de consulta
                <textarea
                  required
                  maxLength={255}
                  value={bookingReason}
                  onChange={(event) => setBookingReason(event.target.value)}
                  rows={3}
                  placeholder="Contá brevemente el motivo de la consulta"
                  className="mt-1.5 w-full resize-y rounded-xl border-2 border-slate-400 bg-white px-3 py-2.5 text-sm font-semibold text-slate-900 outline-none focus:border-teal-700"
                />
              </label>
              <label className="flex items-start gap-2 rounded-xl border-2 border-[#B8AE99] bg-[#F2E9D8] p-3 text-xs font-semibold leading-5 text-slate-900">
                <input
                  required
                  type="checkbox"
                  checked={bookingConsent}
                  onChange={(event) => setBookingConsent(event.target.checked)}
                  className="mt-1 accent-teal-700"
                />
                <span>
                  Confirmo que el paciente recibió y aceptó el consentimiento informado para teleconsulta y solicita la reserva de esta fecha y horario.
                </span>
              </label>
              {bookingError && (
                <p role="alert" className="rounded-lg border border-red-400 bg-red-50 px-3 py-2 text-sm font-bold text-red-900">
                  {bookingError}
                </p>
              )}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedSlot(null)}
                  className="rounded-xl border border-slate-400 bg-white px-4 py-2.5 text-sm font-bold text-slate-800 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={bookingBusy || !patients.length}
                  className="rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-extrabold text-white hover:bg-teal-800 disabled:opacity-50"
                >
                  {bookingBusy ? 'Confirmando…' : 'Confirmar reserva'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  )
}

function SummaryCard({ icon, label, value, detail, color }: { icon: ReactNode; label: string; value: string; detail: string; color: 'teal' | 'violet' | 'blue' }) {
  const colors = {
    teal: 'bg-teal-100 text-teal-900 border border-teal-300',
    violet: 'bg-violet-100 text-violet-900 border border-violet-300',
    blue: 'bg-blue-100 text-blue-900 border border-blue-300',
  }
  return (
    <div className="rounded-2xl border-2 border-[#B8AE99] bg-[#FAF5E8] p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-wide text-slate-800">{label}</p>
          <p className="mt-1.5 text-3xl font-extrabold tracking-tight text-slate-950">{value}</p>
        </div>
        <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${colors[color]}`}>{icon}</span>
      </div>
      <p className="mt-1.5 text-xs font-bold text-slate-700">{detail}</p>
    </div>
  )
}
