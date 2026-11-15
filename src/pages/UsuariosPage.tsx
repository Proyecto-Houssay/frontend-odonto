import React, { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  CheckCircle2,
  Link2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Shield,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  X,
  XCircle,
} from 'lucide-react'
import { useAuth } from '../auth/useAuth'
import { apiRequest } from '../lib/api'

export type SystemRole = 'ADMINISTRADOR' | 'ODONTOLOGO' | 'RECEPCIONISTA' | 'PACIENTE'

export type UsuarioResponse = {
  id: number
  username: string
  nombre: string
  apellido: string
  email: string
  rol: SystemRole | string
  activo: boolean
  telefono?: string | null
}

type PacienteOption = {
  id: number
  nombre: string
  apellido: string
  dni: string
  email?: string
}

type UsuarioFormState = {
  username: string
  nombre: string
  apellido: string
  email: string
  password: string
  rol: SystemRole
  activo: boolean
  telefono: string
}

const EMPTY_FORM: UsuarioFormState = {
  username: '',
  nombre: '',
  apellido: '',
  email: '',
  password: '',
  rol: 'ODONTOLOGO',
  activo: true,
  telefono: '',
}

const ROLE_FILTERS: Array<'TODOS' | SystemRole> = [
  'TODOS',
  'ADMINISTRADOR',
  'ODONTOLOGO',
  'RECEPCIONISTA',
  'PACIENTE',
]

const ROLE_BADGE_STYLES: Record<string, string> = {
  ADMINISTRADOR: 'bg-purple-100 text-purple-800 border-purple-200',
  ODONTOLOGO: 'bg-blue-100 text-blue-800 border-blue-200',
  RECEPCIONISTA: 'bg-teal-100 text-teal-800 border-teal-200',
  PACIENTE: 'bg-emerald-100 text-emerald-800 border-emerald-200',
}

const ROLE_PERMISSIONS_MATRIX: Array<{
  role: SystemRole
  label: string
  badgeClass: string
  permissions: string[]
}> = [
  {
    role: 'ADMINISTRADOR',
    label: 'Administrador del Sistema',
    badgeClass: 'bg-purple-100 text-purple-800 border-purple-200',
    permissions: [
      'Alta, edición, activación/baja y eliminación de cuentas de usuario',
      'Vinculación de cuentas de pacientes con fichas clínicas por DNI',
      'Gestión del plantel de odontólogos y catálogo de especialidades',
      'Acceso a informes operativos, financieros e ingesta de conocimiento RAG',
    ],
  },
  {
    role: 'ODONTOLOGO',
    label: 'Profesional Odontólogo',
    badgeClass: 'bg-blue-100 text-blue-800 border-blue-200',
    permissions: [
      'Apertura y cierre de sesiones en historias clínicas, diagnósticos y tratamientos',
      'Edición de odontograma clínico con firma digital y presupuesto',
      'Revisión de reportes de seguimiento dental y validación de prioridad en teletriaje',
      'Uso del Copiloto Clínico IA y analizador radiográfico Dr. Annie',
    ],
  },
  {
    role: 'RECEPCIONISTA',
    label: 'Recepción y Admisión',
    badgeClass: 'bg-teal-100 text-teal-800 border-teal-200',
    permissions: [
      'Admisión, alta y actualización de fichas de pacientes',
      'Programación, reprogramación y control de agenda de turnos',
      'Consulta de directorio de odontólogos, especialidades y odontograma en modo lectura',
      'Reserva de citas en teletriaje y uso del Asistente de Recepción IA',
    ],
  },
  {
    role: 'PACIENTE',
    label: 'Portal del Paciente',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    permissions: [
      'Consulta aislada de sus propios turnos, tratamientos y odontograma personal',
      'Envío de reportes de seguimiento dental con dolor y fotografía clínica',
      'Autovinculación inicial de perfil y check-in biométrico facial',
      'Consultas generales al Asistente IA respaldadas por fuentes oficiales',
    ],
  },
]

export const UsuariosPage: React.FC = () => {
  const { session } = useAuth()
  const token = session?.token || ''

  const [users, setUsers] = useState<UsuarioResponse[]>([])
  const [patients, setPatients] = useState<PacienteOption[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [togglingId, setTogglingId] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<'TODOS' | SystemRole>('TODOS')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const [form, setForm] = useState<UsuarioFormState | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)

  const [linkingUser, setLinkingUser] = useState<UsuarioResponse | null>(null)
  const [selectedPacienteId, setSelectedPacienteId] = useState<string>('')
  const [dniConfirmado, setDniConfirmado] = useState<string>('')
  const [linkingBusy, setLinkingBusy] = useState(false)

  const loadData = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    setError('')
    try {
      const [usersResult, patientsResult] = await Promise.allSettled([
        apiRequest<UsuarioResponse[]>('/usuarios', { token, signal }),
        apiRequest<PacienteOption[]>('/pacientes', { token, signal }),
      ])

      if (usersResult.status === 'fulfilled') {
        setUsers(Array.isArray(usersResult.value) ? usersResult.value : [])
      } else {
        const reason = usersResult.reason
        if (reason instanceof DOMException && reason.name === 'AbortError') return
        throw reason
      }

      if (patientsResult.status === 'fulfilled' && Array.isArray(patientsResult.value)) {
        setPatients(patientsResult.value)
      }
    } catch (failure) {
      if (failure instanceof DOMException && failure.name === 'AbortError') return
      setError(failure instanceof Error ? failure.message : 'No se pudieron cargar los usuarios del sistema.')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    const controller = new AbortController()
    void loadData(controller.signal)
    return () => controller.abort()
  }, [loadData])

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('es-AR')
    return users.filter(user => {
      const normalizedRole = (user.rol || '').toUpperCase()
      if (roleFilter !== 'TODOS' && normalizedRole !== roleFilter) return false
      if (!query) return true
      return [
        user.username,
        user.nombre,
        user.apellido,
        `${user.nombre} ${user.apellido}`,
        user.email,
        user.rol,
        user.telefono || '',
      ].some(field => field.toLocaleLowerCase('es-AR').includes(query))
    })
  }, [users, search, roleFilter])

  const kpis = useMemo(() => {
    const countByRole = (role: SystemRole) =>
      users.filter(u => (u.rol || '').toUpperCase() === role).length
    return {
      total: users.length,
      admins: countByRole('ADMINISTRADOR'),
      odontologos: countByRole('ODONTOLOGO'),
      recepcionistas: countByRole('RECEPCIONISTA'),
      pacientes: countByRole('PACIENTE'),
      activos: users.filter(u => u.activo).length,
    }
  }, [users])

  function startCreate() {
    setEditingId(null)
    setForm({ ...EMPTY_FORM })
    setError('')
    setNotice('')
  }

  function startEdit(user: UsuarioResponse) {
    const normalizedRole = ((user.rol || 'ODONTOLOGO').toUpperCase() as SystemRole)
    setEditingId(user.id)
    setForm({
      username: user.username,
      nombre: user.nombre,
      apellido: user.apellido,
      email: user.email,
      password: '',
      rol: ['ADMINISTRADOR', 'ODONTOLOGO', 'RECEPCIONISTA', 'PACIENTE'].includes(normalizedRole)
        ? normalizedRole
        : 'ODONTOLOGO',
      activo: user.activo,
      telefono: user.telefono || '',
    })
    setError('')
    setNotice('')
  }

  function closeForm() {
    setForm(null)
    setEditingId(null)
  }

  async function handleSubmitUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!form) return
    setSaving(true)
    setError('')
    setNotice('')

    try {
      if (editingId === null) {
        const body = {
          username: form.username.trim(),
          nombre: form.nombre.trim(),
          apellido: form.apellido.trim(),
          email: form.email.trim(),
          password: form.password,
          rol: form.rol,
          activo: form.activo,
          telefono: form.telefono.trim() || null,
        }
        await apiRequest<UsuarioResponse>('/usuarios', {
          method: 'POST',
          token,
          body,
        })
        setNotice(`Usuario @${body.username} creado correctamente con rol ${body.rol}.`)
      } else {
        const body = {
          username: form.username.trim(),
          nombre: form.nombre.trim(),
          apellido: form.apellido.trim(),
          email: form.email.trim(),
          rol: form.rol,
          activo: form.activo,
          telefono: form.telefono.trim() || null,
        }
        await apiRequest<UsuarioResponse>(`/usuarios/${editingId}`, {
          method: 'PUT',
          token,
          body,
        })
        setNotice(`Datos y permisos de @${body.username} actualizados correctamente.`)
      }
      closeForm()
      await loadData()
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'No se pudo guardar el usuario.')
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleActive(user: UsuarioResponse) {
    setTogglingId(user.id)
    setError('')
    setNotice('')
    try {
      const updated = await apiRequest<UsuarioResponse>(`/usuarios/${user.id}`, {
        method: 'PUT',
        token,
        body: {
          username: user.username,
          nombre: user.nombre,
          apellido: user.apellido,
          email: user.email,
          rol: (user.rol || 'PACIENTE').toUpperCase(),
          activo: !user.activo,
          telefono: user.telefono || null,
        },
      })
      setUsers(current => current.map(item => (item.id === user.id ? updated : item)))
      setNotice(
        `Cuenta @${user.username} ${updated.activo ? 'activada' : 'desactivada'} correctamente.`
      )
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'No se pudo cambiar el estado de la cuenta.')
    } finally {
      setTogglingId(null)
    }
  }

  async function handleDeleteUser(user: UsuarioResponse) {
    if (!window.confirm(`¿Confirmás eliminar la cuenta de ${user.nombre} ${user.apellido} (@${user.username})?`)) {
      return
    }
    setError('')
    setNotice('')
    try {
      await apiRequest<void>(`/usuarios/${user.id}`, {
        method: 'DELETE',
        token,
      })
      setUsers(current => current.filter(item => item.id !== user.id))
      setNotice(`Usuario @${user.username} eliminado correctamente.`)
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'No se pudo eliminar el usuario.')
    }
  }

  function startLinkPaciente(user: UsuarioResponse) {
    setLinkingUser(user)
    const matchingPatient = patients.find(
      p => p.email && user.email && p.email.toLowerCase() === user.email.toLowerCase()
    ) || patients[0]
    setSelectedPacienteId(matchingPatient ? String(matchingPatient.id) : '')
    setDniConfirmado(matchingPatient ? matchingPatient.dni : '')
    setError('')
    setNotice('')
  }

  function handleSelectPacienteChange(pacienteIdValue: string) {
    setSelectedPacienteId(pacienteIdValue)
    const found = patients.find(p => String(p.id) === pacienteIdValue)
    if (found) {
      setDniConfirmado(found.dni)
    }
  }

  async function handleLinkPacienteSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!linkingUser || !selectedPacienteId || !dniConfirmado.trim()) return
    setLinkingBusy(true)
    setError('')
    setNotice('')
    try {
      await apiRequest(`/admin/vinculos-paciente/${linkingUser.id}`, {
        method: 'PUT',
        token,
        body: {
          pacienteId: Number(selectedPacienteId),
          dniConfirmado: dniConfirmado.trim(),
        },
      })
      setNotice(`Ficha clínica vinculada correctamente a la cuenta @${linkingUser.username}.`)
      setLinkingUser(null)
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'No se pudo vincular la ficha de paciente.')
    } finally {
      setLinkingBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Encabezado principal */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-2xl border border-white/70 bg-white/85 p-5 shadow-md shadow-blue-950/5 backdrop-blur-xl">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-purple-700">
            Administración de Seguridad · RBAC
          </p>
          <h2 className="mt-1 text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <UserCheck className="w-7 h-7 text-purple-600" />
            Gestión de Usuarios y Permisos
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Administración de cuentas del sistema, asignación de roles (administrador, odontólogo, recepcionista y paciente), estados de acceso y vinculación de fichas clínicas.
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
          <button
            type="button"
            onClick={startCreate}
            className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold px-4 py-2.5 rounded-xl shadow-xs transition-colors"
          >
            <Plus className="w-5 h-5" />
            + Nuevo Usuario
          </button>
        </div>
      </div>

      {/* Mensajes de estado */}
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

      {/* Tarjetas de resumen KPI */}
      <section aria-label="Resumen de cuentas y roles" className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
        <div className="rounded-xl border border-white/70 bg-white/85 p-4 shadow-xs">
          <p className="text-xs font-semibold text-slate-500">Total de cuentas</p>
          <p className="mt-1 text-2xl font-extrabold text-slate-900" data-testid="kpi-total-users">{kpis.total}</p>
        </div>
        <div className="rounded-xl border border-purple-100 bg-purple-50/70 p-4 shadow-xs">
          <p className="text-xs font-semibold text-purple-800">Administradores</p>
          <p className="mt-1 text-2xl font-extrabold text-purple-950" data-testid="kpi-admin-users">{kpis.admins}</p>
        </div>
        <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-4 shadow-xs">
          <p className="text-xs font-semibold text-blue-800">Odontólogos</p>
          <p className="mt-1 text-2xl font-extrabold text-blue-950" data-testid="kpi-dentist-users">{kpis.odontologos}</p>
        </div>
        <div className="rounded-xl border border-teal-100 bg-teal-50/70 p-4 shadow-xs">
          <p className="text-xs font-semibold text-teal-800">Recepcionistas</p>
          <p className="mt-1 text-2xl font-extrabold text-teal-950" data-testid="kpi-reception-users">{kpis.recepcionistas}</p>
        </div>
        <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-4 shadow-xs">
          <p className="text-xs font-semibold text-emerald-800">Pacientes</p>
          <p className="mt-1 text-2xl font-extrabold text-emerald-950" data-testid="kpi-patient-users">{kpis.pacientes}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white/90 p-4 shadow-xs">
          <p className="text-xs font-semibold text-slate-600">Cuentas activas</p>
          <p className="mt-1 text-2xl font-extrabold text-emerald-700" data-testid="kpi-active-users">{kpis.activos}</p>
        </div>
      </section>

      {/* Matriz de permisos por rol */}
      <details className="group rounded-2xl border border-slate-200/80 bg-white/85 p-4 shadow-xs backdrop-blur-xl">
        <summary className="flex cursor-pointer list-none items-center justify-between font-bold text-slate-800 text-sm">
          <span className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-purple-600" />
            Matriz de Permisos y Alcance Funcional por Rol
          </span>
          <span className="text-xs font-semibold text-purple-700 group-open:underline">
            Ver detalle de autorizaciones
          </span>
        </summary>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 border-t border-slate-200/70 pt-4">
          {ROLE_PERMISSIONS_MATRIX.map(item => (
            <div key={item.role} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-bold ${item.badgeClass}`}>
                  <Shield className="w-3 h-3" />
                  {item.role}
                </span>
              </div>
              <p className="text-xs font-bold text-slate-800">{item.label}</p>
              <ul className="space-y-1 text-xs text-slate-600 list-disc list-inside">
                {item.permissions.map(perm => (
                  <li key={perm}>{perm}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </details>

      {/* Formulario de creación / edición de usuario */}
      {form && (
        <section
          aria-label={editingId === null ? 'Crear nuevo usuario' : 'Editar usuario'}
          className="rounded-2xl border border-purple-200 bg-white p-5 shadow-lg space-y-4"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-purple-600" />
              {editingId === null ? 'Registrar Nuevo Usuario' : 'Editar Cuenta y Rol de Usuario'}
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

          <form onSubmit={handleSubmitUser} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label htmlFor="user-nombre" className="block text-xs font-bold text-slate-700 mb-1">
                Nombre
              </label>
              <input
                id="user-nombre"
                required
                value={form.nombre}
                onChange={e => setForm({ ...form, nombre: e.target.value })}
                placeholder="Ej. Laura"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-purple-600 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="user-apellido" className="block text-xs font-bold text-slate-700 mb-1">
                Apellido
              </label>
              <input
                id="user-apellido"
                required
                value={form.apellido}
                onChange={e => setForm({ ...form, apellido: e.target.value })}
                placeholder="Ej. Gómez"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-purple-600 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="user-username" className="block text-xs font-bold text-slate-700 mb-1">
                Nombre de usuario
              </label>
              <input
                id="user-username"
                required
                value={form.username}
                onChange={e => setForm({ ...form, username: e.target.value })}
                placeholder="Ej. lgomez"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-purple-600 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="user-email" className="block text-xs font-bold text-slate-700 mb-1">
                Correo electrónico
              </label>
              <input
                id="user-email"
                type="email"
                required
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                placeholder="lgomez@novadent.com"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-purple-600 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="user-telefono" className="block text-xs font-bold text-slate-700 mb-1">
                Teléfono
              </label>
              <input
                id="user-telefono"
                value={form.telefono}
                onChange={e => setForm({ ...form, telefono: e.target.value })}
                placeholder="11 4455-6677"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-purple-600 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="user-rol" className="block text-xs font-bold text-slate-700 mb-1">
                Rol del sistema
              </label>
              <select
                id="user-rol"
                value={form.rol}
                onChange={e => setForm({ ...form, rol: e.target.value as SystemRole })}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-purple-600 focus:outline-none"
              >
                <option value="ADMINISTRADOR">ADMINISTRADOR</option>
                <option value="ODONTOLOGO">ODONTOLOGO</option>
                <option value="RECEPCIONISTA">RECEPCIONISTA</option>
                <option value="PACIENTE">PACIENTE</option>
              </select>
            </div>

            {editingId === null && (
              <div>
                <label htmlFor="user-password" className="block text-xs font-bold text-slate-700 mb-1">
                  Contraseña inicial
                </label>
                <input
                  id="user-password"
                  type="password"
                  required
                  minLength={6}
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-purple-600 focus:outline-none"
                />
              </div>
            )}

            <div className="flex items-center gap-2 pt-5">
              <input
                id="user-activo"
                type="checkbox"
                checked={form.activo}
                onChange={e => setForm({ ...form, activo: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
              />
              <label htmlFor="user-activo" className="text-sm font-medium text-slate-800">
                Cuenta activa (habilitada para iniciar sesión)
              </label>
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
                className="rounded-xl bg-purple-600 px-5 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-50"
              >
                {saving ? 'Guardando…' : editingId === null ? 'Crear usuario' : 'Guardar cambios'}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Modal/Panel para vincular cuenta PACIENTE con ficha clínica */}
      {linkingUser && (
        <section
          aria-label="Vincular ficha de paciente"
          className="rounded-2xl border border-emerald-300 bg-emerald-50/60 p-5 shadow-md space-y-4"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Link2 className="w-5 h-5 text-emerald-700" />
                Vincular Cuenta @{linkingUser.username} con Ficha Clínica de Paciente
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                Seleccioná la ficha clínica registrada en recepción y confirmá el DNI para habilitar el portal del paciente.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setLinkingUser(null)}
              className="rounded-lg p-1 text-slate-500 hover:bg-white"
              aria-label="Cerrar vinculación"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleLinkPacienteSubmit} className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
            <div>
              <label htmlFor="link-paciente-select" className="block text-xs font-bold text-slate-700 mb-1">
                Ficha clínica de paciente
              </label>
              <select
                id="link-paciente-select"
                required
                value={selectedPacienteId}
                onChange={e => handleSelectPacienteChange(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
              >
                <option value="">Seleccionar paciente…</option>
                {patients.map(p => (
                  <option key={p.id} value={String(p.id)}>
                    {p.nombre} {p.apellido} — DNI {p.dni}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="link-dni-confirm" className="block text-xs font-bold text-slate-700 mb-1">
                Confirmar DNI del paciente
              </label>
              <input
                id="link-dni-confirm"
                required
                value={dniConfirmado}
                onChange={e => setDniConfirmado(e.target.value)}
                placeholder="DNI exacto de la ficha"
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={linkingBusy || !selectedPacienteId || !dniConfirmado.trim()}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {linkingBusy ? 'Vinculando…' : 'Confirmar vínculo'}
              </button>
              <button
                type="button"
                onClick={() => setLinkingUser(null)}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Barra de búsqueda y filtros por rol */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 rounded-2xl border border-white/70 bg-white/85 p-4 shadow-xs">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            aria-label="Buscar usuarios"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por usuario, nombre, email o rol..."
            className="w-full rounded-xl border border-slate-300 bg-white pl-10 pr-4 py-2 text-sm focus:border-purple-600 focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por rol">
          {ROLE_FILTERS.map(roleOption => (
            <button
              key={roleOption}
              type="button"
              onClick={() => setRoleFilter(roleOption)}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                roleFilter === roleOption
                  ? 'bg-purple-600 text-white shadow-2xs'
                  : 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
              }`}
            >
              {roleOption}
            </button>
          ))}
        </div>
      </div>

      {/* Tabla de usuarios */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white/90 shadow-xs">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">Cargando cuentas de usuario…</div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <Users className="w-8 h-8 text-slate-400 mx-auto" />
            <p className="text-sm font-semibold text-slate-700">No se encontraron usuarios para los filtros aplicados.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-bold uppercase tracking-wider text-slate-600">
                  <th className="py-3 px-4">Usuario / Nombre</th>
                  <th className="py-3 px-4">Contacto</th>
                  <th className="py-3 px-4">Rol</th>
                  <th className="py-3 px-4">Estado</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70">
                {filteredUsers.map(user => {
                  const normalizedRole = (user.rol || 'PACIENTE').toUpperCase()
                  const badgeStyle =
                    ROLE_BADGE_STYLES[normalizedRole] || 'bg-slate-100 text-slate-800 border-slate-200'

                  return (
                    <tr key={user.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4">
                        <p className="font-bold text-slate-900">
                          {user.nombre} {user.apellido}
                        </p>
                        <p className="text-xs text-slate-500">@{user.username}</p>
                      </td>
                      <td className="py-3.5 px-4">
                        <p className="text-slate-800">{user.email}</p>
                        <p className="text-xs text-slate-500">{user.telefono || 'Sin teléfono'}</p>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold ${badgeStyle}`}
                        >
                          {normalizedRole}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                              user.activo
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {user.activo ? (
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            ) : (
                              <XCircle className="w-3.5 h-3.5" />
                            )}
                            {user.activo ? 'Activo' : 'Inactivo'}
                          </span>
                          <button
                            type="button"
                            disabled={togglingId === user.id}
                            onClick={() => void handleToggleActive(user)}
                            className="text-xs font-semibold text-purple-700 hover:underline disabled:opacity-50"
                          >
                            {user.activo ? 'Desactivar' : 'Activar'}
                          </button>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                          {normalizedRole === 'PACIENTE' && (
                            <button
                              type="button"
                              onClick={() => startLinkPaciente(user)}
                              className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
                            >
                              <Link2 className="w-3.5 h-3.5" />
                              Vincular ficha
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => startEdit(user)}
                            aria-label={`Editar ${user.username}`}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDeleteUser(user)}
                            aria-label={`Eliminar ${user.username}`}
                            className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
