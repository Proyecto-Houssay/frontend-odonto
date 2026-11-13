import { useCallback, useContext, useEffect, useMemo, useState } from 'react'
import {
  Activity, Accessibility, AlertTriangle, ArrowRight, CalendarClock, Check, CheckCircle2,
  CircleHelp, Eye, HeartHandshake, History, LoaderCircle, LockKeyhole,
  RefreshCw, ShieldCheck, Sparkles, Stethoscope, Users, Video,
} from 'lucide-react'
import { AuthContext } from '../auth/context'

type Patient = { id: number; nombre: string; apellido: string; dni?: string }
type Dentist = { id: number; nombre: string; apellido: string; activo?: boolean; especialidad?: { nombre: string } }
type Appointment = {
  id: number; fecha: string; hora: string; motivo?: string; estado?: string; telemedicina?: boolean
  estadoSala?: string; paciente?: Patient; odontologo?: Dentist
}
type Triage = {
  id: number; pacienteId: number; pacienteNombre: string; motivoConsulta: string; descripcionSintomas?: string
  prioridadSugerida: string; prioridadValidada?: string; prioridadEfectiva: string; estadoValidacion: string
  signosAlarma: boolean; derivacionHumana: boolean; fechaCreacion: string; observacionesClinicas?: string
}
type SlotResponse = { horariosDisponibles?: string[]; [key: string]: unknown }
type Tab = 'resumen' | 'recorrido' | 'seguimiento' | 'espera' | 'privacidad'
type WaitEntry = { patientId: number; dentistId: number; date: string; window: string; matchingSlots: string[] }

const SESSION_KEY = 'novadent.auth.session'
const FOLLOWUP_KEY = 'novadent.followup.done'
const privacyCopy = 'La prioridad del teletriaje es una orientación para ordenar la atención. No es un diagnóstico ni reemplaza la evaluación de un profesional.'

function authToken() {
  try { return (JSON.parse(sessionStorage.getItem(SESSION_KEY) || '{}') as { token?: string }).token } catch { return undefined }
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
function prettyDate(value?: string) {
  if (!value) return 'Sin fecha'
  const date = new Date(`${value}T12:00:00`)
  return new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short', year: 'numeric' }).format(date)
}
function isCancelled(state?: string) { return /cancel|anulad/i.test(state || '') }
function displayPerson(person?: { nombre?: string; apellido?: string }) { return [person?.nombre, person?.apellido].filter(Boolean).join(' ') || 'Sin asignar' }

function Panel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>{children}</section>
}

export function CentroInteligentePage({ token: propToken }: { token?: string } = {}) {
  const auth = useContext(AuthContext)
  const activeToken = propToken || auth?.session?.token?.replace(/^Bearer\s+/i, '') || authToken()

  const api = useCallback(async <T,>(path: string): Promise<T> => {
    const bearer = activeToken
    const response = await fetch(`/api${path}`, { headers: { Accept: 'application/json', ...(bearer ? { Authorization: `Bearer ${bearer.replace(/^Bearer\s+/i, '')}` } : {}) } })
    if (!response.ok) throw new Error(response.status === 401 ? 'Iniciá sesión para ver datos de la agenda.' : `No se pudieron cargar los datos (HTTP ${response.status}).`)
    return response.json() as Promise<T>
  }, [activeToken])

  const [tab, setTab] = useState<Tab>('resumen')
  const [patients, setPatients] = useState<Patient[]>([])
  const [dentists, setDentists] = useState<Dentist[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [triage, setTriage] = useState<Triage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedPatientId, setSelectedPatientId] = useState('')
  const [followedUp, setFollowedUp] = useState<string[]>(() => {
    try { return JSON.parse(sessionStorage.getItem(FOLLOWUP_KEY) || '[]') as string[] } catch { return [] }
  })
  const [waitEntries, setWaitEntries] = useState<WaitEntry[]>([])
  const [waitDentist, setWaitDentist] = useState('')
  const [waitDate, setWaitDate] = useState(dateKey(new Date(Date.now() + 86400000)))
  const [waitWindow, setWaitWindow] = useState('mañana')
  const [slots, setSlots] = useState<string[]>([])
  const [slotLoading, setSlotLoading] = useState(false)
  const [highContrast, setHighContrast] = useState(false)
  const [largeText, setLargeText] = useState(false)
  const [privacyExpanded, setPrivacyExpanded] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const today = new Date()
      const until = new Date(today); until.setDate(until.getDate() + 30)
      const [patientsRes, dentistsRes, turnosRes, triageRes, teleRes] = await Promise.allSettled([
        api<Patient[]>('/pacientes'),
        api<Dentist[]>('/odontologos'),
        api<Appointment[]>('/turnos'),
        api<Triage[]>('/teletriaje/solicitudes'),
        api<Array<{ turnoId: number; fecha: string; hora: string; estadoTurno?: string; pacienteId?: number; pacienteNombre?: string; odontologoId?: number; odontologoNombre?: string }>>(`/teletriaje/citas/agenda?desde=${dateKey(today)}&hasta=${dateKey(until)}`),
      ])

      const patientsData = patientsRes.status === 'fulfilled' && Array.isArray(patientsRes.value) ? patientsRes.value : []
      const dentistsData = dentistsRes.status === 'fulfilled' && Array.isArray(dentistsRes.value) ? dentistsRes.value : []
      const turnosData = turnosRes.status === 'fulfilled' && Array.isArray(turnosRes.value) ? turnosRes.value : []
      const triageData = triageRes.status === 'fulfilled' && Array.isArray(triageRes.value) ? triageRes.value : []
      const teleData = teleRes.status === 'fulfilled' && Array.isArray(teleRes.value) ? teleRes.value : []

      if (patientsRes.status === 'rejected' && turnosRes.status === 'rejected') {
        const firstErr = patientsRes.reason || turnosRes.reason
        throw firstErr instanceof Error ? firstErr : new Error('No se pudieron sincronizar los datos de la agenda.')
      }

      const virtualIds = new Set(teleData.map((item) => item.turnoId))
      const teleAppointments: Appointment[] = teleData.map((item) => ({
        id: item.turnoId, fecha: item.fecha, hora: item.hora, estado: item.estadoTurno || 'Confirmado', telemedicina: true,
        paciente: item.pacienteNombre ? { id: item.pacienteId || 0, nombre: item.pacienteNombre, apellido: '' } : undefined,
        odontologo: item.odontologoNombre ? { id: item.odontologoId || 0, nombre: item.odontologoNombre, apellido: '' } : undefined,
      }))
      setPatients(patientsData)
      setDentists(dentistsData)
      const allTurns = turnosData.filter((item) => !virtualIds.has(item.id))
      setAppointments([...allTurns, ...teleAppointments].sort((a, b) => `${a.fecha}${a.hora}`.localeCompare(`${b.fecha}${b.hora}`)))
      setTriage(triageData)
      setSelectedPatientId((current) => current || String(patientsData[0]?.id || ''))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo conectar con la agenda.')
    } finally { setLoading(false) }
  }, [api])

  useEffect(() => { void load() }, [load])
  useEffect(() => {
    if (!waitDentist || !waitDate) { setSlots([]); return }
    let alive = true
    setSlotLoading(true)
    api<SlotResponse>(`/turnos/disponibilidad/fecha/${waitDate}?odontologoId=${encodeURIComponent(waitDentist)}`)
      .then((result) => { if (alive) setSlots(Array.isArray(result.horariosDisponibles) ? result.horariosDisponibles : []) })
      .catch(() => { if (alive) setSlots([]) })
      .finally(() => { if (alive) setSlotLoading(false) })
    return () => { alive = false }
  }, [waitDentist, waitDate])

  const today = dateKey(new Date())
  const upcoming = appointments.filter((item) => item.fecha >= today && !isCancelled(item.estado))
  const activeTriage = triage.filter((item) => !/cerrad|cancel/i.test(item.estadoValidacion || ''))
  const alertCount = activeTriage.filter((item) => item.signosAlarma || item.derivacionHumana).length
  const selectedPatient = patients.find((patient) => String(patient.id) === selectedPatientId)
  const patientEvents = useMemo(() => {
    if (!selectedPatient) return []
    const appointmentsForPatient = appointments.filter((item) => String(item.paciente?.id) === String(selectedPatient.id)).map((item) => ({
      id: `turno-${item.id}`, date: item.fecha, time: item.hora, label: item.telemedicina ? 'Teleconsulta' : 'Turno odontológico',
      detail: item.motivo || item.odontologo?.especialidad?.nombre || 'Atención programada', state: item.estado || 'Programado', icon: item.telemedicina ? 'video' : 'appointment',
    }))
    const requests = triage.filter((item) => String(item.pacienteId) === String(selectedPatient.id)).map((item) => ({
      id: `triage-${item.id}`, date: item.fechaCreacion?.slice(0, 10) || '', time: item.fechaCreacion?.slice(11, 16) || '',
      label: 'Teletriaje', detail: item.motivoConsulta, state: item.prioridadEfectiva, icon: 'triage',
    }))
    return [...appointmentsForPatient, ...requests].sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`))
  }, [appointments, selectedPatient, triage])

  const markFollowup = (id: number) => {
    const next = [...new Set([...followedUp, String(id)])]
    setFollowedUp(next)
    sessionStorage.setItem(FOLLOWUP_KEY, JSON.stringify(next))
  }
  const joinWaitlist = () => {
    if (!waitDentist || !waitDate || !selectedPatientId) return
    setWaitEntries((current) => [...current, { patientId: Number(selectedPatientId), dentistId: Number(waitDentist), date: waitDate, window: waitWindow, matchingSlots: availableForWaitlist }])
  }
  const availableForWaitlist = slots.filter((time) => waitWindow === 'mañana' ? Number(time.slice(0, 2)) < 12 : waitWindow === 'tarde' ? Number(time.slice(0, 2)) >= 12 : true)
  const followupCutoff = new Date(); followupCutoff.setDate(followupCutoff.getDate() - 30)
  const openFollowups = appointments.filter((item) => !isCancelled(item.estado)
    && (item.fecha < today || /complet|atendid/i.test(item.estado || ''))
    && item.fecha >= dateKey(followupCutoff))
    .filter((item) => !followedUp.includes(String(item.id)))
  const tabs: Array<{ id: Tab; label: string; icon: typeof Activity }> = [
    { id: 'resumen', label: 'Resumen', icon: Activity }, { id: 'recorrido', label: 'Recorrido', icon: History },
    { id: 'seguimiento', label: 'Seguimiento', icon: HeartHandshake }, { id: 'espera', label: 'Lista de espera', icon: CalendarClock },
    { id: 'privacidad', label: 'Acceso y privacidad', icon: LockKeyhole },
  ]

  return <main className={`mx-auto max-w-7xl space-y-6 p-4 md:p-8 ${largeText ? 'text-lg' : ''} ${highContrast ? 'contrast-125' : ''}`}>
    <header className="overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-blue-950 to-cyan-900 p-6 text-white shadow-xl md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="max-w-3xl">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold"><Sparkles size={14}/> NOVADENT · CUIDADO CONECTADO</div>
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Centro de atención inteligente</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-blue-100 md:text-base">Un recorrido coordinado desde la primera señal hasta el seguimiento, con el equipo clínico tomando las decisiones.</p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-semibold hover:bg-white/20 disabled:opacity-60"><RefreshCw size={16} className={loading ? 'animate-spin' : ''}/> Actualizar</button>
      </div>
      <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Próximas atenciones" value={String(upcoming.length)} hint="Turnos y teleconsultas" icon={<CalendarClock/>}/>
        <Kpi label="Teletriajes a revisar" value={String(activeTriage.length)} hint="Cola activa" icon={<Activity/>}/>
        <Kpi label="Señales para revisión humana" value={String(alertCount)} hint="Prioridad sugerida; validar" icon={<AlertTriangle/>}/>
        <Kpi label="Profesionales activos" value={String(dentists.filter((item) => item.activo !== false).length)} hint="Disponibilidad consultable" icon={<Stethoscope/>}/>
      </div>
    </header>

    <nav aria-label="Herramientas de atención" className="flex gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
      {tabs.map(({ id, label, icon: Icon }) => <button key={id} type="button" onClick={() => setTab(id)} aria-current={tab === id ? 'page' : undefined} className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${tab === id ? 'bg-blue-700 text-white shadow' : 'text-slate-600 hover:bg-slate-100'}`}><Icon size={16}/>{label}</button>)}
    </nav>

    {error && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><span>{error}</span><a href="/turnos" className="font-semibold underline">Abrir agenda</a></div>}
    {loading && <div className="flex items-center gap-2 rounded-2xl bg-white p-5 text-sm text-slate-600"><LoaderCircle className="animate-spin" size={18}/> Sincronizando agenda, pacientes y teletriaje…</div>}

    {!loading && tab === 'resumen' && <div className="grid gap-5 lg:grid-cols-[1.3fr_0.7fr]">
      <Panel>
        <div className="flex items-start justify-between gap-3"><div><h2 className="text-lg font-bold text-slate-900">Próximos pasos de atención</h2><p className="mt-1 text-sm text-slate-500">Agenda real de turnos comunes y teleconsultas.</p></div><a href="/turnos" className="inline-flex items-center gap-1 text-sm font-semibold text-blue-700">Ver calendario <ArrowRight size={15}/></a></div>
        <div className="mt-5 space-y-3">{upcoming.slice(0, 6).map((item) => <div key={`${item.telemedicina ? 'tele' : 'turno'}-${item.id}`} className="flex items-center gap-4 rounded-xl border border-slate-100 p-3"><div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${item.telemedicina ? 'bg-violet-50 text-violet-700' : 'bg-blue-50 text-blue-700'}`}>{item.telemedicina ? <Video size={19}/> : <Stethoscope size={19}/>}</div><div className="min-w-0 flex-1"><p className="truncate font-semibold text-slate-800">{displayPerson(item.paciente)}</p><p className="truncate text-xs text-slate-500">{item.telemedicina ? 'Teleconsulta' : item.motivo || 'Turno presencial'} · {displayPerson(item.odontologo)}</p></div><div className="text-right"><p className="text-sm font-semibold text-slate-800">{prettyDate(item.fecha)}</p><p className="text-xs text-slate-500">{item.hora?.slice(0, 5)} · {item.estado || 'Programado'}</p></div></div>)}{!upcoming.length && <Empty>La agenda no tiene próximas atenciones cargadas.</Empty>}</div>
      </Panel>
      <div className="space-y-5">
        <Panel className="border-amber-200 bg-amber-50/60"><div className="flex items-center gap-2 text-amber-900"><AlertTriangle size={18}/><h2 className="font-bold">Revisión humana</h2></div><p className="mt-2 text-sm leading-6 text-amber-900/80">{alertCount ? `${alertCount} solicitud${alertCount === 1 ? '' : 'es'} con signos de alarma o derivación sugerida requieren atención del equipo.` : 'No hay señales de alarma pendientes reportadas en la cola cargada.'}</p><p className="mt-3 border-t border-amber-200 pt-3 text-xs leading-5 text-amber-900/70">{privacyCopy}</p><button type="button" onClick={() => setTab('recorrido')} className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-amber-950 underline">Ver criterios de orientación <ArrowRight size={14}/></button></Panel>
        <Panel><h2 className="font-bold text-slate-900">Cuidado accesible</h2><p className="mt-1 text-sm text-slate-500">Ajustá la lectura para esta pantalla.</p><div className="mt-4 flex flex-wrap gap-2"><button type="button" aria-pressed={largeText} onClick={() => setLargeText((value) => !value)} className="rounded-xl border px-3 py-2 text-sm font-semibold hover:bg-slate-50"><Accessibility className="mr-2 inline" size={16}/>Texto grande</button><button type="button" aria-pressed={highContrast} onClick={() => setHighContrast((value) => !value)} className="rounded-xl border px-3 py-2 text-sm font-semibold hover:bg-slate-50"><Eye className="mr-2 inline" size={16}/>Alto contraste</button></div></Panel>
      </div>
    </div>}

    {!loading && tab === 'recorrido' && <div className="grid gap-5 lg:grid-cols-[0.7fr_1.3fr]">
      <Panel><h2 className="text-lg font-bold">Recorrido del paciente</h2><p className="mt-1 text-sm text-slate-500">Conecta teletriaje y turnos registrados para dar contexto al equipo.</p><label className="mt-5 block text-sm font-semibold text-slate-700" htmlFor="timeline-patient">Paciente</label><select id="timeline-patient" value={selectedPatientId} onChange={(event) => setSelectedPatientId(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5">{patients.map((patient) => <option key={patient.id} value={patient.id}>{displayPerson(patient)}{patient.dni ? ` · ${patient.dni}` : ''}</option>)}</select><div className="mt-5 rounded-xl bg-blue-50 p-4 text-sm leading-6 text-blue-950"><ShieldCheck size={17} className="mb-1 inline"/> Mostramos únicamente eventos existentes en los módulos conectados; no inferimos diagnósticos.</div></Panel>
      <Panel><div className="flex items-center justify-between gap-3"><div><h2 className="text-lg font-bold">Línea de tiempo</h2><p className="text-sm text-slate-500">{selectedPatient ? displayPerson(selectedPatient) : 'Seleccioná un paciente'}</p></div><History className="text-blue-700"/></div><div className="mt-6">{patientEvents.length ? <ol className="relative space-y-0 border-l-2 border-blue-100 pl-6">{patientEvents.map((event) => <li key={event.id} className="relative pb-6 last:pb-0"><span className="absolute -left-[33px] top-1 grid h-4 w-4 place-items-center rounded-full border-2 border-white bg-blue-600 ring-2 ring-blue-100"/><p className="text-xs font-semibold uppercase tracking-wide text-blue-700">{prettyDate(event.date)}{event.time ? ` · ${event.time}` : ''}</p><h3 className="mt-1 font-bold text-slate-900">{event.label}</h3><p className="mt-0.5 text-sm text-slate-600">{event.detail}</p><p className="mt-1 text-xs text-slate-500">Estado registrado: {event.state}</p></li>)}</ol> : <Empty>No hay eventos vinculados para este paciente.</Empty>}</div></Panel>
      <Panel className="lg:col-span-2"><h2 className="font-bold text-slate-900">Criterios visibles del teletriaje</h2><p className="mt-1 text-sm text-slate-500">Separamos la prioridad orientativa de la validación profesional y hacemos visibles las señales que requieren revisión.</p><div className="mt-4 grid gap-3 md:grid-cols-3"><ExplainCard title="Señal de alarma" text="El registro marca signos de alarma: priorizar lectura por personal clínico."/><ExplainCard title="Derivación humana" text="La solicitud requiere que una persona del equipo valore los próximos pasos."/><ExplainCard title="Prioridad sugerida y validada" text="Se muestran ambas para distinguir la orientación del criterio confirmado por profesional."/></div><div className="mt-5 space-y-3">{triage.slice(0, 8).map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-4"><div><p className="font-semibold text-slate-900">{item.pacienteNombre} · {item.motivoConsulta}</p><p className="mt-1 text-sm text-slate-600">Sugerida: {item.prioridadSugerida} · Efectiva: {item.prioridadEfectiva} · Validación: {item.estadoValidacion}</p><p className="mt-1 text-xs text-slate-500">{item.signosAlarma ? 'Señal de alarma marcada · ' : ''}{item.derivacionHumana ? 'Revisión humana indicada · ' : ''}{prettyDate(item.fechaCreacion?.slice(0, 10))}</p></div>{(item.signosAlarma || item.derivacionHumana) && <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">Revisar con profesional</span>}</div>)}{!triage.length && <Empty>No hay solicitudes de teletriaje cargadas.</Empty>}</div></Panel>
    </div>}

    {!loading && tab === 'seguimiento' && <Panel><div className="flex items-start gap-3"><div className="rounded-xl bg-emerald-50 p-2 text-emerald-700"><HeartHandshake/></div><div><h2 className="text-lg font-bold">Seguimiento posterior</h2><p className="mt-1 text-sm text-slate-500">Marcá el contacto de control realizado por el equipo, sin agregar información clínica sensible.</p></div></div><div className="mt-5 space-y-3">{openFollowups.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-4"><div><p className="font-semibold text-slate-900">{displayPerson(item.paciente)} · {item.telemedicina ? 'Teleconsulta' : 'Atención presencial'}</p><p className="mt-1 text-sm text-slate-500">{prettyDate(item.fecha)} · {item.motivo || 'Consulta'} · Profesional: {displayPerson(item.odontologo)}</p></div><button type="button" onClick={() => markFollowup(item.id)} className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800"><Check size={16}/>Registrar contacto</button></div>)}{!openFollowups.length && <Empty>No hay atenciones completadas pendientes de seguimiento en los datos cargados.</Empty>}</div><p className="mt-4 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600">Prototipo de interfaz: la marca de seguimiento dura esta sesión del navegador y no envía notificaciones ni se guarda como dato clínico en el servidor.</p></Panel>}

    {!loading && tab === 'espera' && <div className="grid gap-5 lg:grid-cols-2"><Panel><div className="flex items-center gap-2"><Users className="text-blue-700"/><h2 className="text-lg font-bold">Lista de espera por disponibilidad</h2></div><p className="mt-1 text-sm text-slate-500">Elegí preferencias; consultamos horarios libres reales del profesional y la fecha.</p><div className="mt-5 grid gap-4"><label className="text-sm font-semibold">Paciente<select value={selectedPatientId} onChange={(event) => setSelectedPatientId(event.target.value)} className="mt-1 block w-full rounded-xl border px-3 py-2.5"><option value="">Seleccionar…</option>{patients.map((patient) => <option key={patient.id} value={patient.id}>{displayPerson(patient)}</option>)}</select></label><label className="text-sm font-semibold">Profesional<select value={waitDentist} onChange={(event) => setWaitDentist(event.target.value)} className="mt-1 block w-full rounded-xl border px-3 py-2.5"><option value="">Seleccionar…</option>{dentists.filter((dentist) => dentist.activo !== false).map((dentist) => <option key={dentist.id} value={dentist.id}>{displayPerson(dentist)}{dentist.especialidad?.nombre ? ` · ${dentist.especialidad.nombre}` : ''}</option>)}</select></label><div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-semibold">Fecha<input type="date" min={today} value={waitDate} onChange={(event) => setWaitDate(event.target.value)} className="mt-1 block w-full rounded-xl border px-3 py-2.5"/></label><label className="text-sm font-semibold">Franja<select value={waitWindow} onChange={(event) => setWaitWindow(event.target.value)} className="mt-1 block w-full rounded-xl border px-3 py-2.5"><option value="mañana">Mañana</option><option value="tarde">Tarde</option><option value="cualquiera">Cualquier hora</option></select></label></div></div><div className="mt-4 rounded-xl bg-slate-50 p-4"><p className="text-sm font-semibold text-slate-800">{slotLoading ? 'Consultando disponibilidad…' : `${availableForWaitlist.length} horarios libres en esa franja`}</p>{availableForWaitlist.length > 0 && <p className="mt-1 text-sm text-slate-600">{availableForWaitlist.slice(0, 5).join(' · ')}</p>}</div><button type="button" disabled={!waitDentist || !selectedPatientId || slotLoading} onClick={joinWaitlist} className="mt-4 w-full rounded-xl bg-blue-700 px-4 py-3 text-sm font-bold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50">Agregar preferencia de espera</button></Panel><Panel><h2 className="text-lg font-bold">Preferencias activas</h2><p className="mt-1 text-sm text-slate-500">Se revisan contra la disponibilidad actual.</p><div className="mt-4 space-y-3">{waitEntries.map((entry, index) => { const dentist = dentists.find((item) => item.id === entry.dentistId); const patient = patients.find((item) => item.id === entry.patientId); return <div key={`${entry.dentistId}-${entry.date}-${index}`} className="rounded-xl border border-slate-200 p-4"><p className="font-semibold">{displayPerson(patient)} · {displayPerson(dentist)}</p><p className="mt-1 text-sm text-slate-600">{prettyDate(entry.date)} · Franja {entry.window}</p><p className="mt-2 text-xs font-semibold text-blue-800">{entry.matchingSlots.length ? `Horarios compatibles ahora: ${entry.matchingSlots.join(' · ')}` : 'No hay horarios compatibles ahora; contactar manualmente si se libera un turno.'}</p></div> })}{!waitEntries.length && <Empty>Todavía no hay preferencias en esta sesión.</Empty>}</div><p className="mt-4 flex gap-2 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-900"><CircleHelp size={15} className="mt-0.5 shrink-0"/>La lista es una demostración local: aún no envía avisos automáticos ni reserva turnos.</p></Panel></div>}

    {!loading && tab === 'privacidad' && <div className="grid gap-5 lg:grid-cols-2"><Panel><div className="flex items-center gap-2"><LockKeyhole className="text-blue-700"/><h2 className="text-lg font-bold">Privacidad y consentimiento</h2></div><p className="mt-3 text-sm leading-6 text-slate-600">La agenda presenta datos de turnos y teletriaje habilitados para tu sesión. El consentimiento de una reserva de teleconsulta se consulta en el módulo de agenda antes de iniciar la atención.</p><button type="button" onClick={() => setPrivacyExpanded((value) => !value)} aria-expanded={privacyExpanded} className="mt-4 inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold hover:bg-slate-50"><Eye size={16}/>{privacyExpanded ? 'Ocultar detalle' : 'Ver detalle de datos'}</button>{privacyExpanded && <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-700"><p><b>Agenda:</b> fecha, horario, estado y profesional asociado.</p><p><b>Recorrido:</b> eventos de teletriaje y turnos del paciente seleccionado.</p><p><b>Controles locales:</b> tamaño de texto y contraste solo cambian esta vista.</p><p><b>Seguimiento / espera:</b> acciones de demostración temporales en el navegador, sin persistencia clínica ni notificaciones.</p></div>}</Panel><Panel><div className="flex items-center gap-2"><ShieldCheck className="text-emerald-700"/><h2 className="text-lg font-bold">Uso responsable</h2></div><ul className="mt-4 space-y-3 text-sm leading-6 text-slate-600"><li>• La prioridad sugerida no constituye diagnóstico.</li><li>• Las señales de alarma se derivan a revisión del equipo.</li><li>• No se generan recomendaciones terapéuticas automáticas.</li><li>• La disponibilidad se consulta al sistema; esta pantalla no asigna turnos por sí sola.</li></ul><div className="mt-5 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-950"><CheckCircle2 className="mr-2 inline" size={17}/>Separación clara entre asistencia operativa y decisión clínica.</div></Panel></div>}

    <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-4 text-xs text-slate-500"><span>Datos sincronizados desde los módulos existentes de pacientes, turnos y teletriaje.</span><a href="/teletriaje" className="inline-flex items-center gap-1 font-semibold text-blue-700">Abrir teletriaje <ArrowRight size={13}/></a></footer>
  </main>
}

function Kpi({ label, value, hint, icon }: { label: string; value: string; hint: string; icon: React.ReactNode }) {
  return <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur-sm"><div className="flex items-center justify-between text-blue-100"><span className="text-xs font-semibold">{label}</span><span>{icon}</span></div><p className="mt-2 text-3xl font-bold">{value}</p><p className="mt-1 text-xs text-blue-100/80">{hint}</p></div>
}
function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">{children}</div>
}
function ExplainCard({ title, text }: { title: string; text: string }) {
  return <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><h3 className="font-semibold text-slate-900">{title}</h3><p className="mt-1 text-sm leading-5 text-slate-600">{text}</p></div>
}
