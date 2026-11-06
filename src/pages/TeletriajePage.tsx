import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Video,
  AlertTriangle,
  Clock,
  ShieldCheck,
  Calendar,
  User,
  Filter,
  CheckCircle2,
  XCircle,
  ExternalLink,
  PhoneCall,
  Search
} from 'lucide-react'

export interface Solicitud {
  id: number
  pacienteId: number
  pacienteNombre: string
  pacienteDni: string
  motivoConsulta: string
  descripcionSintomas?: string
  prioridadSugerida: string
  prioridadValidada?: string
  prioridadEfectiva: string
  estadoValidacion: string
  signosAlarma: boolean
  derivacionHumana: boolean
  origen: string
  estado: string
  profesionalValidadorId?: number
  profesionalValidadorNombre?: string
  observacionesClinicas?: string
  fechaCreacion: string
  fechaValidacion?: string
  turnoId?: number
}

export interface Cita {
  id: number
  solicitudId?: number
  turnoId: number
  pacienteId: number
  pacienteNombre: string
  pacienteDni: string
  odontologoId: number
  odontologoNombre: string
  fecha: string
  hora: string
  consentimientoInformado: boolean
  fechaConsentimiento?: string
  grabacionHabilitada: boolean
  estadoSala: string
  enlaceVideo?: string
  enlaceExpiraEn?: string
  enlaceFuncional: boolean
  expirada: boolean
  fechaCreacion: string
}

export const TeletriajePage: React.FC = () => {
  // Configuración de sesión / rol
  const [token, setToken] = useState<string>('')
  const [rol, setRol] = useState<'RECEPCIONISTA' | 'ODONTOLOGO' | 'PACIENTE'>('RECEPCIONISTA')
  const [pacienteIdActivo, setPacienteIdActivo] = useState<string>('1')

  // Datos
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([])
  const [citas, setCitas] = useState<Cita[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [errorStatus, setErrorStatus] = useState<number | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Filtros
  const [filtroPrioridad, setFiltroPrioridad] = useState<string>('TODAS')
  const [filtroValidacion, setFiltroValidacion] = useState<string>('TODAS')
  const [busqueda, setBusqueda] = useState<string>('')

  // Modales y formularios
  const [solicitudParaValidar, setSolicitudParaValidar] = useState<Solicitud | null>(null)
  const [nuevaPrioridad, setNuevaPrioridad] = useState<string>('AMARILLO')
  const [observacionesValidacion, setObservacionesValidacion] = useState<string>('')

  const [solicitudParaReservar, setSolicitudParaReservar] = useState<Solicitud | null>(null)
  const [odontologoIdReserva, setOdontologoIdReserva] = useState<string>('1')
  const [fechaReserva, setFechaReserva] = useState<string>('')
  const [horaReserva, setHoraReserva] = useState<string>('10:00')
  const [motivoReserva, setMotivoReserva] = useState<string>('')
  const [consentimiento, setConsentimiento] = useState<boolean>(false)
  const [requiereVideo, setRequiereVideo] = useState<boolean>(true)
  const [reservaConflictError, setReservaConflictError] = useState<string | null>(null)
  const [reservaConfirmada, setReservaConfirmada] = useState<Cita | null>(null)

  const cargarDatos = useCallback(async () => {
    setLoading(true)
    setErrorStatus(null)
    setErrorMessage(null)

    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }
    if (token.trim()) {
      headers['Authorization'] = `Bearer ${token.trim()}`
    }

    try {
      if (rol === 'PACIENTE') {
        const idPac = pacienteIdActivo.trim() || '1'
        const resSol = await fetch(`/api/teletriaje/solicitudes/paciente/${idPac}`, { headers })
        if (resSol.status === 401 || resSol.status === 403) {
          setErrorStatus(resSol.status)
          setErrorMessage(
            resSol.status === 401
              ? 'Sesión vencida o token no válido. Inicie sesión nuevamente.'
              : 'Acceso denegado (403): Solo puede consultar sus propias solicitudes.'
          )
          setSolicitudes([])
          setCitas([])
          setLoading(false)
          return
        }
        if (resSol.ok) {
          const dataSol = await resSol.json()
          setSolicitudes(Array.isArray(dataSol) ? dataSol : [])
        }

        const resCitas = await fetch(`/api/teletriaje/citas/paciente/${idPac}`, { headers })
        if (resCitas.ok) {
          const dataCitas = await resCitas.json()
          setCitas(Array.isArray(dataCitas) ? dataCitas : [])
        }
      } else {
        const resSol = await fetch('/api/teletriaje/solicitudes', { headers })
        if (resSol.status === 401) {
          setErrorStatus(401)
          setErrorMessage('Sesión vencida o token no válido. Inicie sesión nuevamente.')
          setSolicitudes([])
          setLoading(false)
          return
        }
        if (resSol.status === 403) {
          setErrorStatus(403)
          setErrorMessage('Acceso denegado (403): Solo personal autorizado puede consultar la cola completa.')
          setSolicitudes([])
          setLoading(false)
          return
        }
        if (resSol.ok) {
          const dataSol = await resSol.json()
          setSolicitudes(Array.isArray(dataSol) ? dataSol : [])
        }
      }
    } catch (err: unknown) {
      setErrorStatus(500)
      setErrorMessage(err instanceof Error ? err.message : 'Error al conectar con la API de teletriaje')
    } finally {
      setLoading(false)
    }
  }, [token, rol, pacienteIdActivo])

  useEffect(() => {
    cargarDatos()
  }, [cargarDatos])

  const solicitudesFiltradas = useMemo(() => {
    return solicitudes.filter((s) => {
      const prioridadMatch =
        filtroPrioridad === 'TODAS' ||
        s.prioridadEfectiva?.toUpperCase() === filtroPrioridad.toUpperCase()

      const validacionMatch =
        filtroValidacion === 'TODAS' ||
        (filtroValidacion === 'SUGERIDA' && s.estadoValidacion === 'SUGERIDA') ||
        (filtroValidacion === 'VALIDADA' && s.estadoValidacion === 'VALIDADA') ||
        (filtroValidacion === 'ALARMA' && (s.signosAlarma || s.derivacionHumana))

      const busquedaLower = busqueda.toLowerCase().trim()
      const searchMatch =
        !busquedaLower ||
        (s.pacienteNombre && s.pacienteNombre.toLowerCase().includes(busquedaLower)) ||
        (s.pacienteDni && s.pacienteDni.includes(busquedaLower)) ||
        (s.motivoConsulta && s.motivoConsulta.toLowerCase().includes(busquedaLower))

      return prioridadMatch && validacionMatch && searchMatch
    })
  }, [solicitudes, filtroPrioridad, filtroValidacion, busqueda])

  const handleValidarPrioridad = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!solicitudParaValidar) return

    setLoading(true)
    setErrorMessage(null)
    setSuccessMessage(null)

    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (token.trim()) headers['Authorization'] = `Bearer ${token.trim()}`

    try {
      const res = await fetch(`/api/teletriaje/solicitudes/${solicitudParaValidar.id}/prioridad`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          nuevaPrioridad,
          observacionesClinicas: observacionesValidacion
        })
      })

      if (res.status === 403) {
        setErrorMessage('Acceso denegado (403): Solo un profesional Odontólogo o Administrador puede validar la prioridad.')
        setLoading(false)
        return
      }

      if (!res.ok) {
        const errorText = await res.text()
        setErrorMessage(errorText || 'Error al validar la prioridad.')
        setLoading(false)
        return
      }

      setSuccessMessage(`Prioridad de la solicitud #${solicitudParaValidar.id} validada correctamente como ${nuevaPrioridad}.`)
      setSolicitudParaValidar(null)
      setObservacionesValidacion('')
      await cargarDatos()
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Error al procesar la validación.')
    } finally {
      setLoading(false)
    }
  }

  const handleConfirmarReserva = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!solicitudParaReservar) return

    setReservaConflictError(null)
    setErrorMessage(null)
    setSuccessMessage(null)

    if (!consentimiento) {
      setReservaConflictError('Debe aceptar el consentimiento informado para confirmar la reserva de teletriaje.')
      return
    }

    if (!fechaReserva) {
      setReservaConflictError('Debe seleccionar una fecha válida.')
      return
    }

    setLoading(true)
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (token.trim()) headers['Authorization'] = `Bearer ${token.trim()}`

    try {
      const res = await fetch(`/api/teletriaje/solicitudes/${solicitudParaReservar.id}/reservar`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          odontologoId: Number(odontologoIdReserva),
          fecha: fechaReserva,
          hora: horaReserva.length === 5 ? `${horaReserva}:00` : horaReserva,
          motivo: motivoReserva || `Teletriaje: ${solicitudParaReservar.motivoConsulta}`,
          consentimientoInformado: consentimiento,
          requiereVideollamada: requiereVideo
        })
      })

      if (res.status === 409) {
        const txt = await res.text()
        setReservaConflictError(
          `Conflicto de horario (409): ${txt || 'El profesional ya no cuenta con disponibilidad en el horario seleccionado o la solicitud ya cuenta con reserva.'}`
        )
        setLoading(false)
        return
      }

      if (res.status === 401) {
        setReservaConflictError('Sesión vencida: Debe autenticarse nuevamente.')
        setLoading(false)
        return
      }

      if (res.status === 403) {
        setReservaConflictError('Acceso denegado (403): No tiene permisos para registrar reservas.')
        setLoading(false)
        return
      }

      if (!res.ok) {
        const errTxt = await res.text()
        setReservaConflictError(errTxt || 'No se pudo confirmar la reserva.')
        setLoading(false)
        return
      }

      // Respuesta exitosa del BE confirmada
      const citaCreada: Cita = await res.json()
      setReservaConfirmada(citaCreada)
      setSuccessMessage(`Reserva confirmada con éxito. Turno #${citaCreada.turnoId} asignado.`)
      setSolicitudParaReservar(null)
      setConsentimiento(false)
      await cargarDatos()
    } catch (err: unknown) {
      setReservaConflictError(err instanceof Error ? err.message : 'Error al comunicar con el servidor.')
    } finally {
      setLoading(false)
    }
  }

  const badgePrioridad = (prioridad: string, validada: boolean, signosAlarma: boolean) => {
    const p = prioridad?.toUpperCase() || 'VERDE'

    let colorClase = 'bg-emerald-100 text-emerald-800 border-emerald-300'
    let texto = 'Verde (Baja)'

    if (p === 'ROJO' || p === 'ALTA' || p === 'URGENTE') {
      colorClase = 'bg-red-100 text-red-800 border-red-300'
      texto = 'Rojo (Urgente / Alta)'
    } else if (p === 'AMARILLO' || p === 'MEDIA') {
      colorClase = 'bg-amber-100 text-amber-800 border-amber-300'
      texto = 'Amarillo (Media / Prioritaria)'
    }

    return (
      <div className="flex flex-col gap-1 items-start">
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${colorClase}`}>
          <span className="w-2 h-2 rounded-full bg-current"></span>
          {texto}
        </span>
        <span className="text-[11px] text-slate-500 font-medium">
          {validada ? (
            <span className="text-blue-700 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 inline" /> Validada por profesional
            </span>
          ) : (
            <span className="text-slate-500">Prioridad sugerida (orientativa)</span>
          )}
        </span>
        {signosAlarma && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-600 text-white text-[11px] font-bold">
            <AlertTriangle className="w-3 h-3" /> Atención humana inmediata
          </span>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Video className="w-7 h-7 text-blue-600" />
            Gestión de Teletriaje y Cola Prioritaria
          </h2>
          <p className="text-sm text-slate-500">
            Atención remota, clasificación por semáforo clínico y agenda segura con control de concurrencia.
          </p>
        </div>
      </div>

      {/* Barra de simulación de Rol y Token para verificación */}
      <div className="bg-slate-900 text-slate-100 p-4 rounded-2xl shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <User className="w-5 h-5 text-blue-400" />
            <span className="text-sm font-semibold">Rol activo de consulta:</span>
            <div className="flex bg-slate-800 rounded-xl p-1 border border-slate-700">
              <button
                type="button"
                onClick={() => setRol('RECEPCIONISTA')}
                className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                  rol === 'RECEPCIONISTA' ? 'bg-blue-600 text-white shadow' : 'text-slate-300 hover:text-white'
                }`}
              >
                Recepcionista
              </button>
              <button
                type="button"
                onClick={() => setRol('ODONTOLOGO')}
                className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                  rol === 'ODONTOLOGO' ? 'bg-blue-600 text-white shadow' : 'text-slate-300 hover:text-white'
                }`}
              >
                Odontólogo
              </button>
              <button
                type="button"
                onClick={() => setRol('PACIENTE')}
                className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                  rol === 'PACIENTE' ? 'bg-blue-600 text-white shadow' : 'text-slate-300 hover:text-white'
                }`}
              >
                Paciente
              </button>
            </div>
          </div>

          {rol === 'PACIENTE' && (
            <div className="flex items-center gap-2">
              <label htmlFor="pacienteIdInput" className="text-xs text-slate-300 font-medium">
                ID Paciente:
              </label>
              <input
                id="pacienteIdInput"
                type="text"
                value={pacienteIdActivo}
                onChange={(e) => setPacienteIdActivo(e.target.value)}
                className="w-16 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white"
              />
            </div>
          )}

          <div className="flex-1 max-w-md flex items-center gap-2">
            <label htmlFor="tokenBearerInput" className="text-xs text-slate-300 font-medium whitespace-nowrap">
              Token JWT:
            </label>
            <input
              id="tokenBearerInput"
              type="password"
              placeholder="Bearer token opcional (vacío para demo)"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-blue-500"
            />
            <button
              type="button"
              onClick={cargarDatos}
              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors"
            >
              Recargar
            </button>
          </div>
        </div>
      </div>

      {/* Notificaciones globales */}
      {successMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl flex items-center gap-3 text-sm">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-xl flex items-center gap-3 text-sm">
          <XCircle className="w-5 h-5 text-red-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Cuadro explicativo de HU y Criterios de Aceptación */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-xs text-blue-900 space-y-1">
        <p className="font-semibold flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-blue-600" />
          Reglas clínicas y seguridad de teletriaje (HU-15 / HU-19):
        </p>
        <p>• El semáforo es orientativo hasta validación profesional; signos de alarma se derivan a atención humana, no a una espera automática.</p>
        <p>• Reserva transaccional con control de concurrencia: dos solicitudes simultáneas no obtienen el mismo horario (HTTP 409).</p>
        <p>• El paciente solo consulta sus propios turnos. La acción de video aparece únicamente cuando el backend entrega un enlace válido y activo.</p>
      </div>

      {/* VISTA PARA PACIENTE: Solo ve sus turnos y enlaces válidos */}
      {rol === 'PACIENTE' ? (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-emerald-600" />
              Mis Citas de Teletriaje
            </h3>

            {loading ? (
              <p className="text-sm text-slate-500 py-4">Cargando citas de teletriaje...</p>
            ) : citas.length === 0 ? (
              <div className="text-center py-8 text-slate-500 space-y-2">
                <Video className="w-10 h-10 mx-auto text-slate-300" />
                <p className="font-medium">No tiene citas de teletriaje programadas.</p>
                <p className="text-xs text-slate-400">Cuando el equipo reserve una cita, aparecerá aquí con los detalles y el enlace seguro.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {citas.map((cita) => (
                  <div key={cita.id} className="border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-800">Cita #{cita.id}</span>
                        <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-mono">
                          {cita.fecha} {cita.hora}
                        </span>
                        <span className="text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                          Turno #{cita.turnoId}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600">Profesional: {cita.odontologoNombre || 'Asignado'}</p>
                      <p className="text-xs text-slate-500">
                        Consentimiento informado: {cita.consentimientoInformado ? 'Registrado ✓' : 'Pendiente'}
                      </p>
                      {cita.expirada && (
                        <p className="text-xs text-red-600 font-semibold flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" /> Enlace de teletriaje expirado / caducado
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Botón de videollamada ÚNICAMENTE si existe enlace funcional */}
                      {cita.enlaceFuncional && cita.enlaceVideo ? (
                        <a
                          href={cita.enlaceVideo}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs px-4 py-2 rounded-xl transition-colors shadow-xs"
                        >
                          <PhoneCall className="w-4 h-4" />
                          Ingresar a Videollamada
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      ) : (
                        <div className="text-right">
                          <span className="inline-block text-xs bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg border border-slate-200">
                            {cita.expirada ? 'Enlace caducado' : 'Pendiente de generación de sala'}
                          </span>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            Sin proveedor configurado o fuera de P0
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* VISTA PARA RECEPCIONISTA Y ODONTÓLOGO: Cola de prioridad, filtros y reserva */
        <div className="space-y-6">
          {/* Barra de Filtros */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 text-slate-600 text-xs font-semibold">
                <Filter className="w-4 h-4" />
                <span>Filtros:</span>
              </div>

              <select
                aria-label="Filtrar por prioridad"
                value={filtroPrioridad}
                onChange={(e) => setFiltroPrioridad(e.target.value)}
                className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-700 focus:outline-hidden focus:border-blue-500"
              >
                <option value="TODAS">Prioridad: Todas</option>
                <option value="ROJO">Rojo (Urgente / Alta)</option>
                <option value="AMARILLO">Amarillo (Media)</option>
                <option value="VERDE">Verde (Baja)</option>
              </select>

              <select
                aria-label="Filtrar por validación"
                value={filtroValidacion}
                onChange={(e) => setFiltroValidacion(e.target.value)}
                className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-700 focus:outline-hidden focus:border-blue-500"
              >
                <option value="TODAS">Estado: Todos</option>
                <option value="SUGERIDA">Solo Sugeridas (Orientativas)</option>
                <option value="VALIDADA">Solo Validadas por Profesional</option>
                <option value="ALARMA">Con Signos de Alarma</option>
              </select>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar paciente o motivo..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-700 focus:outline-hidden focus:border-blue-500"
              />
            </div>
          </div>

          {/* Tabla de la Cola de Prioridad */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-600" />
                Cola de Prioridad Clínica ({solicitudesFiltradas.length})
              </h3>
              <span className="text-xs text-slate-500">Ordenada por prioridad validada y fecha</span>
            </div>

            {errorStatus === 403 ? (
              <div className="p-8 text-center text-red-700 space-y-2">
                <XCircle className="w-10 h-10 text-red-500 mx-auto" />
                <p className="font-bold">Acceso Denegado (403)</p>
                <p className="text-xs">Solo el personal autorizado puede ver la cola completa de solicitudes.</p>
              </div>
            ) : loading ? (
              <div className="p-8 text-center text-slate-500">Cargando cola de teletriaje...</div>
            ) : solicitudesFiltradas.length === 0 ? (
              <div className="p-12 text-center text-slate-500 space-y-2">
                <CheckCircle2 className="w-10 h-10 text-slate-300 mx-auto" />
                <p className="font-medium text-slate-600">No hay solicitudes pendientes en la cola.</p>
                <p className="text-xs text-slate-400">Las nuevas solicitudes registradas por web o recepción se mostrarán aquí priorizadas.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-semibold text-[11px]">
                    <tr>
                      <th className="px-4 py-3">ID / Paciente</th>
                      <th className="px-4 py-3">Motivo / Síntomas</th>
                      <th className="px-4 py-3">Semáforo y Validación</th>
                      <th className="px-4 py-3">Estado</th>
                      <th className="px-4 py-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {solicitudesFiltradas.map((sol) => (
                      <tr key={sol.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-800">{sol.pacienteNombre || `Paciente #${sol.pacienteId}`}</p>
                          <p className="text-slate-400 text-[11px]">DNI: {sol.pacienteDni || '-'}</p>
                          <span className="text-[10px] text-slate-400 font-mono">Solicitud #{sol.id}</span>
                        </td>
                        <td className="px-4 py-3 max-w-xs">
                          <p className="font-medium text-slate-800">{sol.motivoConsulta}</p>
                          {sol.descripcionSintomas && (
                            <p className="text-slate-500 text-[11px] truncate mt-0.5" title={sol.descripcionSintomas}>
                              {sol.descripcionSintomas}
                            </p>
                          )}
                          {sol.observacionesClinicas && (
                            <p className="text-blue-700 bg-blue-50 p-1 rounded text-[10px] mt-1">
                              <strong>Obs. profesional:</strong> {sol.observacionesClinicas}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {badgePrioridad(
                            sol.prioridadEfectiva,
                            sol.estadoValidacion === 'VALIDADA',
                            sol.signosAlarma || sol.derivacionHumana
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium ${
                              sol.estado === 'RESERVADA'
                                ? 'bg-emerald-100 text-emerald-800'
                                : sol.estado === 'DERIVADA_URGENTE'
                                ? 'bg-red-100 text-red-800 font-bold'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {sol.estado}
                          </span>
                          {sol.turnoId && (
                            <p className="text-[10px] text-emerald-700 mt-0.5">Turno #{sol.turnoId}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right space-x-2">
                          {/* Validar Prioridad: solo odontólogo o admin */}
                          {rol === 'ODONTOLOGO' && (
                            <button
                              type="button"
                              onClick={() => {
                                setSolicitudParaValidar(sol)
                                setNuevaPrioridad(sol.prioridadEfectiva || 'AMARILLO')
                                setObservacionesValidacion(sol.observacionesClinicas || '')
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-semibold transition-colors"
                            >
                              Validar
                            </button>
                          )}

                          {/* Reservar Turno: recepcionista u odontólogo si aún no está reservada */}
                          {sol.estado !== 'RESERVADA' && (
                            <button
                              type="button"
                              onClick={() => {
                                setSolicitudParaReservar(sol)
                                setFechaReserva(new Date().toISOString().split('T')[0])
                                setReservaConflictError(null)
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 text-xs font-semibold transition-colors shadow-xs"
                            >
                              Reservar
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal / Formulario de Validación de Prioridad Profesional */}
      {solicitudParaValidar && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-blue-600" />
              Validación Profesional de Prioridad
            </h3>
            <p className="text-xs text-slate-500">
              Solicitud #{solicitudParaValidar.id} - Paciente: {solicitudParaValidar.pacienteNombre}
            </p>

            <form onSubmit={handleValidarPrioridad} className="space-y-4">
              <div>
                <label htmlFor="nuevaPrioridadSelect" className="block text-xs font-semibold text-slate-700 mb-1">
                  Nueva Prioridad Clínica:
                </label>
                <select
                  id="nuevaPrioridadSelect"
                  value={nuevaPrioridad}
                  onChange={(e) => setNuevaPrioridad(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 font-medium"
                >
                  <option value="ROJO">Rojo (Urgente / Alta) - Alarma</option>
                  <option value="AMARILLO">Amarillo (Media / Prioritaria)</option>
                  <option value="VERDE">Verde (Baja / Consulta general)</option>
                </select>
              </div>

              <div>
                <label htmlFor="observacionesClinicasInput" className="block text-xs font-semibold text-slate-700 mb-1">
                  Observaciones Clínicas:
                </label>
                <textarea
                  id="observacionesClinicasInput"
                  rows={3}
                  value={observacionesValidacion}
                  onChange={(e) => setObservacionesValidacion(e.target.value)}
                  placeholder="Justificación del triaje o criterio médico..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-800"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSolicitudParaValidar(null)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition-colors"
                >
                  Confirmar Validación
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal / Formulario de Reserva Transaccional */}
      {solicitudParaReservar && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4">
            <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-emerald-600" />
              Reserva de Turno de Teletriaje
            </h3>
            <p className="text-xs text-slate-500">
              Solicitud #{solicitudParaReservar.id} - Paciente: {solicitudParaReservar.pacienteNombre}
            </p>

            {reservaConflictError && (
              <div className="bg-red-50 border border-red-300 text-red-800 p-3 rounded-xl text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Error en la reserva:</p>
                  <p>{reservaConflictError}</p>
                </div>
              </div>
            )}

            <form onSubmit={handleConfirmarReserva} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="odontologoSelect" className="block text-xs font-semibold text-slate-700 mb-1">
                    ID Odontólogo:
                  </label>
                  <input
                    id="odontologoSelect"
                    type="number"
                    min="1"
                    value={odontologoIdReserva}
                    onChange={(e) => setOdontologoIdReserva(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="fechaReservaInput" className="block text-xs font-semibold text-slate-700 mb-1">
                    Fecha del Turno:
                  </label>
                  <input
                    id="fechaReservaInput"
                    type="date"
                    value={fechaReserva}
                    onChange={(e) => setFechaReserva(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="horaReservaInput" className="block text-xs font-semibold text-slate-700 mb-1">
                    Horario:
                  </label>
                  <select
                    id="horaReservaInput"
                    value={horaReserva}
                    onChange={(e) => setHoraReserva(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 font-mono"
                  >
                    <option value="09:00">09:00</option>
                    <option value="10:00">10:00</option>
                    <option value="11:00">11:00</option>
                    <option value="14:00">14:00</option>
                    <option value="15:00">15:00</option>
                    <option value="16:00">16:00</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="motivoReservaInput" className="block text-xs font-semibold text-slate-700 mb-1">
                    Motivo:
                  </label>
                  <input
                    id="motivoReservaInput"
                    type="text"
                    value={motivoReserva}
                    onChange={(e) => setMotivoReserva(e.target.value)}
                    placeholder="Teletriaje prioritario"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800"
                  />
                </div>
              </div>

              {/* Consentimiento informado obligatorio */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={consentimiento}
                    onChange={(e) => setConsentimiento(e.target.checked)}
                    className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    required
                  />
                  <span className="text-xs text-slate-700 font-medium">
                    He informado al paciente y registrado su <strong>consentimiento informado</strong> para la consulta remota por teletriaje.
                  </span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={requiereVideo}
                    onChange={(e) => setRequiereVideo(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-xs text-slate-600">
                    Generar enlace de sala virtual si el proveedor está habilitado (TR-49).
                  </span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSolicitudParaReservar(null)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition-colors shadow-xs"
                >
                  {loading ? 'Confirmando...' : 'Confirmar Reserva en BE'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tarjeta de Confirmación de Reserva Exitosa */}
      {reservaConfirmada && (
        <div className="bg-emerald-50 border border-emerald-300 rounded-2xl p-6 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-emerald-900 text-base flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              Reserva Transaccional Confirmada
            </h4>
            <button
              type="button"
              onClick={() => setReservaConfirmada(null)}
              className="text-xs text-emerald-700 hover:text-emerald-900 font-semibold"
            >
              Cerrar
            </button>
          </div>
          <p className="text-xs text-emerald-800">
            Turno #{reservaConfirmada.turnoId} asignado y confirmado para el paciente <strong>{reservaConfirmada.pacienteNombre}</strong> con el Dr./Dra. <strong>{reservaConfirmada.odontologoNombre}</strong> para el día <strong>{reservaConfirmada.fecha}</strong> a las <strong>{reservaConfirmada.hora}</strong>.
          </p>
          <div className="pt-1">
            {reservaConfirmada.enlaceFuncional && reservaConfirmada.enlaceVideo ? (
              <a
                href={reservaConfirmada.enlaceVideo}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs bg-emerald-700 text-white px-3 py-1.5 rounded-lg hover:bg-emerald-800 font-medium"
              >
                Abrir sala de teletriaje <ExternalLink className="w-3.5 h-3.5" />
              </a>
            ) : (
              <span className="text-xs text-slate-500 bg-white/80 px-2.5 py-1 rounded border border-emerald-200">
                Sala virtual: Pendiente de habilitación por proveedor de video.
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default TeletriajePage
