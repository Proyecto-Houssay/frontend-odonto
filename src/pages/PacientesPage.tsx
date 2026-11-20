import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ClipboardList, Pencil, Plus, Search, Trash2, Users, X } from 'lucide-react'
import { useAuth } from '../auth/useAuth'
import { apiRequest } from '../lib/api'

type Paciente = {
  id: number
  nombre: string
  apellido: string
  dni: string
  telefono: string | null
  email: string
  fechaNacimiento: string
}

type PacienteForm = Omit<Paciente, 'id'>

const EMPTY_FORM: PacienteForm = {
  nombre: '',
  apellido: '',
  dni: '',
  telefono: '',
  email: '',
  fechaNacimiento: '',
}

export const PacientesPage = () => {
  const { session } = useAuth()
  const token = session?.token
  const [patients, setPatients] = useState<Paciente[]>([])
  const [form, setForm] = useState<PacienteForm | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const loadPatients = useCallback(async () => {
    try {
      const result = await apiRequest<Paciente[]>('/pacientes', { token })
      setPatients(Array.isArray(result) ? result : [])
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'No se pudieron cargar los pacientes.')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    apiRequest<Paciente[]>('/pacientes', { token, signal: controller.signal })
      .then(result => { if (active) setPatients(Array.isArray(result) ? result : []) })
      .catch(failure => { if (active) setError(failure instanceof Error ? failure.message : 'No se pudieron cargar los pacientes.') })
      .finally(() => { if (active) setLoading(false) })
    return () => {
      active = false
      controller.abort()
    }
  }, [token])

  const filteredPatients = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('es-AR')
    if (!query) return patients
    return patients.filter(patient => [patient.nombre, patient.apellido, patient.dni, patient.email]
      .some(value => value.toLocaleLowerCase('es-AR').includes(query)))
  }, [patients, search])

  function startCreate() {
    setEditingId(null)
    setForm({ ...EMPTY_FORM })
    setError('')
    setNotice('')
  }

  function startEdit(patient: Paciente) {
    setEditingId(patient.id)
    setForm({
      nombre: patient.nombre,
      apellido: patient.apellido,
      dni: patient.dni,
      telefono: patient.telefono || '',
      email: patient.email,
      fechaNacimiento: patient.fechaNacimiento,
    })
    setError('')
    setNotice('')
  }

  function closeForm() {
    setForm(null)
    setEditingId(null)
    setError('')
  }

  function updateForm(field: keyof PacienteForm, value: string) {
    setForm(current => current ? { ...current, [field]: value } : current)
  }

  async function savePatient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!form || !session?.token) return
    setSaving(true)
    setError('')
    setNotice('')
    const body: PacienteForm = {
      nombre: form.nombre.trim(),
      apellido: form.apellido.trim(),
      dni: form.dni.trim(),
      telefono: form.telefono?.trim() || null,
      email: form.email.trim(),
      fechaNacimiento: form.fechaNacimiento,
    }
    try {
      if (editingId === null) {
        await apiRequest<string>('/pacientes', { method: 'POST', token: session.token, body })
        setNotice('Paciente creado correctamente.')
      } else {
        await apiRequest<Paciente>(`/pacientes/${editingId}`, { method: 'PUT', token: session.token, body })
        setNotice('Paciente actualizado correctamente.')
      }
      setForm(null)
      setEditingId(null)
      await loadPatients()
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'No se pudo guardar el paciente.')
    } finally {
      setSaving(false)
    }
  }

  async function deletePatient(patient: Paciente) {
    if (!session?.token || !window.confirm(`¿Eliminar al paciente ${patient.nombre} ${patient.apellido}?`)) return
    setError('')
    setNotice('')
    try {
      await apiRequest<void>(`/pacientes/${patient.id}`, { method: 'DELETE', token: session.token })
      setNotice('Paciente eliminado correctamente.')
      await loadPatients()
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'No se pudo eliminar el paciente.')
    }
  }

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold text-slate-800">
            <Users aria-hidden="true" className="h-7 w-7 text-blue-600" /> Gestión de Pacientes
          </h2>
          <p className="mt-1 text-sm text-slate-500">Pacientes conectados a la base de datos del backend.</p>
        </div>
        <button type="button" onClick={startCreate} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 font-medium text-white shadow-sm transition-colors hover:bg-blue-700">
          <Plus aria-hidden="true" className="h-5 w-5" /> Nuevo Paciente
        </button>
      </header>

      {error ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p> : null}
      {notice ? <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</p> : null}

      {form ? (
        <form onSubmit={savePatient} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center justify-between gap-4">
            <h3 className="text-lg font-semibold text-slate-800">{editingId === null ? 'Registrar paciente' : `Editar paciente #${editingId}`}</h3>
            <button type="button" onClick={closeForm} aria-label="Cerrar formulario" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X aria-hidden="true" className="h-5 w-5" /></button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <label className="text-sm font-medium text-slate-700">Nombre
              <input required maxLength={255} autoComplete="given-name" className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 px-3" value={form.nombre} onChange={event => updateForm('nombre', event.target.value)} />
            </label>
            <label className="text-sm font-medium text-slate-700">Apellido
              <input required maxLength={255} autoComplete="family-name" className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 px-3" value={form.apellido} onChange={event => updateForm('apellido', event.target.value)} />
            </label>
            <label className="text-sm font-medium text-slate-700">DNI
              <input required maxLength={255} inputMode="numeric" className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 px-3" value={form.dni} onChange={event => updateForm('dni', event.target.value)} />
            </label>
            <label className="text-sm font-medium text-slate-700">Teléfono
              <input maxLength={255} autoComplete="tel" className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 px-3" value={form.telefono || ''} onChange={event => updateForm('telefono', event.target.value)} />
            </label>
            <label className="text-sm font-medium text-slate-700">Correo electrónico
              <input required type="email" maxLength={255} autoComplete="email" className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 px-3" value={form.email} onChange={event => updateForm('email', event.target.value)} />
            </label>
            <label className="text-sm font-medium text-slate-700">Fecha de nacimiento
              <input required type="date" max={new Date().toISOString().slice(0, 10)} className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 px-3" value={form.fechaNacimiento} onChange={event => updateForm('fechaNacimiento', event.target.value)} />
            </label>
          </div>
          <p className="text-xs text-slate-500">Nombre, apellido, DNI, correo y fecha de nacimiento son obligatorios. El DNI no puede estar repetido.</p>
          <div className="flex flex-wrap gap-3">
            <button disabled={saving} type="submit" className="min-h-11 rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700 disabled:opacity-60">{saving ? 'Guardando…' : editingId === null ? 'Guardar paciente' : 'Guardar cambios'}</button>
            <button disabled={saving} type="button" onClick={closeForm} className="min-h-11 rounded-lg border border-slate-300 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50">Cancelar</button>
          </div>
        </form>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-semibold text-slate-800">Pacientes registrados</h3>
            <p className="text-sm text-slate-500">{patients.length} en la base conectada</p>
          </div>
          <label className="relative block w-full sm:max-w-sm">
            <Search aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input aria-label="Buscar pacientes" className="min-h-10 w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3" placeholder="Buscar nombre, DNI o correo" value={search} onChange={event => setSearch(event.target.value)} />
          </label>
        </div>
        {loading ? <p role="status" className="p-8 text-center text-sm text-slate-500">Cargando pacientes…</p> : patients.length === 0 ? <p className="p-8 text-center text-sm text-slate-500">No hay pacientes registrados.</p> : filteredPatients.length === 0 ? <p className="p-8 text-center text-sm text-slate-500">No hay pacientes que coincidan con la búsqueda.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr><th className="px-4 py-3">Paciente</th><th className="px-4 py-3">DNI</th><th className="px-4 py-3">Contacto</th><th className="px-4 py-3">Nacimiento</th><th className="px-4 py-3">Acciones</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPatients.map(patient => (
                  <tr key={patient.id} className="text-slate-700">
                    <td className="px-4 py-3"><span className="block font-semibold text-slate-900">{patient.nombre} {patient.apellido}</span><span className="text-xs text-slate-500">ID {patient.id}</span></td>
                    <td className="px-4 py-3">{patient.dni}</td>
                    <td className="px-4 py-3"><span className="block">{patient.email}</span><span className="text-xs text-slate-500">{patient.telefono || 'Sin teléfono'}</span></td>
                    <td className="px-4 py-3">{patient.fechaNacimiento}</td>
                    <td className="px-4 py-3"><div className="flex items-center gap-2">
                      <button type="button" aria-label={`Editar ${patient.nombre} ${patient.apellido}`} onClick={() => startEdit(patient)} className="rounded-lg p-2 text-blue-700 hover:bg-blue-50"><Pencil aria-hidden="true" className="h-4 w-4" /></button>
                      <button type="button" aria-label={`Eliminar ${patient.nombre} ${patient.apellido}`} onClick={() => void deletePatient(patient)} className="rounded-lg p-2 text-red-700 hover:bg-red-50"><Trash2 aria-hidden="true" className="h-4 w-4" /></button>
                      <Link to={`/pacientes/${patient.id}/odontograma`} aria-label={`Abrir odontograma de ${patient.nombre} ${patient.apellido}`} className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-blue-700 hover:bg-blue-50"><ClipboardList aria-hidden="true" className="h-4 w-4" /><span>Odontograma</span></Link>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}
