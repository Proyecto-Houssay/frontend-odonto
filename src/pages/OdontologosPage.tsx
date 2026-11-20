import React, { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  Award,
  CalendarDays,
  CheckCircle2,
  Eye,
  EyeOff,
  Mail,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Stethoscope,
  Trash2,
  X,
  XCircle,
} from 'lucide-react'
import { useAuth } from '../auth/useAuth'
import { apiRequest } from '../lib/api'

export type Especialidad = {
  id: number
  nombre: string
  descripcion?: string | null
}

export type Odontologo = {
  id: number
  nombre: string
  apellido: string
  matricula: string
  email?: string | null
  telefono?: string | null
  consultorio?: string | null
  usuarioId?: number | null
  activo?: boolean
  especialidad?: Especialidad | null
}

type TurnoAgenda = {
  id: number
  fecha: string
  hora: string
  estado: string
  odontologo?: { id: number; nombre?: string; apellido?: string } | null
}

type OdontologoFormState = {
  nombre: string
  apellido: string
  matricula: string
  email: string
  telefono: string
  consultorio: string
  activo: boolean
  especialidadId: string
  nuevaEspecialidadNombre: string
  crearCuentaUsuario: boolean
  username: string
  password: string
}

const EMPTY_FORM: OdontologoFormState = {
  nombre: '',
  apellido: '',
  matricula: '',
  email: '',
  telefono: '',
  consultorio: '',
  activo: true,
  especialidadId: '',
  nuevaEspecialidadNombre: '',
  crearCuentaUsuario: false,
  username: '',
  password: '',
}

const SUGGESTED_SPECIALTIES = [
  { nombre: 'Odontología General', descripcion: 'Diagnóstico integral, controles preventivos y restauraciones.' },
  { nombre: 'Ortodoncia', descripcion: 'Alineación dental y corrección oclusal.' },
  { nombre: 'Endodoncia', descripcion: 'Tratamientos de conducto radicular y urgencias pulpares.' },
  { nombre: 'Implantología', descripcion: 'Rehabilitación protésica e implantes osteointegrados.' },
  { nombre: 'Odontopediatría', descripcion: 'Atención odontológica integral para niños y adolescentes.' },
  { nombre: 'Periodoncia', descripcion: 'Prevención y tratamiento de encías y tejidos de soporte.' },
]

export const OdontologosPage: React.FC = () => {
  const { session } = useAuth()
  const token = session?.token || ''
  const canManage = !session?.role || session.role === 'ADMINISTRADOR'

  const [dentists, setDentists] = useState<Odontologo[]>([])
  const [especialidades, setEspecialidades] = useState<Especialidad[]>([])
  const [turnos, setTurnos] = useState<TurnoAgenda[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const [search, setSearch] = useState('')
  const [specialtyFilter, setSpecialtyFilter] = useState<string>('TODAS')
  const [statusFilter, setStatusFilter] = useState<'TODOS' | 'ACTIVOS' | 'INACTIVOS'>('TODOS')

  const [form, setForm] = useState<OdontologoFormState | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)

  const [showSpecialtiesModal, setShowSpecialtiesModal] = useState(false)
  const [newSpecialtyName, setNewSpecialtyName] = useState('')
  const [newSpecialtyDesc, setNewSpecialtyDesc] = useState('')
  const [specialtyBusy, setSpecialtyBusy] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const loadData = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    setError('')
    try {
      const [dentistsRes, espRes, turnosRes] = await Promise.allSettled([
        apiRequest<Odontologo[]>('/odontologos', { token, signal }),
        apiRequest<Especialidad[]>('/especialidades', { token, signal }),
        apiRequest<TurnoAgenda[]>('/turnos', { token, signal }),
      ])

      if (dentistsRes.status === 'fulfilled') {
        setDentists(Array.isArray(dentistsRes.value) ? dentistsRes.value : [])
      } else {
        const reason = dentistsRes.reason
        if (reason instanceof DOMException && reason.name === 'AbortError') return
        throw reason
      }

      if (espRes.status === 'fulfilled' && Array.isArray(espRes.value)) {
        setEspecialidades(espRes.value)
      }

      if (turnosRes.status === 'fulfilled' && Array.isArray(turnosRes.value)) {
        setTurnos(turnosRes.value)
      }
    } catch (failure) {
      if (failure instanceof DOMException && failure.name === 'AbortError') return
      setError(failure instanceof Error ? failure.message : 'No se pudo cargar el plantel de odontólogos.')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    const controller = new AbortController()
    void loadData(controller.signal)
    return () => controller.abort()
  }, [loadData])

  const turnosCountByDentist = useMemo(() => {
    const counts = new Map<number, number>()
    for (const turno of turnos) {
      if (turno.estado === 'CANCELADO') continue
      const dentistId = turno.odontologo?.id
      if (typeof dentistId === 'number') {
        counts.set(dentistId, (counts.get(dentistId) || 0) + 1)
      }
    }
    return counts
  }, [turnos])

  const filteredDentists = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('es-AR')
    return dentists.filter(dentist => {
      const isActive = dentist.activo !== false
      if (statusFilter === 'ACTIVOS' && !isActive) return false
      if (statusFilter === 'INACTIVOS' && isActive) return false
      if (
        specialtyFilter !== 'TODAS' &&
        String(dentist.especialidad?.id || '') !== specialtyFilter
      ) {
        return false
      }
      if (!query) return true
      return [
        dentist.nombre,
        dentist.apellido,
        `${dentist.nombre} ${dentist.apellido}`,
        dentist.matricula,
        dentist.email || '',
        dentist.especialidad?.nombre || '',
      ].some(value => value.toLocaleLowerCase('es-AR').includes(query))
    })
  }, [dentists, search, specialtyFilter, statusFilter])

  const kpis = useMemo(() => {
    const activos = dentists.filter(d => d.activo !== false).length
    const activeTurnos = turnos.filter(t => t.estado !== 'CANCELADO').length
    return {
      total: dentists.length,
      activos,
      especialidades: especialidades.length,
      turnosAsignados: activeTurnos,
    }
  }, [dentists, especialidades, turnos])

  function startCreateDentist() {
    setEditingId(null)
    setForm({
      ...EMPTY_FORM,
      especialidadId: especialidades[0] ? String(especialidades[0].id) : '',
    })
    setError('')
    setNotice('')
  }

  function startEditDentist(dentist: Odontologo) {
    setEditingId(dentist.id)
    setForm({
      nombre: dentist.nombre,
      apellido: dentist.apellido,
      matricula: dentist.matricula,
      email: dentist.email || '',
      telefono: dentist.telefono || '',
      consultorio: dentist.consultorio || '',
      activo: dentist.activo !== false,
      especialidadId: dentist.especialidad?.id ? String(dentist.especialidad.id) : '',
      nuevaEspecialidadNombre: '',
      crearCuentaUsuario: false,
      username: '',
      password: '',
    })
    setError('')
    setNotice('')
  }

  function closeForm() {
    setForm(null)
    setEditingId(null)
  }

  async function handleSaveDentist(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!form) return
    setSaving(true)
    setError('')
    setNotice('')

    const useAltaCompleta =
      editingId === null &&
      (form.crearCuentaUsuario || (form.especialidadId === 'NUEVA' && form.nuevaEspecialidadNombre.trim().length > 0))

    const body = {
      nombre: form.nombre.trim(),
      apellido: form.apellido.trim(),
      matricula: form.matricula.trim(),
      email: form.email.trim() || null,
      telefono: form.telefono.trim() || null,
      ...(form.consultorio.trim() ? { consultorio: form.consultorio.trim() } : {}),
      activo: form.activo,
      especialidad: form.especialidadId && form.especialidadId !== 'NUEVA' ? { id: Number(form.especialidadId) } : null,
    }

    try {
      if (editingId === null) {
        if (useAltaCompleta) {
          const created = await apiRequest<Odontologo>('/odontologos/alta-completa', {
            method: 'POST',
            token,
            body: {
              nombre: form.nombre.trim(),
              apellido: form.apellido.trim(),
              matricula: form.matricula.trim(),
              email: form.email.trim() || null,
              telefono: form.telefono.trim() || null,
              consultorio: form.consultorio.trim() || null,
              activo: form.activo,
              especialidadId:
                form.especialidadId && form.especialidadId !== 'NUEVA' ? Number(form.especialidadId) : null,
              nuevaEspecialidadNombre:
                form.especialidadId === 'NUEVA' ? form.nuevaEspecialidadNombre.trim() : null,
              crearCuentaUsuario: form.crearCuentaUsuario,
              username: form.crearCuentaUsuario ? form.username.trim() : null,
              password: form.crearCuentaUsuario ? form.password : null,
            },
          })
          if (created && typeof created === 'object' && 'id' in created) {
            setDentists(current => [...current, created])
          }
          setNotice(
            form.crearCuentaUsuario
              ? `Profesional Dr./Dra. ${body.nombre} ${body.apellido} y cuenta de acceso "${form.username.trim()}" registrados correctamente.`
              : `Profesional Dr./Dra. ${body.nombre} ${body.apellido} registrado correctamente.`
          )
        } else {
          const created = await apiRequest<Odontologo>('/odontologos', {
            method: 'POST',
            token,
            body,
          })
          if (created && typeof created === 'object' && 'id' in created) {
            setDentists(current => [...current, created])
          }
          setNotice(`Profesional Dr./Dra. ${body.nombre} ${body.apellido} registrado correctamente.`)
        }
      } else {
        const updated = await apiRequest<Odontologo>(`/odontologos/${editingId}`, {
          method: 'PUT',
          token,
          body,
        })
        if (updated && typeof updated === 'object' && 'id' in updated) {
          setDentists(current => current.map(item => (item.id === editingId ? updated : item)))
        }
        setNotice(`Ficha profesional de Dr./Dra. ${body.nombre} ${body.apellido} actualizada.`)
      }
      closeForm()
      await loadData()
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'No se pudo guardar el profesional.')
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleActive(dentist: Odontologo) {
    const currentActive = dentist.activo !== false
    setError('')
    setNotice('')
    try {
      const updated = await apiRequest<Odontologo>(`/odontologos/${dentist.id}`, {
        method: 'PUT',
        token,
        body: {
          nombre: dentist.nombre,
          apellido: dentist.apellido,
          matricula: dentist.matricula,
          email: dentist.email || null,
          telefono: dentist.telefono || null,
          activo: !currentActive,
          especialidad: dentist.especialidad?.id ? { id: dentist.especialidad.id } : null,
        },
      })
      setDentists(current => current.map(item => (item.id === dentist.id ? updated : item)))
      setNotice(
        `Dr./Dra. ${dentist.nombre} ${dentist.apellido} ahora figura como ${!currentActive ? 'Activo' : 'Inactivo'}.`
      )
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'No se pudo actualizar el estado del profesional.')
    }
  }

  async function handleDeleteDentist(dentist: Odontologo) {
    if (!window.confirm(`¿Confirmás eliminar a Dr./Dra. ${dentist.nombre} ${dentist.apellido} (MP ${dentist.matricula})?`)) {
      return
    }
    setError('')
    setNotice('')
    try {
      await apiRequest<void>(`/odontologos/${dentist.id}`, {
        method: 'DELETE',
        token,
      })
      setDentists(current => current.filter(item => item.id !== dentist.id))
      setNotice(`Profesional Dr./Dra. ${dentist.nombre} ${dentist.apellido} eliminado del padrón.`)
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'No se pudo eliminar el profesional.')
    }
  }

  async function handleCreateSpecialty(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!newSpecialtyName.trim()) return
    setSpecialtyBusy(true)
    setError('')
    setNotice('')
    try {
      const created = await apiRequest<Especialidad>('/especialidades', {
        method: 'POST',
        token,
        body: {
          nombre: newSpecialtyName.trim(),
          descripcion: newSpecialtyDesc.trim() || null,
        },
      })
      setEspecialidades(current => [...current, created])
      setNewSpecialtyName('')
      setNewSpecialtyDesc('')
      setNotice(`Especialidad "${created.nombre}" registrada correctamente.`)
      if (form && !form.especialidadId) {
        setForm({ ...form, especialidadId: String(created.id) })
      }
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'No se pudo crear la especialidad.')
    } finally {
      setSpecialtyBusy(false)
    }
  }

  async function handleDeleteSpecialty(especialidad: Especialidad) {
    if (!window.confirm(`¿Confirmás eliminar la especialidad "${especialidad.nombre}"?`)) {
      return
    }
    setError('')
    setNotice('')
    try {
      await apiRequest<void>(`/especialidades/${especialidad.id}`, {
        method: 'DELETE',
        token,
      })
      setEspecialidades(current => current.filter(item => item.id !== especialidad.id))
      setNotice(`Especialidad "${especialidad.nombre}" eliminada.`)
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'No se pudo eliminar la especialidad.')
    }
  }

  return (
    <div className="space-y-6">
      {/* Encabezado principal */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-2xl border border-white/70 bg-white/85 p-5 shadow-md shadow-blue-950/5 backdrop-blur-xl">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-indigo-700">
            Dirección Médica · Plantel Clínico
          </p>
          <h2 className="mt-1 text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <Stethoscope className="w-7 h-7 text-indigo-600" />
            Equipo de Odontólogos
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Gestión del plantel profesional, matrículas, especialidades y carga de agenda.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => void loadData()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Recargar
          </button>

          {canManage && (
            <>
              <button
                type="button"
                onClick={() => setShowSpecialtiesModal(prev => !prev)}
                className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3.5 py-2.5 text-sm font-semibold text-indigo-800 hover:bg-indigo-100 transition-colors"
              >
                <Award className="w-4 h-4" />
                Gestionar Especialidades
              </button>
              <button
                type="button"
                onClick={startCreateDentist}
                className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-2.5 rounded-xl shadow-xs transition-colors"
              >
                <Plus className="w-5 h-5" />
                + Registrar Odontólogo
              </button>
            </>
          )}
        </div>
      </div>

      {/* Alertas */}
      {error && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 flex items-center justify-between gap-3">
          <span>{error}</span>
          <button type="button" onClick={() => setError('')} className="text-red-600 hover:text-red-900" aria-label="Cerrar error">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {notice && (
        <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 flex items-center justify-between gap-3">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice('')} className="text-emerald-700 hover:text-emerald-950" aria-label="Cerrar aviso">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Tarjetas KPI */}
      <section aria-label="Indicadores del plantel odontológico" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <div className="rounded-xl border border-white/70 bg-white/85 p-4 shadow-xs">
          <p className="text-xs font-semibold text-slate-500">Total profesionales</p>
          <p className="mt-1 text-2xl font-extrabold text-slate-900" data-testid="kpi-total-dentists">{kpis.total}</p>
        </div>
        <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-4 shadow-xs">
          <p className="text-xs font-semibold text-emerald-800">Profesionales activos</p>
          <p className="mt-1 text-2xl font-extrabold text-emerald-950" data-testid="kpi-active-dentists">{kpis.activos}</p>
        </div>
        <div className="rounded-xl border border-indigo-100 bg-indigo-50/70 p-4 shadow-xs">
          <p className="text-xs font-semibold text-indigo-800">Especialidades registradas</p>
          <p className="mt-1 text-2xl font-extrabold text-indigo-950" data-testid="kpi-specialties">{kpis.especialidades}</p>
        </div>
        <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-4 shadow-xs">
          <p className="text-xs font-semibold text-blue-800">Turnos asignados en agenda</p>
          <p className="mt-1 text-2xl font-extrabold text-blue-950" data-testid="kpi-assigned-appointments">{kpis.turnosAsignados}</p>
        </div>
      </section>

      {/* Panel de Gestión de Especialidades */}
      {showSpecialtiesModal && canManage && (
        <section
          aria-label="Gestión de especialidades odontológicas"
          className="rounded-2xl border border-indigo-200 bg-white p-5 shadow-lg space-y-4"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Award className="w-5 h-5 text-indigo-600" />
                Catálogo de Especialidades Odontológicas
              </h3>
              <p className="text-xs text-slate-600">
                Creá o administrá las especialidades clínicas disponibles para asignar al plantel profesional.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowSpecialtiesModal(false)}
              className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"
              aria-label="Cerrar panel de especialidades"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-600">Sugerencias rápidas:</p>
            <div className="flex flex-wrap gap-1.5">
              {SUGGESTED_SPECIALTIES.map(preset => (
                <button
                  key={preset.nombre}
                  type="button"
                  onClick={() => {
                    setNewSpecialtyName(preset.nombre)
                    setNewSpecialtyDesc(preset.descripcion)
                  }}
                  className="rounded-lg border border-indigo-200 bg-indigo-50/70 px-2.5 py-1 text-xs font-semibold text-indigo-800 hover:bg-indigo-100"
                >
                  + {preset.nombre}
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleCreateSpecialty} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            <div>
              <label htmlFor="esp-nombre" className="block text-xs font-bold text-slate-700 mb-1">
                Nombre de la especialidad
              </label>
              <input
                id="esp-nombre"
                required
                value={newSpecialtyName}
                onChange={e => setNewSpecialtyName(e.target.value)}
                placeholder="Ej. Endodoncia"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-indigo-600 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="esp-descripcion" className="block text-xs font-bold text-slate-700 mb-1">
                Descripción
              </label>
              <input
                id="esp-descripcion"
                value={newSpecialtyDesc}
                onChange={e => setNewSpecialtyDesc(e.target.value)}
                placeholder="Alcance clínico de la especialidad"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-indigo-600 focus:outline-none"
              />
            </div>

            <div>
              <button
                type="submit"
                disabled={specialtyBusy || !newSpecialtyName.trim()}
                className="w-full rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {specialtyBusy ? 'Guardando…' : 'Agregar especialidad'}
              </button>
            </div>
          </form>

          {especialidades.length === 0 ? (
            <p className="text-xs text-slate-500 italic">No hay especialidades registradas todavía.</p>
          ) : (
            <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-2">
              {especialidades.map(esp => {
                const assignedCount = dentists.filter(d => d.especialidad?.id === esp.id).length
                return (
                  <li
                    key={esp.id}
                    className="flex items-start justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50/80 p-3 text-xs"
                  >
                    <div>
                      <p className="font-bold text-slate-900">{esp.nombre}</p>
                      {esp.descripcion && <p className="text-slate-600 mt-0.5">{esp.descripcion}</p>}
                      <p className="mt-1 font-semibold text-indigo-700">{assignedCount} profesional(es)</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleDeleteSpecialty(esp)}
                      aria-label={`Eliminar especialidad ${esp.nombre}`}
                      className="rounded-lg p-1.5 text-rose-600 hover:bg-rose-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      )}

      {/* Formulario de alta / edición de odontólogo */}
      {form && canManage && (
        <section
          aria-label={editingId === null ? 'Registrar odontólogo' : 'Editar odontólogo'}
          className="rounded-2xl border border-indigo-200 bg-white p-5 shadow-lg space-y-4"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Stethoscope className="w-5 h-5 text-indigo-600" />
              {editingId === null ? 'Registrar Nuevo Odontólogo' : 'Editar Ficha de Odontólogo'}
            </h3>
            <button
              type="button"
              onClick={closeForm}
              className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"
              aria-label="Cerrar formulario"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSaveDentist} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label htmlFor="dentist-nombre" className="block text-xs font-bold text-slate-700 mb-1">
                Nombre
              </label>
              <input
                id="dentist-nombre"
                required
                value={form.nombre}
                onChange={e => setForm({ ...form, nombre: e.target.value })}
                placeholder="Ej. Martín"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-indigo-600 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="dentist-apellido" className="block text-xs font-bold text-slate-700 mb-1">
                Apellido
              </label>
              <input
                id="dentist-apellido"
                required
                value={form.apellido}
                onChange={e => setForm({ ...form, apellido: e.target.value })}
                placeholder="Ej. Sánchez"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-indigo-600 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="dentist-matricula" className="block text-xs font-bold text-slate-700 mb-1">
                Matrícula profesional
              </label>
              <input
                id="dentist-matricula"
                required
                value={form.matricula}
                onChange={e => setForm({ ...form, matricula: e.target.value })}
                placeholder="Ej. MN-45892"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-indigo-600 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="dentist-especialidad" className="block text-xs font-bold text-slate-700 mb-1">
                Especialidad
              </label>
              <select
                id="dentist-especialidad"
                required
                value={form.especialidadId}
                onChange={e => setForm({ ...form, especialidadId: e.target.value })}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-600 focus:outline-none"
              >
                <option value="">Seleccionar especialidad…</option>
                {especialidades.map(esp => (
                  <option key={esp.id} value={String(esp.id)}>
                    {esp.nombre}
                  </option>
                ))}
                {editingId === null && (
                  <option value="NUEVA">+ Crear nueva especialidad…</option>
                )}
              </select>
            </div>

            {editingId === null && form.especialidadId === 'NUEVA' && (
              <div>
                <label htmlFor="dentist-nueva-especialidad" className="block text-xs font-bold text-indigo-700 mb-1">
                  Nombre de la nueva especialidad
                </label>
                <input
                  id="dentist-nueva-especialidad"
                  required
                  value={form.nuevaEspecialidadNombre}
                  onChange={e => setForm({ ...form, nuevaEspecialidadNombre: e.target.value })}
                  placeholder="Ej. Implantología"
                  className="w-full rounded-xl border border-indigo-300 bg-indigo-50/40 px-3 py-2 text-sm focus:border-indigo-600 focus:outline-none"
                />
              </div>
            )}

            <div>
              <label htmlFor="dentist-email" className="block text-xs font-bold text-slate-700 mb-1">
                Correo electrónico
              </label>
              <input
                id="dentist-email"
                type="email"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                placeholder="msanchez@novadent.com"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-indigo-600 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="dentist-telefono" className="block text-xs font-bold text-slate-700 mb-1">
                Teléfono
              </label>
              <input
                id="dentist-telefono"
                value={form.telefono}
                onChange={e => setForm({ ...form, telefono: e.target.value })}
                placeholder="11 5566-7788"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-indigo-600 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="dentist-consultorio" className="block text-xs font-bold text-slate-700 mb-1">
                Consultorio / Box
              </label>
              <input
                id="dentist-consultorio"
                value={form.consultorio}
                onChange={e => setForm({ ...form, consultorio: e.target.value })}
                placeholder="Ej. Box 1"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-indigo-600 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <input
                id="dentist-activo"
                type="checkbox"
                checked={form.activo}
                onChange={e => setForm({ ...form, activo: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <label htmlFor="dentist-activo" className="text-sm font-medium text-slate-800">
                Profesional activo para asignación de turnos
              </label>
            </div>

            {editingId === null && (
              <div className="sm:col-span-2 lg:col-span-3 rounded-xl border border-indigo-200 bg-indigo-50/50 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <input
                    id="dentist-crear-cuenta"
                    type="checkbox"
                    checked={form.crearCuentaUsuario}
                    onChange={e => setForm({ ...form, crearCuentaUsuario: e.target.checked })}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <label htmlFor="dentist-crear-cuenta" className="text-sm font-bold text-indigo-950">
                    Crear cuenta de acceso (login) como Odontólogo
                  </label>
                </div>
                {form.crearCuentaUsuario && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div>
                      <label htmlFor="dentist-username" className="block text-xs font-bold text-slate-700 mb-1">
                        Usuario de acceso (login)
                      </label>
                      <input
                        id="dentist-username"
                        required
                        value={form.username}
                        onChange={e => setForm({ ...form, username: e.target.value })}
                        placeholder="Ej. dra.paz"
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-600 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label htmlFor="dentist-password" className="block text-xs font-bold text-slate-700 mb-1">
                        Contraseña inicial
                      </label>
                      <div className="relative">
                        <input
                          id="dentist-password"
                          type={showPassword ? 'text' : 'password'}
                          required
                          minLength={6}
                          value={form.password}
                          onChange={e => setForm({ ...form, password: e.target.value })}
                          placeholder="Mínimo 6 caracteres"
                          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 pr-10 text-sm focus:border-indigo-600 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(v => !v)}
                          aria-label={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-800"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="sm:col-span-2 lg:col-span-3 flex justify-end gap-2.5 border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={closeForm}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {saving ? 'Guardando…' : editingId === null ? 'Guardar odontólogo' : 'Guardar cambios'}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Filtros y búsqueda */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 rounded-2xl border border-white/70 bg-white/85 p-4 shadow-xs">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            aria-label="Buscar odontólogos"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre, apellido, matrícula o especialidad..."
            className="w-full rounded-xl border border-slate-300 bg-white pl-10 pr-4 py-2 text-sm focus:border-indigo-600 focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Filtrar por especialidad"
            value={specialtyFilter}
            onChange={e => setSpecialtyFilter(e.target.value)}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
          >
            <option value="TODAS">Todas las especialidades</option>
            {especialidades.map(esp => (
              <option key={esp.id} value={String(esp.id)}>
                {esp.nombre}
              </option>
            ))}
          </select>

          <div className="flex gap-1" role="group" aria-label="Filtrar por estado">
            {(['TODOS', 'ACTIVOS', 'INACTIVOS'] as const).map(status => (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                  statusFilter === status
                    ? 'bg-indigo-600 text-white'
                    : 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                }`}
              >
                {status === 'TODOS' ? 'Todos' : status === 'ACTIVOS' ? 'Activos' : 'Inactivos'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Listado de odontólogos */}
      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          Cargando plantel de odontólogos…
        </div>
      ) : filteredDentists.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center space-y-2">
          <Stethoscope className="w-8 h-8 text-slate-400 mx-auto" />
          <p className="text-sm font-semibold text-slate-700">
            No se encontraron profesionales para los criterios seleccionados.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredDentists.map(dentist => {
            const isActive = dentist.activo !== false
            const assignedTurnos = turnosCountByDentist.get(dentist.id) || 0

            return (
              <article
                key={dentist.id}
                className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white/90 p-5 shadow-xs hover:shadow-md transition-shadow space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-base font-bold text-slate-900">
                        Dr./Dra. {dentist.nombre} {dentist.apellido}
                      </h3>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-700">
                          MP {dentist.matricula}
                        </span>
                        <span className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-800">
                          {dentist.especialidad?.nombre || 'Odontología General'}
                        </span>
                      </div>
                    </div>

                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {isActive ? (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5" />
                      )}
                      {isActive ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-600 border-t border-slate-100 pt-3">
                    <p className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-slate-400" />
                      <span>{dentist.email || 'Sin correo registrado'}</span>
                    </p>
                    <p className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      <span>{dentist.telefono || 'Sin teléfono registrado'}</span>
                    </p>
                    <div className="flex items-center justify-between pt-1">
                      <span className="inline-flex items-center gap-1.5 font-semibold text-blue-800">
                        <CalendarDays className="w-3.5 h-3.5 text-blue-600" />
                        {assignedTurnos} turno(s) activo(s)
                      </span>
                      <Link
                        to="/turnos"
                        className="text-xs font-semibold text-indigo-600 hover:underline"
                      >
                        Ver agenda →
                      </Link>
                    </div>
                  </div>
                </div>

                {canManage && (
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
                    <button
                      type="button"
                      onClick={() => void handleToggleActive(dentist)}
                      className="text-xs font-semibold text-indigo-700 hover:underline"
                    >
                      {isActive ? 'Desactivar' : 'Activar'}
                    </button>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => startEditDentist(dentist)}
                        aria-label={`Editar ${dentist.nombre} ${dentist.apellido}`}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDeleteDentist(dentist)}
                        aria-label={`Eliminar ${dentist.nombre} ${dentist.apellido}`}
                        className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Eliminar
                      </button>
                    </div>
                  </div>
                )}
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
