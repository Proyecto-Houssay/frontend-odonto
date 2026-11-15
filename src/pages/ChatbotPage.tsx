import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { BookPlus, ChevronDown, ShieldCheck, Sparkles, Stethoscope } from 'lucide-react'
import { ApiError, apiRequest } from '../lib/api'
import { useAuth } from '../auth/useAuth'
import { roleFromToken, type UserRole } from '../auth/role'
import {
  ChatbotAgendaCard,
  type AgendaAsistente,
  type ReservaChatbotResponse,
} from '../components/chatbot/ChatbotAgendaCard'

type Citation = { id: string; documento: string; version: string; fragmento: string }
type ChatResponse = {
  respuesta: string
  intencion: string
  timestamp: string
  citas?: Citation[]
  accionesSugeridas?: string[]
  agenda?: AgendaAsistente
}
type TurnoPropio = { id: number; fecha: string; hora: string; motivo: string; estado: string; odontologoNombre: string }
type TurnoClinica = {
  id: number
  fecha: string
  hora: string
  motivo?: string
  estado: string
  paciente?: { id?: number; nombre?: string; apellido?: string } | null
  odontologo?: { id?: number; nombre?: string; apellido?: string } | null
}
type ReporteSeguimiento = {
  id: number
  pacienteId: number
  pieza: number
  dolor: number
  sintomas: string
  estado: string
}
type SolicitudTeletriaje = {
  id: number
  motivo?: string
  prioridad?: string
  estado?: string
}
type UsuarioResumen = {
  id: number
  username: string
  nombre: string
  apellido: string
  rol: string
  activo: boolean
}
type OdontologoResumen = {
  id: number
  nombre: string
  apellido: string
  matricula: string
  activo?: boolean
  especialidad?: { id: number; nombre: string } | null
}

type ChatAction = { to: string; label: string }
type Message = {
  id: string
  role: 'user' | 'assistant'
  text: string
  citations?: Citation[]
  actions?: ChatAction[]
  noEvidence?: boolean
  agenda?: AgendaAsistente
}

const NO_EVIDENCE = 'No tengo información suficiente'
const LOCAL_GREETING_RESPONSE = '¡Hola! Soy el asistente de NovaDent. Puedo ayudarte a consultar los doctores disponibles, ver horarios libres y sacar un turno, consultar tu próximo turno registrado o abrir tu odontograma. No brindo diagnósticos ni invento precios.'
const SCHEDULE_FALLBACK_RESPONSE = 'Ahora no puedo confirmar los horarios ni la disponibilidad porque no hay una fuente vigente aprobada. Consultá tus turnos registrados o comunicate con recepción.'

const ACTIONS: Record<string, ChatAction> = {
  '/mis-turnos': { to: '/mis-turnos', label: 'Ver mis turnos' },
  '/mi-odontograma': { to: '/mi-odontograma', label: 'Ver mi odontograma' },
  '/': { to: '/', label: 'Registrar una observación' },
  '/turnos': { to: '/turnos', label: 'Agenda de turnos' },
  '/seguimiento': { to: '/seguimiento', label: 'Seguimiento de pacientes' },
  '/historias-clinicas': { to: '/historias-clinicas', label: 'Historias clínicas' },
  '/odontograma': { to: '/odontograma', label: 'Odontograma clínico' },
  '/teletriaje': { to: '/teletriaje', label: 'Cola de teletriaje' },
  '/dr-annie': { to: '/dr-annie', label: 'Dr. Annie (IA)' },
  '/usuarios': { to: '/usuarios', label: 'Gestión de Usuarios' },
  '/odontologos': { to: '/odontologos', label: 'Equipo de Odontólogos' },
  '/informes': { to: '/informes', label: 'Informes operativos' },
  '/pacientes': { to: '/pacientes', label: 'Recepción de pacientes' },
}

export const SUGGESTIONS_BY_ROLE: Record<UserRole, readonly string[]> = {
  PACIENTE: [
    '¿Cuándo es mi próximo turno?',
    '¿Qué turnos tienen disponibles?',
    '¿Qué doctores disponibles hay?',
    'Quiero sacar un turno con un odontólogo',
    '¿Cuánto sale una limpieza dental?',
    'Me duele la muela de juicio',
    '¿Qué obras sociales atienden?',
    '¿Qué horarios tienen disponibles?',
    'Hola, ¿en qué me podés ayudar?',
  ],
  ODONTOLOGO: [
    '¿Qué turnos de pacientes tengo agendados?',
    'Ver reportes clínicos y seguimiento de pacientes',
    '¿Hay casos pendientes en teletriaje?',
    'Consultar protocolo clínico de urgencias',
    'Abrir analizador radiográfico Dr. Annie (IA)',
  ],
  ADMINISTRADOR: [
    'Resumen operativo del sistema (usuarios, odontólogos y turnos)',
    '¿Qué turnos tienen disponibles?',
    '¿Qué doctores disponibles hay?',
    'Quiero sacar un turno',
    '¿Cómo agregar o actualizar documentos en la base de conocimiento?',
  ],
  RECEPCIONISTA: [
    '¿Qué turnos hay programados para hoy?',
    '¿Qué odontólogos están activos y qué especialidad tienen?',
    '¿Qué obras sociales y horarios están vigentes?',
    'Ir a recepción de pacientes y alta de fichas',
  ],
}

const ROLE_HEADER_CONFIG: Record<
  UserRole,
  { eyebrow: string; title: string; subtitle: string; emptyPrompt: string }
> = {
  PACIENTE: {
    eyebrow: 'Asistente Novadent',
    title: 'Consultas con fuentes',
    subtitle:
      'Consultá doctores disponibles, horarios libres y sacá tu turno al instante, o hacé preguntas con documentos aprobados. No brinda diagnósticos ni reemplaza una consulta profesional.',
    emptyPrompt:
      'Preguntá por los doctores disponibles, consultá qué turnos libres hay y sacá uno directamente desde acá, o revisá tu próximo turno registrado.',
  },
  ODONTOLOGO: {
    eyebrow: 'Copiloto Clínico Novadent',
    title: 'Copiloto Clínico IA · Odontología',
    subtitle:
      'Asistente para consulta rápida de turnos agendados por pacientes, reportes clínicos pendientes, teletriaje y protocolos documentados.',
    emptyPrompt:
      'Consultá los turnos agendados por pacientes, revisá reportes clínicos pendientes de seguimiento, verificá la cola de teletriaje o abrí herramientas de diagnóstico.',
  },
  ADMINISTRADOR: {
    eyebrow: 'Administración e Inteligencia RAG',
    title: 'Asistente de Gestión y Base de Conocimiento (Admin)',
    subtitle:
      'Panel de control del asistente IA, auditoría operativa de usuarios/profesionales y carga de fuentes oficiales RAG.',
    emptyPrompt:
      'Ejecutá diagnósticos en vivo sobre cuentas, plantel profesional y turnos del día, o utilizá el panel inferior para indexar fuentes oficiales en la base de conocimiento.',
  },
  RECEPCIONISTA: {
    eyebrow: 'Admisión y Turnos',
    title: 'Asistente de Recepción y Agenda',
    subtitle:
      'Consulta rápida de disponibilidad de turnos, profesionales activos y admisión de pacientes.',
    emptyPrompt:
      'Consultá los turnos programados del día, verificá qué odontólogos y especialidades están activos o accedé al alta de fichas de pacientes.',
  },
}

const KNOWLEDGE_TEMPLATES = [
  {
    label: 'Horarios y Guardia',
    source: 'horarios-atencion.md',
    version: '1.0',
    content:
      '## Horarios de Atención Clínica\nLa clínica NovaDent atiende de lunes a viernes de 08:30 a 19:30 hs y sábados de 09:00 a 13:00 hs.\n\n## Guardia Odontológica\nLas urgencias por dolor agudo o traumatismos se priorizan mediante el módulo de Teletriaje.',
  },
  {
    label: 'Obras Sociales y Coberturas',
    source: 'obras-sociales-convenios.md',
    version: '1.0',
    content:
      '## Obras Sociales y Prepagas Vigentes\nAtendemos por reintegro y convenios directos en Odontología General, Endodoncia, Ortodoncia y Odontopediatría. Presentar credencial vigente y DNI en recepción.',
  },
  {
    label: 'Protocolo Clínico de Urgencias',
    source: 'protocolo-urgencias.md',
    version: '1.0',
    content:
      '## Protocolo de Urgencias Odontológicas\n1. Clasificar nivel de dolor (escala EVA 1-10) en Teletriaje.\n2. Evaluar signos de infección o inflamación aguda.\n3. Registrar hallazgo en Historia Clínica y Odontograma antes de intervenir.',
  },
]

function createMessageId() {
  return globalThis.crypto?.randomUUID?.() ?? String(Date.now()) + '-' + String(Math.random()).slice(2)
}

function normalizar(text: string) {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('es-AR')
}

function limpiarTexto(text: string) {
  return normalizar(text).replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
}

function esSaludoLocal(text: string) {
  const clean = limpiarTexto(text)
  if (!clean) return false
  if (/\b(turno|turnos|cita|citas|horario|horarios|disponib|doctor|doctora|doctores|odontologo|odontologa|odontologos|profesional|profesionales|dentista|medico|sacar|reservar|agendar|precio|costo|obra social|dolor|diente|odontograma|tratamiento|implante|limpieza|usuario|reporte|teletriaje|resumen|auditar)\b/.test(clean)) {
    return false
  }
  return /^(hola|buenas|buen dia|buenos dias|buenas tardes|buenas noches|que tal|como estas|gracias|muchas gracias|ayuda)(\s+(como estas|que tal|buen dia|buenos dias|buenas tardes|buenas noches|gracias|por favor|asistente|novadent))*$/.test(clean)
    || clean.includes('en que me podes ayudar')
    || clean.includes('que podes hacer')
}

function notifyTurnoBooked() {
  window.dispatchEvent(new CustomEvent('novadent:turno-booked'))
}

function preguntaTurnoPropio(text: string) {
  const normalized = normalizar(text)
  return /\bmis?\b.*\b(turnos?|citas?)\b/.test(normalized)
    || /\b(cuando|cual|que)\b.*\b(mi|mis)\b.*\b(turno|cita)/.test(normalized)
    || /\bproximo\b.*\bturno\b/.test(normalized)
}

function preguntaHorarioODisponibilidad(text: string) {
  const normalized = normalizar(text)
  return /\b(horarios?|disponibilidad|disponibles?|atienden|abren|dias de atencion|turnos libres)\b/.test(normalized)
}

function formatoFecha(fecha: string) {
  return new Date(fecha + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })
}

function localDateIso() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function accionesDesde(values?: string[]) {
  return (values || []).map(value => ACTIONS[value]).filter((value): value is ChatAction => Boolean(value))
}

function respuestaTurnos(turnos: TurnoPropio[]): string {
  const now = new Date()
  const next = turnos
    .filter(item => item.estado !== 'CANCELADO')
    .filter(item => new Date(item.fecha + 'T' + item.hora).getTime() >= now.getTime())
    .sort((a, b) => new Date(a.fecha + 'T' + a.hora).getTime() - new Date(b.fecha + 'T' + b.hora).getTime())[0]
  if (!next) return 'No tenés turnos futuros registrados en tu ficha. Para confirmar o solicitar uno, consultá con recepción.'
  return 'Tu próximo turno registrado es el ' + formatoFecha(next.fecha) + ' a las ' + next.hora.slice(0, 5)
    + ' hs (' + next.motivo + '), con ' + next.odontologoNombre + '.'
}

export function ChatbotPage({ compact = false }: { compact?: boolean } = {}) {
  const { session } = useAuth()
  const resolvedRole: UserRole =
    session?.role || (session?.token ? roleFromToken(session.token) : null) || 'PACIENTE'

  const [messages, setMessages] = useState<Message[]>([])
  const [question, setQuestion] = useState('')
  const [loading, setLoading] = useState(false)
  const conversationRef = useRef<HTMLElement | null>(null)
  const isStaff = resolvedRole !== 'PACIENTE'

  useEffect(() => {
    if (conversationRef.current) {
      conversationRef.current.scrollTop = conversationRef.current.scrollHeight
    }
  }, [messages])

  function handleAgendaBooked(reserva: ReservaChatbotResponse) {
    notifyTurnoBooked()
    setMessages(current => [
      ...current,
      {
        id: createMessageId(),
        role: 'assistant',
        text: reserva.mensaje,
        actions: [isStaff ? ACTIONS['/turnos'] : ACTIONS['/mis-turnos']],
      },
    ])
  }

  // Estado para ingesta de documentos RAG (solo ADMINISTRADOR)
  const [docSource, setDocSource] = useState('')
  const [docVersion, setDocVersion] = useState('1.0')
  const [docContent, setDocContent] = useState('')
  const [ingesting, setIngesting] = useState(false)
  const [ingestFeedback, setIngestFeedback] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)

  async function handleOdontologoQuestion(text: string, token: string): Promise<Omit<Message, 'id' | 'role'>> {
    const norm = normalizar(text)

    if (esSaludoLocal(text)) {
      return {
        text: '¡Hola, colega! Soy tu Copiloto Clínico en NovaDent. Puedo resumir los turnos que los pacientes agendaron hoy, verificar reportes de seguimiento dental pendientes, consultar la cola de teletriaje o abrir el analizador radiográfico Dr. Annie.',
        actions: [
          ACTIONS['/turnos'],
          ACTIONS['/seguimiento'],
          ACTIONS['/dr-annie'],
          ACTIONS['/historias-clinicas'],
        ],
      }
    }

    if (/\b(turnos?|agenda|pacientes.*agendados|citas|hoy|proximos)\b/.test(norm)) {
      try {
        const turnos = await apiRequest<TurnoClinica[]>('/turnos', { token })
        const activos = (Array.isArray(turnos) ? turnos : []).filter(t => t.estado !== 'CANCELADO')
        const hoy = localDateIso()
        const deHoy = activos.filter(t => t.fecha === hoy)
        const proximos = activos
          .filter(t => t.fecha >= hoy)
          .sort((a, b) => `${a.fecha}${a.hora}`.localeCompare(`${b.fecha}${b.hora}`))
          .slice(0, 5)

        if (proximos.length === 0) {
          return {
            text: 'Actualmente no hay turnos futuros activos agendados en el consultorio.',
            actions: [ACTIONS['/turnos'], ACTIONS['/historias-clinicas']],
          }
        }

        const detalle = proximos
          .map(t => {
            const pac = t.paciente
              ? `${t.paciente.nombre || ''} ${t.paciente.apellido || ''}`.trim()
              : 'Paciente registrado'
            return `• ${t.fecha} ${t.hora.slice(0, 5)} hs — ${pac} (${t.motivo || 'Consulta clínica'} · ${t.estado})`
          })
          .join('\n')

        return {
          text: `Resumen de agenda clínica: hay ${activos.length} turno(s) activo(s) (${deHoy.length} para hoy).\nPróximos turnos de pacientes:\n${detalle}`,
          actions: [ACTIONS['/turnos'], ACTIONS['/seguimiento'], ACTIONS['/historias-clinicas']],
        }
      } catch {
        return {
          text: 'No pude consultar los turnos agendados en este momento. Podés abrir directamente la agenda clínica.',
          actions: [ACTIONS['/turnos'], ACTIONS['/historias-clinicas']],
        }
      }
    }

    if (/\b(reportes?|seguimiento|observaciones)\b/.test(norm)) {
      try {
        const reportes = await apiRequest<ReporteSeguimiento[]>('/seguimiento/reportes', { token })
        const lista = Array.isArray(reportes) ? reportes : []
        const pendientes = lista.filter(r => r.estado === 'PENDIENTE')
        const resumenPendientes = pendientes
          .slice(0, 3)
          .map(r => `• Pieza ${r.pieza} (Dolor ${r.dolor}/10): ${r.sintomas}`)
          .join('\n')

        return {
          text:
            lista.length === 0
              ? 'No hay reportes de seguimiento enviados por pacientes en este momento.'
              : `Seguimiento clínico: se registran ${lista.length} reporte(s) en total y ${pendientes.length} pendiente(s) de revisión profesional.${resumenPendientes ? '\n' + resumenPendientes : ''}`,
          actions: [ACTIONS['/seguimiento'], ACTIONS['/odontograma']],
        }
      } catch {
        return {
          text: 'Podés revisar las observaciones de dolor y evolución de los pacientes en el módulo de Seguimiento Clínico.',
          actions: [ACTIONS['/seguimiento'], ACTIONS['/odontograma']],
        }
      }
    }

    if (/\b(teletriaje|solicitudes|cola|prioridad)\b/.test(norm)) {
      try {
        const solicitudes = await apiRequest<SolicitudTeletriaje[]>('/teletriaje/solicitudes', { token })
        const lista = Array.isArray(solicitudes) ? solicitudes : []
        return {
          text:
            lista.length === 0
              ? 'No hay casos pendientes en la cola de teletriaje en este momento.'
              : `Hay ${lista.length} solicitud(es) registrada(s) en la cola de teletriaje para validación de prioridad clínica.`,
          actions: [ACTIONS['/teletriaje'], ACTIONS['/turnos']],
        }
      } catch {
        return {
          text: 'Abrí el módulo de Teletriaje para validar la prioridad de casos remotos y asignar videoconsultas.',
          actions: [ACTIONS['/teletriaje'], ACTIONS['/turnos']],
        }
      }
    }

    if (/\b(annie|radiograf|imagen|hallazgo)\b/.test(norm)) {
      return {
        text: 'El módulo Dr. Annie (IA) permite analizar radiografías dentales, registrar hallazgos por patología/severidad y vincularlos con la historia clínica del paciente.',
        actions: [ACTIONS['/dr-annie'], ACTIONS['/historias-clinicas'], ACTIONS['/odontograma']],
      }
    }

    return {
      text: 'Protocolo clínico asistido: recordá verificar la anamnesis en Historia Clínica, registrar hallazgos por pieza en el Odontograma con firma digital y validar casos agudos en Teletriaje o Seguimiento.',
      actions: [
        ACTIONS['/turnos'],
        ACTIONS['/seguimiento'],
        ACTIONS['/historias-clinicas'],
        ACTIONS['/odontograma'],
      ],
    }
  }

  async function handleAdminQuestion(text: string, token: string): Promise<Omit<Message, 'id' | 'role'> | null> {
    const norm = normalizar(text)

    if (esSaludoLocal(text)) {
      return {
        text: '¡Hola! Soy el Asistente de Gestión y Auditoría para Administración. Puedo generar un resumen en vivo de usuarios, odontólogos activos y turnos del sistema, o ayudarte a cargar nuevas fuentes oficiales en la base de conocimiento RAG.',
        actions: [
          ACTIONS['/usuarios'],
          ACTIONS['/odontologos'],
          ACTIONS['/informes'],
          ACTIONS['/turnos'],
        ],
      }
    }

    if (/\b(conocimiento|rag|documentos?|fuentes?|indexar|agregar.*documento|actualizar.*documento)\b/.test(norm)) {
      return {
        text: 'Para agregar o actualizar documentos en la base de conocimiento RAG, completá el formulario "Cargar Fuente Oficial a la Base de Conocimiento (RAG)" ubicado debajo de este chat. Indicá el identificador del archivo (ej. horarios.md), la versión y el contenido en formato Markdown.',
        actions: [ACTIONS['/usuarios'], ACTIONS['/informes']],
      }
    }

    if (
      !/\b(disponib|sacar|reservar|agendar|doctores disponibles)\b/.test(norm) &&
      /\b(resumen|operativo|sistema|usuarios?|plantel|turnos.*hoy|cuantos turnos|auditar|modulos|roles)\b/.test(
        norm
      )
    ) {
      const [usersRes, dentistsRes, turnosRes] = await Promise.allSettled([
        apiRequest<UsuarioResumen[]>('/usuarios', { token }),
        apiRequest<OdontologoResumen[]>('/odontologos', { token }),
        apiRequest<TurnoClinica[]>('/turnos', { token }),
      ])

      const users = usersRes.status === 'fulfilled' && Array.isArray(usersRes.value) ? usersRes.value : []
      const dentists =
        dentistsRes.status === 'fulfilled' && Array.isArray(dentistsRes.value) ? dentistsRes.value : []
      const turnos = turnosRes.status === 'fulfilled' && Array.isArray(turnosRes.value) ? turnosRes.value : []

      const activeUsers = users.filter(u => u.activo).length
      const activeDentists = dentists.filter(d => d.activo !== false)
      const hoy = localDateIso()
      const turnosHoy = turnos.filter(t => t.fecha === hoy && t.estado !== 'CANCELADO').length
      const turnosActivos = turnos.filter(t => t.estado !== 'CANCELADO').length

      const listaProfesionales =
        activeDentists.length > 0
          ? activeDentists
              .slice(0, 5)
              .map(
                d =>
                  `• Dr./Dra. ${d.nombre} ${d.apellido} (MP ${d.matricula}${
                    d.especialidad?.nombre ? ' · ' + d.especialidad.nombre : ''
                  })`
              )
              .join('\n')
          : '• Sin profesionales activos registrados.'

      return {
        text:
          `Diagnóstico operativo del sistema en tiempo real:\n` +
          `• Cuentas de usuario: ${users.length} registradas (${activeUsers} activas).\n` +
          `• Plantel odontológico: ${activeDentists.length} profesional(es) activo(s) de ${dentists.length} registrado(s).\n` +
          `• Agenda de turnos: ${turnosActivos} turno(s) activo(s) (${turnosHoy} programado(s) para hoy).\n\n` +
          `Plantel activo:\n${listaProfesionales}`,
        actions: [
          ACTIONS['/usuarios'],
          ACTIONS['/odontologos'],
          ACTIONS['/informes'],
          ACTIONS['/turnos'],
        ],
      }
    }

    return null
  }

  async function handleRecepcionistaQuestion(
    text: string,
    token: string
  ): Promise<Omit<Message, 'id' | 'role'>> {
    const norm = normalizar(text)

    if (esSaludoLocal(text)) {
      return {
        text: '¡Hola! Soy el Asistente de Recepción y Agenda. Puedo informarte los turnos programados del día, listar qué odontólogos y especialidades están activos o llevarte a la gestión de pacientes.',
        actions: [ACTIONS['/turnos'], ACTIONS['/pacientes'], ACTIONS['/odontologos']],
      }
    }

    if (/\b(turnos?|agenda|programados|hoy|citas)\b/.test(norm)) {
      try {
        const turnos = await apiRequest<TurnoClinica[]>('/turnos', { token })
        const activos = (Array.isArray(turnos) ? turnos : []).filter(t => t.estado !== 'CANCELADO')
        const hoy = localDateIso()
        const deHoy = activos.filter(t => t.fecha === hoy)
        return {
          text: `Estado de agenda para recepción: hay ${deHoy.length} turno(s) programado(s) para hoy y ${activos.length} turno(s) activo(s) en total.`,
          actions: [ACTIONS['/turnos'], ACTIONS['/pacientes']],
        }
      } catch {
        return {
          text: 'No pude consultar los turnos ahora. Abrí la agenda de turnos para verificar horarios disponibles.',
          actions: [ACTIONS['/turnos'], ACTIONS['/pacientes']],
        }
      }
    }

    if (/\b(odontologos?|profesionales|especialidad|activos|plantel)\b/.test(norm)) {
      try {
        const dentists = await apiRequest<OdontologoResumen[]>('/odontologos', { token })
        const activos = (Array.isArray(dentists) ? dentists : []).filter(d => d.activo !== false)
        const detalle = activos
          .slice(0, 6)
          .map(
            d =>
              `• Dr./Dra. ${d.nombre} ${d.apellido} — ${
                d.especialidad?.nombre || 'Odontología General'
              } (MP ${d.matricula})`
          )
          .join('\n')
        return {
          text:
            activos.length === 0
              ? 'No hay odontólogos activos registrados en el directorio.'
              : `Profesionales activos para asignar turnos (${activos.length}):\n${detalle}`,
          actions: [ACTIONS['/odontologos'], ACTIONS['/turnos']],
        }
      } catch {
        return {
          text: 'Consultá el directorio completo de profesionales en la sección de Odontólogos.',
          actions: [ACTIONS['/odontologos'], ACTIONS['/turnos']],
        }
      }
    }

    return {
      text: 'Guía rápida de recepción: podés dar de alta o actualizar fichas en Pacientes, asignar citas por profesional en Agenda de Turnos o gestionar solicitudes en Teletriaje.',
      actions: [ACTIONS['/pacientes'], ACTIONS['/turnos'], ACTIONS['/odontologos'], ACTIONS['/teletriaje']],
    }
  }

  async function sendQuestion(rawText: string) {
    const text = rawText.trim()
    if (!text || loading || !session) return

    setQuestion('')
    setMessages(current => [...current, { id: createMessageId(), role: 'user', text }])

    // Flujo para ODONTOLOGO (Copiloto Clínico)
    if (resolvedRole === 'ODONTOLOGO') {
      setLoading(true)
      try {
        const reply = await handleOdontologoQuestion(text, session.token)
        setMessages(current => [...current, { id: createMessageId(), role: 'assistant', ...reply }])
      } finally {
        setLoading(false)
      }
      return
    }

    // Flujo para RECEPCIONISTA (Asistente de Recepción)
    if (resolvedRole === 'RECEPCIONISTA') {
      setLoading(true)
      try {
        const reply = await handleRecepcionistaQuestion(text, session.token)
        setMessages(current => [...current, { id: createMessageId(), role: 'assistant', ...reply }])
      } finally {
        setLoading(false)
      }
      return
    }

    // Flujo para ADMINISTRADOR (Diagnóstico en vivo + RAG)
    if (resolvedRole === 'ADMINISTRADOR') {
      setLoading(true)
      try {
        const adminReply = await handleAdminQuestion(text, session.token)
        if (adminReply) {
          setMessages(current => [...current, { id: createMessageId(), role: 'assistant', ...adminReply }])
          return
        }
        const response = await apiRequest<ChatResponse>('/chatbot/ask', {
          method: 'POST',
          token: session.token,
          body: { mensaje: text },
        })
        if (response.agenda?.turnoConfirmado) {
          notifyTurnoBooked()
        }
        setMessages(current => [
          ...current,
          {
            id: createMessageId(),
            role: 'assistant',
            text: response.respuesta,
            citations: response.citas ?? [],
            actions: [ACTIONS['/turnos'], ACTIONS['/usuarios'], ACTIONS['/odontologos'], ACTIONS['/informes']],
            noEvidence: !response.citas?.length && !response.agenda && response.respuesta.startsWith(NO_EVIDENCE),
            agenda: response.agenda,
          },
        ])
      } catch {
        setMessages(current => [
          ...current,
          {
            id: createMessageId(),
            role: 'assistant',
            text: 'No pude consultar el motor RAG en este momento. Podés auditar los módulos directamente desde los accesos de administración.',
            actions: [ACTIONS['/usuarios'], ACTIONS['/odontologos'], ACTIONS['/informes']],
          },
        ])
      } finally {
        setLoading(false)
      }
      return
    }

    // Flujo por defecto para PACIENTE (mantiene 100% compatibilidad con tests existentes)
    if (esSaludoLocal(text)) {
      setMessages(current => [...current, {
        id: createMessageId(),
        role: 'assistant',
        text: LOCAL_GREETING_RESPONSE,
        actions: [ACTIONS['/mis-turnos'], ACTIONS['/mi-odontograma'], ACTIONS['/']],
      }])
      return
    }

    setLoading(true)
    try {
      if (preguntaTurnoPropio(text)) {
        try {
          const turnos = await apiRequest<TurnoPropio[]>('/portal-paciente/turnos', { token: session.token })
          setMessages(current => [...current, {
            id: createMessageId(), role: 'assistant', text: respuestaTurnos(turnos),
            actions: [ACTIONS['/mis-turnos']],
          }])
        } catch (turnosError) {
          const missingProfile = turnosError instanceof ApiError && (turnosError.status === 404 || turnosError.status === 409)
          setMessages(current => [...current, {
            id: createMessageId(),
            role: 'assistant',
            text: missingProfile
              ? 'Todavía no tenés una ficha de paciente vinculada a tu cuenta. Completá tus datos en el portal para consultar tus turnos registrados.'
              : 'No pude consultar tus turnos en este momento. No compartas tus datos personales por el chat; podés revisar el listado de tu cuenta.',
            actions: [ACTIONS['/mis-turnos']],
          }])
        }
      } else {
        const response = await apiRequest<ChatResponse>('/chatbot/ask', {
          method: 'POST',
          token: session.token,
          body: { mensaje: text },
        })
        const providerFailed = response.intencion === 'error'
        const isSchedule = preguntaHorarioODisponibilidad(text) || response.intencion === 'turno'
        const answer = providerFailed
          ? (isSchedule
              ? SCHEDULE_FALLBACK_RESPONSE
              : 'Ahora no hay fuentes aprobadas disponibles para responder esa consulta y no voy a inventar datos. Podés consultar tus turnos o tu odontograma desde tu cuenta.')
          : response.respuesta
        const actions = providerFailed
          ? (isSchedule ? [ACTIONS['/mis-turnos']] : [ACTIONS['/mis-turnos'], ACTIONS['/mi-odontograma']])
          : (accionesDesde(response.accionesSugeridas).length > 0
              ? accionesDesde(response.accionesSugeridas)
              : (isSchedule ? [ACTIONS['/mis-turnos']] : []))
        if (!providerFailed && response.agenda?.turnoConfirmado) {
          notifyTurnoBooked()
        }
        setMessages(current => [...current, {
          id: createMessageId(),
          role: 'assistant',
          text: answer,
          citations: providerFailed ? [] : response.citas ?? [],
          actions,
          noEvidence: !providerFailed && !response.citas?.length && !response.agenda && answer.startsWith(NO_EVIDENCE),
          agenda: providerFailed ? undefined : response.agenda,
        }])
      }
    } catch {
      const ownTurnQuestion = preguntaTurnoPropio(text)
      const isSchedule = preguntaHorarioODisponibilidad(text)
      setMessages(current => [...current, {
        id: createMessageId(),
        role: 'assistant',
        text: ownTurnQuestion
          ? 'No pude consultar tus turnos en este momento. No compartas tus datos personales por el chat; podés revisar el listado de tu cuenta.'
          : isSchedule
            ? 'No pude conectar con el asistente y no puedo confirmar horarios ni disponibilidad sin una fuente vigente aprobada. Podés revisar tus turnos registrados o comunicarte con recepción.'
            : 'No pude conectar con el asistente y no voy a inventar una respuesta. Probá de nuevo más tarde o usá las opciones de tu cuenta.',
        actions: [ACTIONS['/mis-turnos'], ACTIONS['/mi-odontograma']],
      }])
    } finally {
      setLoading(false)
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await sendQuestion(question)
  }

  async function handleIngestKnowledge(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!session?.token || !docSource.trim() || !docVersion.trim() || !docContent.trim()) return
    setIngesting(true)
    setIngestFeedback(null)
    try {
      await apiRequest<void>('/chatbot/knowledge', {
        method: 'POST',
        token: session.token,
        body: {
          source: docSource.trim(),
          version: docVersion.trim(),
          content: docContent.trim(),
        },
      })
      setIngestFeedback({
        type: 'ok',
        text: `Fuente oficial "${docSource.trim()}" (versión ${docVersion.trim()}) indexada correctamente en la base de conocimiento RAG.`,
      })
      setDocSource('')
      setDocContent('')
    } catch (failure) {
      setIngestFeedback({
        type: 'error',
        text: failure instanceof Error ? failure.message : 'No se pudo indexar el documento en la base de conocimiento.',
      })
    } finally {
      setIngesting(false)
    }
  }

  const headerConfig = ROLE_HEADER_CONFIG[resolvedRole]
  const roleSuggestions = SUGGESTIONS_BY_ROLE[resolvedRole]

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-3">
      {!compact && (
        <header className="space-y-1 rounded-2xl border border-slate-200/80 bg-white/80 px-4 py-3 shadow-sm backdrop-blur-xl sm:px-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">{headerConfig.eyebrow}</p>
          <h1 className="text-xl font-bold text-slate-950 sm:text-2xl">{headerConfig.title}</h1>
          <p className="max-w-3xl text-xs leading-5 text-slate-600 sm:text-sm">
            {headerConfig.subtitle}
          </p>
        </header>
      )}

      <section
        ref={conversationRef}
        aria-label="Conversación"
        aria-live="polite"
        className="max-h-[340px] min-h-[200px] space-y-3 overflow-y-auto rounded-2xl border border-slate-200 bg-white/80 p-3.5 shadow-sm backdrop-blur-xl sm:max-h-[380px] sm:p-4"
      >
        {messages.length === 0 && (
          <div className="space-y-2.5 rounded-xl border border-blue-100 bg-blue-50/80 p-3 text-xs text-blue-950 sm:text-sm">
            <p className="leading-5">{headerConfig.emptyPrompt}</p>
            <div className="flex flex-wrap gap-1.5">
              {roleSuggestions.map(item => (
                <button
                  key={item}
                  type="button"
                  disabled={loading}
                  onClick={() => void sendQuestion(item)}
                  className="rounded-lg border border-blue-200 bg-white px-2.5 py-1.5 text-left text-xs font-semibold text-blue-900 transition hover:border-blue-400 hover:bg-blue-100/70 disabled:opacity-50"
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map(message => (
          <article key={message.id} className={'max-w-2xl rounded-2xl border p-3.5 ' + (message.role === 'user' ? 'ml-auto border-blue-600 bg-blue-700 text-white' : 'border-blue-100 bg-blue-50/90 text-slate-900')}>
            <p className="whitespace-pre-wrap text-sm leading-6">{message.text}</p>
            {message.noEvidence && <p className="mt-2.5 text-xs font-semibold text-amber-800">Sin evidencia suficiente en las fuentes.</p>}
            {message.agenda && session && (
              <ChatbotAgendaCard
                agenda={message.agenda}
                token={session.token}
                compact={compact}
                onBooked={handleAgendaBooked}
              />
            )}
            {!!message.actions?.length && <div className="mt-2.5 flex flex-wrap gap-2">
              {message.actions.map(action => <Link key={action.to} to={action.to} className="inline-flex min-h-8 items-center rounded-lg border border-blue-300 bg-white/90 px-3 py-1.5 text-xs font-semibold text-blue-900 hover:bg-blue-50">{action.label}</Link>)}
            </div>}
            {!!message.citations?.length && (
              <details className="mt-3 border-t border-blue-200/60 pt-2 text-xs text-slate-700">
                <summary className="inline-flex cursor-pointer select-none items-center gap-1.5 font-semibold text-blue-700 hover:text-blue-900">
                  <ShieldCheck size={14} className="text-blue-600" />
                  <span>Fuentes oficiales consultadas ({message.citations.length})</span>
                </summary>
                <ul className="mt-2 space-y-2 rounded-xl border border-blue-100 bg-white/80 p-2.5 shadow-sm">
                  {message.citations.map((citation, index) => (
                    <li key={citation.id || String(index)} className="border-b border-blue-50 pb-1.5 last:border-none last:pb-0">
                      <span className="font-semibold text-slate-800">{citation.documento} · versión {citation.version}</span>
                      <details className="mt-1 text-slate-600">
                        <summary className="cursor-pointer text-[0.75rem] text-blue-600 hover:underline">Ver fragmento citado</summary>
                        <p className="mt-1 rounded-md border border-slate-100 bg-white p-2 leading-relaxed text-slate-700">{citation.fragmento}</p>
                      </details>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </article>
        ))}
        {loading && <p role="status" className="text-xs text-slate-500 sm:text-sm">Buscando fuentes y preparando respuesta…</p>}
      </section>

      <form onSubmit={submit} className="flex gap-2">
        <label className="sr-only" htmlFor="chat-question">Tu pregunta</label>
        <input id="chat-question" maxLength={1000} value={question}
          onChange={event => setQuestion(event.target.value)}
          placeholder="Escribí tu pregunta…" disabled={loading}
          className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white/90 px-3.5 py-2.5 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100" />
        <button type="submit" disabled={loading || !question.trim()}
          className="rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50">Enviar</button>
      </form>

      {!compact && resolvedRole === 'ADMINISTRADOR' && (
        <>
          <section
            aria-label="Cargar Fuente Oficial a la Base de Conocimiento (RAG)"
            className="rounded-2xl border border-blue-200/80 bg-white/90 p-4 shadow-xs backdrop-blur-xl space-y-3"
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <BookPlus className="h-4 w-4 text-blue-700" />
                  Cargar Fuente Oficial a la Base de Conocimiento (RAG)
                </h2>
                <p className="text-xs text-slate-600">
                  Indexá o actualizá documentos verificados (horarios, obras sociales, protocolos clínicos) para las respuestas del asistente.
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {KNOWLEDGE_TEMPLATES.map(tpl => (
                  <button
                    key={tpl.source}
                    type="button"
                    onClick={() => {
                      setDocSource(tpl.source)
                      setDocVersion(tpl.version)
                      setDocContent(tpl.content)
                    }}
                    className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-800 hover:bg-blue-100"
                  >
                    Plantilla: {tpl.label}
                  </button>
                ))}
              </div>
            </div>

            {ingestFeedback && (
              <div
                role={ingestFeedback.type === 'error' ? 'alert' : 'status'}
                className={`rounded-xl border px-3.5 py-2.5 text-xs font-medium ${
                  ingestFeedback.type === 'ok'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                    : 'border-red-200 bg-red-50 text-red-800'
                }`}
              >
                {ingestFeedback.text}
              </div>
            )}

            <form onSubmit={handleIngestKnowledge} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label htmlFor="rag-source" className="block text-xs font-bold text-slate-700 mb-1">
                  Identificador de fuente (ej. horarios-clinica.md)
                </label>
                <input
                  id="rag-source"
                  required
                  value={docSource}
                  onChange={e => setDocSource(e.target.value)}
                  placeholder="horarios-clinica.md"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="rag-version" className="block text-xs font-bold text-slate-700 mb-1">
                  Versión
                </label>
                <input
                  id="rag-version"
                  required
                  value={docVersion}
                  onChange={e => setDocVersion(e.target.value)}
                  placeholder="1.0"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div className="sm:col-span-3">
                <label htmlFor="rag-content" className="block text-xs font-bold text-slate-700 mb-1">
                  Contenido oficial (Markdown con secciones ##)
                </label>
                <textarea
                  id="rag-content"
                  required
                  rows={4}
                  value={docContent}
                  onChange={e => setDocContent(e.target.value)}
                  placeholder="## Horarios de atención&#10;Lunes a viernes de 09:00 a 18:00 hs."
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div className="sm:col-span-3 flex justify-end">
                <button
                  type="submit"
                  disabled={ingesting || !docSource.trim() || !docVersion.trim() || !docContent.trim()}
                  className="rounded-xl bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
                >
                  {ingesting ? 'Indexando fuente…' : 'Indexar documento en RAG'}
                </button>
              </div>
            </form>
          </section>

          <details className="group rounded-2xl border border-slate-200/80 bg-white/80 p-4 text-xs text-slate-600 shadow-2xs backdrop-blur-xl transition-all">
            <summary className="flex cursor-pointer list-none items-center justify-between font-bold text-slate-800 text-sm">
              <div className="flex items-center gap-2">
                <Stethoscope className="h-4 w-4 text-blue-600" />
                <span>Ficha Técnica y Arquitectura RAG</span>
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-800">
                  Spring AI
                </span>
              </div>
              <ChevronDown className="h-4 w-4 text-slate-400 transition-transform group-open:rotate-180" />
            </summary>

            <div className="mt-3 grid grid-cols-1 gap-4 border-t border-slate-200/70 pt-3 md:grid-cols-2">
              <div>
                <p className="mb-1 flex items-center gap-1 font-semibold text-slate-700">
                  <Sparkles className="h-3 w-3 text-amber-500" /> Stack Tecnológico:
                </p>
                <ul className="list-inside list-disc space-y-1 text-slate-600">
                  <li><strong>Backend:</strong> Spring Boot 3.5.6 + Spring AI (VectorStore + OpenAI).</li>
                  <li><strong>Fuentes controladas:</strong> solo documentos explícitamente aprobados e indexados.</li>
                  <li><strong>Endpoints REST:</strong> <code>POST /api/chatbot/ask</code> y <code>POST /api/chatbot/knowledge</code>.</li>
                </ul>
              </div>
              <div>
                <p className="mb-1 flex items-center gap-1 font-semibold text-slate-700">
                  <ShieldCheck className="h-3 w-3 text-emerald-600" /> Seguridad y Privacidad:
                </p>
                <ul className="list-inside list-disc space-y-1 text-slate-600">
                  <li>Consultas de turnos propios aisladas en <code>GET /api/portal-paciente/turnos</code>.</li>
                  <li>Respuestas verificables con citas documentales sin inventar horarios, precios ni consejos médicos.</li>
                  <li>Respaldo local para saludos y navegación cuando el proveedor de IA no está configurado.</li>
                </ul>
              </div>
            </div>
          </details>
        </>
      )}
    </div>
  )
}
