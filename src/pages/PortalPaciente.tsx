import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import { CalendarDays, Camera, ClipboardList, FileUp, Home, LogOut, MessageCircle, Moon, ShieldCheck, Sun, UserRound } from 'lucide-react'
import { Link, NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { ApiError, apiRequest } from '../lib/api'
import { NovadentBrand } from '../components/brand/NovadentBrand'
import { ChatbotPage } from './ChatbotPage'
import { MiOdontograma } from './MiOdontograma'

type Perfil = { id: number; nombre: string; apellido: string; dni: string; email: string; telefono?: string; fechaNacimiento: string }
type Reporte = {
  id: number; pacienteId: number; pieza: number; dolor: number; sintomas: string; fotoDisponible?: boolean
  fotoBase64?: string | null; creadoEn?: string; estado: 'PENDIENTE' | 'REVISADO'
  revisionProfesional?: string | null; revisadoEn?: string | null
}
type TurnoPropio = { id: number; fecha: string; hora: string; motivo: string; estado: string; odontologoNombre: string }
type TratamientoPropio = { id: number; fecha: string; descripcion: string; estado: string }

const PATIENT_LINKS = [
  { label: 'Inicio', to: '/', icon: Home },
  { label: 'Mi odontograma', to: '/mi-odontograma', icon: ShieldCheck },
  { label: 'Mi seguimiento', to: '/mi-seguimiento', icon: ShieldCheck },
  { label: 'Mis turnos', to: '/mis-turnos', icon: CalendarDays },
  { label: 'Mis tratamientos', to: '/mis-tratamientos', icon: ShieldCheck },
  { label: 'Mis reportes', to: '/mis-reportes', icon: ClipboardList },
  { label: 'Mis datos', to: '/mis-datos', icon: UserRound },
  { label: 'Asistente IA', to: '/chatbot', icon: MessageCircle },
] as const

const PAGE_TITLES: Record<string, { title: string; subtitle: string }> = {
  '/': { title: 'Inicio', subtitle: 'Consultá tu resumen y registrá lo que observás.' },
  '/mi-odontograma': { title: 'Mi odontograma', subtitle: 'Consultá los registros del equipo profesional por pieza dental.' },
  '/mi-seguimiento': { title: 'Mi seguimiento dental', subtitle: 'Consultá la evolución de tus observaciones.' },
  '/mis-turnos': { title: 'Tus turnos', subtitle: 'Consultá tus citas registradas en el consultorio.' },
  '/mis-tratamientos': { title: 'Tus tratamientos', subtitle: 'Consultá los tratamientos indicados para tu ficha.' },
  '/mis-reportes': { title: 'Tus reportes', subtitle: 'Consultá tus observaciones y las revisiones profesionales.' },
  '/mis-datos': { title: 'Tus datos', subtitle: 'Revisá tus datos de contacto.' },
  '/chatbot': { title: 'Asistente IA', subtitle: 'Consultá información general de NovaDent.' },
}

function dateLabel(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })
}

const DIENTES = [
  [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28],
  [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38],
]

const TOOTH_TYPES: Record<number, string> = {
  1: 'Incisivo central', 2: 'Incisivo lateral', 3: 'Canino', 4: 'Primer premolar',
  5: 'Segundo premolar', 6: 'Primer molar', 7: 'Segundo molar', 8: 'Tercer molar',
}
const TOOTH_QUADRANTS: Record<number, string> = {
  1: 'superior derecho', 2: 'superior izquierdo', 3: 'inferior izquierdo', 4: 'inferior derecho',
}

function nombrePieza(numero: number) {
  const cuadrante = Math.floor(numero / 10)
  const tipo = numero % 10
  return `${TOOTH_TYPES[tipo] || 'Pieza dental'} ${TOOTH_QUADRANTS[cuadrante] || ''}`.trim()
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
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [openedAt] = useState(() => Date.now())
  const [reloadKey, setReloadKey] = useState(0)
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try { return localStorage.getItem('novadent-theme') === 'dark' ? 'dark' : 'light' }
    catch { return 'light' }
  })

  useEffect(() => {
    const onTurnoBooked = () => setReloadKey(value => value + 1)
    window.addEventListener('novadent:turno-booked', onTurnoBooked)
    return () => window.removeEventListener('novadent:turno-booked', onTurnoBooked)
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try { localStorage.setItem('novadent-theme', theme) } catch { /* Storage may be disabled by the browser. */ }
  }, [theme])

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
        if (active) { setReports(reportList); setTurnos(ownTurnos); setTratamientos(ownTreatments) }
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
    return () => { active = false }
  }, [token, reloadKey])

  async function crearPerfil(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true); setError(''); setNotice('')
    try {
      const created = await apiRequest<Perfil>('/portal-paciente/perfil', {
        method: 'POST', token, body: { dni: dni.trim(), telefono: telefono.trim(), fechaNacimiento },
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
    } finally { setBusy(false) }
  }

  async function actualizarTelefono(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true); setError(''); setNotice('')
    try {
      const updated = await apiRequest<Perfil>('/portal-paciente/perfil', {
        method: 'PUT', token, body: { telefono: editTelefono.trim() },
      })
      setPerfil(updated)
      setNotice('Teléfono actualizado.')
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'No se pudo actualizar el teléfono.') }
    finally { setBusy(false) }
  }

  function cargarFoto(event: ChangeEvent<HTMLInputElement>) {
    setError(''); setFoto(null); setFotoNombre(''); setFotoConsentida(false)
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
    if (foto && !fotoConsentida) { setError('Aceptá el uso de la foto para este reporte.'); return }
    setBusy(true); setError(''); setNotice('')
    try {
      await apiRequest<Reporte>('/portal-paciente/reportes', {
        method: 'POST', token,
        body: { pieza: selectedTooth, dolor, sintomas: sintomas.trim(), fotoBase64: foto, consentimientoFoto: foto ? fotoConsentida : false },
      })
      setReports(await apiRequest<Reporte[]>('/portal-paciente/reportes', { token }))
      setSintomas(''); setFoto(null); setFotoNombre(''); setFotoConsentida(false)
      setNotice('Reporte enviado. Un odontólogo debe revisarlo; esto no es un diagnóstico.')
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'No se pudo enviar el reporte.')
    } finally { setBusy(false) }
  }

  async function verReporte(id: number) {
    setError('')
    try { setSelectedReport(await apiRequest<Reporte>(`/portal-paciente/reportes/${id}`, { token })) }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'No se pudo abrir el reporte.') }
  }

  const nextTurno = turnos.find(turno => turno.estado !== 'CANCELADO' &&
    new Date(`${turno.fecha}T${turno.hora}`).getTime() >= openedAt)
  const page = PAGE_TITLES[location.pathname] || PAGE_TITLES['/']

  return <main className="clinic-backdrop patient-portal-backdrop min-h-screen text-slate-900" style={{ backgroundImage: theme === 'dark'
    ? 'linear-gradient(125deg, rgba(3,16,32,.76), rgba(5,23,42,.68)), url("/images/novadent-consultorio.png")'
    : 'linear-gradient(125deg, rgba(230,243,255,.28), rgba(218,237,252,.36)), url("/images/novadent-consultorio.png")' }}>
    <div className="mx-auto grid w-full max-w-[1800px] gap-4 px-3 py-3 sm:px-5 sm:py-5 lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="flex flex-col rounded-2xl border border-white/70 bg-white/85 p-4 shadow-xl shadow-blue-950/10 backdrop-blur-xl lg:sticky lg:top-5 lg:h-[calc(100vh-2.5rem)] lg:p-5">
        <NovadentBrand compact />
        <nav aria-label="Navegación del paciente" className="mt-5 flex flex-wrap gap-1 border-t border-blue-100 pt-4 lg:flex-col">
          {PATIENT_LINKS.map(({ label, to, icon: Icon }) => <NavLink key={to} to={to} end={to === '/'}
            className={({ isActive }) => `flex min-h-10 items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${isActive ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-700 hover:bg-blue-50 hover:text-blue-800'}`}>
            <Icon aria-hidden="true" size={17} /> {label}
          </NavLink>)}
        </nav>
        <div className="mt-auto hidden border-t border-blue-100 pt-4 lg:block">
          <div className="flex items-center gap-3 rounded-xl bg-blue-50/90 p-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">{perfil?.nombre?.charAt(0).toUpperCase() || 'P'}</span>
            <span className="min-w-0"><span className="block truncate text-sm font-bold text-slate-900">{perfil ? `${perfil.nombre} ${perfil.apellido}` : 'Mi cuenta'}</span><span className="block text-xs text-slate-600">Paciente</span></span>
          </div>
        </div>
      </aside>
      <div className="min-w-0">
        <header id="inicio" className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/70 bg-white/75 px-5 py-4 shadow-lg shadow-blue-950/5 backdrop-blur-xl sm:px-6">
          <div><p className="text-[0.7rem] font-bold uppercase tracking-[0.16em] text-blue-700">Portal del paciente</p><h1 className="mt-0.5 text-2xl font-extrabold tracking-tight text-blue-950 sm:text-3xl">{page.title}</h1><p className="mt-0.5 text-sm text-slate-600">{page.subtitle}</p></div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setTheme(value => value === 'dark' ? 'light' : 'dark')} aria-label={theme === 'dark' ? 'Activar modo claro' : 'Activar modo oscuro'} className="flex min-h-10 items-center gap-2 rounded-xl border border-blue-200 bg-blue-50/80 px-3 py-2 text-sm font-semibold text-blue-900 hover:bg-blue-100 focus-visible:outline-2 focus-visible:outline-blue-600">
              {theme === 'dark' ? <Sun aria-hidden="true" size={16} /> : <Moon aria-hidden="true" size={16} />}{theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
            </button>
            <button type="button" onClick={onLogout} className="flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-red-50 hover:text-red-700 focus-visible:outline-2 focus-visible:outline-blue-600"><LogOut size={16} /> Cerrar sesión</button>
          </div>
        </header>
        <div className="space-y-4 py-4">
      <p className="rounded-xl border border-blue-200/90 bg-blue-50/90 px-4 py-2.5 text-sm text-blue-950 shadow-sm">
        Este portal registra lo que vos observás. No determina enfermedades ni reemplaza la consulta. La evaluación corresponde al odontólogo.
      </p>
      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
      {notice && <p role="status" className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">{notice}</p>}
      {location.pathname === '/chatbot' ? <ChatbotPage /> : loading ? <p className="rounded-xl bg-white/85 p-5">Cargando tu información…</p> : !perfil ? <section id="mis-datos" className="rounded-2xl border border-white/70 bg-white/85 p-5 shadow-lg shadow-blue-950/5 backdrop-blur-xl">
        <h2 className="mb-2 text-lg font-bold text-blue-950">Completá tu ficha para ver {page.title.toLocaleLowerCase('es-AR')}</h2>
        <p className="mb-5 text-sm text-slate-600">Tu cuenta todavía no tiene una ficha de paciente vinculada. Completá tus datos abajo para consultar tus turnos, tratamientos, reportes y odontograma, o pedí al administrador que vincule tu ficha si ya te atendiste en el consultorio.</p>
        <form onSubmit={crearPerfil} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <label className="block text-sm font-medium">DNI<input className={inputClass} required minLength={5} maxLength={30} value={dni} onChange={event => setDni(event.target.value)} /></label>
          <label className="block text-sm font-medium">Fecha de nacimiento<input className={inputClass} required type="date" max={new Date().toISOString().slice(0, 10)} value={fechaNacimiento} onChange={event => setFechaNacimiento(event.target.value)} /></label>
          <label className="block text-sm font-medium">Teléfono (opcional)<input className={inputClass} maxLength={30} value={telefono} onChange={event => setTelefono(event.target.value)} /></label>
          <div className="flex items-end"><button type="submit" disabled={busy} className={primaryClass}>Crear mi ficha</button></div>
        </form>
      </section> : <>
        <Routes>
          <Route path="/mi-odontograma" element={<MiOdontograma token={token} />} />
          <Route path="/" element={
            <div className="space-y-4">
              <section data-testid="patient-summary-grid" className={cardClass + ' grid gap-5 lg:grid-cols-[1fr_auto] lg:items-center'}>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-blue-700">Resumen personal</p>
                  <h2 className="mt-1 text-2xl font-extrabold text-blue-950">Resumen de hoy</h2>
                  <p className="mt-1 text-sm text-slate-600">Hola, {perfil.nombre}. Acá tenés tus próximas acciones y actividad reciente.</p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <Link to="/mis-datos" className="rounded-lg border border-blue-200 bg-blue-50/80 px-4 py-2 text-sm font-semibold text-blue-900 hover:bg-blue-100">Revisar mis datos</Link>
                    <Link to="/mi-odontograma" className="rounded-lg border border-blue-200 bg-white/75 px-4 py-2 text-sm font-semibold text-blue-900 hover:bg-blue-50">Ver odontograma</Link>
                    <Link to="/mis-reportes" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">Ver mis reportes</Link>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 lg:min-w-72">
                  <div className="rounded-xl border border-blue-100 bg-blue-50/80 p-3"><span className="block text-xs text-slate-600">Reportes pendientes</span><span className="mt-1 block text-2xl font-extrabold text-blue-900">{reports.filter(report => report.estado === 'PENDIENTE').length}</span></div>
                  <div className="rounded-xl border border-green-200 bg-green-50/80 p-3"><span className="block text-xs text-slate-600">Tratamientos activos</span><span className="mt-1 block text-2xl font-extrabold text-green-800">{tratamientos.filter(item => item.estado.toLocaleLowerCase('es-AR').includes('curso') || item.estado.toLocaleLowerCase('es-AR').includes('activo')).length}</span></div>
                </div>
              </section>

              <div className="grid gap-4 lg:grid-cols-2">
                <section className={cardClass}>
                  <h2 className="flex items-center gap-2 text-base font-bold text-blue-950"><CalendarDays aria-hidden="true" className="h-5 w-5 text-blue-600" /> Próximo turno</h2>
                  {turnosError ? <p role="alert" className="mt-3 text-sm text-red-700">No se pudieron cargar tus turnos.</p> : nextTurno ? <div className="mt-3">
                    <p className="font-semibold text-slate-900">{dateLabel(nextTurno.fecha)} · {nextTurno.hora.slice(0, 5)} hs</p>
                    <p className="text-sm text-slate-700">{nextTurno.motivo}</p><p className="text-sm text-slate-600">{nextTurno.odontologoNombre}</p>
                    <Link to="/mis-turnos" className="mt-3 inline-flex rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">Ver mis turnos</Link>
                  </div> : <p className="mt-3 text-sm text-slate-700">Todavía no tenés próximos turnos.</p>}
                </section>
                <section className={cardClass}>
                  <h2 className="flex items-center gap-2 text-base font-bold text-blue-950"><ClipboardList aria-hidden="true" className="h-5 w-5 text-green-700" /> Actividad reciente</h2>
                  {reportsError ? <p role="alert" className="mt-3 text-sm text-red-700">No se pudieron cargar tus reportes.</p> : reports.length === 0 ? <p className="mt-3 text-sm text-slate-600">Todavía no hay reportes. Si querés registrar una observación, usá el formulario de abajo.</p> : <p className="mt-3 text-sm text-slate-700">Tenés {reports.length} {reports.length === 1 ? 'reporte' : 'reportes'} registrados. El más reciente es de la pieza {reports[0].pieza}.</p>}
                  <Link to="/mi-seguimiento" className="mt-3 inline-flex rounded-lg border border-green-300 bg-green-50/80 px-4 py-2 text-sm font-semibold text-green-900 hover:bg-green-100">Ver evolución de mis reportes</Link>
                </section>
              </div>

              <section id="registrar-reporte" className={cardClass}>
                <h2 className="mb-1 text-lg font-bold text-blue-950">Registrar una observación</h2>
                <p className="mb-3 text-sm text-slate-600">Contale al equipo qué sentís. Esto registra una observación y no es un diagnóstico.</p>
                <form className="grid gap-4 lg:grid-cols-2" onSubmit={enviar}>
                  <div className="space-y-3">
                    <label className="block text-sm font-medium">Pieza dental<select className={inputClass} value={selectedTooth} onChange={event => setSelectedTooth(Number(event.target.value))}>{DIENTES.flat().map(number => <option key={number} value={number}>{number} · {nombrePieza(number)}</option>)}</select></label>
                    <label className="block text-sm font-medium">Dolor informado: {dolor}/10<input className="mt-2 w-full accent-blue-600" type="range" min="0" max="10" value={dolor} onChange={event => setDolor(Number(event.target.value))} /></label>
                  </div>
                  <div className="space-y-3">
                    <label className="block text-sm font-medium">Síntomas<textarea className={inputClass} required minLength={3} maxLength={500} rows={2} value={sintomas} onChange={event => setSintomas(event.target.value)} placeholder="Qué notás y desde cuándo" /></label>
                    <div>
                      <label htmlFor="patient-photo-upload" className="flex items-center gap-2 text-sm font-medium"><Camera size={18} /> Foto opcional (PNG/JPEG, hasta 1 MB)</label>
                      <div className="relative mt-2 rounded-lg border border-dashed border-blue-300 bg-blue-50/70 p-2.5 transition hover:border-blue-600 hover:bg-blue-100/80 focus-within:border-blue-700 focus-within:ring-2 focus-within:ring-blue-300">
                        <input id="patient-photo-upload" aria-label="Foto opcional (PNG/JPEG, hasta 1 MB)" className="absolute inset-0 h-full w-full cursor-pointer opacity-0" type="file" accept="image/png,image/jpeg" onChange={cargarFoto} />
                        <div className="pointer-events-none flex flex-wrap items-center gap-3"><span className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-sm"><FileUp aria-hidden="true" size={17} /> Seleccionar foto</span><span className="min-w-0 break-all text-sm text-blue-950">{fotoNombre || 'Ningún archivo seleccionado'}</span></div>
                      </div>
                    </div>
                    {foto && <><img src={foto} alt="Vista previa de la foto cargada" className="max-h-44 rounded-xl border object-contain" /><label className="flex gap-2 text-sm"><input type="checkbox" checked={fotoConsentida} onChange={event => setFotoConsentida(event.target.checked)} />Acepto guardar esta foto en mi reporte clínico.</label></>}
                    <button type="submit" disabled={busy} className={primaryClass + ' w-full'}>Enviar reporte</button>
                  </div>
                </form>
              </section>
            </div>
          } />
          <Route path="/mi-seguimiento" element={<section className={cardClass}>
            <header className="border-b border-blue-100 pb-4">
              <p className="text-xs font-bold uppercase tracking-wide text-green-700">Línea de tiempo</p>
              <h2 className="mt-1 text-xl font-bold text-blue-950">Evolución de mis observaciones</h2>
              <p className="mt-1 text-sm text-slate-600">Revisá en orden cronológico lo que informaste y si el equipo profesional dejó una respuesta.</p>
            </header>
            {reportsError ? <p role="alert" className="mt-5 text-sm text-red-700">{reportsError}</p> : reports.length === 0 ? <p className="mt-5 rounded-xl bg-blue-50/80 p-4 text-sm text-slate-700">Todavía no registraste observaciones. Podés iniciar una desde <Link to="/" className="font-semibold text-blue-700 underline">Inicio</Link>.</p> : <ol className="mt-5 space-y-4">
              {[...reports].sort((a, b) => new Date(b.creadoEn || 0).getTime() - new Date(a.creadoEn || 0).getTime()).map(item => <li key={item.id} className="relative rounded-xl border border-blue-100 bg-white/70 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-bold text-blue-950">Pieza {item.pieza} · {nombrePieza(item.pieza)}</h3><time className="text-xs text-slate-500">{item.creadoEn ? new Date(item.creadoEn).toLocaleString('es-AR') : 'Reporte #' + item.id}</time></div>
                <p className="mt-2 text-sm text-slate-700">{item.sintomas}</p>
                <p className="mt-2 text-xs text-slate-600">Dolor informado: {item.dolor}/10</p>
                <p className="mt-2 text-xs font-semibold text-blue-700">{item.estado === 'REVISADO' ? 'Revisado por un profesional' : 'Pendiente de revisión profesional'}</p>
                {item.revisionProfesional && <p className="mt-3 rounded-lg border-l-4 border-green-500 bg-green-50/70 p-3 text-sm text-green-950"><span className="font-semibold">Nota del equipo: </span>{item.revisionProfesional}</p>}
              </li>)}
            </ol>}
            <Link to="/mis-reportes" className="mt-5 inline-flex rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">Abrir mis reportes</Link>
          </section>} />
          <Route path="/mis-turnos" element={<section className={cardClass}>
            <h2 className="text-xl font-bold text-blue-950">Mis turnos</h2>
            <p className="mt-1 text-sm text-slate-600">Consultá las citas vinculadas a tu ficha. Para cambiar un turno, comunicate con recepción.</p>
            {turnosError ? <p role="alert" className="mt-5 text-sm text-red-700">{turnosError}</p> : turnos.length === 0 ? <p className="mt-5 rounded-xl bg-blue-50 p-4 text-sm text-slate-700">Todavía no tenés turnos registrados.</p> : <ol className="mt-5 grid gap-3 md:grid-cols-2">
              {turnos.map(item => <li key={item.id} className="rounded-xl border border-blue-100 bg-white/85 p-4"><p className="font-bold text-blue-950">{dateLabel(item.fecha)} · {item.hora.slice(0, 5)} hs</p><p className="mt-1 text-sm">{item.motivo}</p><p className="text-sm text-slate-600">{item.odontologoNombre}</p><span className="mt-3 inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800">{item.estado}</span></li>)}
            </ol>}
          </section>} />
          <Route path="/mis-tratamientos" element={<section className={cardClass}>
            <h2 className="text-xl font-bold text-blue-950">Mis tratamientos</h2>
            <p className="mt-1 text-sm text-slate-600">Estos tratamientos fueron registrados por el equipo profesional para tu ficha.</p>
            {tratamientosError ? <p role="alert" className="mt-5 text-sm text-red-700">{tratamientosError}</p> : tratamientos.length === 0 ? <p className="mt-5 rounded-xl bg-blue-50 p-4 text-sm text-slate-700">Todavía no tenés tratamientos registrados.</p> : <ol className="mt-5 grid gap-3 md:grid-cols-2">
              {tratamientos.map(item => <li key={item.id} className="rounded-xl border border-blue-100 bg-white/85 p-4"><p className="font-bold text-blue-950">{item.descripcion}</p><p className="mt-1 text-sm text-slate-600">{dateLabel(item.fecha)}</p><span className="mt-3 inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800">{item.estado}</span></li>)}
            </ol>}
          </section>} />
          <Route path="/mis-reportes" element={<section className={cardClass}>
            <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-bold text-blue-950">Mis reportes</h2><p className="mt-1 text-sm text-slate-600">Observaciones que enviaste y revisión del odontólogo.</p></div><Link to="/" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">Nuevo reporte</Link></div>
            {reportsError ? <p role="alert" className="mt-5 text-sm text-red-700">{reportsError}</p> : reports.length === 0 ? <p className="mt-5 rounded-xl bg-blue-50 p-4 text-sm text-slate-700">Todavía no enviaste reportes.</p> : <ol className="mt-5 grid gap-3 md:grid-cols-2">
              {reports.map(item => <li key={item.id}><button type="button" onClick={() => void verReporte(item.id)} className="w-full rounded-xl border border-blue-100 bg-white/85 p-4 text-left transition hover:border-blue-400 focus-visible:outline-2 focus-visible:outline-blue-600"><span className="font-bold text-blue-950">Pieza {item.pieza} · Reporte #{item.id}</span><span className="ml-2 text-xs text-slate-600">Dolor {item.dolor}/10</span><p className="mt-2 text-sm">{item.sintomas}</p><p className="mt-2 text-xs font-semibold text-blue-700">{item.estado === 'REVISADO' ? 'Revisado por un profesional' : 'Pendiente de revisión profesional'}</p></button></li>)}
            </ol>}
            {selectedReport && <div className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-4"><p className="font-semibold">Reporte #{selectedReport.id}</p>{selectedReport.fotoBase64 && <img src={selectedReport.fotoBase64} alt="Foto del reporte seleccionado" className="my-3 max-h-64 rounded-lg object-contain" />}<p className="mt-2 text-sm">{selectedReport.revisionProfesional || 'Aún no hay una nota profesional.'}</p></div>}
          </section>} />
          <Route path="/mis-datos" element={<section className={cardClass}>
            <h2 className="text-xl font-bold text-blue-950">Mis datos</h2>
            <dl className="mt-5 grid gap-4 sm:grid-cols-2"><div><dt className="text-xs font-semibold uppercase text-slate-500">Nombre completo</dt><dd className="mt-1 font-semibold">{perfil.nombre} {perfil.apellido}</dd></div><div><dt className="text-xs font-semibold uppercase text-slate-500">DNI</dt><dd className="mt-1">{perfil.dni}</dd></div><div><dt className="text-xs font-semibold uppercase text-slate-500">Correo electrónico</dt><dd className="mt-1 break-all">{perfil.email}</dd></div><div><dt className="text-xs font-semibold uppercase text-slate-500">Fecha de nacimiento</dt><dd className="mt-1">{perfil.fechaNacimiento ? dateLabel(perfil.fechaNacimiento) : 'No registrada'}</dd></div></dl>
            <form onSubmit={actualizarTelefono} className="mt-6 flex flex-wrap items-end gap-3 border-t border-blue-100 pt-5"><label className="text-sm font-medium">Teléfono de contacto<input className={inputClass} maxLength={30} value={editTelefono} onChange={event => setEditTelefono(event.target.value)} /></label><button type="submit" disabled={busy} className={primaryClass}>Actualizar teléfono</button></form>
          </section>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </>}
        </div>
      </div>
    </div>
  </main>
}

const inputClass = 'mt-1.5 block min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-600'
const primaryClass = 'min-h-11 rounded-lg bg-blue-600 px-5 py-2 font-semibold text-white hover:bg-blue-700 disabled:opacity-60'
const cardClass = 'rounded-2xl border border-white/70 bg-white/85 p-5 shadow-lg shadow-blue-950/5 backdrop-blur-xl'
