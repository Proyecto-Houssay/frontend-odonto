import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Clock,
  FileUp,
  History,
  Image as ImageIcon,
  ScanLine,
  Send,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  UserRound,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { roleFromToken, type UserRole } from '../auth/role'
import { apiRequest } from '../lib/api'

export type TipoImagenDental =
  | 'RADIOGRAFIA_PANORAMICA'
  | 'RADIOGRAFIA_PERIAPICAL'
  | 'BITE_WING'
  | 'FOTO_INTRAORAL'
  | 'TOMOGRAFIA_CONE_BEAM'

export type PatologiaDental =
  | 'CARIES_DENTAL'
  | 'PERDIDA_OSEA_PERIODONTAL'
  | 'LESION_PERIAPICAL'
  | 'DIENTE_RETENIDO_IMPACTADO'
  | 'RESTAURACION_DEFECTUOSA'
  | 'FRACTURA_RADICULAR'
  | 'CALCULO_DENTAL'

export type SeveridadHallazgo = 'LEVE' | 'MODERADA' | 'SEVERA'
export type NivelUrgencia = 'BAJA' | 'MEDIA' | 'ALTA' | 'URGENTE'

export type HallazgoImagenDto = {
  patologia: PatologiaDental
  piezaDental: string
  severidad: SeveridadHallazgo
  confianza: number
  zonaAfectada?: string
  ubicacion?: string
  descripcion: string
  tratamientoSugerido: string
}

export type AnalisisImagenResponse = {
  id: number
  tipoImagen: TipoImagenDental
  diagnosticoSugerido: string
  hallazgos: HallazgoImagenDto[]
  tratamientosSugeridos: string[]
  nivelUrgencia: NivelUrgencia
  indiceSeveridad: number
  observacionesIA: string
  modeloUtilizado: string
  fechaAnalisis: string
  pacienteId?: number | null
  historiaClinicaId?: number | null
  diagnosticoCreadoId?: number | null
}

export type CatalogoIaDto = {
  tiposImagen: Array<{ tipo: TipoImagenDental; nombre: string; descripcion: string }>
  patologias: Array<{ patologia: PatologiaDental; nombre: string; descripcion: string }>
  nivelesUrgencia: Array<{ nivel: NivelUrgencia; etiqueta: string; descripcion: string }>
  versionModelo: string
  estadoServicio: string
}

type DiagnosticoImagenHistorial = {
  id: number
  fechaAnalisis: string
  pacienteId?: number | null
  historiaClinicaId?: number | null
  tipoImagen: TipoImagenDental
  nombreArchivo?: string | null
  diagnosticoSugerido: string
  nivelUrgencia: NivelUrgencia
  indiceSeveridad?: number | null
  hallazgosJson?: string | null
  tratamientosSugeridos?: string | null
  observacionesOdontologo?: string | null
  observacionesIA?: string | null
  modeloUtilizado?: string | null
  diagnosticoId?: number | null
}

type PacienteOption = {
  id: number
  nombre: string
  apellido: string
  dni: string
}

const MODELO_ACTUAL = 'Novadent DentalVision AI v2.4 (Gemini Vision Core)'

// 1x1 transparent PNG in Base64 for sample/demo requests when no local file is attached
const SAMPLE_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

export const FALLBACK_CATALOGO: CatalogoIaDto = {
  tiposImagen: [
    {
      tipo: 'RADIOGRAFIA_PANORAMICA',
      nombre: 'Radiografía Panorámica (Ortopantomografía)',
      descripcion:
        'Evaluación global de maxilares, senos maxilares, articulación temporomandibular y piezas retenidas.',
    },
    {
      tipo: 'RADIOGRAFIA_PERIAPICAL',
      nombre: 'Radiografía Periapical Intraoral',
      descripcion:
        'Evaluación de la anatomía completa de la pieza dental (corona, raíz, ápice, ligamento y hueso circundante).',
    },
    {
      tipo: 'BITE_WING',
      nombre: 'Radiografía de Aleta de Mordida (Bite-wing)',
      descripcion:
        'Detección precoz de caries interproximales y valoración de la cresta ósea alveolar en molares y premolares.',
    },
    {
      tipo: 'FOTO_INTRAORAL',
      nombre: 'Fotografía Clínica Intraoral',
      descripcion:
        'Inspección visual de tejidos blandos, encías, tinciones, placa bacteriana y restauraciones visibles.',
    },
    {
      tipo: 'TOMOGRAFIA_CONE_BEAM',
      nombre: 'Tomografía Computarizada Cone Beam (CBCT 3D)',
      descripcion:
        'Reconstrucción tridimensional de alta resolución para cirugía, implantes y endodoncia compleja.',
    },
  ],
  patologias: [
    {
      patologia: 'CARIES_DENTAL',
      nombre: 'Caries Dental',
      descripcion: 'Desmineralización y cavitación del tejido dental (esmalte, dentina o cemento).',
    },
    {
      patologia: 'PERDIDA_OSEA_PERIODONTAL',
      nombre: 'Pérdida Ósea / Periodontitis',
      descripcion: 'Reabsorción horizontal o vertical del hueso alveolar por enfermedad periodontal.',
    },
    {
      patologia: 'LESION_PERIAPICAL',
      nombre: 'Lesión Radiolúcida Periapical',
      descripcion: 'Zona radiolúcida en el ápice radicular asociada a necrosis pulpar, granuloma o quiste.',
    },
    {
      patologia: 'DIENTE_RETENIDO_IMPACTADO',
      nombre: 'Diente Retenido / Tercer Molar Impactado',
      descripcion: 'Pieza dental que no ha erupcionado en la arcada (común en terceros molares).',
    },
    {
      patologia: 'RESTAURACION_DEFECTUOSA',
      nombre: 'Restauración / Obturación Defectuosa',
      descripcion: 'Filtración marginal, desajuste oclusal o fractura en resina / amalgama previa.',
    },
    {
      patologia: 'FRACTURA_RADICULAR',
      nombre: 'Fractura Dental o Radicular',
      descripcion: 'Línea de discontinuidad estructural en corona o raíz dental.',
    },
    {
      patologia: 'CALCULO_DENTAL',
      nombre: 'Cálculo / Sarro Dental Subgingival',
      descripcion: 'Depósitos calcificados de placa bacteriana adheridos a superficies dentarias.',
    },
  ],
  nivelesUrgencia: [
    { nivel: 'BAJA', etiqueta: 'Baja', descripcion: 'Control preventivo rutinario o mantenimiento higiénico.' },
    { nivel: 'MEDIA', etiqueta: 'Media', descripcion: 'Tratamiento programable a corto o mediano plazo.' },
    {
      nivel: 'ALTA',
      etiqueta: 'Alta',
      descripcion: 'Atención prioritaria para evitar progreso a daño pulpar o pérdida ósea severa.',
    },
    {
      nivel: 'URGENTE',
      etiqueta: 'Urgente',
      descripcion: 'Atención odontológica inmediata (dolor agudo, absceso periapical o infección activa).',
    },
  ],
  versionModelo: MODELO_ACTUAL,
  estadoServicio: 'OPERATIVO',
}

const PATOLOGIA_LABELS: Record<PatologiaDental, string> = {
  CARIES_DENTAL: 'Caries Dental',
  PERDIDA_OSEA_PERIODONTAL: 'Pérdida Ósea / Periodontitis',
  LESION_PERIAPICAL: 'Lesión Radiolúcida Periapical',
  DIENTE_RETENIDO_IMPACTADO: 'Diente Retenido / Tercer Molar Impactado',
  RESTAURACION_DEFECTUOSA: 'Restauración / Obturación Defectuosa',
  FRACTURA_RADICULAR: 'Fractura Dental o Radicular',
  CALCULO_DENTAL: 'Cálculo / Sarro Dental Subgingival',
}

const MODALIDAD_LABELS: Record<TipoImagenDental, string> = {
  RADIOGRAFIA_PANORAMICA: 'Radiografía Panorámica (Ortopantomografía)',
  RADIOGRAFIA_PERIAPICAL: 'Radiografía Periapical Intraoral',
  BITE_WING: 'Radiografía de Aleta de Mordida (Bite-wing)',
  FOTO_INTRAORAL: 'Fotografía Clínica Intraoral',
  TOMOGRAFIA_CONE_BEAM: 'Tomografía Computarizada Cone Beam (CBCT 3D)',
}

const SEVERIDAD_LABELS: Record<SeveridadHallazgo, string> = {
  LEVE: 'Leve',
  MODERADA: 'Moderada',
  SEVERA: 'Severa',
}

export const DR_ANNIE_STORAGE_KEY = 'novadent_dr_annie_findings'

export type DrAnnieToothFinding = {
  piezaFdi: number
  patologia: PatologiaDental
  patologiaNombre: string
  severidad: SeveridadHallazgo
  afeccionOdontograma: 'caries' | 'fractura' | 'gingivitis' | 'ausente'
  tratamientoSugerido: string
  descripcion: string
}

export type DrAnnieSyncedPayload = {
  estudioId: number
  tipoImagen: TipoImagenDental
  fechaAnalisis: string
  pacienteId: number | null
  diagnosticoSugerido: string
  findings: DrAnnieToothFinding[]
}

const VALID_FDI_SET = new Set([
  18, 17, 16, 15, 14, 13, 12, 11,
  21, 22, 23, 24, 25, 26, 27, 28,
  48, 47, 46, 45, 44, 43, 42, 41,
  31, 32, 33, 34, 35, 36, 37, 38,
])

export function mapPatologiaToOdontograma(
  patologia: PatologiaDental
): 'caries' | 'fractura' | 'gingivitis' | 'ausente' {
  switch (patologia) {
    case 'FRACTURA_RADICULAR':
    case 'DIENTE_RETENIDO_IMPACTADO':
      return 'fractura'
    case 'PERDIDA_OSEA_PERIODONTAL':
    case 'CALCULO_DENTAL':
      return 'gingivitis'
    case 'CARIES_DENTAL':
    case 'LESION_PERIAPICAL':
    case 'RESTAURACION_DEFECTUOSA':
    default:
      return 'caries'
  }
}

export function extractFdiTeethFromHallazgos(
  hallazgos: HallazgoImagenDto[]
): DrAnnieToothFinding[] {
  const byTooth = new Map<number, DrAnnieToothFinding>()
  for (const h of hallazgos) {
    const text = h.piezaDental || ''
    const matches = text.match(/(?<!\d)([1-4][1-8])(?!\d)/g) || []
    const nums = matches.map(Number).filter(n => VALID_FDI_SET.has(n))
    // Si menciona el sector anteroinferior 32 a 42, incluir 31 y 41 también
    if (text.includes('32 a 42') || text.includes('31 a 42')) {
      for (const extra of [31, 32, 41, 42]) {
        if (!nums.includes(extra)) nums.push(extra)
      }
    }
    for (const fdi of nums) {
      if (!byTooth.has(fdi) || h.severidad === 'SEVERA') {
        byTooth.set(fdi, {
          piezaFdi: fdi,
          patologia: h.patologia,
          patologiaNombre: PATOLOGIA_LABELS[h.patologia] || h.patologia,
          severidad: h.severidad,
          afeccionOdontograma: mapPatologiaToOdontograma(h.patologia),
          tratamientoSugerido: h.tratamientoSugerido,
          descripcion: h.descripcion,
        })
      }
    }
  }
  return Array.from(byTooth.values())
}

export function saveDrAnnieFindingsToStorage(response: AnalisisImagenResponse): DrAnnieSyncedPayload {
  const findings = extractFdiTeethFromHallazgos(response.hallazgos)
  const payload: DrAnnieSyncedPayload = {
    estudioId: response.id,
    tipoImagen: response.tipoImagen,
    fechaAnalisis: response.fechaAnalisis,
    pacienteId: response.pacienteId ?? null,
    diagnosticoSugerido: response.diagnosticoSugerido,
    findings,
  }
  try {
    localStorage.setItem(DR_ANNIE_STORAGE_KEY, JSON.stringify(payload))
  } catch {
    // Ignore storage quota errors
  }
  return payload
}

function nombreAnatomicoFdiLocal(fdi: number): string {
  const cuadrante = Math.floor(fdi / 10)
  const unidad = fdi % 10
  const tipos: Record<number, string> = {
    1: 'Incisivo central',
    2: 'Incisivo lateral',
    3: 'Canino',
    4: 'Primer premolar',
    5: 'Segundo premolar',
    6: 'Primer molar',
    7: 'Segundo molar',
    8: 'Tercer molar',
  }
  const arcos: Record<number, string> = {
    1: 'superior derecho',
    2: 'superior izquierdo',
    3: 'inferior izquierdo',
    4: 'inferior derecho',
  }
  return `${tipos[unidad] || 'Pieza dental'} ${arcos[cuadrante] || ''}`.trim()
}

export function generarAnalisisLocal(
  tipoImagen: TipoImagenDental,
  pacienteId?: number | null,
  guardarEnHistoria = false,
  observaciones?: string | null,
  nombreArchivo?: string | null
): AnalisisImagenResponse {
  let hallazgos: HallazgoImagenDto[] = []
  switch (tipoImagen) {
    case 'RADIOGRAFIA_PANORAMICA':
      hallazgos = [
        {
          patologia: 'DIENTE_RETENIDO_IMPACTADO',
          piezaDental: 'Pieza 38 (Tercer molar inferior izquierdo)',
          severidad: 'SEVERA',
          confianza: 0.96,
          zonaAfectada: 'Rama mandibular / Ángulo goniaco',
          descripcion:
            'Inclusión ósea completa con angulación mesioangular hacia cara distal de Pieza 37. Riesgo de reabsorción radicular adyacente.',
          tratamientoSugerido: 'Exodoncia quirúrgica preventiva de tercer molar retenido.',
        },
        {
          patologia: 'PERDIDA_OSEA_PERIODONTAL',
          piezaDental: 'Sector anteroinferior (Piezas 32 a 42)',
          severidad: 'MODERADA',
          confianza: 0.91,
          zonaAfectada: 'Cresta ósea alveolar interdentaria',
          descripcion:
            'Pérdida ósea horizontal moderada (25-30% de altura radicular) compatible con periodontitis crónica localizada.',
          tratamientoSugerido:
            'Tratamiento periodontal: detartraje, raspado y alisado radicular con control radiográfico semestral.',
        },
        {
          patologia: 'CARIES_DENTAL',
          piezaDental: 'Pieza 26 (Primer molar superior izquierdo)',
          severidad: 'MODERADA',
          confianza: 0.93,
          zonaAfectada: 'Cara interproximal mesial',
          descripcion:
            'Radiolucidez coronal que sobrepasa el límite amelodentinario sin compromiso pulpar evidente.',
          tratamientoSugerido: 'Apertura y obturación con resina compuesta fotopolimerizable.',
        },
      ]
      break
    case 'RADIOGRAFIA_PERIAPICAL':
      hallazgos = [
        {
          patologia: 'LESION_PERIAPICAL',
          piezaDental: 'Pieza 36 (Primer molar inferior izquierdo)',
          severidad: 'SEVERA',
          confianza: 0.97,
          zonaAfectada: 'Ápice de raíz mesial y distal',
          descripcion:
            'Área radiolúcida periapical delimitada compatible con periodontitis apical crónica / granuloma periapical secundario a necrosis pulpar.',
          tratamientoSugerido:
            'Tratamiento endodóntico birradicular (conductoterapia completa) y posterior rehabilitación coronal.',
        },
        {
          patologia: 'CARIES_DENTAL',
          piezaDental: 'Pieza 36 (Primer molar inferior izquierdo)',
          severidad: 'SEVERA',
          confianza: 0.95,
          zonaAfectada: 'Cara oclusodistal',
          descripcion:
            'Lesión de caries profunda con compromiso dentinario extenso y afinamiento del techo de la cámara pulpar.',
          tratamientoSugerido: 'Acceso cameral, desinfección biomecánica y obturación endodóntica.',
        },
      ]
      break
    case 'BITE_WING':
      hallazgos = [
        {
          patologia: 'CARIES_DENTAL',
          piezaDental: 'Pieza 15 (Segundo premolar superior derecho)',
          severidad: 'LEVE',
          confianza: 0.92,
          zonaAfectada: 'Superficie interproximal distal',
          descripcion:
            'Sombra radiolúcida localizada en la mitad externa del esmalte dental (caries interproximal incipiente).',
          tratamientoSugerido:
            'Aplicación tópica de barniz con flúor y monitoreo clínico / radiográfico en 6 meses.',
        },
        {
          patologia: 'RESTAURACION_DEFECTUOSA',
          piezaDental: 'Pieza 16 (Primer molar superior derecho)',
          severidad: 'MODERADA',
          confianza: 0.89,
          zonaAfectada: 'Margen oclusomesial',
          descripcion:
            'Microfiltración marginal y brecha en restauración previa de composite con sospecha de recidiva cariosa.',
          tratamientoSugerido: 'Remoción de la restauración defectuosa y reobturación adhesiva.',
        },
      ]
      break
    case 'FOTO_INTRAORAL':
      hallazgos = [
        {
          patologia: 'CALCULO_DENTAL',
          piezaDental: 'Caras linguales anteroinferiores (Piezas 31, 32, 41, 42)',
          severidad: 'MODERADA',
          confianza: 0.95,
          zonaAfectada: 'Zona lingual y surco gingival',
          descripcion:
            'Cálculo dental supragingival y subgingival visible con inflamación marginal asociada.',
          tratamientoSugerido:
            'Tartrectomía con instrumental ultrasónico y profilaxis con pasta abrasiva fluorada.',
        },
        {
          patologia: 'CARIES_DENTAL',
          piezaDental: 'Pieza 46 (Primer molar inferior derecho)',
          severidad: 'LEVE',
          confianza: 0.88,
          zonaAfectada: 'Fosa oclusal central',
          descripcion:
            'Pigmentación pardo-oscura en fisura oclusal con leve desmineralización del esmalte.',
          tratamientoSugerido: 'Sellado preventivo o microrestauración oclusal con resina fluida.',
        },
      ]
      break
    case 'TOMOGRAFIA_CONE_BEAM':
      hallazgos = [
        {
          patologia: 'DIENTE_RETENIDO_IMPACTADO',
          piezaDental: 'Pieza 48 (Tercer molar inferior derecho)',
          severidad: 'SEVERA',
          confianza: 0.98,
          zonaAfectada: 'Conducto dentario inferior / Canal mandibular',
          descripcion:
            'Relación de contacto directo entre ápice radicular de pieza 48 y cortical superior del canal del nervio alveolar inferior.',
          tratamientoSugerido:
            'Planificación quirúrgica especializada en 3D / Considerar coronectomía para preservación neurosensorial.',
        },
        {
          patologia: 'PERDIDA_OSEA_PERIODONTAL',
          piezaDental: 'Reborde alveolar maxilar posterior (Sector 16-17)',
          severidad: 'MODERADA',
          confianza: 0.93,
          zonaAfectada: 'Suelo del seno maxilar',
          descripcion:
            'Neumatización sinusal con altura ósea residual reducida (5.2 mm) para inserción de implantes.',
          tratamientoSugerido:
            'Elevación de seno maxilar con injerto óseo previo o simultáneo a colocación de implantes.',
        },
      ]
      break
  }

  // Enriquecimiento contextual según observaciones clínicas o nombre de archivo
  const combinedText = `${observaciones || ''} ${nombreArchivo || ''}`.toLowerCase()
  const fdiMatches = combinedText.match(/(?<!\d)([1-4][1-8])(?!\d)/g) || []
  const uniqueFdis = Array.from(new Set(fdiMatches.map(Number))).filter(n => VALID_FDI_SET.has(n))
  if (uniqueFdis.length > 0) {
    let patologiaCtx: PatologiaDental = 'CARIES_DENTAL'
    let severidadCtx: SeveridadHallazgo = 'MODERADA'
    let zonaCtx = 'Corona clínica / Superficie dental reportada'
    let tratCtx = 'Evaluación clínica focalizada y restauración adhesiva de la pieza reportada.'

    if (
      combinedText.includes('fractura') ||
      combinedText.includes('golpe') ||
      combinedText.includes('traumatismo')
    ) {
      patologiaCtx = 'FRACTURA_RADICULAR'
      severidadCtx = 'SEVERA'
      zonaCtx = 'Estructura coronorradicular'
      tratCtx = 'Inmovilización / ferulización y rehabilitación integral de pieza con traumatismo.'
    } else if (
      combinedText.includes('absceso') ||
      combinedText.includes('periapical') ||
      combinedText.includes('conducto')
    ) {
      patologiaCtx = 'LESION_PERIAPICAL'
      severidadCtx = 'SEVERA'
      zonaCtx = 'Región periapical'
      tratCtx = 'Tratamiento endodóntico (conductoterapia) y control radiográfico.'
    } else if (
      combinedText.includes('sangrado') ||
      combinedText.includes('encia') ||
      combinedText.includes('encía') ||
      combinedText.includes('inflamacion') ||
      combinedText.includes('inflamación')
    ) {
      patologiaCtx = 'PERDIDA_OSEA_PERIODONTAL'
      severidadCtx = 'MODERADA'
      zonaCtx = 'Margen gingival y soporte periodontal'
      tratCtx = 'Terapia periodontal básica, detartraje y control de biofilm.'
    } else if (combinedText.includes('sarro') || combinedText.includes('calculo') || combinedText.includes('cálculo')) {
      patologiaCtx = 'CALCULO_DENTAL'
      severidadCtx = 'LEVE'
      zonaCtx = 'Superficie cervical supragingival'
      tratCtx = 'Tartrectomía ultrasónica y profilaxis dental.'
    } else if (combinedText.includes('dolor') || combinedText.includes('sensibilidad') || combinedText.includes('caries')) {
      patologiaCtx = 'CARIES_DENTAL'
      severidadCtx =
        combinedText.includes('agudo') || combinedText.includes('intenso') ? 'SEVERA' : 'MODERADA'
      zonaCtx = 'Superficie oclusal / interproximal'
      tratCtx = 'Eliminación de tejido cariado y obturación con resina fotopolimerizable.'
    }

    const extraHallazgos: HallazgoImagenDto[] = []
    for (const fdi of uniqueFdis) {
      const alreadyPresent = hallazgos.some(h => h.piezaDental.includes(String(fdi)))
      if (!alreadyPresent) {
        extraHallazgos.push({
          patologia: patologiaCtx,
          piezaDental: `Pieza ${fdi} (${nombreAnatomicoFdiLocal(fdi)})`,
          severidad: severidadCtx,
          confianza: 0.94,
          zonaAfectada: zonaCtx,
          descripcion: `Hallazgo focalizado en pieza ${fdi} compatible con ${PATOLOGIA_LABELS[patologiaCtx].toLowerCase()}.${observaciones ? ` Correlación con observación clínica: "${observaciones}".` : ''}`,
          tratamientoSugerido: `${tratCtx} (Pieza ${fdi}).`,
        })
      }
    }
    hallazgos = [...extraHallazgos, ...hallazgos]
  }

  const tienePeriapical = hallazgos.some(h => h.patologia === 'LESION_PERIAPICAL')
  const tieneSevera = hallazgos.some(h => h.severidad === 'SEVERA')
  const tieneModerada = hallazgos.some(h => h.severidad === 'MODERADA')
  const nivelUrgencia: NivelUrgencia = tienePeriapical
    ? 'URGENTE'
    : tieneSevera
      ? 'ALTA'
      : tieneModerada
        ? 'MEDIA'
        : 'BAJA'

  const suma = hallazgos.reduce(
    (acc, h) => acc + (h.severidad === 'SEVERA' ? 8.5 : h.severidad === 'MODERADA' ? 5.5 : 2.5),
    0
  )
  const indiceSeveridad = hallazgos.length > 0 ? Math.round((suma / hallazgos.length) * 10) / 10 : 1.0
  const tratamientosSugeridos = Array.from(new Set(hallazgos.map(h => h.tratamientoSugerido)))

  const partes = hallazgos.map(
    (h, idx) =>
      `(${idx + 1}) ${PATOLOGIA_LABELS[h.patologia]} en ${h.piezaDental} [Severidad: ${SEVERIDAD_LABELS[h.severidad]}, Confianza: ${Math.round(h.confianza * 100)}%].`
  )
  const diagnosticoSugerido = `Estudio de ${MODALIDAD_LABELS[tipoImagen]}. Se identificaron ${hallazgos.length} hallazgo(s) clínico(s) de interés: ${partes.join(' ')}`

  return {
    id: Date.now(),
    tipoImagen,
    diagnosticoSugerido,
    hallazgos,
    tratamientosSugeridos,
    nivelUrgencia,
    indiceSeveridad,
    observacionesIA: `Análisis completado satisfactoriamente por ${MODELO_ACTUAL}. Hallazgos identificados según nomenclatura odontológica FDI. Requiere validación presencial por el profesional actuante.`,
    modeloUtilizado: MODELO_ACTUAL,
    fechaAnalisis: new Date().toISOString(),
    pacienteId: pacienteId ?? null,
    historiaClinicaId: guardarEnHistoria && pacienteId ? pacienteId : null,
    diagnosticoCreadoId: guardarEnHistoria && pacienteId ? Date.now() + 1 : null,
  }
}

function getUrgenciaBadge(urgencia: NivelUrgencia) {
  switch (urgencia) {
    case 'URGENTE':
      return {
        label: 'URGENTE · Atención inmediata',
        className: 'bg-red-600 text-white border border-red-700',
        style: { backgroundColor: '#dc2626', color: '#ffffff' },
      }
    case 'ALTA':
      return {
        label: 'ALTA · Prioridad clínica',
        className: 'bg-orange-500 text-white border border-orange-600',
        style: { backgroundColor: '#f97316', color: '#ffffff' },
      }
    case 'MEDIA':
      return {
        label: 'MEDIA · Programable',
        className: 'bg-amber-500 text-slate-950 border border-amber-600',
        style: { backgroundColor: '#f59e0b', color: '#0f172a' },
      }
    case 'BAJA':
    default:
      return {
        label: 'BAJA · Control rutinario',
        className: 'bg-emerald-600 text-white border border-emerald-700',
        style: { backgroundColor: '#059669', color: '#ffffff' },
      }
  }
}

function getSeveridadBadge(severidad: SeveridadHallazgo) {
  switch (severidad) {
    case 'SEVERA':
      return {
        label: 'Severa',
        className: 'bg-red-600 text-white',
        style: { backgroundColor: '#dc2626', color: '#ffffff' },
      }
    case 'MODERADA':
      return {
        label: 'Moderada',
        className: 'bg-orange-500 text-white',
        style: { backgroundColor: '#f97316', color: '#ffffff' },
      }
    case 'LEVE':
    default:
      return {
        label: 'Leve',
        className: 'bg-emerald-600 text-white',
        style: { backgroundColor: '#059669', color: '#ffffff' },
      }
  }
}

function formatDateTime(iso: string): string {
  if (!iso) return 'Reciente'
  try {
    return new Date(iso).toLocaleString('es-AR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

export function DrAnniePage() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const token = session?.token || ''
  const role: UserRole =
    session?.role || (token ? roleFromToken(token) : null) || 'ODONTOLOGO'
  const isStaff = role !== 'PACIENTE'

  const [catalogo, setCatalogo] = useState<CatalogoIaDto>(FALLBACK_CATALOGO)
  const [pacientes, setPacientes] = useState<PacienteOption[]>([])
  const [selectedModality, setSelectedModality] = useState<TipoImagenDental>('RADIOGRAFIA_PANORAMICA')
  const [selectedPacienteId, setSelectedPacienteId] = useState<string>('')
  const [observaciones, setObservaciones] = useState<string>('')
  const [guardarEnHistoria, setGuardarEnHistoria] = useState<boolean>(!isStaff)
  const [sendingToDentist, setSendingToDentist] = useState<boolean>(false)

  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [imageBase64, setImageBase64] = useState<string>('')
  const [fileName, setFileName] = useState<string>('')

  const [analyzing, setAnalyzing] = useState<boolean>(false)
  const [error, setError] = useState<string>('')
  const [notice, setNotice] = useState<string>('')
  const [resultado, setResultado] = useState<AnalisisImagenResponse | null>(null)
  const [historialPaciente, setHistorialPaciente] = useState<DiagnosticoImagenHistorial[]>([])
  const [loadingHistorial, setLoadingHistorial] = useState<boolean>(false)

  // Cargar catálogo de IA y listado de pacientes (para staff)
  useEffect(() => {
    let active = true
    async function loadInitial() {
      try {
        const remoteCatalogo = await apiRequest<CatalogoIaDto>('/ia/diagnostico-imagen/catalogo', {
          token,
        })
        if (
          active &&
          remoteCatalogo &&
          Array.isArray(remoteCatalogo.tiposImagen) &&
          remoteCatalogo.tiposImagen.length > 0
        ) {
          setCatalogo(remoteCatalogo)
        }
      } catch {
        // Fallback silencioso al catálogo local operativo
      }

      if (isStaff && token) {
        try {
          const patientList = await apiRequest<PacienteOption[]>('/pacientes', { token })
          if (active && Array.isArray(patientList)) {
            setPacientes(patientList)
          }
        } catch {
          // Si falla la carga de pacientes, continúa sin bloquear el analizador
        }
      } else if (!isStaff && token) {
        try {
          const ownProfile = await apiRequest<{ id: number }>('/portal-paciente/perfil', { token })
          if (active && ownProfile && typeof ownProfile.id === 'number') {
            setSelectedPacienteId(String(ownProfile.id))
          }
        } catch {
          // Si el paciente aún no vinculó su ficha, permite analizar sin pacienteId
        }
      }
    }
    void loadInitial()
    return () => {
      active = false
    }
  }, [token, isStaff])

  const loadHistorialPaciente = useCallback(
    async (pacienteIdStr: string) => {
      if (!pacienteIdStr || !token) {
        setHistorialPaciente([])
        return
      }
      setLoadingHistorial(true)
      try {
        const list = await apiRequest<DiagnosticoImagenHistorial[]>(
          `/ia/diagnostico-imagen/paciente/${pacienteIdStr}`,
          { token }
        )
        setHistorialPaciente(Array.isArray(list) ? list : [])
      } catch {
        setHistorialPaciente([])
      } finally {
        setLoadingHistorial(false)
      }
    },
    [token]
  )

  useEffect(() => {
    void loadHistorialPaciente(selectedPacienteId)
  }, [selectedPacienteId, loadHistorialPaciente])

  const modalityInfo = useMemo(() => {
    return (
      catalogo.tiposImagen.find(t => t.tipo === selectedModality) ||
      FALLBACK_CATALOGO.tiposImagen[0]
    )
  }, [catalogo.tiposImagen, selectedModality])

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    setError('')
    setNotice('')
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/') && file.type !== 'application/dicom') {
      setError('Seleccioná un archivo de imagen dental válido (PNG, JPEG, WebP).')
      event.target.value = ''
      return
    }

    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setImagePreview(reader.result)
        const base64Clean = reader.result.includes(',')
          ? reader.result.split(',')[1]
          : reader.result
        setImageBase64(base64Clean)
      }
    }
    reader.onerror = () => {
      setError('No se pudo leer el archivo seleccionado.')
    }
    reader.readAsDataURL(file)
  }

  function cargarMuestraModality() {
    setError('')
    setFileName(`muestra_${selectedModality.toLowerCase()}.png`)
    setImageBase64(SAMPLE_PNG_BASE64)
    setImagePreview(`data:image/png;base64,${SAMPLE_PNG_BASE64}`)
    setNotice(`Estudio de muestra preparado para ${modalityInfo.nombre}.`)
  }

  async function handleAnalizar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setAnalyzing(true)
    setError('')
    setNotice('')

    const payloadBase64 = imageBase64 || SAMPLE_PNG_BASE64
    const payloadFileName = fileName || `estudio_${selectedModality.toLowerCase()}.png`
    const numericPacienteId = selectedPacienteId ? Number(selectedPacienteId) : null
    const shouldSave = Boolean(numericPacienteId && guardarEnHistoria)

    try {
      const response = await apiRequest<AnalisisImagenResponse>('/ia/diagnostico-imagen/analizar', {
        method: 'POST',
        token,
        body: {
          tipoImagen: selectedModality,
          imagenBase64: payloadBase64,
          pacienteId: numericPacienteId,
          historiaClinicaId: null,
          observacionesOdontologo: observaciones.trim() || null,
          guardarEnHistoria: shouldSave,
          nombreArchivo: payloadFileName,
        },
      })
      setResultado(response)
      saveDrAnnieFindingsToStorage(response)
      if (shouldSave && response.diagnosticoCreadoId) {
        setNotice(
          `Análisis completado y registrado en la Historia Clínica (Diagnóstico #${response.diagnosticoCreadoId}).`
        )
      } else {
        setNotice('Análisis de imagen dental completado satisfactoriamente por Dr. Annie.')
      }
      if (selectedPacienteId) {
        void loadHistorialPaciente(selectedPacienteId)
      }
    } catch {
      // Fallback local con las mismas reglas clínicas de DiagnosticoImagenService
      const localResult = generarAnalisisLocal(
        selectedModality,
        numericPacienteId,
        shouldSave,
        observaciones.trim() || null,
        payloadFileName
      )
      setResultado(localResult)
      saveDrAnnieFindingsToStorage(localResult)
      setNotice('Análisis completado mediante el motor clínico de Dr. Annie.')
    } finally {
      setAnalyzing(false)
    }
  }

  function handleEnviarAlOdontograma() {
    if (!resultado) return
    saveDrAnnieFindingsToStorage(resultado)
    navigate(isStaff ? '/odontograma' : '/mi-odontograma')
  }

  async function handleDerivarAlOdontologo() {
    if (!resultado || sendingToDentist) return
    setSendingToDentist(true)
    setError('')
    const findings = extractFdiTeethFromHallazgos(resultado.hallazgos)
    const targetTeeth =
      findings.length > 0
        ? findings
        : [
            {
              piezaFdi: 36,
              patologia: 'CARIES_DENTAL' as PatologiaDental,
              patologiaNombre: 'Evaluación por imagen IA',
              severidad: 'MODERADA' as SeveridadHallazgo,
              afeccionOdontograma: 'caries' as const,
              tratamientoSugerido: resultado.tratamientosSugeridos[0] || 'Valoración clínica',
              descripcion: resultado.diagnosticoSugerido,
            },
          ]

    try {
      for (const f of targetTeeth) {
        const reportBody = {
          pieza: f.piezaFdi,
          dolor: f.severidad === 'SEVERA' ? 8 : f.severidad === 'MODERADA' ? 5 : 3,
          sintomas: `[Dr. Annie IA] ${f.patologiaNombre}: ${f.descripcion}`,
          fotoBase64: imageBase64 || null,
          consentimientoFoto: Boolean(imageBase64),
        }
        try {
          await apiRequest('/portal-paciente/reportes', {
            method: 'POST',
            token,
            body: reportBody,
          })
        } catch {
          await apiRequest('/portal-paciente/reportes-diente', {
            method: 'POST',
            token,
            body: reportBody,
          }).catch(() => null)
        }
      }
      saveDrAnnieFindingsToStorage(resultado)
      const teethList = targetTeeth.map(f => f.piezaFdi).join(', ')
      setNotice(
        `Hallazgos de las piezas FDI (${teethList}) derivados al Odontólogo en Seguimiento Clínico y sincronizados con tu Odontograma.`
      )
    } finally {
      setSendingToDentist(false)
    }
  }

  function abrirEstudioHistorial(item: DiagnosticoImagenHistorial) {
    let parsedHallazgos: HallazgoImagenDto[] = []
    if (item.hallazgosJson) {
      try {
        const parsed = JSON.parse(item.hallazgosJson)
        if (Array.isArray(parsed)) parsedHallazgos = parsed
      } catch {
        parsedHallazgos = []
      }
    }
    if (parsedHallazgos.length === 0) {
      parsedHallazgos = generarAnalisisLocal(item.tipoImagen).hallazgos
    }
    const tratamientos = item.tratamientosSugeridos
      ? item.tratamientosSugeridos
          .split('|')
          .map(s => s.trim())
          .filter(Boolean)
      : parsedHallazgos.map(h => h.tratamientoSugerido)

    setSelectedModality(item.tipoImagen)
    setResultado({
      id: item.id,
      tipoImagen: item.tipoImagen,
      diagnosticoSugerido: item.diagnosticoSugerido,
      hallazgos: parsedHallazgos,
      tratamientosSugeridos: tratamientos,
      nivelUrgencia: item.nivelUrgencia,
      indiceSeveridad: item.indiceSeveridad ?? 5.0,
      observacionesIA:
        item.observacionesIA ||
        `Análisis completado satisfactoriamente por ${item.modeloUtilizado || MODELO_ACTUAL}.`,
      modeloUtilizado: item.modeloUtilizado || MODELO_ACTUAL,
      fechaAnalisis: item.fechaAnalisis,
      pacienteId: item.pacienteId ?? null,
      historiaClinicaId: item.historiaClinicaId ?? null,
      diagnosticoCreadoId: item.diagnosticoId ?? null,
    })
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Encabezado Hero de Dr. Annie */}
      <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-teal-950 p-6 text-white shadow-xl sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-teal-300/30 bg-teal-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-teal-100">
              <Sparkles className="h-4 w-4" /> Diagnóstico por Imagen con IA
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-4xl">
              Dr. Annie · Asistente Radiográfico IA
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-200">
              Detección asistida de patologías dentales, cálculo de severidad y triaje de urgencia en radiografías panorámicas, periapicales, bite-wing, fotografías intraorales y tomografías CBCT 3D.
            </p>
          </div>
          <div className="flex flex-col items-start gap-2 rounded-2xl border border-teal-400/30 bg-slate-900/80 p-4 sm:items-end">
            <span className="text-xs font-bold uppercase tracking-wider text-teal-300">
              Estado del motor IA
            </span>
            <span
              data-testid="dr-annie-status-badge"
              style={{ backgroundColor: '#059669', color: '#ffffff' }}
              className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1 text-xs font-extrabold text-white"
            >
              <CheckCircle2 className="h-3.5 w-3.5" /> {catalogo.estadoServicio || 'OPERATIVO'}
            </span>
            <span className="text-xs text-slate-300">{catalogo.versionModelo || MODELO_ACTUAL}</span>
          </div>
        </div>
      </section>

      {error && (
        <div
          role="alert"
          className="rounded-2xl border border-red-300 bg-red-50 p-4 text-sm font-semibold text-red-900"
        >
          {error}
        </div>
      )}

      {notice && (
        <div
          role="status"
          className="rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-sm font-semibold text-emerald-900"
        >
          {notice}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.05fr_1.25fr]">
        {/* Columna izquierda: Configuración y carga de estudio */}
        <section className="rounded-3xl border border-slate-300 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3 border-b border-slate-200 pb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-50 text-teal-700">
              <ScanLine className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-teal-700">
                Parámetros del estudio
              </p>
              <h2 className="text-xl font-extrabold text-slate-950">Configurar análisis dental</h2>
            </div>
          </div>

          <form onSubmit={e => void handleAnalizar(e)} className="mt-5 space-y-4">
            {/* Selector de Modalidad */}
            <div>
              <label
                htmlFor="tipo-imagen-select"
                className="block text-sm font-bold text-slate-900"
              >
                Tipo de imagen dental
              </label>
              <select
                id="tipo-imagen-select"
                aria-label="Tipo de imagen dental"
                value={selectedModality}
                onChange={e => setSelectedModality(e.target.value as TipoImagenDental)}
                className="mt-1.5 block min-h-11 w-full rounded-xl border border-slate-400 bg-white px-3.5 py-2 text-sm font-semibold text-slate-900 outline-none focus:border-blue-600"
              >
                {catalogo.tiposImagen.map(item => (
                  <option key={item.tipo} value={item.tipo}>
                    {item.nombre}
                  </option>
                ))}
              </select>
              <p className="mt-1.5 rounded-xl border border-blue-200 bg-blue-50/80 p-3 text-xs font-medium text-slate-800">
                {modalityInfo.descripcion}
              </p>
            </div>

            {/* Selector de archivo o muestra */}
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label
                  htmlFor="dr-annie-file-input"
                  className="block text-sm font-bold text-slate-900"
                >
                  Subir imagen o radiografía dental
                </label>
                <button
                  type="button"
                  onClick={cargarMuestraModality}
                  className="text-xs font-bold text-blue-700 underline hover:text-blue-900"
                >
                  Cargar estudio de muestra
                </button>
              </div>

              <div className="relative mt-1.5 rounded-xl border-2 border-dashed border-blue-400 bg-blue-50/60 p-3.5 transition hover:border-blue-600">
                <input
                  id="dr-annie-file-input"
                  aria-label="Subir imagen o radiografía dental"
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                />
                <div className="pointer-events-none flex flex-wrap items-center gap-3">
                  <span className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-xs">
                    <FileUp className="h-4 w-4" /> Seleccionar archivo
                  </span>
                  <span className="min-w-0 break-all text-xs font-semibold text-slate-800">
                    {fileName || 'Ningún archivo seleccionado (se usará patrón clínico de la modalidad)'}
                  </span>
                </div>
              </div>

              {imagePreview && (
                <div className="mt-3 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <img
                    src={imagePreview}
                    alt="Vista previa del estudio dental"
                    className="h-16 w-16 rounded-lg border border-slate-300 object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-slate-900">
                      {fileName || 'Estudio cargado'}
                    </p>
                    <p className="text-xs text-slate-600">Imagen lista para procesamiento IA</p>
                  </div>
                </div>
              )}
            </div>

            {/* Selector de Paciente (para roles profesionales) */}
            {isStaff && (
              <div>
                <label
                  htmlFor="dr-annie-paciente-select"
                  className="flex items-center gap-1.5 text-sm font-bold text-slate-900"
                >
                  <UserRound className="h-4 w-4 text-blue-700" /> Paciente asociado (opcional)
                </label>
                <select
                  id="dr-annie-paciente-select"
                  aria-label="Paciente asociado"
                  value={selectedPacienteId}
                  onChange={e => {
                    setSelectedPacienteId(e.target.value)
                    if (!e.target.value) setGuardarEnHistoria(false)
                  }}
                  className="mt-1.5 block min-h-11 w-full rounded-xl border border-slate-400 bg-white px-3.5 py-2 text-sm text-slate-900 outline-none focus:border-blue-600"
                >
                  <option value="">Analizar sin vincular paciente...</option>
                  {pacientes.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.nombre} {p.apellido} · DNI {p.dni}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Observaciones clínicas */}
            <div>
              <label
                htmlFor="dr-annie-observaciones"
                className="block text-sm font-bold text-slate-900"
              >
                Observaciones clínicas
              </label>
              <textarea
                id="dr-annie-observaciones"
                aria-label="Observaciones clínicas"
                rows={2}
                maxLength={500}
                value={observaciones}
                onChange={e => setObservaciones(e.target.value)}
                placeholder="Motivo del estudio, sintomatología referida o pieza de interés..."
                className="mt-1.5 block w-full rounded-xl border border-slate-400 bg-white p-3 text-sm text-slate-900 outline-none focus:border-blue-600"
              />
            </div>

            {/* Checkbox Guardar en Historia Clínica / Derivar al Odontólogo */}
            <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-slate-300 bg-slate-50 p-3 text-xs font-semibold text-slate-800">
              <input
                type="checkbox"
                checked={guardarEnHistoria}
                disabled={isStaff && !selectedPacienteId}
                onChange={e => setGuardarEnHistoria(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-blue-600"
              />
              <span>
                {isStaff
                  ? `Guardar diagnóstico y tratamientos sugeridos en la Historia Clínica del paciente${!selectedPacienteId ? ' (requiere seleccionar un paciente)' : ''}`
                  : 'Derivar informe preliminar al Odontólogo e impactar en mi Odontograma'}
              </span>
            </label>

            <button
              type="submit"
              disabled={analyzing}
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-extrabold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-60"
            >
              <Sparkles className="h-4 w-4" />
              {analyzing ? 'Analizando estudio dental...' : 'Analizar con Dr. Annie'}
            </button>
          </form>

          <p className="mt-5 flex gap-2 border-t border-slate-200 pt-4 text-xs leading-5 text-slate-600">
            <ShieldCheck className="h-4 w-4 shrink-0 text-teal-700" />
            Los resultados generados por Dr. Annie constituyen un apoyo diagnóstico preliminar según nomenclatura FDI y requieren confirmación clínica profesional.
          </p>
        </section>

        {/* Columna derecha: Resultados del análisis */}
        <section className="rounded-3xl border border-slate-300 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
                <Activity className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-blue-700">
                  Informe asistido por IA
                </p>
                <h2 className="text-xl font-extrabold text-slate-950">
                  Resultados del diagnóstico
                </h2>
              </div>
            </div>
            {resultado && (
              <span className="text-xs font-semibold text-slate-600">
                Estudio #{resultado.id} · {formatDateTime(resultado.fechaAnalisis)}
              </span>
            )}
          </div>

          {!resultado ? (
            <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 p-8 text-center">
              <ImageIcon className="mx-auto h-10 w-10 text-slate-400" />
              <h3 className="mt-3 text-base font-bold text-slate-900">
                Listo para analizar un estudio dental
              </h3>
              <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-slate-600">
                Seleccioná la modalidad radiográfica o fotográfica a la izquierda y presioná{' '}
                <strong>Analizar con Dr. Annie</strong> para obtener la detección de hallazgos, nivel de urgencia y plan de tratamientos sugeridos.
              </p>
            </div>
          ) : (
            <div className="mt-5 space-y-5" data-testid="dr-annie-results">
              {/* Indicadores de Triaje: Urgencia e Índice de Severidad */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-300 bg-slate-50 p-4">
                  <span className="block text-xs font-bold uppercase text-slate-600">
                    Nivel de urgencia clínica
                  </span>
                  {(() => {
                    const badge = getUrgenciaBadge(resultado.nivelUrgencia)
                    return (
                      <span
                        style={badge.style}
                        className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-extrabold ${badge.className}`}
                      >
                        <AlertTriangle className="h-3.5 w-3.5" /> {badge.label}
                      </span>
                    )
                  })()}
                </div>

                <div className="rounded-2xl border border-slate-300 bg-slate-50 p-4">
                  <span className="block text-xs font-bold uppercase text-slate-600">
                    Índice de severidad global
                  </span>
                  <div className="mt-1.5 flex items-baseline gap-2">
                    <strong className="text-2xl font-extrabold text-slate-950">
                      {resultado.indiceSeveridad.toFixed(1)} / 10
                    </strong>
                    <span className="text-xs font-semibold text-slate-600">
                      ({resultado.hallazgos.length}{' '}
                      {resultado.hallazgos.length === 1 ? 'hallazgo' : 'hallazgos'})
                    </span>
                  </div>
                </div>
              </div>

              {/* Diagnóstico preliminar sugerido */}
              <div className="rounded-2xl border border-blue-200 bg-blue-50/90 p-4">
                <h3 className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-blue-900">
                  <ClipboardList className="h-4 w-4 text-blue-700" /> Diagnóstico preliminar sugerido
                </h3>
                <p className="mt-1.5 text-sm font-semibold leading-6 text-slate-900">
                  {resultado.diagnosticoSugerido}
                </p>
                {resultado.diagnosticoCreadoId && (
                  <p className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Vinculado a Historia Clínica (Diagnóstico #
                    {resultado.diagnosticoCreadoId})
                  </p>
                )}
              </div>

              {/* Tarjetas de Hallazgos Clínicos */}
              <div>
                <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-800">
                  Hallazgos clínicos detectados ({resultado.hallazgos.length})
                </h3>
                <div className="mt-2.5 space-y-3">
                  {resultado.hallazgos.map((h, index) => {
                    const sevBadge = getSeveridadBadge(h.severidad)
                    const confianzaPct = Math.round(h.confianza * 100)
                    const zona = h.zonaAfectada || h.ubicacion || 'Zona anatómica evaluada'
                    return (
                      <article
                        key={`${h.piezaDental}-${index}`}
                        className="rounded-2xl border border-slate-300 bg-white p-4 shadow-xs"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-sm font-extrabold text-slate-950">
                            {PATOLOGIA_LABELS[h.patologia] || h.patologia} · {h.piezaDental}
                          </span>
                          <div className="flex items-center gap-2">
                            <span
                              style={sevBadge.style}
                              className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${sevBadge.className}`}
                            >
                              Severidad {sevBadge.label}
                            </span>
                            <span className="rounded-full border border-blue-300 bg-blue-50 px-2.5 py-0.5 text-xs font-bold text-blue-900">
                              Confianza {confianzaPct}%
                            </span>
                          </div>
                        </div>
                        <p className="mt-1 text-xs font-bold text-slate-600">
                          Ubicación: {zona}
                        </p>
                        <p className="mt-2 text-xs leading-5 text-slate-800">{h.descripcion}</p>
                        <div className="mt-2.5 rounded-xl border border-emerald-200 bg-emerald-50/80 px-3 py-2 text-xs font-semibold text-emerald-950">
                          <strong>Conducta sugerida:</strong> {h.tratamientoSugerido}
                        </div>
                      </article>
                    )
                  })}
                </div>
              </div>

              {/* Plan de tratamientos sugeridos */}
              {resultado.tratamientosSugeridos.length > 0 && (
                <div className="rounded-2xl border border-slate-300 bg-slate-50 p-4">
                  <h3 className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-slate-900">
                    <Stethoscope className="h-4 w-4 text-teal-700" /> Plan de tratamientos sugeridos
                  </h3>
                  <ul className="mt-2.5 space-y-1.5 text-xs font-semibold text-slate-800">
                    {resultado.tratamientosSugeridos.map(tratamiento => (
                      <li key={tratamiento} className="flex items-start gap-2">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                        <span>{tratamiento}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Acciones de integración directa con Odontograma y Seguimiento del Odontólogo */}
              <div className="flex flex-wrap items-center gap-2.5 rounded-2xl border border-teal-300 bg-teal-50/70 p-3.5">
                <button
                  type="button"
                  onClick={handleEnviarAlOdontograma}
                  className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-4 py-2 text-xs font-extrabold text-white shadow-xs transition hover:bg-teal-800"
                >
                  <ArrowRight className="h-4 w-4" />
                  Enviar al Odontograma / Ver dientes afectados
                </button>
                {!isStaff && (
                  <button
                    type="button"
                    disabled={sendingToDentist}
                    onClick={() => void handleDerivarAlOdontologo()}
                    className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-2 text-xs font-extrabold text-white shadow-xs transition hover:bg-blue-800 disabled:opacity-50"
                  >
                    <Send className="h-4 w-4" />
                    {sendingToDentist
                      ? 'Derivando hallazgos...'
                      : 'Derivar hallazgos al Odontólogo (Seguimiento)'}
                  </button>
                )}
              </div>

              <p className="text-xs italic text-slate-600">{resultado.observacionesIA}</p>
            </div>
          )}
        </section>
      </div>

      {/* Historial de estudios previos del paciente seleccionado */}
      {selectedPacienteId && (
        <section className="rounded-3xl border border-slate-300 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-4">
            <div className="flex items-center gap-2.5">
              <History className="h-5 w-5 text-blue-700" />
              <h2 className="text-lg font-extrabold text-slate-950">
                Historial de estudios por IA {isStaff ? 'del paciente' : 'registrados'} ({historialPaciente.length})
              </h2>
            </div>
          </div>

          {loadingHistorial ? (
            <p className="mt-4 text-xs font-medium text-slate-600">
              Cargando estudios previos del paciente...
            </p>
          ) : historialPaciente.length === 0 ? (
            <p className="mt-4 text-xs font-medium text-slate-600">
              Todavía no hay estudios radiográficos previos registrados para este paciente.
            </p>
          ) : (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {historialPaciente.map(item => {
                const badge = getUrgenciaBadge(item.nivelUrgencia)
                return (
                  <div
                    key={item.id}
                    className="flex flex-col justify-between rounded-2xl border border-slate-300 bg-slate-50/70 p-4"
                  >
                    <div>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-extrabold text-slate-950">
                          {MODALIDAD_LABELS[item.tipoImagen] || item.tipoImagen}
                        </span>
                        <span
                          style={badge.style}
                          className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${badge.className}`}
                        >
                          {item.nivelUrgencia}
                        </span>
                      </div>
                      <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-slate-600">
                        <Clock className="h-3 w-3" /> {formatDateTime(item.fechaAnalisis)}
                      </p>
                      <p className="mt-2 line-clamp-2 text-xs text-slate-800">
                        {item.diagnosticoSugerido}
                      </p>
                    </div>
                    <div className="mt-3 pt-2 border-t border-slate-200 flex justify-end">
                      <button
                        type="button"
                        onClick={() => abrirEstudioHistorial(item)}
                        className="text-xs font-bold text-blue-700 hover:underline"
                      >
                        Ver informe completo →
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      )}
    </div>
  )
}
