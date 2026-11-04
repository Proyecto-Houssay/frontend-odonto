import { apiRequest } from './api'

export interface Citation {
  id: string
  documento: string
  version: string
  fragmento: string
}

export interface ChatResponse {
  respuesta: string
  intencion: 'urgencia' | 'precio' | 'turno' | 'tratamiento' | 'consulta_general' | 'error'
  accionesSugeridas?: string[]
  timestamp?: string
  citas?: Citation[]
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  timestamp: Date
  intencion?: ChatResponse['intencion']
  citas?: Citation[]
  accionesSugeridas?: string[]
  isFallback?: boolean
}

interface KnowledgeItem {
  keywords: string[]
  citas: Citation[]
  respuesta: string | ((query: string) => string)
  intencion: 'urgencia' | 'precio' | 'turno' | 'tratamiento' | 'consulta_general'
  acciones: string[]
}

// Base de conocimiento local para fallback en preview de Vercel
// Contiene la misma evidencia médica y nomenclador que backend-odonto
const KNOWLEDGE_URGENCIAS: KnowledgeItem[] = [
  {
    keywords: ['muela de juicio', 'muela del juicio', 'tercer molar', 'pericoronaritis'],
    citas: [{
      id: 'urg-1',
      documento: 'protocolos-urgencia.md — Muela de Juicio',
      version: '1.2',
      fragmento: 'Dolor de muela de juicio: Ibuprofeno 400-600mg cada 8hs. Enjuagues tibios con agua y sal. Si el dolor persiste más de 3 días hay riesgo de pericoronaritis o infección. Requiere evaluación inmediata con radiografía panorámica y turno de urgencia.'
    }],
    respuesta: '🚨 **Triage Clínico - Urgencia Media/Alta:**\n\nSi te duele la muela de juicio hace 3 días, existe probabilidad de un cuadro inflamatorio agudo o **pericoronaritis** (infección en el tejido gingival que rodea la pieza).\n\n**Protocolo de alivio inmediato:**\n• Tomar Ibuprofeno 400 a 600 mg cada 8 horas con alimento (salvo contraindicación médica).\n• Realizar buches suaves con agua tibia y sal (1 cdta. en 1 vaso de agua).\n• Aplicar frío local externo sobre la mejilla; **nunca aplicar calor directo**.\n• **No automedicarte con antibióticos** sin prescripción.\n\n⚠️ Te sugerimos coordinar un **turno de urgencia** hoy mismo para evaluación clínica y radiografía panorámica.',
    intencion: 'urgencia',
    acciones: ['Agendar turno de urgencia', 'Ver guardia odontológica', 'Consultar medicación']
  },
  {
    keywords: ['golpe', 'caído', 'avulsión', 'traumatismo', 'diente roto', 'sangrado'],
    citas: [{
      id: 'urg-2',
      documento: 'protocolos-urgencia.md — Traumatismos y Avulsión',
      version: '1.2',
      fragmento: 'Traumatismo con avulsión: Conservar la pieza en leche o solución salina sin lavar la raíz. Acudir dentro de los primeros 30 a 60 minutos para posibilitar el reimplante exitoso.'
    }],
    respuesta: '🚨 **URGENCIA ODONTOLÓGICA INMEDIATA (Código Rojo):**\n\n1. **Conservación de la pieza:** Guardá el diente en un recipiente con leche fría o suero fisiológico. **NO toques la raíz**, sostenelo únicamente por la corona blanca.\n2. **Ventana terapéutica crítica:** Las posibilidades de salvar el diente son máximas dentro de los primeros 30 a 60 minutos.\n3. Acudí de forma prioritaria a nuestro centro de atención inmediata.',
    intencion: 'urgencia',
    acciones: ['Llamar a Urgencias (Guardia 24hs)', 'Lista de espera inmediata']
  }
]

const KNOWLEDGE_PRECIOS: KnowledgeItem[] = [
  {
    keywords: ['limpieza', 'profilaxis', 'sarro', 'tártaro'],
    citas: [{
      id: 'nom-1',
      documento: 'precios-nomenclador.md — Profilaxis y Detartraje',
      version: '2.0',
      fragmento: 'Código 01.04 Limpieza y detartraje ultrasónico: Arancel particular $18.000. Cobertura: OSDE (100% en planes 210/310/410/510 sin copago), Swiss Medical (100% en planes SMG02 a superior), Galeno (100% Plata/Oro), IOMA (Bono B con copago $2.500), PAMI (100% cápita autorizada).'
    }],
    respuesta: (query: string) => {
      const q = query.toLowerCase()
      let detalleObraSocial = ''
      if (q.includes('osde')) {
        detalleObraSocial = '\n\n**Tu cobertura con OSDE:**\n• Cobertura al **100% sin copago** en planes 210, 310, 410 y 510.\n• Incluye profilaxis con ultrasonido, pulido coronario y fluoración tópica.'
      } else if (q.includes('swiss')) {
        detalleObraSocial = '\n\n**Tu cobertura con Swiss Medical:**\n• Cobertura al **100%** para planes SMG02 en adelante con presentación de credencial digital.'
      } else if (q.includes('galeno')) {
        detalleObraSocial = '\n\n**Tu cobertura con Galeno:**\n• Cobertura al **100%** en planes Plata y Oro (copago de $1.500 en plan Azul 220).'
      } else if (q.includes('ioma')) {
        detalleObraSocial = '\n\n**Tu cobertura con IOMA:**\n• Cubierto con Bono B autorizado más copago de $2.500.'
      } else if (q.includes('pami')) {
        detalleObraSocial = '\n\n**Tu cobertura con PAMI:**\n• 100% cubierto según cápita asignada a Clínica Novadent.'
      } else {
        detalleObraSocial = '\n\n**Convenios de cobertura:**\n• **OSDE / Swiss Medical / Galeno:** 100% cubierto según plan.\n• **IOMA / PAMI:** Con autorización digital.\n• **Particular:** $18.000 (incluye destartraje + pulido).'
      }

      return `🦷 **Nomenclador Oficial Novadent — Limpieza Dental y Detartraje Ultrasónico (Cód. 01.04):**${detalleObraSocial}\n\n*Valores vigentes según el Colegio Odontológico y convenios institucionales.*`
    },
    intencion: 'precio',
    acciones: ['Solicitar turno para Limpieza', 'Consultar mi Plan de Salud']
  },
  {
    keywords: ['blanqueamiento', 'estética'],
    citas: [{
      id: 'nom-2',
      documento: 'precios-nomenclador.md — Estética Dental',
      version: '2.0',
      fragmento: 'Blanqueamiento combinado (consultorio LED + férulas ambulatorias): $85.000 particular. Obras sociales no suelen tener cobertura al 100%, pero OSDE 410/510 y SMG04 cuentan con reintegro parcial del 30% al 50%.'
    }],
    respuesta: '✨ **Blanqueamiento Dental LED + Kit Ambulatorio:**\n\n• **Valor particular:** $85.000 (incluye sesión de consultorio con luz LED + férulas personalizadas para mantenimiento en casa).\n• **Obras Sociales:** Al ser tratamiento estético, OSDE (planes 410/510) y Swiss Medical (SMG04/05) ofrecen **reintegro odontológico de hasta 40%** presentando nuestra factura oficial.',
    intencion: 'precio',
    acciones: ['Pedir consulta de evaluación estética', 'Ver promociones']
  },
  {
    keywords: ['conducto', 'endodoncia'],
    citas: [{
      id: 'nom-3',
      documento: 'precios-nomenclador.md — Endodoncia',
      version: '2.0',
      fragmento: 'Tratamiento de conducto unirradicular: $32.000 / multirradicular: $45.000. Cubierto al 100% por OSDE, Swiss Medical y Galeno con autorización previa.'
    }],
    respuesta: '🔬 **Tratamiento de Conducto (Endodoncia mecanizada):**\n\n• **Unirradicular (dientes anteriores):** $32.000 particular.\n• **Multirradicular (molares/premolares):** $45.000 particular.\n• **Coberturas:** OSDE, Swiss Medical y Galeno cubren el **100%** de la práctica (requiere radiografía pre y post-operatoria).',
    intencion: 'precio',
    acciones: ['Agendar turno con especialista en Endodoncia']
  }
]

const KNOWLEDGE_TURNOS: KnowledgeItem[] = [
  {
    keywords: ['turno', 'cita', 'agendar', 'horario', 'reservar', 'disponibilidad', 'lista de espera'],
    citas: [{
      id: 'faq-horarios',
      documento: 'faq-clinica.md — Horarios y Agendamiento',
      version: '1.0',
      fragmento: 'Horarios de atención: Lunes a viernes de 08:00 a 20:00 hs. Sábados de 09:00 a 14:00 hs. Si no hay turnos disponibles dentro de la ventana deseada, el paciente puede inscribirse en la lista de espera con notificación automática por WhatsApp.'
    }],
    respuesta: '📅 **Agenda de Turnos Novadent:**\n\n• **Horarios de atención:** Lunes a viernes de 08:00 a 20:00 hs | Sábados de 09:00 a 14:00 hs.\n• Podés consultar turnos disponibles en el módulo **Turnos** del sistema.\n\n💡 *Si no encontrás disponibilidad en el día u horario que necesitás, el sistema te suma automáticamente a nuestra **Lista de Espera Inteligente**, avisándote de inmediato si se libera un espacio.*',
    intencion: 'turno',
    acciones: ['Ir al Calendario de Turnos', 'Anotarme en Lista de Espera']
  }
]

function resolveAnswer(item: KnowledgeItem, query: string): string {
  if (typeof item.respuesta === 'function') {
    return item.respuesta(query)
  }
  return item.respuesta
}

export function generateLocalRAGResponse(query: string): ChatResponse {
  const q = query.toLowerCase()

  // 1. Chequeo de Urgencias y Triage
  for (const item of KNOWLEDGE_URGENCIAS) {
    if (item.keywords.some((k) => q.includes(k))) {
      return {
        respuesta: resolveAnswer(item, query),
        intencion: item.intencion,
        accionesSugeridas: item.acciones,
        timestamp: new Date().toISOString(),
        citas: item.citas,
      }
    }
  }

  // 2. Chequeo de Precios y Nomenclador
  for (const item of KNOWLEDGE_PRECIOS) {
    if (item.keywords.some((k) => q.includes(k))) {
      return {
        respuesta: resolveAnswer(item, query),
        intencion: item.intencion,
        accionesSugeridas: item.acciones,
        timestamp: new Date().toISOString(),
        citas: item.citas,
      }
    }
  }

  // 3. Chequeo de Turnos y Horarios
  for (const item of KNOWLEDGE_TURNOS) {
    if (item.keywords.some((k) => q.includes(k))) {
      return {
        respuesta: resolveAnswer(item, query),
        intencion: item.intencion,
        accionesSugeridas: item.acciones,
        timestamp: new Date().toISOString(),
        citas: item.citas,
      }
    }
  }

  // 4. Chequeo general con citas de FAQ
  return {
    respuesta:
      '¡Hola! Soy el asistente virtual inteligente de Clínica Novadent con base de conocimiento RAG.\n\n' +
      'Puedo ayudarte con:\n' +
      '• **Triage clínico de urgencias** (dolor dental, muelas de juicio, traumatismos).\n' +
      '• **Precios del nomenclador oficial y cobertura** de obras sociales (OSDE, Swiss Medical, Galeno, IOMA, PAMI).\n' +
      '• **Coordinación de turnos** o derivación a lista de espera ante agenda llena.',
    intencion: 'consulta_general',
    accionesSugeridas: [
      '¿Cuánto sale una limpieza con OSDE?',
      'Me duele la muela de juicio hace 3 días',
      '¿Cuáles son los horarios de atención?',
      '¿Cómo funciona la lista de espera?'
    ],
    timestamp: new Date().toISOString(),
    citas: [
      {
        id: 'faq-general',
        documento: 'faq-clinica.md — Servicios Generales',
        version: '1.0',
        fragmento: 'Novadent cuenta con equipamiento de alta tecnología, atención interdisciplinaria y servicio de urgencias odontológicas.'
      }
    ]
  }
}

/**
 * Envía la consulta al backend Spring Boot (`/api/chatbot/ask`).
 * Si el backend está disponible, utiliza la respuesta de Spring AI con RAG.
 * Si el backend está inaccesible (ej. preview de Vercel sin servidor Java),
 * utiliza de forma transparente el motor RAG local para garantizar la experiencia interactiva.
 */
export async function askChatbot(mensaje: string, token?: string): Promise<{ response: ChatResponse; isFallback: boolean }> {
  try {
    const res = await apiRequest<ChatResponse>('/chatbot/ask', {
      method: 'POST',
      token,
      body: { mensaje },
    })
    return { response: res, isFallback: false }
  } catch (error) {
    console.warn('[Chatbot RAG] Backend offline o inaccesible. Activando RAG local de contingencia:', error)
    const fallbackResponse = generateLocalRAGResponse(mensaje)
    return { response: fallbackResponse, isFallback: true }
  }
}
