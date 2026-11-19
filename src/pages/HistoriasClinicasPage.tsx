import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Edit2,
  Eye,
  FileText,
  Plus,
  Search,
  Stethoscope,
  User,
  Users,
  X
} from 'lucide-react'
import { useAuth } from '../auth/useAuth'
import { apiRequest } from '../lib/api'

type Paciente = {
  id: number
  nombre: string
  apellido: string
  dni: string
  telefono?: string | null
  email?: string
  fechaNacimiento?: string
}

type HistoriaClinica = {
  id: number
  pacienteId: number
  fechaApertura: string
  observaciones?: string | null
}

type Diagnostico = {
  id: number
  fecha: string
  descripcion: string
  tratamientos?: Array<{ id: number; descripcion: string; estado?: string }>
}

type HistoriaDetalle = HistoriaClinica & {
  diagnosticos?: Diagnostico[]
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '-'
  try {
    const parts = dateStr.split('-')
    if (parts.length === 3) {
      const date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 12)
      return new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short', year: 'numeric' }).format(date)
    }
    return dateStr
  } catch {
    return dateStr
  }
}

export const HistoriasClinicasPage = () => {
  const { session } = useAuth()
  const token = session?.token

  const [historias, setHistorias] = useState<HistoriaClinica[]>([])
  const [pacientes, setPacientes] = useState<Paciente[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  // Modal Crear / Editar Ficha
  const [showModal, setShowModal] = useState(false)
  const [editingHistoria, setEditingHistoria] = useState<HistoriaClinica | null>(null)
  const [formPacienteId, setFormPacienteId] = useState('')
  const [formFechaApertura, setFormFechaApertura] = useState(() => new Date().toISOString().slice(0, 10))
  const [formObservaciones, setFormObservaciones] = useState('')
  const [modalSaving, setModalSaving] = useState(false)
  const [modalError, setModalError] = useState('')

  // Modal Ver Detalle & Evoluciones
  const [selectedHistoria, setSelectedHistoria] = useState<HistoriaClinica | null>(null)
  const [historiaDetalle, setHistoriaDetalle] = useState<HistoriaDetalle | null>(null)
  const [loadingDetalle, setLoadingDetalle] = useState(false)
  const [nuevaEvolucion, setNuevaEvolucion] = useState('')
  const [savingEvolucion, setSavingEvolucion] = useState(false)
  const [evolucionError, setEvolucionError] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [histRes, pacRes] = await Promise.all([
        apiRequest<HistoriaClinica[]>('/historias-clinicas', { token }),
        apiRequest<Paciente[]>('/pacientes', { token }),
      ])
      setHistorias(Array.isArray(histRes) ? histRes : [])
      setPacientes(Array.isArray(pacRes) ? pacRes : [])
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudieron cargar las historias clínicas.')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    void loadData()
  }, [loadData])

  // Mapa de pacientes para búsqueda rápida
  const pacienteMap = useMemo(() => {
    const map = new Map<number, Paciente>()
    for (const p of pacientes) {
      map.set(p.id, p)
    }
    return map
  }, [pacientes])

  // Pacientes que ya tienen historia clínica
  const pacientesConFicha = useMemo(() => {
    return new Set(historias.map((h) => h.pacienteId))
  }, [historias])

  // Historias filtradas por búsqueda
  const filteredHistorias = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('es-AR')
    if (!query) return historias

    return historias.filter((h) => {
      const p = pacienteMap.get(h.pacienteId)
      const nombreCompleto = p ? `${p.nombre} ${p.apellido}`.toLocaleLowerCase('es-AR') : ''
      const dni = p ? p.dni.toLocaleLowerCase('es-AR') : ''
      const idMatch = String(h.id).includes(query)
      const obsMatch = (h.observaciones || '').toLocaleLowerCase('es-AR').includes(query)

      return nombreCompleto.includes(query) || dni.includes(query) || idMatch || obsMatch
    })
  }, [historias, pacienteMap, search])

  // Abrir modal de creación
  const openCreateModal = () => {
    setEditingHistoria(null)
    // Seleccionar automáticamente el primer paciente que no tenga ficha
    const primerDisponible = pacientes.find((p) => !pacientesConFicha.has(p.id))
    setFormPacienteId(primerDisponible ? String(primerDisponible.id) : '')
    setFormFechaApertura(new Date().toISOString().slice(0, 10))
    setFormObservaciones('')
    setModalError('')
    setShowModal(true)
  }

  // Abrir modal de edición
  const openEditModal = (h: HistoriaClinica) => {
    setEditingHistoria(h)
    setFormPacienteId(String(h.pacienteId))
    setFormFechaApertura(h.fechaApertura || new Date().toISOString().slice(0, 10))
    setFormObservaciones(h.observaciones || '')
    setModalError('')
    setShowModal(true)
  }

  // Guardar Ficha (Crear o Actualizar)
  const handleSaveFicha = async (e: FormEvent) => {
    e.preventDefault()
    setModalError('')

    if (!editingHistoria && !formPacienteId) {
      setModalError('Debe seleccionar un paciente.')
      return
    }
    if (!formFechaApertura) {
      setModalError('La fecha de apertura es obligatoria.')
      return
    }

    setModalSaving(true)
    try {
      if (editingHistoria) {
        // Actualizar historia existente
        await apiRequest<HistoriaClinica>(`/historias-clinicas/${editingHistoria.id}`, {
          method: 'PUT',
          token,
          body: {
            fechaApertura: formFechaApertura,
            observaciones: formObservaciones.trim() || undefined,
          },
        })
        setNotice(`Ficha #${editingHistoria.id} actualizada correctamente.`)
      } else {
        // Crear nueva historia clínica
        const created = await apiRequest<HistoriaClinica>('/historias-clinicas', {
          method: 'POST',
          token,
          body: {
            pacienteId: Number(formPacienteId),
            fechaApertura: formFechaApertura,
            observaciones: formObservaciones.trim() || undefined,
          },
        })
        const paciente = pacienteMap.get(Number(formPacienteId))
        const pacNombre = paciente ? `${paciente.nombre} ${paciente.apellido}` : 'paciente'
        setNotice(`Ficha clínica #${created.id} creada con éxito para ${pacNombre}.`)
      }
      setShowModal(false)
      await loadData()
    } catch (cause) {
      setModalError(cause instanceof Error ? cause.message : 'Error al guardar la historia clínica.')
    } finally {
      setModalSaving(false)
    }
  }

  // Cargar detalle completo de la historia clínica
  const openDetalleModal = async (h: HistoriaClinica) => {
    setSelectedHistoria(h)
    setHistoriaDetalle(null)
    setLoadingDetalle(true)
    setNuevaEvolucion('')
    setEvolucionError('')
    try {
      const detalle = await apiRequest<HistoriaDetalle>(`/historias-clinicas/${h.id}/detalle`, { token })
      setHistoriaDetalle(detalle)
    } catch {
      // Fallback a los datos básicos si el endpoint de detalle no responde
      setHistoriaDetalle({ ...h, diagnosticos: [] })
    } finally {
      setLoadingDetalle(false)
    }
  }

  // Registrar nueva evolución / diagnóstico
  const handleAddEvolucion = async (e: FormEvent) => {
    e.preventDefault()
    if (!selectedHistoria || !nuevaEvolucion.trim()) return

    setSavingEvolucion(true)
    setEvolucionError('')
    try {
      await apiRequest(`/historias-clinicas/${selectedHistoria.id}/diagnosticos`, {
        method: 'POST',
        token,
        body: {
          historiaClinicaId: selectedHistoria.id,
          fecha: new Date().toISOString().slice(0, 10),
          descripcion: nuevaEvolucion.trim(),
          tratamientos: [],
        },
      })
      setNuevaEvolucion('')
      // Recargar detalle
      const detalleActualizado = await apiRequest<HistoriaDetalle>(`/historias-clinicas/${selectedHistoria.id}/detalle`, { token })
      setHistoriaDetalle(detalleActualizado)
      setNotice('Evolución clínica registrada correctamente.')
    } catch (cause) {
      setEvolucionError(cause instanceof Error ? cause.message : 'Error al registrar la evolución.')
    } finally {
      setSavingEvolucion(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Encabezado Principal */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <ClipboardList className="w-7 h-7 text-amber-600" />
            Historias Clínicas
          </h2>
          <p className="text-sm text-slate-500">
            Fichas odontológicas, antecedentes médicos, evoluciones clínicas y diagnósticos.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white font-medium px-4 py-2.5 rounded-xl shadow-xs transition-colors"
        >
          <Plus className="w-5 h-5" />
          Nueva Ficha
        </button>
      </div>

      {/* Avisos globales */}
      {notice && (
        <div className="flex items-center justify-between rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-sm text-emerald-800">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{notice}</span>
          </div>
          <button type="button" onClick={() => setNotice('')} className="text-emerald-700 hover:text-emerald-900">
            <X size={16} />
          </button>
        </div>
      )}

      {error && (
        <div className="flex items-center justify-between rounded-xl bg-rose-50 border border-rose-200 p-4 text-sm text-rose-800">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button type="button" onClick={() => setError('')} className="text-rose-700 hover:text-rose-900">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Tarjetas de Resumen */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500">Fichas Clínicas Activas</p>
              <p className="text-2xl font-bold text-slate-800 mt-1">{historias.length}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <ClipboardList className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500">Pacientes Registrados</p>
              <p className="text-2xl font-bold text-slate-800 mt-1">{pacientes.length}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500">Sin Ficha Inicial</p>
              <p className="text-2xl font-bold text-slate-800 mt-1">
                {Math.max(0, pacientes.length - pacientesConFicha.size)}
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center">
              <User className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>

      {/* Barra de Búsqueda */}
      <div className="relative">
        <Search className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar historia por paciente, DNI o N° de ficha..."
          className="w-full bg-white border border-slate-200 rounded-xl pl-11 pr-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
        />
      </div>

      {/* Listado de Historias Clínicas */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
          Cargando historias clínicas...
        </div>
      ) : filteredHistorias.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
          <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <ClipboardList className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-semibold text-slate-700">
            {search ? 'No se encontraron historias clínicas' : 'No hay fichas clínicas registradas aún'}
          </h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto mt-2">
            {search
              ? 'Intentá buscar con otros términos o limpiá el filtro de búsqueda.'
              : 'Comenzá agregando la primera ficha odontológica para asociar antecedentes y diagnósticos.'}
          </p>
          {!search && (
            <button
              type="button"
              onClick={openCreateModal}
              className="mt-4 inline-flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white font-medium px-4 py-2 rounded-xl text-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              Crear primera ficha
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredHistorias.map((historia) => {
            const paciente = pacienteMap.get(historia.pacienteId)
            return (
              <div
                key={historia.id}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:border-amber-300 hover:shadow-sm transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <span className="inline-flex items-center gap-1 text-xs font-bold bg-amber-100 text-amber-800 px-2.5 py-1 rounded-lg">
                      Ficha #{historia.id}
                    </span>
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {formatDate(historia.fechaApertura)}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-slate-800">
                    {paciente ? `${paciente.nombre} ${paciente.apellido}` : `Paciente #${historia.pacienteId}`}
                  </h3>
                  {paciente && (
                    <p className="text-xs text-slate-500 mt-0.5">
                      DNI: <span className="font-semibold text-slate-700">{paciente.dni}</span>
                      {paciente.telefono ? ` · Tel: ${paciente.telefono}` : ''}
                    </p>
                  )}

                  <div className="mt-3 pt-3 border-t border-slate-100">
                    <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">
                      Antecedentes / Observaciones
                    </p>
                    <p className="text-xs text-slate-600 line-clamp-3 italic">
                      {historia.observaciones || 'Sin observaciones registradas.'}
                    </p>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void openDetalleModal(historia)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold bg-amber-50 hover:bg-amber-100 text-amber-800 px-3 py-1.5 rounded-lg transition-colors"
                      title="Ver evoluciones y diagnósticos"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Evoluciones
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditModal(historia)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                      title="Editar ficha"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <Link
                    to="/odontograma"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800"
                    title="Ver odontograma general"
                  >
                    <Stethoscope className="w-3.5 h-3.5" />
                    Odontograma
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal: Crear / Editar Ficha */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-amber-600" />
                {editingHistoria ? `Editar Ficha #${editingHistoria.id}` : 'Nueva Ficha Odontológica'}
              </h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={(e) => void handleSaveFicha(e)} className="p-6 space-y-4">
              {modalError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3 rounded-xl flex items-center gap-2">
                  <AlertCircle size={16} className="shrink-0" />
                  <span>{modalError}</span>
                </div>
              )}

              {/* Selección de paciente */}
              <div>
                <label htmlFor="pacienteSelect" className="block text-xs font-semibold text-slate-700 mb-1">
                  Paciente *
                </label>
                {editingHistoria ? (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-800">
                    {pacienteMap.get(editingHistoria.pacienteId)?.nombre}{' '}
                    {pacienteMap.get(editingHistoria.pacienteId)?.apellido} (DNI:{' '}
                    {pacienteMap.get(editingHistoria.pacienteId)?.dni})
                  </div>
                ) : (
                  <select
                    id="pacienteSelect"
                    value={formPacienteId}
                    onChange={(e) => setFormPacienteId(e.target.value)}
                    required
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-hidden focus:border-amber-500"
                  >
                    <option value="">Seleccione un paciente...</option>
                    {pacientes.map((p) => {
                      const yaTiene = pacientesConFicha.has(p.id)
                      return (
                        <option key={p.id} value={p.id} disabled={yaTiene}>
                          {p.nombre} {p.apellido} - DNI: {p.dni} {yaTiene ? '(Ya tiene ficha)' : ''}
                        </option>
                      )
                    })}
                  </select>
                )}
                {!editingHistoria && pacientesConFicha.size >= pacientes.length && (
                  <p className="text-[11px] text-amber-700 mt-1">
                    Todos los pacientes registrados ya cuentan con una historia clínica. Podés agregar un nuevo paciente en la sección de Pacientes.
                  </p>
                )}
              </div>

              {/* Fecha de apertura */}
              <div>
                <label htmlFor="fechaAperturaInput" className="block text-xs font-semibold text-slate-700 mb-1">
                  Fecha de Apertura *
                </label>
                <input
                  id="fechaAperturaInput"
                  type="date"
                  value={formFechaApertura}
                  onChange={(e) => setFormFechaApertura(e.target.value)}
                  required
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-hidden focus:border-amber-500"
                />
              </div>

              {/* Observaciones y antecedentes */}
              <div>
                <label htmlFor="observacionesInput" className="block text-xs font-semibold text-slate-700 mb-1">
                  Antecedentes Médicos / Observaciones Iniciales
                </label>
                <textarea
                  id="observacionesInput"
                  rows={4}
                  value={formObservaciones}
                  onChange={(e) => setFormObservaciones(e.target.value)}
                  placeholder="Alergias a medicamentos, patologías previas, medicación habitual, motivo de apertura..."
                  maxLength={1000}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-hidden focus:border-amber-500"
                />
                <p className="text-[11px] text-slate-400 text-right mt-0.5">
                  {formObservaciones.length} / 1000 caracteres
                </p>
              </div>

              {/* Botones de acción */}
              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={modalSaving || (!editingHistoria && !formPacienteId)}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors"
                >
                  {modalSaving ? 'Guardando...' : editingHistoria ? 'Guardar Cambios' : 'Crear Ficha'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Detalle de Historia y Evoluciones Clínicas */}
      {selectedHistoria && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl border border-slate-200 max-h-[90vh] flex flex-col overflow-hidden">
            {/* Header modal */}
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 shrink-0">
              <div>
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-amber-600" />
                  Evoluciones Clínicas · Ficha #{selectedHistoria.id}
                </h3>
                <p className="text-xs text-slate-500">
                  {pacienteMap.get(selectedHistoria.pacienteId)?.nombre}{' '}
                  {pacienteMap.get(selectedHistoria.pacienteId)?.apellido} · DNI:{' '}
                  {pacienteMap.get(selectedHistoria.pacienteId)?.dni}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedHistoria(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            {/* Contenido scrolleable */}
            <div className="p-6 overflow-y-auto space-y-5 flex-1">
              {/* Tarjeta de Antecedentes */}
              <div className="bg-amber-50/60 border border-amber-200/80 rounded-xl p-4">
                <p className="text-xs font-bold text-amber-900 uppercase tracking-wider mb-1">
                  Antecedentes y Observaciones de la Ficha
                </p>
                <p className="text-xs text-slate-700">
                  {selectedHistoria.observaciones || 'Sin antecedentes iniciales registrados.'}
                </p>
                <p className="text-[10px] text-amber-700 mt-2">
                  Fecha de apertura: {formatDate(selectedHistoria.fechaApertura)}
                </p>
              </div>

              {/* Formulario para agregar nueva evolución */}
              <form onSubmit={(e) => void handleAddEvolucion(e)} className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <p className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Stethoscope className="w-4 h-4 text-amber-600" />
                  Registrar Nueva Evolución / Diagnóstico
                </p>
                {evolucionError && (
                  <p className="text-xs text-rose-600">{evolucionError}</p>
                )}
                <div>
                  <textarea
                    rows={3}
                    value={nuevaEvolucion}
                    onChange={(e) => setNuevaEvolucion(e.target.value)}
                    placeholder="Detalle de la sesión clínica, hallazgos, diagnóstico o procedimiento realizado..."
                    required
                    className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-hidden focus:border-amber-500"
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={savingEvolucion || !nuevaEvolucion.trim()}
                    className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
                  >
                    {savingEvolucion ? 'Registrando...' : 'Agregar Evolución'}
                  </button>
                </div>
              </form>

              {/* Lista de evoluciones */}
              <div>
                <h4 className="text-sm font-bold text-slate-800 mb-3">
                  Historial de Diagnósticos y Evoluciones ({historiaDetalle?.diagnosticos?.length || 0})
                </h4>

                {loadingDetalle ? (
                  <p className="text-xs text-slate-400 text-center py-4">Cargando evoluciones...</p>
                ) : !historiaDetalle?.diagnosticos || historiaDetalle.diagnosticos.length === 0 ? (
                  <div className="border border-dashed border-slate-200 rounded-xl p-6 text-center text-xs text-slate-500">
                    Aún no se han registrado diagnósticos ni evoluciones para esta historia clínica.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {historiaDetalle.diagnosticos.map((d) => (
                      <div key={d.id} className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs">
                        <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                          <span className="font-semibold text-slate-700">Diagnóstico #{d.id}</span>
                          <span>{formatDate(d.fecha)}</span>
                        </div>
                        <p className="text-xs text-slate-800">{d.descripcion}</p>
                        {d.tratamientos && d.tratamientos.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-slate-100">
                            <p className="text-[10px] font-semibold text-slate-500 uppercase">Tratamientos:</p>
                            <ul className="list-disc list-inside text-xs text-slate-600 mt-1">
                              {d.tratamientos.map((t) => (
                                <li key={t.id}>{t.descripcion}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Footer modal */}
            <div className="border-t border-slate-100 px-6 py-3 shrink-0 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedHistoria(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default HistoriasClinicasPage
