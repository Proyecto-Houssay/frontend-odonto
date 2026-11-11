import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { CalendarDays, CheckCircle2, Clock3, Stethoscope, UserRound } from 'lucide-react'
import { ApiError, apiRequest } from '../../lib/api'

export type DoctorDisponible = {
  id: number
  nombre: string
  apellido: string
  nombreCompleto: string
  especialidad: string
}

export type TurnoSlot = {
  odontologoId: number
  odontologoNombre: string
  especialidad: string
  fecha: string
  hora: string
  etiquetaFecha: string
  etiquetaHora: string
}

export type ReservaChatbotResponse = {
  turnoId: number
  fecha: string
  hora: string
  motivo: string
  estado: string
  odontologoId: number
  odontologoNombre: string
  pacienteId: number
  pacienteNombre: string
  mensaje: string
}

export type AgendaAsistente = {
  requiereFichaPaciente: boolean
  esStaff: boolean
  doctores: DoctorDisponible[]
  slotsDisponibles: TurnoSlot[]
  fechaConsultada?: string
  odontologoConsultadoId?: number
  horaSugerida?: string
  motivoSugerido?: string
  turnoConfirmado?: ReservaChatbotResponse
}

type PatientOption = { id: number; nombre: string; apellido: string; dni?: string }

interface ChatbotAgendaCardProps {
  agenda: AgendaAsistente
  token: string
  compact?: boolean
  onBooked: (reserva: ReservaChatbotResponse) => void
}

const MOTIVOS_RAPIDOS = ['Control general', 'Limpieza dental', 'Dolor / urgencia', 'Ortodoncia'] as const

function localDateKey(offsetDays = 0) {
  const date = new Date()
  date.setDate(date.getDate() + offsetDays)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function ChatbotAgendaCard({ agenda, token, compact = false, onBooked }: ChatbotAgendaCardProps) {
  const today = localDateKey(0)
  const tomorrow = localDateKey(1)
  const dayAfter = localDateKey(2)

  const initialDoctorId = String(agenda.odontologoConsultadoId || agenda.slotsDisponibles[0]?.odontologoId || agenda.doctores[0]?.id || '')
  const initialDate = agenda.fechaConsultada || agenda.slotsDisponibles[0]?.fecha || today

  const [doctorId, setDoctorId] = useState(initialDoctorId)
  const [fecha, setFecha] = useState(initialDate)
  const [selectedHora, setSelectedHora] = useState(() => (agenda.horaSugerida ? agenda.horaSugerida.slice(0, 5) : ''))
  const [motivo, setMotivo] = useState(() => agenda.motivoSugerido || '')
  const [slots, setSlots] = useState<TurnoSlot[]>(() =>
    agenda.slotsDisponibles.filter(
      slot => String(slot.odontologoId) === initialDoctorId && slot.fecha === initialDate,
    ),
  )
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [patients, setPatients] = useState<PatientOption[]>([])
  const [patientId, setPatientId] = useState('')
  const [dni, setDni] = useState('')
  const [fechaNacimiento, setFechaNacimiento] = useState('')
  const [telefono, setTelefono] = useState('')
  const [profileLinked, setProfileLinked] = useState(!agenda.requiereFichaPaciente)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [booked, setBooked] = useState<ReservaChatbotResponse | null>(agenda.turnoConfirmado ?? null)

  const [slotRefresh, setSlotRefresh] = useState(0)

  const refreshDaySlots = useCallback(() => {
    setSlotRefresh(count => count + 1)
  }, [])

  useEffect(() => {
    if (booked || !doctorId || !fecha) return
    let active = true
    apiRequest<TurnoSlot[]>(
      `/chatbot/turnos/disponibles?fecha=${encodeURIComponent(fecha)}&odontologoId=${encodeURIComponent(doctorId)}`,
      { token },
    )
      .then(result => {
        if (active && Array.isArray(result)) setSlots(result)
      })
      .catch(() => {
        if (active) {
          setSlots(
            agenda.slotsDisponibles.filter(
              slot => String(slot.odontologoId) === doctorId && slot.fecha === fecha,
            ),
          )
        }
      })
      .finally(() => {
        if (active) setLoadingSlots(false)
      })
    return () => { active = false }
  }, [agenda.slotsDisponibles, doctorId, fecha, booked, token, slotRefresh])

  useEffect(() => {
    if (!agenda.esStaff || booked) return
    let active = true
    apiRequest<PatientOption[]>('/pacientes', { token })
      .then(list => {
        if (!active || !Array.isArray(list)) return
        setPatients(list)
        if (list.length > 0) {
          setPatientId(current => current || String(list[0].id))
        }
      })
      .catch(() => { /* Staff select stays empty if list fails */ })
    return () => { active = false }
  }, [agenda.esStaff, booked, token])

  const selectedDoctor = useMemo(
    () => agenda.doctores.find(doc => String(doc.id) === doctorId) ?? null,
    [agenda.doctores, doctorId],
  )

  const quickSlots = useMemo(() => agenda.slotsDisponibles.slice(0, compact ? 4 : 6), [agenda.slotsDisponibles, compact])

  function pickQuickSlot(slot: TurnoSlot) {
    setError('')
    setDoctorId(String(slot.odontologoId))
    setFecha(slot.fecha)
    setSelectedHora(slot.hora.slice(0, 5))
  }

  async function handleBook(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!doctorId || !fecha || !selectedHora || !motivo.trim()) {
      setError('Elegí un profesional, una fecha, un horario libre y escribí el motivo de consulta.')
      return
    }
    if (agenda.esStaff && !patientId) {
      setError('Seleccioná un paciente para registrar el turno.')
      return
    }
    if (!profileLinked && (!dni.trim() || !fechaNacimiento)) {
      setError('Completá tu DNI y fecha de nacimiento para vincular tu ficha antes de sacar el turno.')
      return
    }

    setSubmitting(true)
    setError('')
    try {
      if (!profileLinked) {
        await apiRequest('/portal-paciente/perfil', {
          method: 'POST',
          token,
          body: { dni: dni.trim(), telefono: telefono.trim(), fechaNacimiento },
        })
        setProfileLinked(true)
      }

      const horaPayload = selectedHora.length === 5 ? `${selectedHora}:00` : selectedHora
      const created = await apiRequest<ReservaChatbotResponse>('/chatbot/turnos/reservar', {
        method: 'POST',
        token,
        body: {
          odontologoId: Number(doctorId),
          fecha,
          hora: horaPayload,
          motivo: motivo.trim(),
          ...(agenda.esStaff && patientId ? { pacienteId: Number(patientId) } : {}),
        },
      })
      setBooked(created)
      onBooked(created)
    } catch (failure) {
      const msg = failure instanceof ApiError || failure instanceof Error
        ? failure.message
        : 'No se pudo reservar el turno. Intentá con otro horario.'
      setError(msg)
      setLoadingSlots(true)
      refreshDaySlots()
    } finally {
      setSubmitting(false)
    }
  }

  if (booked) {
    return (
      <div className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs font-semibold text-emerald-900">
        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
        <span>
          Turno #{booked.turnoId} confirmado · {booked.fecha} a las {booked.hora.slice(0, 5)} hs · Dr./Dra. {booked.odontologoNombre}
        </span>
      </div>
    )
  }

  if (!agenda.doctores.length) {
    return null
  }

  return (
    <form onSubmit={handleBook} className="mt-3 space-y-3 rounded-xl border border-blue-200 bg-white/95 p-3.5 text-slate-900 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
        <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-blue-800">
          <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
          Sacar turno desde el asistente
        </p>
        {selectedDoctor && (
          <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-semibold text-blue-800">
            {selectedDoctor.especialidad}
          </span>
        )}
      </div>

      {quickSlots.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold text-slate-600">Próximos turnos disponibles (clic rápido):</p>
          <div className="flex flex-wrap gap-1.5">
            {quickSlots.map(slot => {
              const isSelected = String(slot.odontologoId) === doctorId && slot.fecha === fecha && slot.hora.slice(0, 5) === selectedHora
              return (
                <button
                  key={`${slot.odontologoId}-${slot.fecha}-${slot.hora}`}
                  type="button"
                  onClick={() => pickQuickSlot(slot)}
                  className={`rounded-lg border px-2.5 py-1 text-left text-[11px] font-semibold transition ${
                    isSelected
                      ? 'border-blue-700 bg-blue-700 text-white shadow-xs'
                      : 'border-blue-200 bg-blue-50/70 text-blue-900 hover:border-blue-400 hover:bg-blue-100/70'
                  }`}
                >
                  {slot.etiquetaFecha} · {slot.etiquetaHora} hs · {slot.odontologoNombre}
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div className={`grid gap-2.5 ${compact ? 'grid-cols-1' : 'sm:grid-cols-2'}`}>
        <label className="grid gap-1 text-xs font-semibold text-slate-700">
          <span className="flex items-center gap-1"><Stethoscope className="h-3.5 w-3.5 text-blue-600" aria-hidden="true" /> Doctor disponible</span>
          <select
            aria-label="Doctor disponible"
            value={doctorId}
            onChange={event => {
              setDoctorId(event.target.value)
              setSelectedHora('')
              setError('')
            }}
            className="min-h-9 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-900 outline-none focus:border-blue-600"
          >
            {agenda.doctores.map(doc => (
              <option key={doc.id} value={doc.id}>
                Dr./Dra. {doc.nombreCompleto} — {doc.especialidad}
              </option>
            ))}
          </select>
        </label>

        <div className="grid gap-1 text-xs font-semibold text-slate-700">
          <label htmlFor={`chat-date-${agenda.fechaConsultada || 'default'}`} className="flex items-center gap-1">
            <CalendarDays className="h-3.5 w-3.5 text-blue-600" aria-hidden="true" /> Fecha del turno
          </label>
          <div className="flex flex-wrap items-center gap-1.5">
            <input
              id={`chat-date-${agenda.fechaConsultada || 'default'}`}
              type="date"
              min={today}
              value={fecha}
              onChange={event => {
                setFecha(event.target.value)
                setSelectedHora('')
                setError('')
              }}
              className="min-h-9 flex-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-900 outline-none focus:border-blue-600"
            />
            <button type="button" onClick={() => { setFecha(today); setSelectedHora('') }} className={`rounded-md border px-2 py-1 text-[11px] font-semibold ${fecha === today ? 'border-blue-600 bg-blue-50 text-blue-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>Hoy</button>
            <button type="button" onClick={() => { setFecha(tomorrow); setSelectedHora('') }} className={`rounded-md border px-2 py-1 text-[11px] font-semibold ${fecha === tomorrow ? 'border-blue-600 bg-blue-50 text-blue-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>Mañana</button>
            <button type="button" onClick={() => { setFecha(dayAfter); setSelectedHora('') }} className={`rounded-md border px-2 py-1 text-[11px] font-semibold ${fecha === dayAfter ? 'border-blue-600 bg-blue-50 text-blue-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>Pasado</button>
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <p className="flex items-center gap-1 text-xs font-semibold text-slate-700">
          <Clock3 className="h-3.5 w-3.5 text-blue-600" aria-hidden="true" />
          Horarios libres para el {fecha}
        </p>
        {loadingSlots ? (
          <p className="text-xs text-slate-500">Consultando horarios libres…</p>
        ) : slots.length === 0 ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs text-amber-900">
            No quedan horarios libres para esta fecha con el profesional elegido. Probá otro día u otro doctor.
          </p>
        ) : (
          <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto pr-1">
            {slots.map(slot => {
              const hhmm = slot.hora.slice(0, 5)
              const active = selectedHora === hhmm
              return (
                <button
                  key={`${slot.fecha}-${slot.hora}`}
                  type="button"
                  aria-pressed={active}
                  onClick={() => { setSelectedHora(hhmm); setError('') }}
                  className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${
                    active
                      ? 'border-blue-700 bg-blue-700 text-white shadow-xs'
                      : 'border-slate-200 bg-slate-50 text-slate-800 hover:border-blue-400 hover:bg-blue-50'
                  }`}
                >
                  {hhmm}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {agenda.esStaff && (
        <label className="grid gap-1 text-xs font-semibold text-slate-700">
          <span className="flex items-center gap-1"><UserRound className="h-3.5 w-3.5 text-blue-600" aria-hidden="true" /> Paciente</span>
          <select
            aria-label="Paciente para el turno"
            required
            value={patientId}
            onChange={event => setPatientId(event.target.value)}
            className="min-h-9 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-900 outline-none focus:border-blue-600"
          >
            <option value="">Seleccionar paciente</option>
            {patients.map(patient => (
              <option key={patient.id} value={patient.id}>
                {patient.nombre} {patient.apellido}{patient.dni ? ` · DNI ${patient.dni}` : ''}
              </option>
            ))}
          </select>
        </label>
      )}

      {!profileLinked && (
        <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50/80 p-2.5 text-xs text-amber-950">
          <p className="font-semibold">Para confirmar el turno vinculamos tu ficha de paciente por única vez:</p>
          <div className={`grid gap-2 ${compact ? 'grid-cols-1' : 'sm:grid-cols-3'}`}>
            <label className="grid gap-1 font-medium">
              DNI
              <input
                required
                minLength={5}
                maxLength={30}
                value={dni}
                onChange={event => setDni(event.target.value)}
                placeholder="Tu DNI"
                className="min-h-8 rounded-md border border-amber-300 bg-white px-2 py-1 text-xs text-slate-900"
              />
            </label>
            <label className="grid gap-1 font-medium">
              Fecha de nacimiento
              <input
                required
                type="date"
                max={today}
                value={fechaNacimiento}
                onChange={event => setFechaNacimiento(event.target.value)}
                className="min-h-8 rounded-md border border-amber-300 bg-white px-2 py-1 text-xs text-slate-900"
              />
            </label>
            <label className="grid gap-1 font-medium">
              Teléfono (opcional)
              <input
                maxLength={30}
                value={telefono}
                onChange={event => setTelefono(event.target.value)}
                placeholder="11..."
                className="min-h-8 rounded-md border border-amber-300 bg-white px-2 py-1 text-xs text-slate-900"
              />
            </label>
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        <label className="grid gap-1 text-xs font-semibold text-slate-700">
          Motivo de la consulta
          <input
            required
            maxLength={200}
            value={motivo}
            onChange={event => setMotivo(event.target.value)}
            placeholder="Ej: Control general, limpieza dental, dolor en pieza..."
            className="min-h-9 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-900 outline-none focus:border-blue-600"
          />
        </label>
        <div className="flex flex-wrap gap-1.5">
          {MOTIVOS_RAPIDOS.map(opcion => (
            <button
              key={opcion}
              type="button"
              onClick={() => setMotivo(opcion)}
              className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-700 hover:border-blue-300 hover:bg-blue-50"
            >
              {opcion}
            </button>
          ))}
        </div>
      </div>

      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-2 text-xs font-medium text-red-800">{error}</p>}

      <button
        type="submit"
        disabled={submitting || !selectedHora || !doctorId || !motivo.trim()}
        className="inline-flex min-h-9 w-full items-center justify-center rounded-lg bg-blue-700 px-3.5 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting
          ? 'Confirmando turno…'
          : !profileLinked
            ? 'Completar ficha y confirmar turno'
            : selectedHora
              ? `Confirmar turno · ${fecha} a las ${selectedHora} hs`
              : 'Elegí un horario libre arriba para confirmar'}
      </button>
    </form>
  )
}
