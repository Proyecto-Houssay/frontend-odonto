import { useCallback, useContext, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import {
  Activity, ArrowLeft, ArrowRight, BellPlus, CalendarDays, Check, Clock3,
  ExternalLink, Sparkles, Stethoscope, Video, X,
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

const SESSION_KEY = 'novadent.auth.session'
const weekdays = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

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
  const appointmentFormRef = useRef<HTMLFormElement | null>(null)
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
  const [scheduleFilter, setScheduleFilter] = useState<'all' | 'assigned' | 'free'>('all')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

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

  useEffect(() => {
    if (isDentist && dentists.length > 0 && dentistFilter === 'all') {
      const me = dentists.find(d =>
        auth?.session?.username && (
          (d.apellido && auth.session.username.toLowerCase().includes(d.apellido.toLowerCase())) ||
          (d.nombre && auth.session.username.toLowerCase().includes(d.nombre.toLowerCase()))
        )
      )
      if (me) setDentistFilter(String(me.id))
    }
  }, [isDentist, dentists, auth?.session?.username, dentistFilter])

  const dayOfWeek = new Date(`${selectedDay}T12:00:00`).getDay()
  const dayClinicHours = useMemo(() => {
    if (dayOfWeek === 0) return []
    const start = dayOfWeek === 6 ? 9 : 8
    const end = dayOfWeek === 6 ? 14 : 20
    const list: string[] = []
    for (let h = start; h < end; h++) {
      list.push(`${String(h).padStart(2, '0')}:00`)
      list.push(`${String(h).padStart(2, '0')}:30`)
    }
    return list
  }, [selectedDay, dayOfWeek])

  const slotsWithStatus = useMemo(() => {
    return dayClinicHours.map(slot => {
      const app = visibleAppointments.find(a => a.hora.startsWith(slot))
      return { slot, appointment: app, isDado: Boolean(app) }
    })
  }, [dayClinicHours, visibleAppointments])
  const upcomingCount = appointments.filter((appointment) => appointment.fecha >= dateKey(new Date()) && !(appointment.estado || '').toLowerCase().includes('cancel')).length
  const telemedicineCount = appointments.filter((appointment) => appointment.telemedicina).length
  const dayLabel = formatDate(new Date(`${selectedDay}T12:00:00`), { weekday: 'long', day: 'numeric', month: 'long' })

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

  const ensurePatientsLoaded = useCallback(async () => {
    if (appointmentPatients.length > 0) return
    try {
      const foundPatients = await getJson<PatientOption[]>('/pacientes', token)
      setAppointmentPatients(Array.isArray(foundPatients) ? foundPatients : [])
    } catch (error) {
      setAppointmentError(error instanceof Error ? error.message : 'No se pudo cargar la lista de pacientes.')
    }
  }, [appointmentPatients.length, token])

  useEffect(() => {
    if (showAppointmentForm && appointmentPatients.length === 0) {
      void ensurePatientsLoaded()
    }
  }, [showAppointmentForm, appointmentPatients.length, ensurePatientsLoaded])

  const openAppointmentForm = async () => {
    setAppointmentError('')
    setAppointmentSuccess('')
    setShowAppointmentForm((open) => !open)
    await ensurePatientsLoaded()
  }

  const openAppointmentFormForSlot = (slot: string) => {
    setAppointmentError('')
    setAppointmentSuccess('')
    setAppointmentForm((prev) => ({
      ...prev,
      fecha: selectedDay,
      hora: `${slot}:00`,
      odontologoId: dentistFilter !== 'all' ? dentistFilter : (dentists[0] ? String(dentists[0].id) : '')
    }))
    setShowAppointmentForm(true)
    void ensurePatientsLoaded()
    window.setTimeout(() => {
      appointmentFormRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' })
    }, 50)
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
      await loadAgenda()
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
          ref={appointmentFormRef}
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

      <div className="grid grid-cols-1 items-start gap-5">
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
                {slotsWithStatus.length > 0 && (
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2 border-b border-[#C8BCA6] pb-3">
                    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filtro de horarios del día">
                      <button
                        type="button"
                        onClick={() => setScheduleFilter('all')}
                        className={`rounded-lg px-3 py-1.5 text-xs font-extrabold transition ${
                          scheduleFilter === 'all'
                            ? 'bg-teal-800 text-white shadow-xs'
                            : 'bg-white border border-[#B8AE99] text-slate-800 hover:bg-teal-50'
                        }`}
                      >
                        Todos los horarios ({slotsWithStatus.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setScheduleFilter('assigned')}
                        className={`rounded-lg px-3 py-1.5 text-xs font-extrabold transition ${
                          scheduleFilter === 'assigned'
                            ? 'bg-blue-700 text-white shadow-xs'
                            : 'bg-white border border-[#B8AE99] text-slate-800 hover:bg-blue-50'
                        }`}
                      >
                        Turnos dados ({visibleAppointments.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setScheduleFilter('free')}
                        className={`rounded-lg px-3 py-1.5 text-xs font-extrabold transition ${
                          scheduleFilter === 'free'
                            ? 'bg-emerald-700 text-white shadow-xs'
                            : 'bg-white border border-[#B8AE99] text-slate-800 hover:bg-emerald-50'
                        }`}
                      >
                        Horarios disponibles ({slotsWithStatus.filter(s => !s.isDado).length})
                      </button>
                    </div>
                    <span className="text-xs font-bold text-slate-700">
                      🟢 {slotsWithStatus.filter(s => !s.isDado).length} libres · 🔵 {visibleAppointments.length} dados
                    </span>
                  </div>
                )}

                {scheduleFilter === 'assigned' ? (
                  visibleAppointments.length ? (
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
                              <span className="rounded-md bg-blue-100 border border-blue-300 px-2 py-0.5 text-[11px] font-black text-blue-900 tracking-wider">
                                TURNO DADO
                              </span>
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
                      <h4 className="mt-3 text-base font-extrabold text-slate-950">No hay turnos dados para este día</h4>
                      <p className="mx-auto mt-1 max-w-md text-sm font-medium leading-6 text-slate-800">
                        Podés consultar los horarios disponibles o registrar un nuevo turno presencial.
                      </p>
                    </div>
                  )
                ) : scheduleFilter === 'free' ? (
                  slotsWithStatus.filter(s => !s.isDado).length ? (
                    slotsWithStatus.filter(s => !s.isDado).map(({ slot }) => (
                      <div key={slot} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border-2 border-dashed border-teal-600 bg-teal-50/50 p-4 transition hover:bg-teal-50">
                        <div className="flex items-center gap-3 sm:gap-4">
                          <div className="w-16 shrink-0 border-r-2 border-teal-300 pr-3 text-right">
                            <span className="text-base font-extrabold text-teal-950">{slot}</span>
                            <span className="mt-0.5 block text-xs font-bold text-teal-700">30 min</span>
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="rounded-md bg-emerald-600 px-2.5 py-0.5 text-xs font-extrabold text-white">
                                DISPONIBLE
                              </span>
                              <span className="text-sm font-extrabold text-teal-950">
                                Horario libre para atención
                              </span>
                            </div>
                            <p className="mt-0.5 text-xs font-medium text-slate-600">
                              {dentistFilter !== 'all'
                                ? `Dra./Dr. ${dentists.find((d) => String(d.id) === dentistFilter)?.apellido || 'Odontólogo'}`
                                : 'Sin turno asignado en esta franja horaria'}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => openAppointmentFormForSlot(slot)}
                          className="inline-flex items-center gap-1.5 rounded-lg border-2 border-teal-700 bg-white px-3 py-1.5 text-xs font-extrabold text-teal-900 shadow-xs hover:bg-teal-100"
                        >
                          + Asignar turno
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-xl border-2 border-dashed border-[#B8AE99] bg-[#F2E9D8]/70 px-4 py-10 text-center">
                      <p className="font-extrabold text-slate-900">Todos los horarios de este día están ocupados.</p>
                    </div>
                  )
                ) : (
                  slotsWithStatus.length ? (
                    slotsWithStatus.map(({ slot, appointment, isDado }) => isDado && appointment ? (
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
                              <span className="rounded-md bg-blue-100 border border-blue-300 px-2 py-0.5 text-[11px] font-black text-blue-900 tracking-wider">
                                TURNO DADO
                              </span>
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
                    ) : (
                      <div key={slot} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border-2 border-dashed border-teal-600 bg-teal-50/50 p-4 transition hover:bg-teal-50">
                        <div className="flex items-center gap-3 sm:gap-4">
                          <div className="w-16 shrink-0 border-r-2 border-teal-300 pr-3 text-right">
                            <span className="text-base font-extrabold text-teal-950">{slot}</span>
                            <span className="mt-0.5 block text-xs font-bold text-teal-700">30 min</span>
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="rounded-md bg-emerald-600 px-2.5 py-0.5 text-xs font-extrabold text-white">
                                DISPONIBLE
                              </span>
                              <span className="text-sm font-extrabold text-teal-950">
                                Horario libre para atención
                              </span>
                            </div>
                            <p className="mt-0.5 text-xs font-medium text-slate-600">
                              {dentistFilter !== 'all'
                                ? `Dra./Dr. ${dentists.find((d) => String(d.id) === dentistFilter)?.apellido || 'Odontólogo'}`
                                : 'Sin turno asignado en esta franja horaria'}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => openAppointmentFormForSlot(slot)}
                          className="inline-flex items-center gap-1.5 rounded-lg border-2 border-teal-700 bg-white px-3 py-1.5 text-xs font-extrabold text-teal-900 shadow-xs hover:bg-teal-100"
                        >
                          + Asignar turno
                        </button>
                      </div>
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
                          : 'No hay turnos registrados para este día. Podés asignar un nuevo turno presencial o consultar horarios libres.'}
                      </p>
                    </div>
                  )
                )}
              </div>
            )}
            <div className="mt-5 flex items-start gap-2 rounded-lg border border-[#B8AE99] bg-[#F2E9D8] px-3.5 py-2.5 text-xs font-bold leading-5 text-slate-800">
              <Check size={15} className="mt-0.5 shrink-0 text-teal-800" />
              Los cambios de disponibilidad se validan nuevamente al confirmar la reserva.
            </div>
          </div>
        </section>
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
