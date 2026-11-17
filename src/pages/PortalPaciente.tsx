import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import {
  Activity,
  AlertCircle,
  CalendarDays,
  CalendarPlus,
  Camera,
  CheckCircle2,
  ClipboardList,
  Clock3,
  FileUp,
  Home,
  Image as ImageIcon,
  LogOut,
  MessageCircle,
  Moon,
  ShieldCheck,
  Stethoscope,
  Sun,
  UserRound,
  XCircle,
} from 'lucide-react'
import { Link, NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { ApiError, apiRequest } from '../lib/api'
import { NovadentBrand } from '../components/brand/NovadentBrand'
import { ChatbotFloatingWidget } from '../components/chatbot/ChatbotFloatingWidget'
import { FaceCheckin } from '../components/FaceCheckin'
import { ChatbotPage } from './ChatbotPage'
import { MiOdontograma } from './MiOdontograma'
import { useTheme } from '../lib/useTheme'

type Perfil = {
  id: number
  nombre: string
  apellido: string
  dni: string
  email: string
  telefono?: string
  fechaNacimiento: string
}

type Reporte = {
  id: number
  pacienteId: number
  pieza: number
  dolor: number
  sintomas: string
  fotoDisponible?: boolean
  fotoBase64?: string | null
  creadoEn?: string
  estado: 'PENDIENTE' | 'REVISADO'
  revisionProfesional?: string | null
  revisadoEn?: string | null
}

type TurnoPropio = {
  id: number
  fecha: string
  hora: string
  motivo: string
  estado: string
  odontologoNombre: string
}

type DoctorDisponible = {
  id: number
  nombre: string
  apellido: string
  nombreCompleto: string
  especialidad: string
}

type TurnoSlot = {
  odontologoId: number
  odontologoNombre: string
  especialidad: string
  fecha: string
  hora: string
  etiquetaFecha: string
  etiquetaHora: string
}

type TratamientoPropio = {
  id: number
  fecha: string
  descripcion: string
  estado: string
}

type TurnoFilter = 'ALL' | 'CONFIRMED' | 'PENDING' | 'REJECTED'
type ReportFilter = 'ALL' | 'REVISADO' | 'PENDIENTE' | 'WITH_PHOTO'

const PATIENT_LINKS = [
  { label: 'Inicio', to: '/', icon: Home },
  { label: 'Check-in facial', to: '/check-in', icon: Camera },
  { label: 'Mi odontograma', to: '/mi-odontograma', icon: ShieldCheck },
  { label: 'Mi seguimiento', to: '/mi-seguimiento', icon: Activity },
  { label: 'Mis turnos', to: '/mis-turnos', icon: CalendarDays },
  { label: 'Mis tratamientos', to: '/mis-tratamientos', icon: Stethoscope },
  { label: 'Mis reportes', to: '/mis-reportes', icon: ClipboardList },
  { label: 'Mis datos', to: '/mis-datos', icon: UserRound },
  { label: 'Asistente IA', to: '/chatbot', icon: MessageCircle },
] as const

const PAGE_TITLES: Record<string, { title: string; subtitle: string }> = {
  '/': { title: 'Inicio', subtitle: 'Consultá tu resumen y registrá lo que observás.' },
  '/check-in': { title: 'Check-in facial', subtitle: 'Validá tu identidad biométrica para confirmar tu ingreso.' },
  '/mi-odontograma': { title: 'Mi odontograma', subtitle: 'Consultá los registros del equipo profesional por pieza dental.' },
  '/mi-seguimiento': { title: 'Mi seguimiento dental', subtitle: 'Tablero de evolución clínica, mapa de piezas vigiladas y respuesta odontológica.' },
  '/mis-turnos': { title: 'Tus turnos', subtitle: 'Agenda de citas confirmadas, turnos en espera y estado de atención.' },
  '/mis-tratamientos': { title: 'Tus tratamientos', subtitle: 'Consultá los tratamientos indicados para tu ficha.' },
  '/mis-reportes': { title: 'Tus reportes', subtitle: 'Bandeja de autoevaluaciones enviadas, evidencia fotográfica y dictamen profesional.' },
  '/mis-datos': { title: 'Tus datos', subtitle: 'Revisá tus datos de contacto.' },
  '/chatbot': { title: 'Asistente IA', subtitle: 'Consultá información general de NovaDent.' },
}

function dateLabel(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function getClinicHoursForDate(dateStr: string): string[] {
  if (!dateStr) return []
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  const day = dt.getDay()
  if (day === 0) return []
  const startHour = day === 6 ? 9 : 8
  const endHour = day === 6 ? 14 : 20
  const slots: string[] = []
  for (let h = startHour; h < endHour; h++) {
    slots.push(`${String(h).padStart(2, '0')}:00`)
    slots.push(`${String(h).padStart(2, '0')}:30`)
  }
  return slots
}

const DIENTES = [
  [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28],
  [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38],
]

const TOOTH_TYPES: Record<number, string> = {
  1: 'Incisivo central',
  2: 'Incisivo lateral',
  3: 'Canino',
  4: 'Primer premolar',
  5: 'Segundo premolar',
  6: 'Primer molar',
  7: 'Segundo molar',
  8: 'Tercer molar',
}
const TOOTH_QUADRANTS: Record<number, string> = {
  1: 'superior derecho',
  2: 'superior izquierdo',
  3: 'inferior izquierdo',
  4: 'inferior derecho',
}

function nombrePieza(numero: number) {
  const cuadrante = Math.floor(numero / 10)
  const tipo = numero % 10
  return `${TOOTH_TYPES[tipo] || 'Pieza dental'} ${TOOTH_QUADRANTS[cuadrante] || ''}`.trim()
}

export function classifyTurnoStatus(estado?: string): 'CONFIRMED' | 'REJECTED' | 'PENDING' {
  const raw = (estado || 'PENDIENTE').toUpperCase().trim()
  if (raw.includes('CANCEL') || raw.includes('RECHAZ') || raw.includes('AUSENT')) {
    return 'REJECTED'
  }
  if (raw.includes('CONFIRM') || raw.includes('COMPLET') || raw.includes('ATENDID')) {
    return 'CONFIRMED'
  }
  return 'PENDING'
}

export function getTurnoStatusUi(estado?: string) {
  const category = classifyTurnoStatus(estado)
  if (category === 'CONFIRMED') {
    return {
      category,
      badgeClass: 'bg-emerald-600 text-white border border-emerald-700 font-bold shadow-xs',
      cardAccentClass: 'border-l-4 border-l-emerald-500 bg-emerald-50/40 border-emerald-200',
      badgeStyle: { backgroundColor: '#059669', color: '#ffffff', borderColor: '#047857' },
      statusHelper: 'Cita confirmada · Presentarse 10 min antes con DNI o usar Check-in Facial.',
    }
  }
  if (category === 'REJECTED') {
    return {
      category,
      badgeClass: 'bg-red-600 text-white border border-red-700 font-bold shadow-xs',
      cardAccentClass: 'border-l-4 border-l-red-500 bg-red-50/40 border-red-200',
      badgeStyle: { backgroundColor: '#dc2626', color: '#ffffff', borderColor: '#b91c1c' },
      statusHelper: 'Turno cancelado o rechazado · Podés reprogramar desde recepción o Asistente IA.',
    }
  }
  return {
    category,
    badgeClass: 'bg-orange-500 text-white border border-orange-600 font-bold shadow-xs',
    cardAccentClass: 'border-l-4 border-l-orange-500 bg-orange-50/40 border-orange-200',
    badgeStyle: { backgroundColor: '#f97316', color: '#ffffff', borderColor: '#ea580c' },
    statusHelper: 'En espera de confirmación o atención · Recepción validará tu horario.',
  }
}

export function PortalPaciente({ token, onLogout }: { token: string; onLogout: () => void }) {
  const location = useLocation()
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [loading, setLoading] = useState(true)
  const [dni, setDni] = useState('')
  const [fechaNacimiento, setFechaNacimiento] = useState('')
  const [telefono, setTelefono] = useState('')
  const [editTelefono, setEditTelefono] = useState('')
  const [reports, setReports] = useState<Reporte[]>([])
  const [turnos, setTurnos] = useState<TurnoPropio[]>([])
  const [tratamientos, setTratamientos] = useState<TratamientoPropio[]>([])
  const [turnosError, setTurnosError] = useState('')
  const [tratamientosError, setTratamientosError] = useState('')
  const [reportsError, setReportsError] = useState('')
  const [selectedTooth, setSelectedTooth] = useState(11)
  const [dolor, setDolor] = useState(3)
  const [sintomas, setSintomas] = useState('')
  const [foto, setFoto] = useState<string | null>(null)
  const [fotoNombre, setFotoNombre] = useState('')
  const [fotoConsentida, setFotoConsentida] = useState(false)
  const [selectedReport, setSelectedReport] = useState<Reporte | null>(null)
  const [turnoFilter, setTurnoFilter] = useState<TurnoFilter>('ALL')
  const [reportFilter, setReportFilter] = useState<ReportFilter>('ALL')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [openedAt] = useState(() => Date.now())
  const [reloadKey, setReloadKey] = useState(0)
  const { theme, toggleTheme } = useTheme()

  const [showBooking, setShowBooking] = useState(false)
  const [bookingDoctors, setBookingDoctors] = useState<DoctorDisponible[]>([])
  const [bookingDoctorId, setBookingDoctorId] = useState('')
  const [bookingFecha, setBookingFecha] = useState(() => new Date().toISOString().slice(0, 10))
  const [bookingHora, setBookingHora] = useState('')
  const [bookingMotivo, setBookingMotivo] = useState('Control general')
  const [bookingSlots, setBookingSlots] = useState<TurnoSlot[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [bookingSubmitting, setBookingSubmitting] = useState(false)
  const [bookingFormError, setBookingFormError] = useState('')

  const bookingClinicHours = useMemo(() => getClinicHoursForDate(bookingFecha), [bookingFecha])

  useEffect(() => {
    if (showBooking && bookingDoctors.length === 0) {
      void apiRequest<DoctorDisponible[]>('/chatbot/doctores', { token })
        .then(docs => {
          if (Array.isArray(docs)) {
            setBookingDoctors(docs)
            if (docs.length > 0 && !bookingDoctorId) {
              setBookingDoctorId(String(docs[0].id))
            }
          }
        })
        .catch(() => undefined)
    }
  }, [showBooking, bookingDoctors.length, bookingDoctorId, token])

  useEffect(() => {
    if (showBooking && bookingDoctorId && bookingFecha) {
      setLoadingSlots(true)
      setBookingFormError('')
      void apiRequest<TurnoSlot[]>(`/chatbot/turnos/disponibles?fecha=${bookingFecha}&odontologoId=${bookingDoctorId}`, { token })
        .then(slots => {
          if (Array.isArray(slots)) {
            setBookingSlots(slots)
            setBookingHora(prev =>
              slots.length > 0 && !slots.some(s => s.hora.startsWith(prev))
                ? slots[0].hora.slice(0, 5)
                : slots.length === 0
                  ? ''
                  : prev
            )
          } else {
            setBookingSlots([])
          }
        })
        .catch(err => {
          setBookingSlots([])
          setBookingFormError(err instanceof Error ? err.message : 'No se pudieron consultar los horarios.')
        })
        .finally(() => setLoadingSlots(false))
    }
  }, [showBooking, bookingDoctorId, bookingFecha, token])

  async function handleSolicitarTurno(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!bookingDoctorId || !bookingFecha || !bookingHora || !bookingMotivo.trim()) {
      setBookingFormError('Completá todos los campos para solicitar el turno.')
      return
    }
    setBookingSubmitting(true)
    setBookingFormError('')
    try {
      const selectedDoc = bookingDoctors.find(d => String(d.id) === bookingDoctorId)
      const res = await apiRequest<{ mensaje: string }>('/chatbot/turnos/reservar', {
        method: 'POST',
        token,
        body: {
          odontologoId: Number(bookingDoctorId),
          fecha: bookingFecha,
          hora: bookingHora.length === 5 ? `${bookingHora}:00` : bookingHora,
          motivo: bookingMotivo.trim(),
          pacienteId: perfil?.id,
        },
      })
      setNotice(res.mensaje || `Turno agendado con éxito para el ${bookingFecha} a las ${bookingHora} hs con Dr./Dra. ${selectedDoc?.nombreCompleto || ''}.`)
      setShowBooking(false)
      setBookingHora('')
      const updatedTurnos = await apiRequest<TurnoPropio[]>('/portal-paciente/turnos', { token })
      setTurnos(updatedTurnos)
      setTurnoFilter('ALL')
      window.dispatchEvent(new CustomEvent('novadent:turno-booked'))
    } catch (err) {
      setBookingFormError(err instanceof Error ? err.message : 'No se pudo reservar el turno en este horario.')
    } finally {
      setBookingSubmitting(false)
    }
  }

  useEffect(() => {
    const onTurnoBooked = () => setReloadKey(value => value + 1)
    window.addEventListener('novadent:turno-booked', onTurnoBooked)
    return () => window.removeEventListener('novadent:turno-booked', onTurnoBooked)
  }, [])

  useEffect(() => {
    let active = true
    async function load() {
      try {
        const current = await apiRequest<Perfil>('/portal-paciente/perfil', { token })
        if (!active) return
        setPerfil(current)
        setEditTelefono(current.telefono || '')
        const [reportList, ownTurnos, ownTreatments] = await Promise.all([
          apiRequest<Reporte[]>('/portal-paciente/reportes', { token }).catch(failure => {
            if (active && !(failure instanceof ApiError && (failure.status === 404 || failure.status === 409))) {
              setReportsError(failure instanceof Error ? failure.message : 'No se pudieron cargar los reportes.')
            }
            return []
          }),
          apiRequest<TurnoPropio[]>('/portal-paciente/turnos', { token }).catch(failure => {
            if (active && !(failure instanceof ApiError && (failure.status === 404 || failure.status === 409))) {
              setTurnosError(failure instanceof Error ? failure.message : 'No se pudieron cargar los turnos.')
            }
            return []
          }),
          apiRequest<TratamientoPropio[]>('/portal-paciente/tratamientos', { token }).catch(failure => {
            if (active && !(failure instanceof ApiError && (failure.status === 404 || failure.status === 409))) {
              setTratamientosError(failure instanceof Error ? failure.message : 'No se pudieron cargar los tratamientos.')
            }
            return []
          }),
        ])
        if (active) {
          setReports(reportList)
          setTurnos(ownTurnos)
          setTratamientos(ownTreatments)
        }
      } catch (failure) {
        if (!active) return
        if (!(failure instanceof ApiError && failure.status === 404)) {
          setError(failure instanceof Error ? failure.message : 'No se pudo cargar el portal.')
        }
      } finally {
        if (active) setLoading(false)
      }
    }
    void reloadKey
    void load()
    return () => {
      active = false
    }
  }, [token, reloadKey])

  async function crearPerfil(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const created = await apiRequest<Perfil>('/portal-paciente/perfil', {
        method: 'POST',
        token,
        body: { dni: dni.trim(), telefono: telefono.trim(), fechaNacimiento },
      })
      setPerfil(created)
      setEditTelefono(created.telefono || '')
      setReports([])
      setReportsError('')
      setTurnosError('')
      setTratamientosError('')
      setNotice('Tu ficha quedó vinculada a esta cuenta.')
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'No se pudo crear la ficha.')
    } finally {
      setBusy(false)
    }
  }

  async function actualizarTelefono(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const updated = await apiRequest<Perfil>('/portal-paciente/perfil', {
        method: 'PUT',
        token,
        body: { telefono: editTelefono.trim() },
      })
      setPerfil(updated)
      setNotice('Teléfono actualizado.')
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'No se pudo actualizar el teléfono.')
    } finally {
      setBusy(false)
    }
  }

  function cargarFoto(event: ChangeEvent<HTMLInputElement>) {
    setError('')
    setFoto(null)
    setFotoNombre('')
    setFotoConsentida(false)
    const file = event.target.files?.[0]
    if (!file) return
    if (!['image/png', 'image/jpeg'].includes(file.type) || file.size > 1_000_000) {
      setError('Elegí una foto PNG o JPEG de hasta 1 MB.')
      event.target.value = ''
      return
    }
    setFotoNombre(file.name)
    const reader = new FileReader()
    reader.onload = () => setFoto(typeof reader.result === 'string' ? reader.result : null)
    reader.onerror = () => setError('No se pudo leer la foto.')
    reader.readAsDataURL(file)
  }

  async function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (foto && !fotoConsentida) {
      setError('Aceptá el uso de la foto para este reporte.')
      return
    }
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await apiRequest<Reporte>('/portal-paciente/reportes', {
        method: 'POST',
        token,
        body: {
          pieza: selectedTooth,
          dolor,
          sintomas: sintomas.trim(),
          fotoBase64: foto,
          consentimientoFoto: foto ? fotoConsentida : false,
        },
      })
      const updatedReports = await apiRequest<Reporte[]>('/portal-paciente/reportes', { token })
      setReports(Array.isArray(updatedReports) ? updatedReports : [])
      setSintomas('')
      setFoto(null)
      setFotoNombre('')
      setFotoConsentida(false)
      setNotice('Reporte enviado. Un odontólogo debe revisarlo; esto no es un diagnóstico.')
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'No se pudo enviar el reporte.')
    } finally {
      setBusy(false)
    }
  }

  async function verReporte(id: number) {
    setError('')
    try {
      setSelectedReport(await apiRequest<Reporte>(`/portal-paciente/reportes/${id}`, { token }))
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'No se pudo abrir el reporte.')
    }
  }

  const nextTurno = turnos.find(
    turno =>
      classifyTurnoStatus(turno.estado) !== 'REJECTED' &&
      new Date(`${turno.fecha}T${turno.hora}`).getTime() >= openedAt
  )
  const page = PAGE_TITLES[location.pathname] || PAGE_TITLES['/']

  // Contadores de turnos por estado
  const turnoCounts = useMemo(() => {
    const confirmed = turnos.filter(t => classifyTurnoStatus(t.estado) === 'CONFIRMED').length
    const pending = turnos.filter(t => classifyTurnoStatus(t.estado) === 'PENDING').length
    const rejected = turnos.filter(t => classifyTurnoStatus(t.estado) === 'REJECTED').length
    return { confirmed, pending, rejected }
  }, [turnos])

  const filteredTurnos = useMemo(() => {
    if (turnoFilter === 'ALL') return turnos
    return turnos.filter(t => classifyTurnoStatus(t.estado) === turnoFilter)
  }, [turnos, turnoFilter])

  // Agrupación de piezas bajo seguimiento clínico para /mi-seguimiento
  const trackedTeethSummary = useMemo(() => {
    const map = new Map<
      number,
      {
        pieza: number
        latest: Reporte
        totalReports: number
        maxPain: number
        hasProfessionalReview: boolean
      }
    >()
    const sorted = (Array.isArray(reports) ? [...reports] : []).sort(
      (a, b) => new Date(b.creadoEn || 0).getTime() - new Date(a.creadoEn || 0).getTime()
    )
    for (const rep of sorted) {
      const existing = map.get(rep.pieza)
      if (!existing) {
        map.set(rep.pieza, {
          pieza: rep.pieza,
          latest: rep,
          totalReports: 1,
          maxPain: rep.dolor,
          hasProfessionalReview: rep.estado === 'REVISADO' || Boolean(rep.revisionProfesional),
        })
      } else {
        existing.totalReports += 1
        existing.maxPain = Math.max(existing.maxPain, rep.dolor)
        if (rep.estado === 'REVISADO' || rep.revisionProfesional) {
          existing.hasProfessionalReview = true
        }
      }
    }
    return Array.from(map.values())
  }, [reports])

  const filteredReports = useMemo(() => {
    return reports.filter(item => {
      if (reportFilter === 'REVISADO') return item.estado === 'REVISADO'
      if (reportFilter === 'PENDIENTE') return item.estado === 'PENDIENTE'
      if (reportFilter === 'WITH_PHOTO') return Boolean(item.fotoDisponible || item.fotoBase64)
      return true
    })
  }, [reports, reportFilter])

  return (
    <main
      className="clinic-backdrop patient-portal-backdrop min-h-screen text-slate-900"
      style={{
        backgroundImage:
          theme === 'dark'
            ? 'linear-gradient(125deg, rgba(3,16,32,.84), rgba(5,23,42,.78)), url("/images/novadent-consultorio.png")'
            : 'linear-gradient(125deg, rgba(226,236,248,.48), rgba(214,230,246,.54)), url("/images/novadent-consultorio.png")',
      }}
    >
      <div className="mx-auto grid w-full max-w-[1800px] gap-4 px-3 py-3 sm:px-5 sm:py-5 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="flex flex-col rounded-2xl border border-slate-300 bg-white/90 p-4 shadow-xl shadow-blue-950/10 backdrop-blur-xl lg:sticky lg:top-5 lg:h-[calc(100vh-2.5rem)] lg:p-5">
          <NovadentBrand compact />
          <nav
            aria-label="Navegación del paciente"
            className="mt-5 flex flex-wrap gap-1 border-t border-blue-100 pt-4 lg:flex-col"
          >
            {PATIENT_LINKS.map(({ label, to, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `flex min-h-10 items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-800 hover:bg-blue-50 hover:text-blue-800'
                  }`
                }
              >
                <Icon aria-hidden="true" size={17} /> {label}
              </NavLink>
            ))}
          </nav>
          <div className="mt-auto hidden border-t border-blue-100 pt-4 lg:block">
            <div className="flex items-center gap-3 rounded-xl bg-blue-50/90 p-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
                {perfil?.nombre?.charAt(0).toUpperCase() || 'P'}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold text-slate-900">
                  {perfil ? `${perfil.nombre} ${perfil.apellido}` : 'Mi cuenta'}
                </span>
                <span className="block text-xs font-semibold text-slate-700">Paciente</span>
              </span>
            </div>
          </div>
        </aside>

        <div className="min-w-0">
          <header
            id="inicio"
            className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-300 bg-white/88 px-5 py-4 shadow-lg shadow-blue-950/5 backdrop-blur-xl sm:px-6"
          >
            <div>
              <p className="text-[0.72rem] font-bold uppercase tracking-[0.16em] text-blue-700">
                Portal del paciente
              </p>
              <h1 className="mt-0.5 text-2xl font-extrabold tracking-tight text-slate-950 sm:text-3xl">
                {page.title}
              </h1>
              <p className="mt-0.5 text-sm font-medium text-slate-700">{page.subtitle}</p>
            </div>
            <div className="flex items-center gap-2.5">
              {/* Botón de Tema: Modo oscuro (Naranja con Luna negra) / Modo claro (Celeste con Sol amarillo) */}
              <button
                type="button"
                onClick={toggleTheme}
                aria-label={theme === 'dark' ? 'Activar modo claro' : 'Activar modo oscuro'}
                style={
                  theme === 'dark'
                    ? { backgroundColor: '#38bdf8', color: '#082f49', borderColor: '#0284c7' }
                    : { backgroundColor: '#f97316', color: '#09090b', borderColor: '#c2410c' }
                }
                className={`flex min-h-10 items-center gap-2 rounded-xl border-2 px-3.5 py-2 text-sm font-extrabold shadow-sm transition focus-visible:outline-2 focus-visible:outline-offset-2 ${
                  theme === 'dark'
                    ? 'border-sky-500 bg-sky-300 text-slate-950 hover:bg-sky-200 focus-visible:outline-sky-400'
                    : 'border-orange-700 bg-orange-500 text-slate-950 hover:bg-orange-600 focus-visible:outline-orange-600'
                }`}
              >
                {theme === 'dark' ? (
                  <Sun
                    aria-hidden="true"
                    size={18}
                    className="text-yellow-300 fill-yellow-400 drop-shadow-[0_1px_1px_rgba(0,0,0,0.45)]"
                    style={{ color: '#fde047', fill: '#facc15' }}
                  />
                ) : (
                  <Moon
                    aria-hidden="true"
                    size={18}
                    className="text-black fill-black"
                    style={{ color: '#000000', fill: '#000000' }}
                  />
                )}
                {theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
              </button>

              {/* Botón Cerrar sesión siempre en Rojo intenso */}
              <button
                type="button"
                onClick={onLogout}
                style={{ backgroundColor: '#dc2626', color: '#ffffff', borderColor: '#b91c1c' }}
                className="flex min-h-10 items-center gap-2 rounded-xl border border-red-700 bg-red-600 px-3.5 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
              >
                <LogOut size={16} className="text-white" /> Cerrar sesión
              </button>
            </div>
          </header>

          <div className="space-y-4 py-4">
            <p className="rounded-xl border border-blue-200/90 bg-blue-50/95 px-4 py-2.5 text-sm font-medium text-blue-950 shadow-sm">
              Este portal registra lo que vos observás. No determina enfermedades ni reemplaza la consulta. La evaluación corresponde al odontólogo.
            </p>
            {error && (
              <p role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm font-semibold text-red-900">
                {error}
              </p>
            )}
            {notice && (
              <p role="status" className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm font-semibold text-emerald-900">
                {notice}
              </p>
            )}

            {location.pathname === '/chatbot' ? (
              <ChatbotPage />
            ) : location.pathname === '/check-in' ? (
              <FaceCheckin
                token={token}
                role="PACIENTE"
                initialDni={perfil?.dni}
                initialPatient={perfil ? { ...perfil, telefono: perfil.telefono ?? null } : null}
              />
            ) : loading ? (
              <p className="rounded-xl bg-white/90 p-5 font-medium">Cargando tu información…</p>
            ) : !perfil ? (
              <section
                id="mis-datos"
                className="rounded-2xl border border-slate-300 bg-white/90 p-5 shadow-lg shadow-blue-950/5 backdrop-blur-xl"
              >
                <h2 className="mb-2 text-lg font-bold text-slate-950">
                  Completá tu ficha para ver {page.title.toLocaleLowerCase('es-AR')}
                </h2>
                <p className="mb-5 text-sm text-slate-700">
                  Tu cuenta todavía no tiene una ficha de paciente vinculada. Completá tus datos abajo para consultar tus turnos, tratamientos, reportes y odontograma, o pedí al administrador que vincule tu ficha si ya te atendiste en el consultorio.
                </p>
                <form onSubmit={crearPerfil} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  <label className="block text-sm font-semibold">
                    DNI
                    <input
                      className={inputClass}
                      required
                      minLength={5}
                      maxLength={30}
                      value={dni}
                      onChange={event => setDni(event.target.value)}
                    />
                  </label>
                  <label className="block text-sm font-semibold">
                    Fecha de nacimiento
                    <input
                      className={inputClass}
                      required
                      type="date"
                      max={new Date().toISOString().slice(0, 10)}
                      value={fechaNacimiento}
                      onChange={event => setFechaNacimiento(event.target.value)}
                    />
                  </label>
                  <label className="block text-sm font-semibold">
                    Teléfono (opcional)
                    <input
                      className={inputClass}
                      maxLength={30}
                      value={telefono}
                      onChange={event => setTelefono(event.target.value)}
                    />
                  </label>
                  <div className="flex items-end">
                    <button type="submit" disabled={busy} className={primaryClass}>
                      Crear mi ficha
                    </button>
                  </div>
                </form>
              </section>
            ) : (
              <Routes>
                <Route path="/mi-odontograma" element={<MiOdontograma token={token} />} />

                {/* RUTA 1: INICIO */}
                <Route
                  path="/"
                  element={
                    <div className="space-y-4">
                      <section
                        data-testid="patient-summary-grid"
                        className={cardClass + ' grid gap-5 lg:grid-cols-[1fr_auto] lg:items-center'}
                      >
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wide text-blue-700">
                            Resumen personal
                          </p>
                          <h2 className="mt-1 text-2xl font-extrabold text-slate-950">Resumen de hoy</h2>
                          <p className="mt-1 text-sm font-medium text-slate-700">
                            Hola, {perfil.nombre}. Acá tenés tus próximas acciones y actividad reciente.
                          </p>
                          <div className="mt-4 flex flex-wrap gap-3">
                            <Link
                              to="/mis-datos"
                              className="rounded-lg border border-blue-300 bg-blue-50/90 px-4 py-2 text-sm font-bold text-blue-900 hover:bg-blue-100"
                            >
                              Revisar mis datos
                            </Link>
                            <Link
                              to="/mi-odontograma"
                              className="rounded-lg border border-blue-300 bg-white/90 px-4 py-2 text-sm font-bold text-blue-900 hover:bg-blue-50"
                            >
                              Ver odontograma
                            </Link>
                            <Link
                              to="/mis-reportes"
                              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700"
                            >
                              Ver mis reportes
                            </Link>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 lg:min-w-72">
                          <div className="rounded-xl border border-orange-300 bg-orange-50/90 p-3">
                            <span className="block text-xs font-bold text-slate-700">Reportes pendientes</span>
                            <span className="mt-1 block text-2xl font-extrabold text-orange-700">
                              {reports.filter(report => report.estado === 'PENDIENTE').length}
                            </span>
                          </div>
                          <div className="rounded-xl border border-emerald-300 bg-emerald-50/90 p-3">
                            <span className="block text-xs font-bold text-slate-700">Tratamientos activos</span>
                            <span className="mt-1 block text-2xl font-extrabold text-emerald-800">
                              {
                                tratamientos.filter(
                                  item =>
                                    item.estado.toLocaleLowerCase('es-AR').includes('curso') ||
                                    item.estado.toLocaleLowerCase('es-AR').includes('activo')
                                ).length
                              }
                            </span>
                          </div>
                        </div>
                      </section>

                      <div className="grid gap-4 lg:grid-cols-2">
                        <section className={cardClass}>
                          <h2 className="flex items-center gap-2 text-base font-bold text-slate-950">
                            <CalendarDays aria-hidden="true" className="h-5 w-5 text-blue-600" /> Próximo turno
                          </h2>
                          {turnosError ? (
                            <p role="alert" className="mt-3 text-sm font-semibold text-red-700">
                              No se pudieron cargar tus turnos.
                            </p>
                          ) : nextTurno ? (
                            (() => {
                              const statusUi = getTurnoStatusUi(nextTurno.estado)
                              return (
                                <div className={`mt-3 rounded-xl border p-3.5 ${statusUi.cardAccentClass}`}>
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <p className="font-bold text-slate-950">
                                      {dateLabel(nextTurno.fecha)} · {nextTurno.hora.slice(0, 5)} hs
                                    </p>
                                    <span
                                      style={statusUi.badgeStyle}
                                      className={`inline-flex items-center rounded-full px-3 py-1 text-xs ${statusUi.badgeClass}`}
                                    >
                                      {nextTurno.estado}
                                    </span>
                                  </div>
                                  <p className="mt-1 text-sm font-semibold text-slate-800">{nextTurno.motivo}</p>
                                  <p className="text-sm font-medium text-slate-700">{nextTurno.odontologoNombre}</p>
                                  <Link
                                    to="/mis-turnos"
                                    className="mt-3 inline-flex rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700"
                                  >
                                    Ver mis turnos
                                  </Link>
                                </div>
                              )
                            })()
                          ) : (
                            <p className="mt-3 text-sm font-medium text-slate-700">Todavía no tenés próximos turnos.</p>
                          )}
                        </section>

                        <section className={cardClass}>
                          <h2 className="flex items-center gap-2 text-base font-bold text-slate-950">
                            <ClipboardList aria-hidden="true" className="h-5 w-5 text-emerald-700" /> Actividad reciente
                          </h2>
                          {reportsError ? (
                            <p role="alert" className="mt-3 text-sm font-semibold text-red-700">
                              No se pudieron cargar tus reportes.
                            </p>
                          ) : reports.length === 0 ? (
                            <p className="mt-3 text-sm font-medium text-slate-700">
                              Todavía no hay reportes. Si querés registrar una observación, usá el formulario de abajo.
                            </p>
                          ) : (
                            <p className="mt-3 text-sm font-medium text-slate-800">
                              Tenés {reports.length} {reports.length === 1 ? 'reporte' : 'reportes'} registrados. El más reciente es de la pieza {reports[0].pieza}.
                            </p>
                          )}
                          <Link
                            to="/mi-seguimiento"
                            className="mt-3 inline-flex rounded-lg border border-emerald-400 bg-emerald-50/90 px-4 py-2 text-sm font-bold text-emerald-900 hover:bg-emerald-100"
                          >
                            Ver evolución de mis reportes
                          </Link>
                        </section>
                      </div>

                      <section id="registrar-reporte" className={cardClass}>
                        <h2 className="mb-1 text-lg font-bold text-slate-950">Registrar una observación</h2>
                        <p className="mb-3 text-sm font-medium text-slate-700">
                          Contale al equipo qué sentís. Esto registra una observación y no es un diagnóstico.
                        </p>
                        <form className="grid gap-4 lg:grid-cols-2" onSubmit={enviar}>
                          <div className="space-y-3">
                            <label className="block text-sm font-semibold">
                              Pieza dental
                              <select
                                className={inputClass}
                                value={selectedTooth}
                                onChange={event => setSelectedTooth(Number(event.target.value))}
                              >
                                {DIENTES.flat().map(number => (
                                  <option key={number} value={number}>
                                    {number} · {nombrePieza(number)}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="block text-sm font-semibold">
                              Dolor informado: {dolor}/10
                              <input
                                className="mt-2 w-full accent-blue-600"
                                type="range"
                                min="0"
                                max="10"
                                value={dolor}
                                onChange={event => setDolor(Number(event.target.value))}
                              />
                            </label>
                          </div>
                          <div className="space-y-3">
                            <label className="block text-sm font-semibold">
                              Síntomas
                              <textarea
                                className={inputClass}
                                required
                                minLength={3}
                                maxLength={500}
                                rows={2}
                                value={sintomas}
                                onChange={event => setSintomas(event.target.value)}
                                placeholder="Qué notás y desde cuándo"
                              />
                            </label>
                            <div>
                              <label htmlFor="patient-photo-upload" className="flex items-center gap-2 text-sm font-semibold">
                                <Camera size={18} /> Foto opcional (PNG/JPEG, hasta 1 MB)
                              </label>
                              <div className="relative mt-2 rounded-lg border border-dashed border-blue-400 bg-blue-50/80 p-2.5 transition hover:border-blue-600 hover:bg-blue-100/80 focus-within:border-blue-700 focus-within:ring-2 focus-within:ring-blue-300">
                                <input
                                  id="patient-photo-upload"
                                  aria-label="Foto opcional (PNG/JPEG, hasta 1 MB)"
                                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                                  type="file"
                                  accept="image/png,image/jpeg"
                                  onChange={cargarFoto}
                                />
                                <div className="pointer-events-none flex flex-wrap items-center gap-3">
                                  <span className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-sm">
                                    <FileUp aria-hidden="true" size={17} /> Seleccionar foto
                                  </span>
                                  <span className="min-w-0 break-all text-sm font-medium text-slate-900">
                                    {fotoNombre || 'Ningún archivo seleccionado'}
                                  </span>
                                </div>
                              </div>
                            </div>
                            {foto && (
                              <>
                                <img
                                  src={foto}
                                  alt="Vista previa de la foto cargada"
                                  className="max-h-44 rounded-xl border object-contain"
                                />
                                <label className="flex gap-2 text-sm font-medium">
                                  <input
                                    type="checkbox"
                                    checked={fotoConsentida}
                                    onChange={event => setFotoConsentida(event.target.checked)}
                                  />
                                  Acepto guardar esta foto en mi reporte clínico.
                                </label>
                              </>
                            )}
                            <button type="submit" disabled={busy} className={primaryClass + ' w-full'}>
                              Enviar reporte
                            </button>
                          </div>
                        </form>
                      </section>
                    </div>
                  }
                />

                {/* RUTA 2: MI SEGUIMIENTO (Tablero de Evolución Clínica, Mapa de Piezas y Plan de Tratamientos) */}
                <Route
                  path="/mi-seguimiento"
                  element={
                    <div className="space-y-4">
                      <section className={cardClass}>
                        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-300 pb-4">
                          <div>
                            <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">
                              Tablero de seguimiento clínico
                            </p>
                            <h2 className="mt-1 text-xl font-extrabold text-slate-950">
                              Evolución de mis observaciones
                            </h2>
                            <p className="mt-1 text-sm font-medium text-slate-700">
                              Monitoreá las piezas dentales bajo vigilancia, la curva de alivio o dolor y las indicaciones del equipo odontológico.
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Link
                              to="/mi-odontograma"
                              className="inline-flex items-center gap-1.5 rounded-xl border border-blue-300 bg-blue-50 px-3.5 py-2 text-xs font-bold text-blue-900 hover:bg-blue-100"
                            >
                              <ShieldCheck size={15} /> Ver mapa en odontograma
                            </Link>
                            <Link
                              to="/mis-reportes"
                              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700"
                            >
                              Abrir mis reportes
                            </Link>
                          </div>
                        </header>

                        {/* KPIs de evolución clínica */}
                        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                          <div className="rounded-xl border border-blue-200 bg-blue-50/80 p-3.5">
                            <span className="text-xs font-bold uppercase text-blue-800">Piezas en vigilancia</span>
                            <strong className="mt-1 block text-2xl font-extrabold text-slate-950">
                              {trackedTeethSummary.length}
                            </strong>
                            <span className="text-xs font-medium text-slate-700">
                              Piezas con seguimiento registrado
                            </span>
                          </div>
                          <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-3.5">
                            <span className="text-xs font-bold uppercase text-emerald-800">Controles respondidos</span>
                            <strong className="mt-1 block text-2xl font-extrabold text-emerald-900">
                              {reports.filter(r => r.estado === 'REVISADO').length} / {reports.length}
                            </strong>
                            <span className="text-xs font-medium text-slate-700">
                              Evaluaciones con devolución clínica
                            </span>
                          </div>
                          <div className="rounded-xl border border-orange-200 bg-orange-50/80 p-3.5">
                            <span className="text-xs font-bold uppercase text-orange-800">Último dolor reportado</span>
                            <strong className="mt-1 block text-2xl font-extrabold text-orange-800">
                              {reports[0] ? `${reports[0].dolor}/10` : '0/10'}
                            </strong>
                            <span className="text-xs font-medium text-slate-700">
                              Escala subjetiva de sensibilidad
                            </span>
                          </div>
                          <div className="rounded-xl border border-violet-200 bg-violet-50/80 p-3.5">
                            <span className="text-xs font-bold uppercase text-violet-800">Planes terapéuticos</span>
                            <strong className="mt-1 block text-2xl font-extrabold text-violet-950">
                              {tratamientos.length}
                            </strong>
                            <span className="text-xs font-medium text-slate-700">
                              Tratamientos vinculados a tu ficha
                            </span>
                          </div>
                        </div>

                        {/* Mapa de piezas dentales bajo seguimiento */}
                        {trackedTeethSummary.length > 0 && (
                          <div className="mt-5">
                            <h3 className="text-sm font-extrabold uppercase tracking-wide text-slate-800">
                              Estado actual por pieza dental vigilada
                            </h3>
                            <div className="mt-2.5 grid gap-3 md:grid-cols-2">
                              {trackedTeethSummary.map(item => {
                                const painPercent = Math.min(100, Math.max(8, item.latest.dolor * 10))
                                const isReviewed = item.hasProfessionalReview
                                return (
                                  <div
                                    key={item.pieza}
                                    className={`rounded-xl border p-4 ${
                                      isReviewed
                                        ? 'border-l-4 border-l-emerald-500 border-emerald-200 bg-emerald-50/35'
                                        : 'border-l-4 border-l-orange-500 border-orange-200 bg-orange-50/35'
                                    }`}
                                  >
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                      <span className="font-extrabold text-slate-950">
                                        Pieza #{item.pieza} · {nombrePieza(item.pieza)}
                                      </span>
                                      <span
                                        style={
                                          isReviewed
                                            ? { backgroundColor: '#059669', color: '#ffffff' }
                                            : { backgroundColor: '#f97316', color: '#ffffff' }
                                        }
                                        className="rounded-full px-2.5 py-0.5 text-xs font-bold text-white"
                                      >
                                        {isReviewed ? 'En control profesional' : 'En observación activa'}
                                      </span>
                                    </div>
                                    <div className="mt-2.5">
                                      <div className="flex justify-between text-xs font-semibold text-slate-700">
                                        <span>Intensidad de molestia actual: {item.latest.dolor}/10</span>
                                        <span>{item.totalReports} {item.totalReports === 1 ? 'registro' : 'registros'}</span>
                                      </div>
                                      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                                        <div
                                          className="h-full rounded-full"
                                          style={{
                                            width: `${painPercent}%`,
                                            backgroundColor:
                                              item.latest.dolor >= 7
                                                ? '#dc2626'
                                                : item.latest.dolor >= 4
                                                  ? '#f97316'
                                                  : '#10b981',
                                          }}
                                        />
                                      </div>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )}

                        {/* Línea de tiempo cronológica */}
                        {reportsError ? (
                          <p role="alert" className="mt-5 text-sm font-semibold text-red-700">
                            {reportsError}
                          </p>
                        ) : reports.length === 0 ? (
                          <p className="mt-5 rounded-xl bg-blue-50/90 p-4 text-sm font-medium text-slate-800">
                            Todavía no registraste observaciones. Podés iniciar una desde{' '}
                            <Link to="/" className="font-bold text-blue-700 underline">
                              Inicio
                            </Link>
                            .
                          </p>
                        ) : (
                          <div className="mt-6">
                            <h3 className="text-sm font-extrabold uppercase tracking-wide text-slate-800">
                              Historial cronológico de evolución
                            </h3>
                            <ol className="mt-3 space-y-4">
                              {[...reports]
                                .sort((a, b) => new Date(b.creadoEn || 0).getTime() - new Date(a.creadoEn || 0).getTime())
                                .map(item => (
                                  <li
                                    key={item.id}
                                    className={`relative rounded-xl border p-4 ${
                                      item.estado === 'REVISADO'
                                        ? 'border-l-4 border-l-emerald-500 border-slate-300 bg-white/90'
                                        : 'border-l-4 border-l-orange-500 border-slate-300 bg-white/90'
                                    }`}
                                  >
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                      <h3 className="font-extrabold text-slate-950">
                                        Pieza {item.pieza} · {nombrePieza(item.pieza)}
                                      </h3>
                                      <time className="text-xs font-semibold text-slate-600">
                                        {item.creadoEn
                                          ? new Date(item.creadoEn).toLocaleString('es-AR')
                                          : 'Reporte #' + item.id}
                                      </time>
                                    </div>
                                    <p className="mt-2 text-sm font-medium text-slate-800">{item.sintomas}</p>
                                    <div className="mt-2 flex flex-wrap items-center gap-3">
                                      <span className="text-xs font-bold text-slate-700">
                                        Dolor informado: {item.dolor}/10
                                      </span>
                                      <span
                                        style={
                                          item.estado === 'REVISADO'
                                            ? { backgroundColor: '#059669', color: '#ffffff' }
                                            : { backgroundColor: '#f97316', color: '#ffffff' }
                                        }
                                        className="rounded-full px-2.5 py-0.5 text-xs font-bold text-white"
                                      >
                                        {item.estado === 'REVISADO'
                                          ? 'Revisado por un profesional'
                                          : 'Pendiente de revisión profesional'}
                                      </span>
                                    </div>
                                    {item.revisionProfesional && (
                                      <p className="mt-3 rounded-lg border-l-4 border-emerald-600 bg-emerald-50/90 p-3 text-sm font-medium text-emerald-950">
                                        <span className="font-bold">Nota del equipo: </span>
                                        {item.revisionProfesional}
                                      </p>
                                    )}
                                  </li>
                                ))}
                            </ol>
                          </div>
                        )}
                      </section>
                    </div>
                  }
                />

                {/* RUTA 3: MIS TURNOS (Agenda de Citas y Semáforo de Confirmación: Verde Confirmado, Naranja En Espera, Rojo Rechazado/Cancelado) */}
                <Route
                  path="/mis-turnos"
                  element={
                    <section className={cardClass}>
                      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-300 pb-4">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wide text-blue-700">
                            Gestión de citas y asistencia
                          </p>
                          <h2 className="mt-1 text-xl font-extrabold text-slate-950">Mis turnos</h2>
                          <p className="mt-1 text-sm font-medium text-slate-700">
                            Consultá las citas vinculadas a tu ficha identificadas por color según su estado de confirmación.
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => setShowBooking(prev => !prev)}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700 transition"
                          >
                            <CalendarPlus size={15} /> {showBooking ? 'Cerrar reserva' : 'Solicitar nuevo turno'}
                          </button>
                          <Link
                            to="/check-in"
                            className="inline-flex items-center gap-1.5 rounded-xl border border-blue-300 bg-blue-50 px-3.5 py-2 text-xs font-bold text-blue-900 hover:bg-blue-100"
                          >
                            <Camera size={15} /> Ir a Check-in facial
                          </Link>
                          <Link
                            to="/chatbot"
                            className="inline-flex items-center gap-1.5 rounded-xl border border-blue-300 bg-white px-3.5 py-2 text-xs font-bold text-blue-900 hover:bg-blue-50"
                          >
                            <MessageCircle size={15} /> Consultar horarios por IA
                          </Link>
                        </div>
                      </div>

                      {/* Cartel informativo de Odontólogos disponibles en la clínica */}
                      {!showBooking && bookingDoctors.length > 0 && (
                        <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50/60 p-4 shadow-xs">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <h3 className="text-xs font-bold uppercase tracking-wider text-blue-800">
                                Profesionales odontológicos disponibles
                              </h3>
                              <p className="mt-0.5 text-xs font-medium text-slate-700">
                                Conocé a los odontólogos del consultorio y consultá sus horarios disponibles para reservar tu turno:
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setShowBooking(true)}
                              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-blue-700 transition"
                            >
                              <CalendarPlus size={14} /> Seleccionar profesional y turno
                            </button>
                          </div>
                          <div className="mt-3 grid gap-3 sm:grid-cols-2">
                            {bookingDoctors.map(doc => (
                              <div
                                key={doc.id}
                                className="flex items-center justify-between gap-3 rounded-xl border border-blue-200/90 bg-white/95 p-3 text-xs shadow-xs"
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-800 font-bold">
                                    <Stethoscope className="h-5 w-5" />
                                  </span>
                                  <div className="min-w-0">
                                    <p className="font-bold text-slate-900 truncate">Dr./Dra. {doc.nombreCompleto}</p>
                                    <p className="text-[11px] font-semibold text-blue-700">{doc.especialidad}</p>
                                    <span className="mt-0.5 inline-block text-[10px] font-bold text-emerald-700">
                                      ● Horarios disponibles para atención
                                    </span>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setBookingDoctorId(String(doc.id))
                                    setShowBooking(true)
                                  }}
                                  className="rounded-lg border border-blue-300 bg-blue-50 px-2.5 py-1.5 text-xs font-bold text-blue-800 hover:bg-blue-100 transition shrink-0"
                                >
                                  Ver horarios →
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {showBooking && (
                        <form
                          onSubmit={handleSolicitarTurno}
                          className="mt-4 rounded-2xl border-2 border-blue-200 bg-blue-50/70 p-4 sm:p-5 shadow-sm space-y-5"
                        >
                          <div className="flex items-center justify-between border-b border-blue-200/60 pb-3">
                            <div>
                              <h3 className="text-sm font-extrabold text-blue-950 sm:text-base">Solicitar turno odontológico</h3>
                              <p className="text-xs font-medium text-slate-700">Elegí el profesional odontólogo, la fecha y el horario disponible que prefieras.</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setShowBooking(false)}
                              className="text-xs font-bold text-slate-500 hover:text-slate-800"
                            >
                              Cerrar ✕
                            </button>
                          </div>

                          {/* 1. SELECCIÓN VISUAL DE ODONTÓLOGOS */}
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <label htmlFor="booking-doctor" className="block text-xs font-bold text-slate-800">
                                Odontólogo / Especialista
                              </label>
                              <span className="text-[11px] font-semibold text-slate-600">
                                {bookingDoctors.length} profesionales disponibles
                              </span>
                            </div>

                            {/* Selector accesible vinculado por id y label para compatibilidad */}
                            <select
                              id="booking-doctor"
                              value={bookingDoctorId}
                              onChange={e => setBookingDoctorId(e.target.value)}
                              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 focus:border-blue-600 focus:outline-none mb-3"
                              required
                            >
                              <option value="">Seleccionar odontólogo...</option>
                              {bookingDoctors.map(doc => (
                                <option key={doc.id} value={doc.id}>
                                  Dr./Dra. {doc.nombreCompleto} ({doc.especialidad})
                                </option>
                              ))}
                            </select>

                            {/* Tarjetas interactivas de odontólogos */}
                            <div className="grid gap-3 sm:grid-cols-2">
                              {bookingDoctors.map(doc => {
                                const isSelected = String(doc.id) === bookingDoctorId
                                return (
                                  <button
                                    key={doc.id}
                                    type="button"
                                    onClick={() => setBookingDoctorId(String(doc.id))}
                                    className={`flex items-start gap-3 rounded-xl border p-3.5 text-left transition ${
                                      isSelected
                                        ? 'border-blue-600 bg-blue-100/90 ring-2 ring-blue-500 shadow-xs'
                                        : 'border-slate-300 bg-white hover:border-blue-400 hover:bg-blue-50/50'
                                    }`}
                                  >
                                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${
                                      isSelected ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-800'
                                    }`}>
                                      <Stethoscope className="h-5 w-5" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center justify-between gap-1">
                                        <p className="truncate text-sm font-bold text-blue-950">
                                          Dr./Dra. {doc.nombreCompleto}
                                        </p>
                                        {isSelected && (
                                          <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-bold text-white shrink-0">
                                            Seleccionado
                                          </span>
                                        )}
                                      </div>
                                      <p className="text-xs font-semibold text-blue-700">{doc.especialidad}</p>
                                      <p className="mt-1 text-[11px] font-medium text-emerald-700">
                                        ● Horarios de atención disponibles
                                      </p>
                                    </div>
                                  </button>
                                )
                              })}
                            </div>
                          </div>

                          {/* 2. FECHA Y MOTIVO */}
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div>
                              <label htmlFor="booking-fecha" className="block text-xs font-bold text-slate-800 mb-1">
                                Fecha del turno
                              </label>
                              <input
                                id="booking-fecha"
                                type="date"
                                min={new Date().toISOString().slice(0, 10)}
                                value={bookingFecha}
                                onChange={e => setBookingFecha(e.target.value)}
                                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 focus:border-blue-600 focus:outline-none"
                                required
                              />
                            </div>

                            <div>
                              <label htmlFor="booking-motivo" className="block text-xs font-bold text-slate-800 mb-1">
                                Motivo de la consulta
                              </label>
                              <input
                                id="booking-motivo"
                                type="text"
                                maxLength={200}
                                placeholder="Ej: Control, limpieza, dolor..."
                                value={bookingMotivo}
                                onChange={e => setBookingMotivo(e.target.value)}
                                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 focus:border-blue-600 focus:outline-none"
                                required
                              />
                            </div>
                          </div>

                          {/* 3. HORARIOS DISPONIBLES Y OCUPADOS DEL PROFESIONAL */}
                          <div>
                            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                              <span className="block text-xs font-bold text-slate-800">
                                Horarios del odontólogo {bookingDoctors.find(d => String(d.id) === bookingDoctorId)?.nombreCompleto ? `· Dr./Dra. ${bookingDoctors.find(d => String(d.id) === bookingDoctorId)?.nombreCompleto}` : ''}
                              </span>
                              <span className="text-[11px] font-semibold text-slate-600">
                                🟢 {bookingSlots.length} libres · ⚪ {Math.max(0, bookingClinicHours.length - bookingSlots.length)} ocupados
                              </span>
                            </div>
                            {loadingSlots ? (
                              <p className="text-xs font-medium text-slate-600 animate-pulse">Consultando horarios libres en tiempo real…</p>
                            ) : bookingClinicHours.length === 0 ? (
                              <p className="rounded-lg bg-amber-50 border border-amber-200 p-2.5 text-xs font-medium text-amber-900">
                                El consultorio permanece cerrado los domingos. Por favor seleccioná un día de lunes a sábado.
                              </p>
                            ) : (
                              <div className="flex flex-wrap gap-2">
                                {bookingClinicHours.map(horaKey => {
                                  const slotMatch = bookingSlots.find(s => s.hora.startsWith(horaKey))
                                  const isSelected = bookingHora === horaKey
                                  if (slotMatch) {
                                    return (
                                      <button
                                        key={horaKey}
                                        type="button"
                                        aria-label={`${horaKey} hs`}
                                        onClick={() => setBookingHora(horaKey)}
                                        className={`rounded-lg px-3 py-1.5 text-xs font-bold transition inline-flex items-center gap-1.5 ${
                                          isSelected
                                            ? 'bg-blue-600 text-white shadow-xs ring-2 ring-blue-400'
                                            : 'bg-emerald-50 border border-emerald-400 text-emerald-950 hover:border-emerald-600 hover:bg-emerald-100'
                                        }`}
                                      >
                                        <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" aria-hidden="true" />
                                        <span>{horaKey} hs</span>
                                        <span className="text-[10px] font-extrabold uppercase text-emerald-800 bg-emerald-200/80 px-1 py-0.5 rounded" aria-hidden="true">
                                          Libre
                                        </span>
                                      </button>
                                    )
                                  }
                                  return (
                                    <span
                                      key={horaKey}
                                      className="rounded-lg border border-slate-200 bg-slate-100/90 px-3 py-1.5 text-xs font-semibold text-slate-400 cursor-not-allowed inline-flex items-center gap-1.5"
                                      title="Horario ocupado (turno asignado)"
                                    >
                                      <span className="h-2 w-2 rounded-full bg-slate-400 shrink-0" aria-hidden="true" />
                                      <span>{horaKey} hs</span>
                                      <span className="text-[10px] font-bold uppercase text-slate-500 bg-slate-200 px-1 py-0.5 rounded">
                                        Ocupado
                                      </span>
                                    </span>
                                  )
                                })}
                              </div>
                            )}
                            {bookingHora && (
                              <p className="mt-2.5 text-xs font-semibold text-blue-900">
                                ✓ Horario seleccionado: <span className="font-extrabold">{bookingHora} hs</span> el {bookingFecha} con {bookingDoctors.find(d => String(d.id) === bookingDoctorId) ? `Dr./Dra. ${bookingDoctors.find(d => String(d.id) === bookingDoctorId)?.nombreCompleto} (${bookingDoctors.find(d => String(d.id) === bookingDoctorId)?.especialidad})` : 'el odontólogo seleccionado'}.
                              </p>
                            )}
                          </div>

                          {bookingFormError && (
                            <p role="alert" className="rounded-lg bg-red-50 border border-red-200 p-2.5 text-xs font-bold text-red-900">
                              {bookingFormError}
                            </p>
                          )}

                          <div className="flex justify-end gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => setShowBooking(false)}
                              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                            >
                              Cancelar
                            </button>
                            <button
                              type="submit"
                              disabled={bookingSubmitting || !bookingHora || !bookingDoctorId}
                              className="rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700 disabled:opacity-50"
                            >
                              {bookingSubmitting ? 'Confirmando…' : `Confirmar turno para las ${bookingHora ? bookingHora + ' hs' : '...'}`}
                            </button>
                          </div>
                        </form>
                      )}

                      {/* Semáforo de Estados de Turno */}
                      <div className="mt-4 grid gap-3 sm:grid-cols-3">
                        <div className="flex items-center justify-between rounded-xl border-l-4 border-l-emerald-600 border border-emerald-200 bg-emerald-50/70 p-3.5">
                          <div>
                            <span className="flex items-center gap-1.5 text-xs font-extrabold uppercase text-emerald-800">
                              <CheckCircle2 size={15} /> Confirmados
                            </span>
                            <p className="mt-0.5 text-xs font-medium text-slate-700">Horario asignado y validado</p>
                          </div>
                          <span
                            style={{ backgroundColor: '#059669', color: '#ffffff' }}
                            className="flex h-9 min-w-9 items-center justify-center rounded-full px-2.5 text-base font-extrabold text-white"
                          >
                            {turnoCounts.confirmed}
                          </span>
                        </div>

                        <div className="flex items-center justify-between rounded-xl border-l-4 border-l-orange-500 border border-orange-200 bg-orange-50/70 p-3.5">
                          <div>
                            <span className="flex items-center gap-1.5 text-xs font-extrabold uppercase text-orange-800">
                              <Clock3 size={15} /> En espera / Programados
                            </span>
                            <p className="mt-0.5 text-xs font-medium text-slate-700">Pendientes de confirmación o atención</p>
                          </div>
                          <span
                            style={{ backgroundColor: '#f97316', color: '#ffffff' }}
                            className="flex h-9 min-w-9 items-center justify-center rounded-full px-2.5 text-base font-extrabold text-white"
                          >
                            {turnoCounts.pending}
                          </span>
                        </div>

                        <div className="flex items-center justify-between rounded-xl border-l-4 border-l-red-600 border border-red-200 bg-red-50/70 p-3.5">
                          <div>
                            <span className="flex items-center gap-1.5 text-xs font-extrabold uppercase text-red-800">
                              <XCircle size={15} /> Rechazados / Cancelados
                            </span>
                            <p className="mt-0.5 text-xs font-medium text-slate-700">Citas sin efecto o reprogramadas</p>
                          </div>
                          <span
                            style={{ backgroundColor: '#dc2626', color: '#ffffff' }}
                            className="flex h-9 min-w-9 items-center justify-center rounded-full px-2.5 text-base font-extrabold text-white"
                          >
                            {turnoCounts.rejected}
                          </span>
                        </div>
                      </div>

                      {/* Filtros rápidos de estado de turno */}
                      {turnos.length > 0 && (
                        <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Filtrar turnos por estado">
                          {[
                            { id: 'ALL' as const, label: `Todos (${turnos.length})` },
                            { id: 'CONFIRMED' as const, label: `Confirmados (${turnoCounts.confirmed})` },
                            { id: 'PENDING' as const, label: `En espera (${turnoCounts.pending})` },
                            { id: 'REJECTED' as const, label: `Rechazados / Cancelados (${turnoCounts.rejected})` },
                          ].map(tab => (
                            <button
                              key={tab.id}
                              type="button"
                              aria-pressed={turnoFilter === tab.id}
                              onClick={() => setTurnoFilter(tab.id)}
                              className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition ${
                                turnoFilter === tab.id
                                  ? 'border-blue-700 bg-blue-600 text-white'
                                  : 'border-slate-300 bg-white text-slate-800 hover:bg-blue-50'
                              }`}
                            >
                              {tab.label}
                            </button>
                          ))}
                        </div>
                      )}

                      {turnosError ? (
                        <p role="alert" className="mt-5 text-sm font-semibold text-red-700">
                          {turnosError}
                        </p>
                      ) : turnos.length === 0 ? (
                        <div className="mt-5 rounded-xl border border-blue-200 bg-blue-50/80 p-5 text-center">
                          <p className="text-sm font-semibold text-slate-800">
                            Todavía no tenés turnos registrados.
                          </p>
                          <p className="mt-1 text-xs text-slate-600">
                            Elegí a continuación un odontólogo y un horario libre para solicitar tu turno.
                          </p>
                          {!showBooking && (
                            <button
                              type="button"
                              onClick={() => setShowBooking(true)}
                              className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700"
                            >
                              <CalendarPlus size={15} /> Solicitar mi primer turno
                            </button>
                          )}
                        </div>
                      ) : (
                        <ol className="mt-5 grid gap-3.5 md:grid-cols-2">
                          {filteredTurnos.map(item => {
                            const statusUi = getTurnoStatusUi(item.estado)
                            return (
                              <li
                                key={item.id}
                                className={`rounded-xl border p-4 shadow-xs ${statusUi.cardAccentClass}`}
                              >
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <p className="font-extrabold text-slate-950">
                                    {dateLabel(item.fecha)} · {item.hora.slice(0, 5)} hs
                                  </p>
                                  <span
                                    style={statusUi.badgeStyle}
                                    className={`inline-flex items-center rounded-full px-3 py-1 text-xs ${statusUi.badgeClass}`}
                                  >
                                    {item.estado}
                                  </span>
                                </div>
                                <p className="mt-2 text-sm font-bold text-slate-900">{item.motivo}</p>
                                <p className="mt-0.5 text-sm font-semibold text-slate-700">
                                  Profesional: {item.odontologoNombre}
                                </p>
                                <p className="mt-2.5 rounded-lg bg-white/80 px-3 py-1.5 text-xs font-medium text-slate-700">
                                  {statusUi.statusHelper}
                                </p>
                              </li>
                            )
                          })}
                        </ol>
                      )}
                    </section>
                  }
                />

                {/* RUTA 4: MIS TRATAMIENTOS */}
                <Route
                  path="/mis-tratamientos"
                  element={
                    <section className={cardClass}>
                      <h2 className="text-xl font-extrabold text-slate-950">Mis tratamientos</h2>
                      <p className="mt-1 text-sm font-medium text-slate-700">
                        Estos tratamientos fueron registrados por el equipo profesional para tu ficha.
                      </p>
                      {tratamientosError ? (
                        <p role="alert" className="mt-5 text-sm font-semibold text-red-700">
                          {tratamientosError}
                        </p>
                      ) : tratamientos.length === 0 ? (
                        <p className="mt-5 rounded-xl bg-blue-50 p-4 text-sm font-medium text-slate-800">
                          Todavía no tenés tratamientos registrados.
                        </p>
                      ) : (
                        <ol className="mt-5 grid gap-3 md:grid-cols-2">
                          {tratamientos.map(item => {
                            const statusUi = getTurnoStatusUi(item.estado)
                            return (
                              <li
                                key={item.id}
                                className={`rounded-xl border p-4 ${statusUi.cardAccentClass}`}
                              >
                                <p className="font-extrabold text-slate-950">{item.descripcion}</p>
                                <p className="mt-1 text-sm font-medium text-slate-700">{dateLabel(item.fecha)}</p>
                                <span
                                  style={statusUi.badgeStyle}
                                  className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs ${statusUi.badgeClass}`}
                                >
                                  {item.estado}
                                </span>
                              </li>
                            )
                          })}
                        </ol>
                      )}
                    </section>
                  }
                />

                {/* RUTA 5: MIS REPORTES (Bandeja de Documentación de Síntomas, Evidencia Fotográfica y Dictamen) */}
                <Route
                  path="/mis-reportes"
                  element={
                    <section className={cardClass}>
                      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-300 pb-4">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wide text-blue-700">
                            Archivo de autoevaluaciones y fotos intraorales
                          </p>
                          <h2 className="mt-1 text-xl font-extrabold text-slate-950">Mis reportes</h2>
                          <p className="mt-1 text-sm font-medium text-slate-700">
                            Seleccioná cualquier reporte enviado para inspeccionar tu evidencia fotográfica y el dictamen del odontólogo.
                          </p>
                        </div>
                        <Link
                          to="/"
                          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700"
                        >
                          Nuevo reporte
                        </Link>
                      </div>

                      {reports.length > 0 && (
                        <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Filtrar bandeja de reportes">
                          {[
                            { id: 'ALL' as const, label: `Todos (${reports.length})` },
                            {
                              id: 'REVISADO' as const,
                              label: `Con dictamen profesional (${reports.filter(r => r.estado === 'REVISADO').length})`,
                            },
                            {
                              id: 'PENDIENTE' as const,
                              label: `Pendientes (${reports.filter(r => r.estado === 'PENDIENTE').length})`,
                            },
                            {
                              id: 'WITH_PHOTO' as const,
                              label: `Con foto (${reports.filter(r => r.fotoDisponible || r.fotoBase64).length})`,
                            },
                          ].map(tab => (
                            <button
                              key={tab.id}
                              type="button"
                              aria-pressed={reportFilter === tab.id}
                              onClick={() => setReportFilter(tab.id)}
                              className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition ${
                                reportFilter === tab.id
                                  ? 'border-blue-700 bg-blue-600 text-white'
                                  : 'border-slate-300 bg-white text-slate-800 hover:bg-blue-50'
                              }`}
                            >
                              {tab.label}
                            </button>
                          ))}
                        </div>
                      )}

                      {reportsError ? (
                        <p role="alert" className="mt-5 text-sm font-semibold text-red-700">
                          {reportsError}
                        </p>
                      ) : reports.length === 0 ? (
                        <p className="mt-5 rounded-xl bg-blue-50 p-4 text-sm font-medium text-slate-800">
                          Todavía no enviaste reportes.
                        </p>
                      ) : (
                        <ol className="mt-5 grid gap-3.5 md:grid-cols-2">
                          {filteredReports.map(item => {
                            const isReviewed = item.estado === 'REVISADO'
                            return (
                              <li key={item.id}>
                                <button
                                  type="button"
                                  onClick={() => void verReporte(item.id)}
                                  className={`w-full rounded-xl border p-4 text-left transition hover:border-blue-500 focus-visible:outline-2 focus-visible:outline-blue-600 ${
                                    isReviewed
                                      ? 'border-l-4 border-l-emerald-500 border-slate-300 bg-white/95'
                                      : 'border-l-4 border-l-orange-500 border-slate-300 bg-white/95'
                                  }`}
                                >
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <span className="font-extrabold text-slate-950">
                                      Pieza {item.pieza} · Reporte #{item.id}
                                    </span>
                                    <span
                                      style={
                                        item.dolor >= 7
                                          ? { backgroundColor: '#dc2626', color: '#ffffff' }
                                          : item.dolor >= 4
                                            ? { backgroundColor: '#f97316', color: '#ffffff' }
                                            : { backgroundColor: '#059669', color: '#ffffff' }
                                      }
                                      className="rounded-full px-2.5 py-0.5 text-xs font-bold text-white"
                                    >
                                      Dolor {item.dolor}/10
                                    </span>
                                  </div>
                                  <p className="mt-2 text-sm font-medium text-slate-800">{item.sintomas}</p>
                                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-2.5">
                                    <span className="inline-flex items-center gap-1 text-xs font-bold text-blue-800">
                                      {isReviewed ? (
                                        <>
                                          <CheckCircle2 size={14} className="text-emerald-600" /> Revisado por un profesional
                                        </>
                                      ) : (
                                        <>
                                          <AlertCircle size={14} className="text-orange-500" /> Pendiente de revisión profesional
                                        </>
                                      )}
                                    </span>
                                    {(item.fotoDisponible || item.fotoBase64) && (
                                      <span className="inline-flex items-center gap-1 rounded-md bg-blue-100 px-2 py-0.5 text-[11px] font-bold text-blue-900">
                                        <ImageIcon size={12} /> Foto adjunta
                                      </span>
                                    )}
                                  </div>
                                </button>
                              </li>
                            )
                          })}
                        </ol>
                      )}

                      {selectedReport && (
                        <div className="mt-5 rounded-xl border-2 border-blue-300 bg-blue-50/95 p-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="font-extrabold text-slate-950">
                              Reporte #{selectedReport.id} · Pieza {selectedReport.pieza} ({nombrePieza(selectedReport.pieza)})
                            </p>
                            <span className="text-xs font-bold text-blue-900">
                              Dolor {selectedReport.dolor}/10
                            </span>
                          </div>
                          {selectedReport.fotoBase64 && (
                            <img
                              src={selectedReport.fotoBase64}
                              alt="Foto del reporte seleccionado"
                              className="my-3 max-h-64 rounded-lg border border-slate-300 object-contain"
                            />
                          )}
                          <p className="mt-2 text-sm font-semibold text-slate-900">
                            {selectedReport.revisionProfesional || 'Aún no hay una nota profesional.'}
                          </p>
                        </div>
                      )}
                    </section>
                  }
                />

                {/* RUTA 6: MIS DATOS */}
                <Route
                  path="/mis-datos"
                  element={
                    <section className={cardClass}>
                      <h2 className="text-xl font-extrabold text-slate-950">Mis datos</h2>
                      <dl className="mt-5 grid gap-4 sm:grid-cols-2">
                        <div>
                          <dt className="text-xs font-bold uppercase text-slate-600">Nombre completo</dt>
                          <dd className="mt-1 font-bold text-slate-950">
                            {perfil.nombre} {perfil.apellido}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs font-bold uppercase text-slate-600">DNI</dt>
                          <dd className="mt-1 font-semibold text-slate-900">{perfil.dni}</dd>
                        </div>
                        <div>
                          <dt className="text-xs font-bold uppercase text-slate-600">Correo electrónico</dt>
                          <dd className="mt-1 break-all font-semibold text-slate-900">{perfil.email}</dd>
                        </div>
                        <div>
                          <dt className="text-xs font-bold uppercase text-slate-600">Fecha de nacimiento</dt>
                          <dd className="mt-1 font-semibold text-slate-900">
                            {perfil.fechaNacimiento ? dateLabel(perfil.fechaNacimiento) : 'No registrada'}
                          </dd>
                        </div>
                      </dl>
                      <form
                        onSubmit={actualizarTelefono}
                        className="mt-6 flex flex-wrap items-end gap-3 border-t border-slate-300 pt-5"
                      >
                        <label className="text-sm font-semibold">
                          Teléfono de contacto
                          <input
                            className={inputClass}
                            maxLength={30}
                            value={editTelefono}
                            onChange={event => setEditTelefono(event.target.value)}
                          />
                        </label>
                        <button type="submit" disabled={busy} className={primaryClass}>
                          Actualizar teléfono
                        </button>
                      </form>
                    </section>
                  }
                />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            )}
          </div>
        </div>
      </div>
      {location.pathname !== '/chatbot' && <ChatbotFloatingWidget />}
    </main>
  )
}

const inputClass =
  'mt-1.5 block min-h-11 w-full rounded-lg border border-slate-400 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-600'
const primaryClass =
  'min-h-11 rounded-lg bg-blue-600 px-5 py-2 font-bold text-white hover:bg-blue-700 disabled:opacity-60'
const cardClass =
  'rounded-2xl border border-slate-300 bg-white/92 p-5 shadow-lg shadow-blue-950/5 backdrop-blur-xl'
