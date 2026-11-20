import React, { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  BadgeCheck,
  Briefcase,
  Building2,
  CheckCircle2,
  Clock,
  Contact2,
  Eye,
  EyeOff,
  Mail,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  UserMinus,
  Users,
  X,
  XCircle,
} from 'lucide-react'
import { useAuth } from '../auth/useAuth'
import { apiRequest } from '../lib/api'

export type CargoPersonal =
  | 'RECEPCIONISTA'
  | 'ASISTENTE_DENTAL'
  | 'SECRETARIO'
  | 'ADMINISTRATIVO'
  | 'MANTENIMIENTO'
  | 'LABORATORIO'

export type EstadoPersonal = 'ACTIVO' | 'INACTIVO'

export type TipoPersonaDirectorio = 'PERSONAL' | 'MEDICO' | 'PACIENTE'

export type PersonalItem = {
  id: number
  nombre: string
  apellido: string
  dni: string
  email?: string | null
  telefono?: string | null
  cargo: CargoPersonal
  cargoLegible?: string | null
  fechaIngreso?: string | null
  horarioLaboral?: string | null
  estado?: EstadoPersonal
  activo?: boolean
  usuarioId?: number | null
}

export type DirectorioItem = {
  id?: number
  identificador?: number
  tipoPersona?: TipoPersonaDirectorio | string
  tipo?: TipoPersonaDirectorio | string
  nombreCompleto: string
  dni?: string | null
  rolOCargo?: string | null
  email?: string | null
  telefono?: string | null
  estado?: string
  activo?: boolean
  detalleAdicional?: string | null
  detalle?: string | null
}

type EspecialidadOption = {
  id: number
  nombre: string
}

type PersonalFormCargo = CargoPersonal | 'ODONTOLOGO'

type PersonalFormState = {
  nombre: string
  apellido: string
  dni: string
  email: string
  telefono: string
  cargo: PersonalFormCargo
  fechaIngreso: string
  horarioLaboral: string
  estado: EstadoPersonal
  matricula: string
  consultorio: string
  especialidadId: string
  nuevaEspecialidadNombre: string
  username: string
  password: string
}

const CARGOS_PERSONAL: Array<{ value: CargoPersonal; label: string }> = [
  { value: 'RECEPCIONISTA', label: 'Recepcionista' },
]

const CARGO_LABELS: Record<string, string> = {
  RECEPCIONISTA: 'Recepcionista',
  ASISTENTE_DENTAL: 'Asistente Dental',
  SECRETARIO: 'Secretario/a',
  ADMINISTRATIVO: 'Administrativo/a',
  MANTENIMIENTO: 'Mantenimiento',
  LABORATORIO: 'Mecánico Dental / Laboratorio',
}

const TIPO_BADGE_STYLES: Record<string, string> = {
  PERSONAL: 'bg-amber-100 text-amber-800 border-amber-200',
  MEDICO: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  PACIENTE: 'bg-emerald-100 text-emerald-800 border-emerald-200',
}

const TIPO_FILTERS: Array<{ value: 'TODOS' | TipoPersonaDirectorio; label: string }> = [
  { value: 'TODOS', label: 'Todos' },
  { value: 'PERSONAL', label: 'Personal' },
  { value: 'MEDICO', label: 'Médicos / Odontólogos' },
  { value: 'PACIENTE', label: 'Pacientes' },
]

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10)
}

function resolvePersonalEstado(person: PersonalItem): EstadoPersonal {
  if (person.estado) return person.estado
  return person.activo === false ? 'INACTIVO' : 'ACTIVO'
}

function resolveDirectorioTipo(item: DirectorioItem): string {
  return (item.tipoPersona || item.tipo || 'PERSONAL').toUpperCase()
}

function resolveDirectorioEstado(item: DirectorioItem): string {
  if (item.estado) return item.estado
  return item.activo === false ? 'INACTIVO' : 'ACTIVO'
}

const EMPTY_FORM: PersonalFormState = {
  nombre: '',
  apellido: '',
  dni: '',
  email: '',
  telefono: '',
  cargo: 'RECEPCIONISTA',
  fechaIngreso: todayIsoDate(),
  horarioLaboral: 'Lunes a Viernes 08:00 - 16:00',
  estado: 'ACTIVO',
  matricula: '',
  consultorio: '',
  especialidadId: '',
  nuevaEspecialidadNombre: '',
  username: '',
  password: '',
}

export const PersonalPage: React.FC = () => {
  const { session } = useAuth()
  const token = session?.token || ''
  const isAdmin = !session?.role || session.role === 'ADMINISTRADOR'

  const [activeTab, setActiveTab] = useState<'DIRECTORIO' | 'PERSONAL'>('DIRECTORIO')

  // Estado del Directorio Unificado
  const [directorioItems, setDirectorioItems] = useState<DirectorioItem[]>([])
  const [directorioSearch, setDirectorioSearch] = useState('')
  const [directorioTipo, setDirectorioTipo] = useState<'TODOS' | TipoPersonaDirectorio>('TODOS')

  // Estado de Gestión de Personal
  const [personalList, setPersonalList] = useState<PersonalItem[]>([])
  const [odontologosList, setOdontologosList] = useState<
    Array<{
      id: number
      nombre: string
      apellido: string
      matricula: string
      email?: string | null
      telefono?: string | null
      consultorio?: string | null
      activo?: boolean
      especialidad?: { nombre?: string | null } | null
    }>
  >([])
  const [personalSearch, setPersonalSearch] = useState('')
  const [cargoFilter, setCargoFilter] = useState<'TODOS' | PersonalFormCargo>('TODOS')
  const [estadoFilter, setEstadoFilter] = useState<'TODOS' | EstadoPersonal>('TODOS')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const [form, setForm] = useState<PersonalFormState | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [especialidades, setEspecialidades] = useState<EspecialidadOption[]>([])
  const [showOdontologoPopup, setShowOdontologoPopup] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const loadData = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true)
      setError('')
      try {
        const requests: Array<Promise<unknown>> = [
          apiRequest<DirectorioItem[]>('/directorio/buscar', { token, signal }),
        ]
        if (isAdmin) {
          requests.push(apiRequest<PersonalItem[]>('/personal', { token, signal }))
          requests.push(apiRequest<EspecialidadOption[]>('/especialidades', { token, signal }))
          requests.push(apiRequest<unknown[]>('/odontologos', { token, signal }))
        }

        const results = await Promise.allSettled(requests)

        const dirResult = results[0]
        if (dirResult.status === 'fulfilled' && Array.isArray(dirResult.value)) {
          setDirectorioItems(dirResult.value as DirectorioItem[])
        } else if (dirResult.status === 'rejected') {
          const reason = dirResult.reason
          if (reason instanceof DOMException && reason.name === 'AbortError') return
          throw reason
        }

        if (isAdmin && results[1]) {
          const persResult = results[1]
          if (persResult.status === 'fulfilled' && Array.isArray(persResult.value)) {
            setPersonalList(persResult.value as PersonalItem[])
          }
        }

        if (isAdmin && results[2]) {
          const espResult = results[2]
          if (espResult.status === 'fulfilled' && Array.isArray(espResult.value)) {
            setEspecialidades(espResult.value as EspecialidadOption[])
          }
        }

        if (isAdmin && results[3]) {
          const odResult = results[3]
          if (odResult.status === 'fulfilled' && Array.isArray(odResult.value)) {
            setOdontologosList(odResult.value as typeof odontologosList)
          }
        }
      } catch (failure) {
        if (failure instanceof DOMException && failure.name === 'AbortError') return
        setError(
          failure instanceof Error
            ? failure.message
            : 'No se pudo cargar el directorio institucional.'
        )
      } finally {
        setLoading(false)
      }
    },
    [token, isAdmin]
  )

  useEffect(() => {
    const controller = new AbortController()
    void loadData(controller.signal)
    return () => controller.abort()
  }, [loadData])

  const filteredDirectorio = useMemo(() => {
    const q = directorioSearch.trim().toLocaleLowerCase('es-AR')
    return directorioItems.filter(item => {
      const normalizedTipo = resolveDirectorioTipo(item)
      if (directorioTipo !== 'TODOS' && normalizedTipo !== directorioTipo) {
        return false
      }
      if (!q) return true
      return [
        item.nombreCompleto,
        item.dni || '',
        item.rolOCargo || '',
        item.email || '',
        item.telefono || '',
        item.detalleAdicional || item.detalle || '',
      ].some(val => val.toLocaleLowerCase('es-AR').includes(q))
    })
  }, [directorioItems, directorioSearch, directorioTipo])

  const filteredOdontologos = useMemo(() => {
    if (cargoFilter !== 'TODOS' && cargoFilter !== 'ODONTOLOGO') return []
    const q = personalSearch.trim().toLocaleLowerCase('es-AR')
    return odontologosList.filter(od => {
      const itemEstado: EstadoPersonal = od.activo === false ? 'INACTIVO' : 'ACTIVO'
      if (estadoFilter !== 'TODOS' && itemEstado !== estadoFilter) return false
      if (!q) return true
      return [
        od.nombre,
        od.apellido,
        `${od.nombre} ${od.apellido}`,
        od.matricula,
        od.email || '',
        od.telefono || '',
        od.especialidad?.nombre || '',
        'odontólogo',
      ].some(val => val.toLocaleLowerCase('es-AR').includes(q))
    })
  }, [odontologosList, personalSearch, cargoFilter, estadoFilter])

  const filteredPersonal = useMemo(() => {
    const q = personalSearch.trim().toLocaleLowerCase('es-AR')
    return personalList.filter(item => {
      const itemEstado = resolvePersonalEstado(item)
      if (cargoFilter !== 'TODOS' && item.cargo !== cargoFilter) return false
      if (estadoFilter !== 'TODOS' && itemEstado !== estadoFilter) return false
      if (!q) return true
      return [
        item.nombre,
        item.apellido,
        `${item.nombre} ${item.apellido}`,
        item.dni,
        item.email || '',
        item.telefono || '',
        item.cargo,
        item.cargoLegible || CARGO_LABELS[item.cargo] || '',
      ].some(val => val.toLocaleLowerCase('es-AR').includes(q))
    })
  }, [personalList, personalSearch, cargoFilter, estadoFilter])

  const kpis = useMemo(() => {
    const countTipo = (tipo: TipoPersonaDirectorio) =>
      directorioItems.filter(i => resolveDirectorioTipo(i) === tipo).length
    return {
      totalDirectorio: directorioItems.length,
      personalCount: isAdmin ? personalList.length : countTipo('PERSONAL'),
      medicosCount: countTipo('MEDICO'),
      pacientesCount: countTipo('PACIENTE'),
    }
  }, [directorioItems, personalList, isAdmin])

  function startCreatePersonal() {
    setEditingId(null)
    setForm({
      ...EMPTY_FORM,
      especialidadId: especialidades[0] ? String(especialidades[0].id) : 'NUEVA',
    })
    setError('')
    setNotice('')
  }

  function startEditPersonal(person: PersonalItem) {
    setEditingId(person.id)
    setForm({
      ...EMPTY_FORM,
      nombre: person.nombre,
      apellido: person.apellido,
      dni: person.dni,
      email: person.email || '',
      telefono: person.telefono || '',
      cargo: person.cargo || 'RECEPCIONISTA',
      fechaIngreso: person.fechaIngreso || todayIsoDate(),
      horarioLaboral: person.horarioLaboral || 'Lunes a Viernes 08:00 - 16:00',
      estado: resolvePersonalEstado(person),
    })
    setError('')
    setNotice('')
  }

  function closeForm() {
    setForm(null)
    setEditingId(null)
    setShowOdontologoPopup(false)
  }

  async function handleSavePersonal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!form) return
    setSaving(true)
    setError('')
    setNotice('')

    try {
      if (editingId === null && form.cargo === 'ODONTOLOGO') {
        await apiRequest('/odontologos/alta-completa', {
          method: 'POST',
          token,
          body: {
            nombre: form.nombre.trim(),
            apellido: form.apellido.trim(),
            matricula: form.matricula.trim(),
            email: form.email.trim() || null,
            telefono: form.telefono.trim() || null,
            consultorio: form.consultorio.trim() || null,
            activo: form.estado === 'ACTIVO',
            especialidadId:
              form.especialidadId && form.especialidadId !== 'NUEVA'
                ? Number(form.especialidadId)
                : null,
            nuevaEspecialidadNombre:
              form.especialidadId === 'NUEVA' ? form.nuevaEspecialidadNombre.trim() : null,
            crearCuentaUsuario: true,
            username: form.username.trim(),
            password: form.password,
          },
        })
        setNotice(
          `Odontólogo Dr./Dra. ${form.nombre.trim()} ${form.apellido.trim()} y cuenta "${form.username.trim()}" creados correctamente.`
        )
        closeForm()
        await loadData()
        return
      }

      let linkedUsuarioId: number | null = null
      if (editingId === null && form.username.trim() && form.password) {
        const createdUser = await apiRequest<{ id: number }>('/usuarios', {
          method: 'POST',
          token,
          body: {
            username: form.username.trim(),
            nombre: form.nombre.trim(),
            apellido: form.apellido.trim(),
            email: form.email.trim(),
            password: form.password,
            rol: 'RECEPCIONISTA',
            activo: form.estado === 'ACTIVO',
          },
        })
        if (createdUser && typeof createdUser === 'object' && 'id' in createdUser) {
          linkedUsuarioId = createdUser.id
        }
      }

      const body = {
        nombre: form.nombre.trim(),
        apellido: form.apellido.trim(),
        dni: form.dni.trim(),
        email: form.email.trim() || null,
        telefono: form.telefono.trim() || null,
        cargo: form.cargo,
        fechaIngreso: form.fechaIngreso || null,
        horarioLaboral: form.horarioLaboral.trim() || 'Lunes a Viernes 08:00 - 16:00',
        estado: form.estado,
        activo: form.estado === 'ACTIVO',
        ...(linkedUsuarioId ? { usuarioId: linkedUsuarioId } : {}),
      }

      if (editingId === null) {
        const created = await apiRequest<PersonalItem>('/personal', {
          method: 'POST',
          token,
          body,
        })
        if (created && typeof created === 'object' && 'id' in created) {
          setPersonalList(curr => [...curr, created])
        }
        setNotice(
          linkedUsuarioId
            ? `Recepcionista ${body.nombre} ${body.apellido} y su cuenta "${form.username.trim()}" registrados correctamente.`
            : `Personal ${body.nombre} ${body.apellido} registrado correctamente.`
        )
      } else {
        const updated = await apiRequest<PersonalItem>(`/personal/${editingId}`, {
          method: 'PUT',
          token,
          body,
        })
        if (updated && typeof updated === 'object' && 'id' in updated) {
          setPersonalList(curr => curr.map(item => (item.id === editingId ? updated : item)))
        }
        setNotice(`Ficha de ${body.nombre} ${body.apellido} actualizada correctamente.`)
      }
      closeForm()
      await loadData()
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : 'No se pudo guardar la ficha del personal.'
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleBajaLogica(person: PersonalItem) {
    setError('')
    setNotice('')
    try {
      const updated = await apiRequest<PersonalItem | null>(`/personal/${person.id}`, {
        method: 'DELETE',
        token,
      })
      setPersonalList(curr =>
        curr.map(item =>
          item.id === person.id
            ? updated && typeof updated === 'object' && 'id' in updated
              ? updated
              : { ...item, estado: 'INACTIVO', activo: false }
            : item
        )
      )
      setNotice(`Baja lógica aplicada: ${person.nombre} ${person.apellido} pasó a estado INACTIVO.`)
      await loadData()
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : 'No se pudo dar de baja al personal.'
      )
    }
  }

  return (
    <div className="space-y-6">
      {/* Encabezado principal */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-2xl border border-white/70 bg-white/85 p-5 shadow-md shadow-blue-950/5 backdrop-blur-xl">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-blue-700">
            Administración Clínica · Recursos Humanos
          </p>
          <h2 className="mt-1 text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <Contact2 className="w-7 h-7 text-blue-600" />
            Personal y Directorio Clínico Unificado
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Buscador institucional centralizado de personal, profesionales médicos y pacientes.{' '}
            <Link to="/odontologos" className="font-semibold text-blue-700 hover:underline">
              ¿Buscás dar de alta un Odontólogo con especialidad y usuario? Ir a Odontólogos →
            </Link>
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

          {isAdmin && (
            <button
              type="button"
              onClick={() => {
                setActiveTab('PERSONAL')
                startCreatePersonal()
              }}
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2.5 rounded-xl shadow-xs transition-colors"
            >
              <Plus className="w-5 h-5" />
              + Registrar Personal
            </button>
          )}
        </div>
      </div>

      {/* Alertas */}
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 flex items-center justify-between gap-3"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError('')}
            className="text-red-600 hover:text-red-900"
            aria-label="Cerrar error"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {notice && (
        <div
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 flex items-center justify-between gap-3"
        >
          <span>{notice}</span>
          <button
            type="button"
            onClick={() => setNotice('')}
            className="text-emerald-700 hover:text-emerald-950"
            aria-label="Cerrar aviso"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* KPIs */}
      <section
        aria-label="Indicadores del directorio institucional"
        className="grid grid-cols-2 lg:grid-cols-4 gap-3"
      >
        <div className="rounded-xl border border-white/70 bg-white/85 p-4 shadow-xs">
          <p className="text-xs font-semibold text-slate-500">Total en directorio</p>
          <p className="mt-1 text-2xl font-extrabold text-slate-900" data-testid="kpi-total-directorio">
            {kpis.totalDirectorio}
          </p>
        </div>
        <div className="rounded-xl border border-amber-100 bg-amber-50/70 p-4 shadow-xs">
          <p className="text-xs font-semibold text-amber-800">Personal auxiliar y administrativo</p>
          <p className="mt-1 text-2xl font-extrabold text-amber-950" data-testid="kpi-total-personal">
            {kpis.personalCount}
          </p>
        </div>
        <div className="rounded-xl border border-indigo-100 bg-indigo-50/70 p-4 shadow-xs">
          <p className="text-xs font-semibold text-indigo-800">Profesionales médicos</p>
          <p className="mt-1 text-2xl font-extrabold text-indigo-950" data-testid="kpi-total-medicos">
            {kpis.medicosCount}
          </p>
        </div>
        <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-4 shadow-xs">
          <p className="text-xs font-semibold text-emerald-800">Pacientes registrados</p>
          <p className="mt-1 text-2xl font-extrabold text-emerald-950" data-testid="kpi-total-pacientes">
            {kpis.pacientesCount}
          </p>
        </div>
      </section>

      {/* Selector de pestañas */}
      <div
        role="tablist"
        aria-label="Secciones de Personal y Directorio"
        className="flex flex-wrap gap-2 rounded-2xl border border-slate-200/80 bg-white/85 p-2 shadow-xs"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'DIRECTORIO'}
          onClick={() => setActiveTab('DIRECTORIO')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-colors ${
            activeTab === 'DIRECTORIO'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-700 hover:bg-slate-100'
          }`}
        >
          <Building2 className="w-4 h-4" />
          Directorio Institucional Unificado
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'PERSONAL'}
          onClick={() => setActiveTab('PERSONAL')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-colors ${
            activeTab === 'PERSONAL'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-700 hover:bg-slate-100'
          }`}
        >
          <Briefcase className="w-4 h-4" />
          Gestión de Personal Auxiliar y Administrativo
        </button>
      </div>

      {/* TAB 1: DIRECTORIO INSTITUCIONAL UNIFICADO */}
      {activeTab === 'DIRECTORIO' && (
        <section aria-label="Directorio Institucional Unificado" className="space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 rounded-2xl border border-white/70 bg-white/85 p-4 shadow-xs">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                aria-label="Buscar en el directorio unificado"
                value={directorioSearch}
                onChange={e => setDirectorioSearch(e.target.value)}
                placeholder="Buscar por DNI, matrícula, nombre, apellido o cargo..."
                className="w-full rounded-xl border border-slate-300 bg-white pl-10 pr-4 py-2 text-sm focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por tipo de persona">
              {TIPO_FILTERS.map(filter => (
                <button
                  key={filter.value}
                  type="button"
                  onClick={() => setDirectorioTipo(filter.value)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                    directorioTipo === filter.value
                      ? 'bg-blue-600 text-white'
                      : 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
              Cargando directorio institucional…
            </div>
          ) : filteredDirectorio.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center space-y-2">
              <Users className="w-8 h-8 text-slate-400 mx-auto" />
              <p className="text-sm font-semibold text-slate-700">
                No se encontraron personas en el directorio para los filtros aplicados.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredDirectorio.map(item => {
                const itemTipo = resolveDirectorioTipo(item)
                const itemEstado = resolveDirectorioEstado(item)
                const itemId = item.id ?? item.identificador ?? item.nombreCompleto
                const itemRol =
                  CARGO_LABELS[item.rolOCargo || ''] ||
                  item.rolOCargo ||
                  item.detalle ||
                  itemTipo
                const itemDetalle = item.detalleAdicional || item.detalle || null
                const badgeStyle =
                  TIPO_BADGE_STYLES[itemTipo] ||
                  'bg-slate-100 text-slate-800 border-slate-200'
                const isActive = itemEstado.toUpperCase() !== 'INACTIVO'

                return (
                  <article
                    key={`${itemTipo}-${itemId}`}
                    className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white/90 p-5 shadow-xs hover:shadow-md transition-shadow space-y-3"
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span
                            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${badgeStyle}`}
                          >
                            {itemTipo}
                          </span>
                          <h3 className="mt-1.5 text-base font-bold text-slate-900">
                            {item.nombreCompleto}
                          </h3>
                          <p className="text-xs font-semibold text-blue-700">{itemRol}</p>
                        </div>

                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            isActive
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {isActive ? (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5" />
                          )}
                          {itemEstado}
                        </span>
                      </div>

                      <div className="space-y-1.5 border-t border-slate-100 pt-2.5 text-xs text-slate-600">
                        {item.dni && (
                          <p className="flex items-center gap-2">
                            <BadgeCheck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="font-semibold text-slate-700">DNI / Matrícula:</span>
                            <span>{item.dni}</span>
                          </p>
                        )}
                        {item.email && (
                          <p className="flex items-center gap-2">
                            <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="truncate">{item.email}</span>
                          </p>
                        )}
                        {item.telefono && (
                          <p className="flex items-center gap-2">
                            <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>{item.telefono}</span>
                          </p>
                        )}
                        {itemDetalle && (
                          <p className="flex items-start gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5 text-slate-700">
                            <Clock className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                            <span>{itemDetalle}</span>
                          </p>
                        )}
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>
      )}

      {/* TAB 2: GESTIÓN DE PERSONAL AUXILIAR Y ADMINISTRATIVO */}
      {activeTab === 'PERSONAL' && (
        <section aria-label="Gestión de Personal Auxiliar y Administrativo" className="space-y-4">
          {!isAdmin ? (
            <div
              role="note"
              className="rounded-2xl border border-amber-200 bg-amber-50/90 p-5 text-sm text-amber-950 flex items-start gap-3"
            >
              <ShieldAlert className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-amber-950">
                  Sección de administración reservada al rol ADMINISTRADOR
                </h3>
                <p className="mt-1 text-xs text-amber-900">
                  El alta, edición de legajos y baja lógica del personal administrativo y auxiliar requiere permisos de administración. Podés consultar todos los datos de contacto en la pestaña Directorio Institucional Unificado.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Formulario de alta/edición de personal */}
              {form && (
                <section
                  aria-label={
                    editingId === null ? 'Registrar nuevo personal' : 'Editar ficha de personal'
                  }
                  className="rounded-2xl border border-blue-200 bg-white p-5 shadow-lg space-y-4"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                      <Briefcase className="w-5 h-5 text-blue-600" />
                      {editingId === null
                        ? 'Registrar Personal Administrativo / Auxiliar'
                        : 'Editar Legajo de Personal'}
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

                  <form
                    onSubmit={handleSavePersonal}
                    className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
                  >
                    <div>
                      <label
                        htmlFor="personal-nombre"
                        className="block text-xs font-bold text-slate-700 mb-1"
                      >
                        Nombre
                      </label>
                      <input
                        id="personal-nombre"
                        required
                        value={form.nombre}
                        onChange={e => setForm({ ...form, nombre: e.target.value })}
                        placeholder="Ej. Laura"
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="personal-apellido"
                        className="block text-xs font-bold text-slate-700 mb-1"
                      >
                        Apellido
                      </label>
                      <input
                        id="personal-apellido"
                        required
                        value={form.apellido}
                        onChange={e => setForm({ ...form, apellido: e.target.value })}
                        placeholder="Ej. Gómez"
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                      />
                    </div>

                    {form.cargo !== 'ODONTOLOGO' ? (
                      <div>
                        <label
                          htmlFor="personal-dni"
                          className="block text-xs font-bold text-slate-700 mb-1"
                        >
                          DNI
                        </label>
                        <input
                          id="personal-dni"
                          required
                          value={form.dni}
                          onChange={e => setForm({ ...form, dni: e.target.value })}
                          placeholder="7 a 10 dígitos numéricos"
                          className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                        />
                      </div>
                    ) : (
                      <div>
                        <label
                          htmlFor="personal-matricula"
                          className="block text-xs font-bold text-slate-700 mb-1"
                        >
                          Matrícula profesional
                        </label>
                        <input
                          id="personal-matricula"
                          required
                          value={form.matricula}
                          onChange={e => setForm({ ...form, matricula: e.target.value })}
                          placeholder="Ej. MP-1234"
                          className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                        />
                      </div>
                    )}

                    <div>
                      <label
                        htmlFor="personal-cargo"
                        className="block text-xs font-bold text-slate-700 mb-1"
                      >
                        Cargo / Puesto
                      </label>
                      <select
                        id="personal-cargo"
                        value={form.cargo}
                        onChange={e => {
                          const nextCargo = e.target.value as PersonalFormCargo
                          setForm({ ...form, cargo: nextCargo })
                          if (nextCargo === 'ODONTOLOGO') {
                            setShowOdontologoPopup(true)
                          }
                        }}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                      >
                        {editingId === null && (
                          <option value="ODONTOLOGO">Odontólogo</option>
                        )}
                        {CARGOS_PERSONAL.map(c => (
                          <option key={c.value} value={c.value}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor="personal-email"
                        className="block text-xs font-bold text-slate-700 mb-1"
                      >
                        Correo electrónico
                      </label>
                      <input
                        id="personal-email"
                        type="email"
                        value={form.email}
                        onChange={e => setForm({ ...form, email: e.target.value })}
                        placeholder="lgomez@novadent.com"
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="personal-telefono"
                        className="block text-xs font-bold text-slate-700 mb-1"
                      >
                        Teléfono
                      </label>
                      <input
                        id="personal-telefono"
                        value={form.telefono}
                        onChange={e => setForm({ ...form, telefono: e.target.value })}
                        placeholder="11 2233-4455"
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="personal-fecha-ingreso"
                        className="block text-xs font-bold text-slate-700 mb-1"
                      >
                        Fecha de ingreso
                      </label>
                      <input
                        id="personal-fecha-ingreso"
                        type="date"
                        value={form.fechaIngreso}
                        onChange={e => setForm({ ...form, fechaIngreso: e.target.value })}
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="personal-horario"
                        className="block text-xs font-bold text-slate-700 mb-1"
                      >
                        Horario laboral
                      </label>
                      <input
                        id="personal-horario"
                        value={form.horarioLaboral}
                        onChange={e => setForm({ ...form, horarioLaboral: e.target.value })}
                        placeholder="Lunes a Viernes 08:00 - 16:00"
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="personal-estado"
                        className="block text-xs font-bold text-slate-700 mb-1"
                      >
                        Estado
                      </label>
                      <select
                        id="personal-estado"
                        value={form.estado}
                        onChange={e =>
                          setForm({ ...form, estado: e.target.value as EstadoPersonal })
                        }
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                      >
                        <option value="ACTIVO">ACTIVO</option>
                        <option value="INACTIVO">INACTIVO</option>
                      </select>
                    </div>

                    {form.cargo === 'RECEPCIONISTA' && editingId === null && (
                      <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
                        <p className="md:col-span-2 text-xs font-bold text-emerald-900">
                          Cuenta de acceso al sistema (rol RECEPCIONISTA — opcional si ya tiene usuario)
                        </p>
                        <div>
                          <label htmlFor="personal-rec-user" className="block text-xs font-bold text-slate-700 mb-1">
                            Usuario de acceso (login)
                          </label>
                          <input
                            id="personal-rec-user"
                            value={form.username}
                            onChange={e => setForm({ ...form, username: e.target.value })}
                            placeholder="Ej. recepcion.laura"
                            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label htmlFor="personal-rec-pass" className="block text-xs font-bold text-slate-700 mb-1">
                            Contraseña inicial
                          </label>
                          <div className="relative">
                            <input
                              id="personal-rec-pass"
                              type={showPassword ? 'text' : 'password'}
                              minLength={6}
                              value={form.password}
                              onChange={e => setForm({ ...form, password: e.target.value })}
                              placeholder="Mínimo 6 caracteres"
                              className="w-full rounded-xl border border-slate-300 px-3 py-2 pr-10 text-sm focus:border-blue-600 focus:outline-none"
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

                    {form.cargo === 'ODONTOLOGO' && editingId === null && (
                      <div className="md:col-span-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50/70 px-4 py-3 text-xs text-blue-900">
                        <div>
                          <p className="font-bold">Configuración de Odontólogo</p>
                          <p className="mt-0.5">
                            Especialidad:{' '}
                            <strong>
                              {form.especialidadId === 'NUEVA'
                                ? form.nuevaEspecialidadNombre || 'Nueva especialidad'
                                : especialidades.find(e => String(e.id) === form.especialidadId)?.nombre || 'Sin seleccionar'}
                            </strong>
                            {form.username ? ` · Usuario: ${form.username}` : ''}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowOdontologoPopup(true)}
                          className="rounded-lg bg-blue-600 px-3 py-1.5 font-bold text-white hover:bg-blue-700"
                        >
                          Elegir especialidad y cuenta
                        </button>
                      </div>
                    )}

                    <div className="md:col-span-3 rounded-xl border border-blue-200 bg-blue-50/80 px-4 py-2.5 text-xs text-blue-900 flex flex-wrap items-center justify-between gap-2">
                      <span>
                        <strong>¿Querés dar de alta un Odontólogo?</strong> Los odontólogos requieren matrícula profesional, especialidad y cuenta médica propia.
                      </span>
                      <Link
                        to="/odontologos"
                        className="inline-flex items-center rounded-lg bg-blue-600 px-3 py-1.5 font-bold text-white hover:bg-blue-700"
                      >
                        Ir a Odontólogos →
                      </Link>
                    </div>

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
                        className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        {saving
                          ? 'Guardando…'
                          : editingId === null
                          ? 'Guardar personal'
                          : 'Guardar cambios'}
                      </button>
                    </div>
                  </form>
                </section>
              )}

              {/* Filtros de personal */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 rounded-2xl border border-white/70 bg-white/85 p-4 shadow-xs">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="search"
                    aria-label="Buscar personal auxiliar"
                    value={personalSearch}
                    onChange={e => setPersonalSearch(e.target.value)}
                    placeholder="Buscar personal por nombre, apellido, DNI o cargo..."
                    className="w-full rounded-xl border border-slate-300 bg-white pl-10 pr-4 py-2 text-sm focus:border-blue-600 focus:outline-none"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <select
                    aria-label="Filtrar por cargo"
                    value={cargoFilter}
                    onChange={e =>
                      setCargoFilter(e.target.value as 'TODOS' | PersonalFormCargo)
                    }
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
                  >
                    <option value="TODOS">Todos los cargos</option>
                    <option value="ODONTOLOGO">Odontólogo</option>
                    {CARGOS_PERSONAL.map(c => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>

                  <select
                    aria-label="Filtrar por estado de personal"
                    value={estadoFilter}
                    onChange={e =>
                      setEstadoFilter(e.target.value as 'TODOS' | EstadoPersonal)
                    }
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
                  >
                    <option value="TODOS">Todos los estados</option>
                    <option value="ACTIVO">ACTIVO</option>
                    <option value="INACTIVO">INACTIVO</option>
                  </select>
                </div>
              </div>

              {/* Listado de personal */}
              {loading ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
                  Cargando padrón de personal…
                </div>
              ) : filteredPersonal.length === 0 && filteredOdontologos.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center space-y-2">
                  <Briefcase className="w-8 h-8 text-slate-400 mx-auto" />
                  <p className="text-sm font-semibold text-slate-700">
                    No hay personal registrado para los filtros seleccionados.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {filteredOdontologos.map(od => {
                    const isActive = od.activo !== false
                    return (
                      <article
                        key={`od-${od.id}`}
                        className="flex flex-col justify-between rounded-2xl border border-indigo-200/80 bg-white/90 p-5 shadow-xs hover:shadow-md transition-shadow space-y-4"
                      >
                        <div className="space-y-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h3 className="text-base font-bold text-slate-900">
                                Dr./Dra. {od.nombre} {od.apellido}
                              </h3>
                              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-700">
                                  MP {od.matricula}
                                </span>
                                <span className="inline-flex items-center rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-bold text-indigo-700">
                                  Odontólogo · {od.especialidad?.nombre || 'General'}
                                </span>
                              </div>
                            </div>

                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                isActive
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {isActive ? (
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              ) : (
                                <XCircle className="w-3.5 h-3.5" />
                              )}
                              {isActive ? 'ACTIVO' : 'INACTIVO'}
                            </span>
                          </div>

                          <div className="space-y-1 text-xs text-slate-600 border-t border-slate-100 pt-2.5">
                            {od.email && (
                              <p className="flex items-center gap-2">
                                <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span className="truncate">{od.email}</span>
                              </p>
                            )}
                            {od.telefono && (
                              <p className="flex items-center gap-2">
                                <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span>{od.telefono}</span>
                              </p>
                            )}
                            {od.consultorio && (
                              <p className="flex items-center gap-2">
                                <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span>Consultorio: {od.consultorio}</span>
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
                          <Link
                            to="/odontologos"
                            className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            Gestionar en Odontólogos →
                          </Link>
                        </div>
                      </article>
                    )
                  })}
                  {filteredPersonal.map(person => {
                    const personEstado = resolvePersonalEstado(person)
                    const isActive = personEstado === 'ACTIVO'
                    return (
                      <article
                        key={person.id}
                        className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white/90 p-5 shadow-xs hover:shadow-md transition-shadow space-y-4"
                      >
                        <div className="space-y-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h3 className="text-base font-bold text-slate-900">
                                {person.nombre} {person.apellido}
                              </h3>
                              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-700">
                                  DNI {person.dni}
                                </span>
                                <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-800">
                                  {person.cargoLegible || CARGO_LABELS[person.cargo] || person.cargo}
                                </span>
                              </div>
                            </div>

                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                isActive
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {isActive ? (
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              ) : (
                                <XCircle className="w-3.5 h-3.5" />
                              )}
                              {personEstado}
                            </span>
                          </div>

                          <div className="space-y-1.5 border-t border-slate-100 pt-2.5 text-xs text-slate-600">
                            {person.email && (
                              <p className="flex items-center gap-2">
                                <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span className="truncate">{person.email}</span>
                              </p>
                            )}
                            {person.telefono && (
                              <p className="flex items-center gap-2">
                                <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span>{person.telefono}</span>
                              </p>
                            )}
                            {person.horarioLaboral && (
                              <p className="flex items-center gap-2">
                                <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span>{person.horarioLaboral}</span>
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
                          <button
                            type="button"
                            onClick={() => startEditPersonal(person)}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            Editar
                          </button>
                          {isActive && (
                            <button
                              type="button"
                              onClick={() => void handleBajaLogica(person)}
                              aria-label={`Dar de baja a ${person.nombre} ${person.apellido}`}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                            >
                              <UserMinus className="w-3.5 h-3.5" />
                              Dar de baja
                            </button>
                          )}
                        </div>
                      </article>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </section>
      )}

      {showOdontologoPopup && form && form.cargo === 'ODONTOLOGO' && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="odontologo-popup-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 id="odontologo-popup-title" className="text-lg font-bold text-slate-900">
                Especialidad y Cuenta del Odontólogo
              </h3>
              <button
                type="button"
                onClick={() => setShowOdontologoPopup(false)}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
                aria-label="Cerrar ventana de especialidad"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label htmlFor="popup-esp" className="block text-xs font-bold text-slate-700 mb-1">
                  Especialidad del odontólogo
                </label>
                <select
                  id="popup-esp"
                  value={form.especialidadId}
                  onChange={e => setForm({ ...form, especialidadId: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                >
                  {especialidades.map(esp => (
                    <option key={esp.id} value={String(esp.id)}>
                      {esp.nombre}
                    </option>
                  ))}
                  <option value="NUEVA">+ Otra (crear nueva especialidad)</option>
                </select>
              </div>

              {form.especialidadId === 'NUEVA' && (
                <div>
                  <label htmlFor="popup-esp-nueva" className="block text-xs font-bold text-slate-700 mb-1">
                    Nombre de la nueva especialidad
                  </label>
                  <input
                    id="popup-esp-nueva"
                    value={form.nuevaEspecialidadNombre}
                    onChange={e => setForm({ ...form, nuevaEspecialidadNombre: e.target.value })}
                    placeholder="Ej. Ortodoncia"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                  />
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="popup-matricula" className="block text-xs font-bold text-slate-700 mb-1">
                    Matrícula profesional
                  </label>
                  <input
                    id="popup-matricula"
                    value={form.matricula}
                    onChange={e => setForm({ ...form, matricula: e.target.value })}
                    placeholder="Ej. MP-1234"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="popup-consultorio" className="block text-xs font-bold text-slate-700 mb-1">
                    Consultorio
                  </label>
                  <input
                    id="popup-consultorio"
                    value={form.consultorio}
                    onChange={e => setForm({ ...form, consultorio: e.target.value })}
                    placeholder="Ej. Box 1"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-slate-100 pt-3">
                <div>
                  <label htmlFor="popup-od-user" className="block text-xs font-bold text-slate-700 mb-1">
                    Usuario de acceso (login)
                  </label>
                  <input
                    id="popup-od-user"
                    value={form.username}
                    onChange={e => setForm({ ...form, username: e.target.value })}
                    placeholder="Ej. joseperalta"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="popup-od-pass" className="block text-xs font-bold text-slate-700 mb-1">
                    Contraseña inicial
                  </label>
                  <div className="relative">
                    <input
                      id="popup-od-pass"
                      type={showPassword ? 'text' : 'password'}
                      value={form.password}
                      onChange={e => setForm({ ...form, password: e.target.value })}
                      placeholder="Mínimo 6 caracteres"
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 pr-10 text-sm focus:border-blue-600 focus:outline-none"
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
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-3">
              <button
                type="button"
                onClick={() => setShowOdontologoPopup(false)}
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
