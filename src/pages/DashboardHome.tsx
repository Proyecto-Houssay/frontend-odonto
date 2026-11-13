import { useEffect, useState } from 'react'
import { ArrowUpRight, CalendarDays, ClipboardCheck, ClipboardList, Stethoscope, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { UserRole } from '../auth/role'
import { apiRequest } from '../lib/api'

type StaffRole = Exclude<UserRole, 'PACIENTE'>
type Shortcut = { title: string; action: string; description: string; to: string; icon: typeof Users }
type Dashboard = { eyebrow: string; title: string; description: string; shortcuts: Shortcut[]; focus: string[]; upcoming: string[] }
type Patient = { id: number; nombre: string; apellido: string; dni: string }
type Appointment = { id: number; fecha: string; hora: string; motivo: string; estado: string; paciente?: { nombre: string; apellido: string }; odontologo?: { nombre: string; apellido: string } }
type Dentist = { id: number; activo: boolean }
type Treatment = { id: number; descripcion: string; fecha: string; estado: string }

function localDate() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

const DASHBOARDS: Record<StaffRole, Dashboard> = {
  ADMINISTRADOR: {
    eyebrow: 'Administración',
    title: 'Panel de administración',
    description: 'Accedé a los módulos disponibles de la clínica desde un solo lugar.',
    shortcuts: [
      { title: 'Pacientes', action: 'Ver pacientes', description: 'Consultá y actualizá las fichas registradas.', to: '/pacientes', icon: Users },
      { title: 'Agenda de turnos', action: 'Ver agenda', description: 'Consultá y asigná turnos reales.', to: '/turnos', icon: CalendarDays },
      { title: 'Odontograma', action: 'Abrir odontograma', description: 'Revisá el registro dental y los presupuestos.', to: '/odontograma', icon: ClipboardList },
      { title: 'Seguimiento', action: 'Revisar reportes', description: 'Consultá reportes enviados por pacientes.', to: '/seguimiento', icon: ClipboardCheck },
    ],
    focus: ['Gestionar fichas de pacientes', 'Supervisar reportes y odontogramas', 'Coordinar los accesos del consultorio'],
    upcoming: ['Gestión de usuarios', 'Informes'],
  },
  ODONTOLOGO: {
    eyebrow: 'Odontología',
    title: 'Espacio clínico',
    description: 'Tus herramientas clínicas disponibles, organizadas para continuar la atención.',
    shortcuts: [
      { title: 'Pacientes', action: 'Ver pacientes', description: 'Buscá las fichas de pacientes del consultorio.', to: '/pacientes', icon: Users },
      { title: 'Agenda de turnos', action: 'Ver agenda', description: 'Consultá los turnos del consultorio.', to: '/turnos', icon: CalendarDays },
      { title: 'Odontograma', action: 'Abrir odontograma', description: 'Registrá y consultá hallazgos dentales.', to: '/odontograma', icon: ClipboardList },
      { title: 'Seguimiento', action: 'Revisar reportes', description: 'Leé las observaciones del paciente y dejá tu revisión.', to: '/seguimiento', icon: ClipboardCheck },
    ],
    focus: ['Revisar las observaciones pendientes', 'Actualizar el odontograma clínico', 'Consultar las fichas antes de la atención'],
    upcoming: ['Historias clínicas integradas'],
  },
  RECEPCIONISTA: {
    eyebrow: 'Recepción',
    title: 'Gestión de recepción',
    description: 'Organizá la información administrativa sin modificar registros clínicos profesionales.',
    shortcuts: [
      { title: 'Pacientes', action: 'Ver pacientes', description: 'Registrá y actualizá los datos de contacto.', to: '/pacientes', icon: Users },
      { title: 'Agenda de turnos', action: 'Ver agenda', description: 'Consultá y asigná turnos reales.', to: '/turnos', icon: CalendarDays },
    ],
    focus: ['Registrar pacientes nuevos', 'Mantener al día los datos de contacto', 'Preparar la información para el equipo clínico'],
    upcoming: ['Confirmaciones y asistencia'],
  },
}

export function DashboardHome({ role, token = '' }: { role: UserRole | null; token?: string }) {
  const [patients, setPatients] = useState<Patient[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [dentists, setDentists] = useState<Dentist[]>([])
  const [treatments, setTreatments] = useState<Treatment[]>([])
  const [loading, setLoading] = useState(true)
  const [partialError, setPartialError] = useState(false)

  useEffect(() => {
    if (!token || !role || role === 'PACIENTE') return
    let active = true
    const controller = new AbortController()
    async function load() {
      let failed = false
      const safe = async <T,>(path: string): Promise<T[]> => {
        try {
          const result = await apiRequest<T[]>(path, { token, signal: controller.signal })
          if (!Array.isArray(result)) throw new Error('La respuesta de la API no tiene formato de lista.')
          return result
        }
        catch (error) { if (!(error instanceof DOMException && error.name === 'AbortError')) failed = true; return [] }
      }
      const [patientItems, appointmentItems, dentistItems, treatmentItems] = await Promise.all([
        safe<Patient>('/pacientes'), safe<Appointment>('/turnos'),
        role === 'ADMINISTRADOR' ? safe<Dentist>('/odontologos') : Promise.resolve([]),
        role !== 'RECEPCIONISTA' ? safe<Treatment>('/tratamientos') : Promise.resolve([]),
      ])
      if (active) { setPatients(patientItems); setAppointments(appointmentItems); setDentists(dentistItems); setTreatments(treatmentItems); setPartialError(failed); setLoading(false) }
    }
    void load()
    return () => { active = false; controller.abort() }
  }, [role, token])

  if (!role || role === 'PACIENTE') return <p role="alert" className="rounded-2xl border border-slate-200 bg-white p-6">Este panel no está disponible para tu cuenta.</p>
  const dashboard = DASHBOARDS[role]
  const today = localDate()
  const todayAppointments = appointments.filter(item => item.fecha === today && item.estado !== 'CANCELADO').sort((a, b) => a.hora.localeCompare(b.hora))
  const upcomingAppointments = appointments.filter(item => item.fecha >= today && item.estado !== 'CANCELADO').sort((a, b) => `${a.fecha}${a.hora}`.localeCompare(`${b.fecha}${b.hora}`)).slice(0, 5)
  const activeTreatments = treatments.filter(item => item.estado !== 'COMPLETADO' && item.estado !== 'CANCELADO')
  const metrics = role === 'ADMINISTRADOR'
    ? [{ label: 'Pacientes', value: patients.length, icon: Users, testId: 'metric-patients' }, { label: 'Turnos hoy', value: todayAppointments.length, icon: CalendarDays, testId: 'metric-appointments' }, { label: 'Odontólogos activos', value: dentists.filter(item => item.activo).length, icon: Stethoscope, testId: 'metric-dentists' }, { label: 'Tratamientos activos', value: activeTreatments.length, icon: ClipboardList, testId: 'metric-treatments' }]
    : role === 'ODONTOLOGO'
      ? [{ label: 'Pacientes de la clínica', value: patients.length, icon: Users, testId: 'metric-patients' }, { label: 'Turnos hoy', value: todayAppointments.length, icon: CalendarDays, testId: 'metric-appointments' }, { label: 'Tratamientos activos', value: activeTreatments.length, icon: ClipboardList, testId: 'metric-treatments' }, { label: 'Próximos turnos', value: upcomingAppointments.length, icon: CalendarDays, testId: 'metric-upcoming' }]
      : [{ label: 'Pacientes registrados', value: patients.length, icon: Users, testId: 'metric-patients' }, { label: 'Turnos hoy', value: todayAppointments.length, icon: CalendarDays, testId: 'metric-appointments' }]

  return <div className="space-y-4 text-slate-900">
    <section className="overflow-hidden rounded-2xl border border-white/70 bg-white/80 px-5 py-4 shadow-lg shadow-blue-950/5 backdrop-blur-xl sm:px-6">
      <p className="text-[0.7rem] font-bold uppercase tracking-[0.18em] text-blue-700">NovaDent · {dashboard.eyebrow}</p>
      <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-blue-950 sm:text-3xl">{dashboard.title}</h2>
      <p className="mt-1 max-w-2xl text-sm text-slate-600">{dashboard.description}</p>
    </section>
    {partialError ? <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">No se pudieron cargar todos los datos del panel. Algunas cifras pueden estar incompletas.</p> : null}
    <section aria-label="Resumen del consultorio" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map(({ label, value, icon: Icon, testId }) => <div key={label} data-testid={testId} className="flex min-h-24 items-center gap-3 rounded-xl border border-white/70 bg-white/85 p-4 shadow-md shadow-blue-950/5 backdrop-blur-xl">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700"><Icon aria-hidden="true" className="h-6 w-6" /></span><div><p className="text-xs font-semibold text-slate-600">{label}</p><p className="text-2xl font-extrabold text-blue-950">{loading ? '…' : value}</p></div>
      </div>)}
    </section>
    <div className="grid gap-3 lg:grid-cols-2">
      <section className="rounded-xl border border-white/70 bg-white/85 p-4 shadow-md shadow-blue-950/5 backdrop-blur-xl">
        <h3 className="flex items-center gap-2 text-lg font-bold text-blue-950"><CalendarDays aria-hidden="true" className="h-5 w-5 text-blue-600" /> {role === 'RECEPCIONISTA' ? 'Agenda de la clínica' : role === 'ODONTOLOGO' ? 'Próximos turnos de la clínica' : 'Turnos de hoy'}</h3>
        <p className="mt-1 text-xs text-slate-600">{role === 'ODONTOLOGO' ? 'Sin asignación por cuenta profesional; se muestran los turnos visibles para el rol.' : 'Información registrada en la agenda del backend.'}</p>
        {loading ? <p className="mt-4 text-sm text-slate-600">Cargando turnos…</p> : (role === 'ADMINISTRADOR' ? todayAppointments : upcomingAppointments).length === 0 ? <p className="mt-4 rounded-lg bg-blue-50 p-3 text-sm text-slate-600">No hay turnos para mostrar.</p> : <ol className="mt-3 divide-y divide-blue-100">{(role === 'ADMINISTRADOR' ? todayAppointments : upcomingAppointments).map(item => <li key={item.id} className="grid grid-cols-[4rem_minmax(0,1fr)_auto] gap-2 py-2.5 text-sm"><time className="font-bold text-blue-950">{item.hora.slice(0, 5)}</time><span className="min-w-0 truncate">{item.paciente ? `${item.paciente.nombre} ${item.paciente.apellido}` : 'Paciente'} · {item.motivo || 'Consulta'}</span><span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-800">{item.estado}</span></li>)}</ol>}
      </section>
      <section className="rounded-xl border border-white/70 bg-white/85 p-4 shadow-md shadow-blue-950/5 backdrop-blur-xl">
        <h3 className="flex items-center gap-2 text-lg font-bold text-blue-950">{role === 'RECEPCIONISTA' ? <Users aria-hidden="true" className="h-5 w-5 text-blue-600" /> : <ClipboardList aria-hidden="true" className="h-5 w-5 text-blue-600" />} {role === 'RECEPCIONISTA' ? 'Pacientes registrados' : role === 'ODONTOLOGO' ? 'Pacientes del consultorio' : 'Tratamientos registrados'}</h3>
        {loading ? <p className="mt-4 text-sm text-slate-600">Cargando…</p> : role === 'RECEPCIONISTA' || role === 'ODONTOLOGO' ? patients.length === 0 ? <p className="mt-4 rounded-lg bg-blue-50 p-3 text-sm text-slate-600">No hay pacientes registrados.</p> : <ol className="mt-3 divide-y divide-blue-100">{patients.slice(0, 5).map(item => <li key={item.id} className="flex items-center justify-between gap-3 py-2.5 text-sm"><span className="font-semibold text-blue-950">{item.nombre} {item.apellido}</span><span className="text-xs text-slate-600">DNI {item.dni}</span></li>)}</ol> : treatments.length === 0 ? <p className="mt-4 rounded-lg bg-blue-50 p-3 text-sm text-slate-600">No hay tratamientos registrados.</p> : <ol className="mt-3 divide-y divide-blue-100">{treatments.slice(0, 5).map(item => <li key={item.id} className="flex items-center justify-between gap-3 py-2.5 text-sm"><span className="font-semibold text-blue-950">{item.descripcion}</span><span className="text-xs text-slate-600">{item.estado}</span></li>)}</ol>}
        {role !== 'ADMINISTRADOR' ? <Link to="/pacientes" className="mt-4 inline-flex text-sm font-semibold text-blue-700 hover:underline">Ver pacientes →</Link> : null}
      </section>
    </div>
    <section aria-labelledby="available-modules-title">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 id="available-modules-title" className="text-lg font-bold text-blue-950">Accesos disponibles</h3>
          <p className="text-xs text-slate-600">Herramientas conectadas con el sistema actual.</p>
        </div>
        <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800">{dashboard.eyebrow}</span>
      </div>
      <div data-testid="role-shortcut-grid" className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {dashboard.shortcuts.map(({ title, action, description, to, icon: Icon }) =>
          <Link key={to} to={to} className="group flex min-h-40 flex-col justify-between rounded-xl border border-white/70 bg-white/85 p-4 shadow-md shadow-blue-950/5 backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
            <div className="flex items-start justify-between gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-700"><Icon aria-hidden="true" className="h-5 w-5" /></span>
              <ArrowUpRight aria-hidden="true" className="h-5 w-5 text-slate-400 transition group-hover:text-blue-700" />
            </div>
            <div><h4 className="mt-3 text-base font-bold text-blue-950">{title}</h4><p className="mt-1 text-xs leading-relaxed text-slate-600">{description}</p><span className="mt-2 inline-block text-sm font-semibold text-blue-700">{action} →</span></div>
          </Link>,
        )}
        {dashboard.upcoming.length > 0 ? <div className="flex min-h-40 flex-col justify-between rounded-xl border border-white/70 bg-white/70 p-4 shadow-md shadow-blue-950/5 backdrop-blur-xl">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-600"><CalendarDays aria-hidden="true" className="h-5 w-5" /></span>
          <div><h4 className="mt-3 text-base font-bold text-blue-950">{dashboard.upcoming[0]}</h4><p className="mt-1 text-xs text-slate-600">Este módulo todavía no muestra datos operativos.</p><span className="mt-2 inline-block rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-800">Próximamente</span></div>
        </div> : null}
      </div>
    </section>
    <div className="grid items-start gap-3 lg:grid-cols-[1.2fr_0.8fr]">
      <section className="rounded-xl border border-white/70 bg-white/85 p-5 shadow-md shadow-blue-950/5 backdrop-blur-xl">
        <h3 className="flex items-center gap-2 text-lg font-bold text-slate-950"><ClipboardCheck aria-hidden="true" className="h-5 w-5 text-blue-700" /> Tu espacio de trabajo</h3>
        <p className="mt-1 text-sm text-slate-600">Estas son las tareas que corresponden a tu rol.</p>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">{dashboard.focus.map(item => <li key={item} className="rounded-lg border border-blue-100 bg-blue-50/65 px-3 py-2.5 text-sm font-medium text-slate-800">{item}</li>)}</ul>
      </section>
      <section className="rounded-xl border border-white/70 bg-white/85 p-5 shadow-md shadow-blue-950/5 backdrop-blur-xl">
        <h3 className="flex items-center gap-2 text-lg font-bold text-slate-950"><CalendarDays aria-hidden="true" className="h-5 w-5 text-blue-700" /> Próximos módulos</h3>
        <p className="mt-1 text-sm text-slate-600">En preparación; aún no muestran datos operativos.</p>
        <ul className="mt-3 space-y-2">{dashboard.upcoming.map(item => <li key={item} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2.5 text-sm text-slate-700"><span>{item}</span><span className="text-xs font-semibold text-slate-500">Próximamente</span></li>)}</ul>
      </section>
    </div>
  </div>
}
