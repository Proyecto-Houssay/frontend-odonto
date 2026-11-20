import { useCallback, useEffect, useState } from 'react'
import { Bell, CalendarClock, Check, CheckCheck, LoaderCircle, Video, X } from 'lucide-react'

type Turno = { id: number; fecha: string; hora: string; estado?: string; odontologo?: { nombre?: string; apellido?: string } }
type Telecita = { turnoId: number; fecha: string; hora: string; estadoTurno?: string; odontologoNombre?: string }
type Aviso = { id: string; fecha: Date; tele: boolean; profesional: string; leido: boolean }
const DIA = 24 * 60 * 60 * 1000
const READ_KEY = 'novadent.notifications.read'

function key(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` }
function leidos() { try { return new Set(JSON.parse(sessionStorage.getItem(READ_KEY) || '[]') as string[]) } catch { return new Set<string>() } }

export function NotificationCenter() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [readIds, setReadIds] = useState(leidos)
  const [avisos, setAvisos] = useState<Aviso[]>([])

  const cargar = useCallback(async () => {
    setLoading(true); setError('')
    const ahora = new Date()
    const hasta = new Date(ahora.getTime() + 2 * DIA)
    const headers: HeadersInit = { Accept: 'application/json' }
    try {
      const saved = JSON.parse(sessionStorage.getItem('novadent.auth.session') || '{}') as { token?: string }
      if (saved.token) headers.Authorization = `Bearer ${saved.token.replace(/^Bearer\s+/i, '')}`
    } catch { /* sesión no disponible */ }
    const [turnos, virtuales] = await Promise.allSettled([
      fetch('/api/turnos', { headers }),
      fetch(`/api/teletriaje/citas/agenda?desde=${key(ahora)}&hasta=${key(hasta)}`, { headers }),
    ])
    try {
      const comunes = turnos.status === 'fulfilled' && turnos.value.ok ? await turnos.value.json() as Turno[] : []
      const tele = virtuales.status === 'fulfilled' && virtuales.value.ok ? await virtuales.value.json() as Telecita[] : []
      if (turnos.status !== 'fulfilled' || !turnos.value.ok) {
        if (virtuales.status !== 'fulfilled' || !virtuales.value.ok) throw new Error('No se pudo consultar la agenda. Iniciá sesión e intentá de nuevo.')
      }
      const idsTele = new Set(tele.map((item) => item.turnoId))
      const candidatos = [
        ...comunes.filter((item) => !idsTele.has(item.id)).map((item) => ({ id: `turno-${item.id}-${item.fecha}-${item.hora}`, fecha: item.fecha, hora: item.hora, tele: false, profesional: [item.odontologo?.nombre, item.odontologo?.apellido].filter(Boolean).join(' ') || 'equipo odontológico', estado: item.estado })),
        ...tele.map((item) => ({ id: `tele-${item.turnoId}-${item.fecha}-${item.hora}`, fecha: item.fecha, hora: item.hora, tele: true, profesional: item.odontologoNombre || 'equipo odontológico', estado: item.estadoTurno })),
      ]
      const nuevos = candidatos.flatMap((item) => {
        if (/cancel|anulad|complet|atendid/i.test(item.estado || '')) return []
        const fecha = new Date(`${item.fecha}T${item.hora.slice(0, 8)}`)
        const restante = fecha.getTime() - ahora.getTime()
        if (Number.isNaN(fecha.getTime()) || restante < 0 || restante > DIA) return []
        return [{ id: item.id, fecha, tele: item.tele, profesional: item.profesional, leido: leidos().has(item.id) }]
      }).sort((a, b) => a.fecha.getTime() - b.fecha.getTime())
      setAvisos(nuevos)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo consultar la agenda.'); setAvisos([]) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { void cargar(); const timer = window.setInterval(() => void cargar(), 5 * 60 * 1000); return () => window.clearInterval(timer) }, [cargar])
  const noLeidos = avisos.filter((aviso) => !readIds.has(aviso.id)).length
  const marcar = (ids: string[]) => { const actualizados = new Set([...readIds, ...ids]); setReadIds(actualizados); sessionStorage.setItem(READ_KEY, JSON.stringify([...actualizados])); setAvisos((actuales) => actuales.map((aviso) => ({ ...aviso, leido: actualizados.has(aviso.id) }))) }

  return <div className="relative">
    <button type="button" onClick={() => setOpen((value) => !value)} aria-label={noLeidos ? `Notificaciones, ${noLeidos} sin leer` : 'Notificaciones'} aria-expanded={open} className="relative rounded-xl p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"><Bell className="h-5 w-5"/>{noLeidos > 0 && <span className="absolute -right-0.5 -top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white">{noLeidos > 9 ? '9+' : noLeidos}</span>}</button>
    {open && <section role="dialog" aria-label="Notificaciones de turnos" className="absolute right-0 top-12 z-50 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
      <header className="flex items-center justify-between border-b p-4"><div><h2 className="font-bold">Próximas 24 horas</h2><p className="text-xs text-slate-500">Avisos dentro de Novadent</p></div><div className="flex gap-1">{noLeidos > 0 && <button type="button" onClick={() => marcar(avisos.map((aviso) => aviso.id))} aria-label="Marcar todas como leídas" className="rounded-lg p-2 text-blue-700 hover:bg-blue-50"><CheckCheck size={17}/></button>}<button type="button" onClick={() => setOpen(false)} aria-label="Cerrar notificaciones" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={17}/></button></div></header>
      {loading && !avisos.length ? <div className="flex items-center gap-2 p-5 text-sm text-slate-500"><LoaderCircle className="animate-spin" size={17}/>Consultando agenda…</div> : error ? <div role="status" className="p-4 text-sm text-amber-800">{error}<button type="button" onClick={() => void cargar()} className="ml-2 font-semibold underline">Reintentar</button></div> : avisos.length ? <ul className="max-h-[min(60vh,28rem)] divide-y overflow-y-auto">{avisos.map((aviso) => <li key={aviso.id} className={`p-4 ${readIds.has(aviso.id) ? '' : 'bg-blue-50/70'}`}><div className="flex items-start gap-3"><span className={`rounded-lg p-2 ${aviso.tele ? 'bg-violet-100 text-violet-700' : 'bg-blue-100 text-blue-700'}`}>{aviso.tele ? <Video size={17}/> : <CalendarClock size={17}/>}</span><div className="flex-1"><p className="font-semibold">{aviso.tele ? 'Teleconsulta' : 'Turno odontológico'}</p><p className="mt-1 text-sm text-slate-600">{new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: 'numeric', month: 'short' }).format(aviso.fecha)} · {new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit' }).format(aviso.fecha)}</p><p className="text-xs text-slate-500">Profesional: {aviso.profesional}</p><div className="mt-3 flex justify-between"><a href="/turnos" onClick={() => setOpen(false)} className="text-xs font-bold text-blue-700">Ver agenda</a>{!readIds.has(aviso.id) && <button type="button" onClick={() => marcar([aviso.id])} className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600"><Check size={13}/>Leída</button>}</div></div></div></li>)}</ul> : <div className="p-6 text-center"><CheckCheck className="mx-auto text-emerald-700"/><p className="mt-2 text-sm font-semibold">Todo al día</p><p className="text-xs text-slate-500">No hay turnos dentro de las próximas 24 horas.</p></div>}
      <footer className="border-t px-4 py-3 text-[11px] leading-4 text-slate-500">Se actualiza mientras la app está abierta. Los avisos al celular o con Novadent cerrada requieren notificaciones push.</footer>
    </section>}
  </div>
}
