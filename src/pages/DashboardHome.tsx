import { useCallback, useEffect, useState } from 'react'
import { Activity, CalendarDays, Clock3, RefreshCw, Stethoscope, Users } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { apiRequest, errorMessage } from '../lib/api'

type Patient = { id: number; nombre: string; apellido: string }
type Dentist = { id: number; nombre: string; apellido: string; activo: boolean; especialidad?: { nombre: string } }
type Appointment = { id: number; fecha: string; hora: string; estado: string; motivo?: string; paciente?: { nombre: string; apellido: string }; odontologo?: { nombre: string; apellido: string } }

function today() {
  const date = new Date()
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 10)
}

export function DashboardHome() {
  const { token, user } = useAuth()
  const [patients, setPatients] = useState<Patient[]>([])
  const [dentists, setDentists] = useState<Dentist[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const refresh = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError('')
    try {
      const [patientData, dentistData, appointmentData] = await Promise.all([
        apiRequest<Patient[]>('/pacientes', token),
        apiRequest<Dentist[]>('/odontologos', token),
        apiRequest<Appointment[]>('/turnos', token),
      ])
      setPatients(patientData)
      setDentists(dentistData)
      setAppointments(appointmentData)
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { void refresh() }, [refresh])

  const todayAppointments = appointments.filter(item => item.fecha === today()).sort((a, b) => a.hora.localeCompare(b.hora))
  const stats = [
    { label: 'Pacientes registrados', value: patients.length, icon: Users, color: 'text-blue-700', bg: 'bg-blue-50' },
    { label: 'Turnos de hoy', value: todayAppointments.length, icon: CalendarDays, color: 'text-emerald-700', bg: 'bg-emerald-50' },
    { label: 'Profesionales activos', value: dentists.filter(item => item.activo).length, icon: Stethoscope, color: 'text-violet-700', bg: 'bg-violet-50' },
  ]

  return (
    <div className="space-y-7">
      <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-900 p-7 text-white shadow-lg shadow-blue-950/10 sm:p-10">
        <div className="flex flex-col gap-7 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-3 flex items-center gap-2 text-sm font-medium text-cyan-200"><Activity size={16} /> NOVADENT · PANEL CLÍNICO</p>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Buen día, {user?.nombre}.</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-blue-100/75">Tu agenda y la actividad de la clínica, actualizadas desde el backend.</p>
          </div>
          <button onClick={() => void refresh()} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-medium transition hover:bg-white/15" aria-label="Actualizar datos"><RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Actualizar</button>
        </div>
      </section>

      {error && <div role="alert" className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-950 sm:flex-row sm:items-center sm:justify-between"><span>{error} Revisá que Spring Boot y MySQL estén iniciados.</span><button onClick={() => void refresh()} className="font-semibold underline underline-offset-4">Reintentar</button></div>}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Resumen de la clínica">
        {stats.map(({ label, value, icon: Icon, color, bg }) => <article key={label} className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-200/40"><div className="flex items-center justify-between"><span className="text-sm font-medium text-slate-500">{label}</span><span className={`grid h-10 w-10 place-items-center rounded-xl ${bg} ${color}`}><Icon size={19} /></span></div><p className="mt-5 text-3xl font-semibold tracking-tight text-slate-900">{loading ? '…' : value}</p><p className="mt-1 text-xs text-slate-400">{loading ? 'Consultando API' : 'Dato en tiempo real'}</p></article>)}
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-200/40">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-6"><div><h2 className="font-semibold text-slate-900">Agenda de hoy</h2><p className="mt-1 text-xs text-slate-500">{new Intl.DateTimeFormat('es-AR', { dateStyle: 'full' }).format(new Date())}</p></div><span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">{todayAppointments.length} turnos</span></div>
        {loading ? <div className="p-10 text-center text-sm text-slate-500">Cargando agenda…</div> : todayAppointments.length ? <div className="divide-y divide-slate-100">{todayAppointments.map(appointment => <div key={appointment.id} className="grid grid-cols-[70px_1fr_auto] items-center gap-3 px-5 py-4 sm:grid-cols-[90px_1fr_1fr_auto] sm:px-6"><div className="flex items-center gap-2 font-semibold text-slate-800"><Clock3 size={15} className="text-blue-600" />{appointment.hora.slice(0, 5)}</div><div><p className="text-sm font-medium text-slate-800">{appointment.paciente?.nombre} {appointment.paciente?.apellido}</p><p className="text-xs text-slate-500">{appointment.motivo || 'Consulta odontológica'}</p></div><p className="hidden text-sm text-slate-600 sm:block">Dr. {appointment.odontologo?.nombre} {appointment.odontologo?.apellido}</p><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">{appointment.estado}</span></div>)}</div> : <div className="p-10 text-center"><CalendarDays size={24} className="mx-auto text-slate-300" /><p className="mt-3 text-sm font-medium text-slate-700">No hay turnos para hoy</p><p className="mt-1 text-xs text-slate-500">Los próximos turnos aparecerán aquí.</p></div>}
      </section>
    </div>
  )
}
