import { useEffect, useState, type FormEvent } from 'react'
import { Camera, ClipboardCheck, Clock3 } from 'lucide-react'
import { apiRequest } from '../lib/api'
import type { UserRole } from '../auth/role'

type Reporte = {
  id: number; pacienteId: number; pieza: number; dolor: number; sintomas: string; fotoDisponible?: boolean
  fotoBase64?: string | null; creadoEn?: string; estado: 'PENDIENTE' | 'REVISADO'
  revisionProfesional?: string | null; revisadoEn?: string | null
}

export function SeguimientoPage({ token, role }: { token: string; role: UserRole | null }) {
  const [reports, setReports] = useState<Reporte[]>([])
  const [selected, setSelected] = useState<Reporte | null>(null)
  const [review, setReview] = useState('')
  const [patientFilter, setPatientFilter] = useState('')
  const [accountId, setAccountId] = useState('')
  const [patientId, setPatientId] = useState('')
  const [confirmedDni, setConfirmedDni] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    let active = true
    apiRequest<Reporte[]>('/seguimiento/reportes', { token })
      .then(result => { if (active) setReports(result) })
      .catch(failure => { if (active) setError(failure instanceof Error ? failure.message : 'No se pudieron cargar los reportes.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [token])

  async function abrir(id: number) {
    setError(''); setNotice('')
    try { setSelected(await apiRequest<Reporte>(`/seguimiento/reportes/${id}`, { token })); setReview('') }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'No se pudo abrir el reporte.') }
  }

  async function revisar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selected) return
    setBusy(true); setError(''); setNotice('')
    try {
      const updated = await apiRequest<Reporte>(`/seguimiento/reportes/${selected.id}/revision`, {
        method: 'PUT', token, body: { revisionProfesional: review.trim() },
      })
      setSelected(updated)
      setReports(await apiRequest<Reporte[]>('/seguimiento/reportes', { token }))
      setNotice('Revisión registrada')
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'No se pudo registrar la revisión.') }
    finally { setBusy(false) }
  }

  async function vincular(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true); setError(''); setNotice('')
    try {
      await apiRequest(`/admin/vinculos-paciente/${Number(accountId)}`, {
        method: 'PUT', token, body: { pacienteId: Number(patientId), dniConfirmado: confirmedDni.trim() },
      })
      setNotice('La cuenta quedó vinculada con la ficha existente.')
      setAccountId(''); setPatientId(''); setConfirmedDni('')
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'No se pudo vincular la cuenta.') }
    finally { setBusy(false) }
  }

  const visible = reports.filter(report => !patientFilter || String(report.pacienteId).includes(patientFilter.trim()))

  return <div className="space-y-6 text-slate-900">
    <div><p className="text-sm font-semibold uppercase tracking-wide text-blue-700">Seguimiento clínico</p>
      <h1 className="text-2xl font-bold">Reportes enviados por pacientes</h1>
      <p className="mt-2 text-sm text-slate-600">La información fue declarada por el paciente. No es un diagnóstico automático; requiere evaluación profesional.</p></div>
    {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
    {notice && <p role="status" className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">{notice}</p>}
    <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-bold"><Clock3 size={20} /> Bandeja de reportes</h2>
        <label className="mb-4 block text-sm font-medium">Filtrar por ID de paciente
          <input className={inputClass} inputMode="numeric" value={patientFilter} onChange={event => setPatientFilter(event.target.value)} />
        </label>
        {loading ? <p>Cargando…</p> : visible.length === 0 ? <p className="text-sm text-slate-600">No hay reportes para mostrar.</p>
          : <ul className="space-y-2">{visible.map(report => <li key={report.id}>
            <button type="button" onClick={() => void abrir(report.id)}
              className={`w-full rounded-xl border p-4 text-left hover:border-blue-400 ${selected?.id === report.id ? 'border-blue-600 bg-blue-50' : 'bg-white'}`}>
              <span className="font-semibold">Reporte #{report.id}</span> · Paciente #{report.pacienteId} · Diente {report.pieza}
              <p className="mt-1 text-sm text-slate-600">Dolor informado {report.dolor}/10 · {report.fotoDisponible ? 'con foto' : 'sin foto'}</p>
              <p className="mt-1 text-sm font-medium text-blue-800">{report.estado === 'REVISADO' ? 'Revisado' : 'Pendiente de revisión'}</p>
            </button>
          </li>)}</ul>}
      </section>
      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-bold"><ClipboardCheck size={20} /> Revisión del odontólogo</h2>
        {!selected ? <p className="text-sm text-slate-600">Elegí un reporte para leerlo y registrar tu revisión.</p> : <div className="space-y-4">
          <p className="text-sm"><strong>Paciente:</strong> #{selected.pacienteId} · <strong>Pieza:</strong> {selected.pieza}</p>
          <p className="text-sm"><strong>Dolor informado:</strong> {selected.dolor}/10</p>
          <p className="rounded-xl bg-slate-50 p-4 text-sm"><strong>Relato del paciente:</strong> {selected.sintomas}</p>
          {selected.fotoBase64 ? <img src={selected.fotoBase64} alt={`Foto aportada para el reporte ${selected.id}`} className="max-h-80 w-full rounded-xl border object-contain" />
            : <p className="flex items-center gap-2 text-sm text-slate-500"><Camera size={16} /> Sin foto adjunta.</p>}
          <a href={`/pacientes/${selected.pacienteId}/odontograma`} className="inline-block text-sm font-medium text-blue-700 underline">Abrir odontograma del paciente</a>
          {selected.estado === 'REVISADO' ? <p className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm">Revisión registrada: {selected.revisionProfesional}</p>
            : <form onSubmit={revisar} className="space-y-3">
              <label className="block text-sm font-medium">Nota profesional
                <textarea className={inputClass} required minLength={3} maxLength={2000} rows={4} value={review} onChange={event => setReview(event.target.value)} placeholder="Hallazgos para evaluar en consulta y próximos pasos" />
              </label>
              <p className="text-xs text-slate-500">La revisión queda fechada y no se edita; una evolución nueva requiere un reporte nuevo.</p>
              <button type="submit" disabled={busy} className={primaryClass}>Registrar revisión</button>
            </form>}
        </div>}
      </section>
    </div>
    {role === 'ADMINISTRADOR' && <section className="rounded-2xl border bg-white p-5 shadow-sm">
      <h2 className="mb-2 text-lg font-bold">Vincular una cuenta con un paciente existente</h2>
      <p className="mb-4 text-sm text-slate-600">Verificá la identidad del paciente antes de vincular. El sistema no vincula automáticamente por DNI o correo.</p>
      <form onSubmit={vincular} className="flex flex-wrap items-end gap-3">
        <label className="text-sm font-medium">ID de cuenta<input className={inputClass} type="number" min="1" required value={accountId} onChange={event => setAccountId(event.target.value)} /></label>
        <label className="text-sm font-medium">ID de paciente<input className={inputClass} type="number" min="1" required value={patientId} onChange={event => setPatientId(event.target.value)} /></label>
        <label className="text-sm font-medium">DNI verificado<input className={inputClass} required value={confirmedDni} onChange={event => setConfirmedDni(event.target.value)} /></label>
        <button type="submit" disabled={busy} className={primaryClass}>Vincular ficha</button>
      </form>
    </section>}
  </div>
}

const inputClass = 'mt-1.5 block min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-600'
const primaryClass = 'min-h-11 rounded-lg bg-blue-600 px-5 py-2 font-semibold text-white hover:bg-blue-700 disabled:opacity-60'
