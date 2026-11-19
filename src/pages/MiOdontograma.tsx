import { useEffect, useState, type CSSProperties } from 'react'
import { apiRequest } from '../lib/api'

type PiezaRegistrada = { numero: number; afeccion: string; tratamiento: string | null }
type OdontogramaPropio = { registradoEn: string | null; piezas: PiezaRegistrada[] }
type LabelMode = 'fdi' | 'anatomical'
type ViewMode = '2d' | '3d'
type MouthPerspective = 'completa' | 'boca' | 'frente' | 'lateral'

type PatientAffectionCode =
  | 'traumatismo'
  | 'caries'
  | 'fractura'
  | 'dolor'
  | 'gingivitis'
  | 'ausente'

type PatientAffectionDef = {
  code: PatientAffectionCode
  label: string
  color: string
  badgeBg: string
  description: string
  defaultPain: number
}

const ARCADA_SUPERIOR = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28]
const ARCADA_INFERIOR = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38]

const TOOTH_TYPES: Record<number, string> = {
  1: 'Incisivo central',
  2: 'Incisivo lateral',
  3: 'Canino',
  4: 'Primer premolar',
  5: 'Segundo premolar',
  6: 'Primer molar',
  7: 'Segundo molar',
  8: 'Tercer molar',
}
const QUADRANTS: Record<number, string> = {
  1: 'superior derecho',
  2: 'superior izquierdo',
  3: 'inferior izquierdo',
  4: 'inferior derecho',
}
const QUADRANT_RANGES: Record<number, string> = {
  1: '18 – 11',
  2: '21 – 28',
  4: '48 – 41',
  3: '31 – 38',
}

const COLORES: Record<string, string> = {
  traumatismo: '#dc2626',
  lesion: '#dc2626',
  golpe: '#dc2626',
  caries: '#ea580c',
  fractura: '#f97316',
  dolor: '#9333ea',
  sensibilidad: '#9333ea',
  gingivitis: '#eab308',
  ausente: '#64748b',
  sano: '#22c55e',
}

export const PATIENT_AFFECTIONS: readonly PatientAffectionDef[] = [
  {
    code: 'traumatismo',
    label: 'Lesión / Traumatismo (Golpe)',
    color: '#dc2626',
    badgeBg: 'rgba(220, 38, 38, 0.18)',
    description: 'Impacto, contusión o sangrado dental por golpe (identificado en rojo intenso).',
    defaultPain: 8,
  },
  {
    code: 'dolor',
    label: 'Dolor agudo / Sensibilidad',
    color: '#9333ea',
    badgeBg: 'rgba(147, 51, 234, 0.18)',
    description: 'Molestia punzante ante frío, calor o masticación.',
    defaultPain: 7,
  },
  {
    code: 'caries',
    label: 'Caries / Cavidad visible',
    color: '#ea580c',
    badgeBg: 'rgba(234, 88, 12, 0.18)',
    description: 'Mancha oscura o cavidad localizada en el esmalte.',
    defaultPain: 5,
  },
  {
    code: 'fractura',
    label: 'Fractura / Diente astillado',
    color: '#f97316',
    badgeBg: 'rgba(249, 115, 22, 0.18)',
    description: 'Desprendimiento parcial de corona o borde incisal.',
    defaultPain: 6,
  },
  {
    code: 'gingivitis',
    label: 'Inflamación o sangrado de encía',
    color: '#eab308',
    badgeBg: 'rgba(234, 179, 8, 0.18)',
    description: 'Encía enrojecida, inflamada o con sangrado al cepillado.',
    defaultPain: 4,
  },
  {
    code: 'ausente',
    label: 'Pieza ausente',
    color: '#64748b',
    badgeBg: 'rgba(100, 116, 139, 0.18)',
    description: 'Espacio edéntulo o pieza extraída.',
    defaultPain: 0,
  },
] as const

function nombrePieza(numero: number) {
  return (TOOTH_TYPES[numero % 10] || 'Pieza dental') + ' ' + (QUADRANTS[Math.floor(numero / 10)] || '')
}

function titleCase(value: string) {
  return value.charAt(0).toLocaleUpperCase('es-AR') + value.slice(1)
}

function colorPieza(afeccion: string | undefined) {
  if (!afeccion) return '#e2d4b7'
  return COLORES[afeccion.toLocaleLowerCase('es-AR').trim()] || '#dc2626'
}

/**
 * Silueta anatómica individual de cada diente (raíces + cuello gingival + corona blanco hueso)
 */
function AnatomicalToothSvg({
  numero,
  activeAffection,
  selected,
}: {
  numero: number
  activeAffection?: string
  selected: boolean
}) {
  const unit = numero % 10
  const isLower = numero >= 30
  const normalizedAff = activeAffection?.toLocaleLowerCase('es-AR').trim() || ''
  const isMissing = normalizedAff === 'ausente'
  const isTrauma = normalizedAff === 'traumatismo' || normalizedAff === 'lesion' || normalizedAff === 'golpe'
  const isGingivitis = normalizedAff === 'gingivitis'
  const isFracture = normalizedAff === 'fractura'
  const isCaries = normalizedAff === 'caries'
  const statusColor = activeAffection ? colorPieza(activeAffection) : '#d6c39f'

  const rootPath =
    unit <= 2
      ? 'M17 25 L19 4 Q22 0 25 4 L27 25 Z'
      : unit === 3
        ? 'M15 26 L20 1 Q22 -1 24 1 L29 26 Z'
        : unit <= 5
          ? 'M12 26 L15 5 Q17 1 19 8 L22 15 L25 8 Q27 1 29 5 L32 26 Z'
          : 'M8 26 L10 5 Q13 1 16 9 L19 17 L22 4 Q24 1 25 17 L28 9 Q31 1 34 5 L36 26 Z'

  const crownPath =
    unit <= 2
      ? 'M10 24 C9 34 10 47 13 52 Q22 54 31 52 C34 47 35 34 34 24 Q22 20 10 24 Z'
      : unit === 3
        ? 'M10 24 C8 33 11 45 22 55 C33 45 36 33 34 24 Q22 20 10 24 Z'
        : unit <= 5
          ? 'M8 24 C5 32 7 47 14 52 Q18 55 22 48 Q26 55 30 52 C37 47 39 32 36 24 Q22 20 8 24 Z'
          : 'M5 24 C2 32 4 48 11 52 Q16 55 20 49 Q22 46 24 49 Q28 55 33 52 C40 48 42 32 39 24 Q22 20 5 24 Z'

  const occlusalGroove =
    unit >= 6
      ? 'M10 39 Q22 44 34 39 M22 30 L22 48 M14 34 L30 44'
      : unit >= 4
        ? 'M12 40 Q22 45 32 40 M22 33 L22 46'
        : 'M14 46 Q22 49 30 46'

  return (
    <svg
      viewBox="0 0 44 58"
      aria-hidden="true"
      className="patient-tooth-icon"
      style={{
        transform: isLower ? 'scaleY(-1)' : undefined,
        opacity: isMissing ? 0.38 : 1,
      }}
    >
      <defs>
        <linearGradient id={`bone-enamel-${numero}`} x1="0" y1="0" x2="0.9" y2="1">
          <stop offset="0%" stopColor="#FFFDF9" />
          <stop offset="40%" stopColor="#FAF3E3" />
          <stop offset="80%" stopColor="#ECDFC6" />
          <stop offset="100%" stopColor="#D5C19E" />
        </linearGradient>
        <linearGradient id={`root-dentin-${numero}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#E6D2AF" />
          <stop offset="100%" stopColor="#C1A270" />
        </linearGradient>
      </defs>

      <path
        d={rootPath}
        fill={`url(#root-dentin-${numero})`}
        stroke={selected ? '#38bdf8' : '#b29364'}
        strokeWidth="1.35"
        strokeDasharray={isMissing ? '3 2' : undefined}
      />

      <path
        d="M7 24 Q22 30 37 24"
        fill="none"
        stroke={isGingivitis ? '#eab308' : '#f47292'}
        strokeWidth={isGingivitis ? '4.5' : '3.2'}
        strokeLinecap="round"
      />

      <path
        d={crownPath}
        fill={`url(#bone-enamel-${numero})`}
        stroke={selected ? '#38bdf8' : activeAffection ? statusColor : '#bda67e'}
        strokeWidth={selected ? 2.8 : activeAffection ? 2.5 : 1.5}
        strokeDasharray={isMissing ? '3 2' : undefined}
      />

      {activeAffection && !isMissing && (
        <path
          d={crownPath}
          fill={statusColor}
          fillOpacity={isTrauma ? 0.66 : 0.46}
        />
      )}

      <path
        d={occlusalGroove}
        fill="none"
        stroke={activeAffection ? statusColor : '#ad9570'}
        strokeWidth="1.35"
        strokeLinecap="round"
      />

      {!isMissing && (
        <path
          d="M13 28 Q13 39 17 46"
          fill="none"
          stroke="#ffffff"
          strokeWidth="1.8"
          strokeLinecap="round"
          opacity="0.9"
        />
      )}

      {isTrauma && (
        <g>
          <circle cx="22" cy="39" r="7" fill="#dc2626" fillOpacity="0.92" stroke="#fef2f2" strokeWidth="1.3" />
          <path d="M17.5 34.5 L26.5 43.5 M26.5 34.5 L17.5 43.5" stroke="#ffffff" strokeWidth="1.7" strokeLinecap="round" />
        </g>
      )}

      {isCaries && <circle cx="22" cy="40" r="5" fill="#dc2626" stroke="#7f1d1d" strokeWidth="1.2" />}

      {isFracture && (
        <path d="M11 36 L19 41 L16 47 L25 50 L33 42" fill="none" stroke="#ea580c" strokeWidth="2.3" strokeLinecap="round" />
      )}
    </svg>
  )
}

/**
 * Ilustración anatómica SVG del Paladar Superior (Bóveda palatina, papila incisiva, rafe medio y rugas palatinas)
 * que se ubica en el centro de la herradura de la Arcada Superior.
 */
function IllustratedPalateSvg() {
  return (
    <svg
      viewBox="0 0 360 155"
      className="mx-auto h-36 w-full max-w-[360px] drop-shadow-[0_6px_16px_rgba(0,0,0,0.45)]"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="palate-vault-grad" cx="50%" cy="38%" r="62%">
          <stop offset="0%" stopColor="#f48da0" />
          <stop offset="52%" stopColor="#d95972" />
          <stop offset="85%" stopColor="#b03550" />
          <stop offset="100%" stopColor="#881d36" />
        </radialGradient>
        <linearGradient id="upper-gum-rim" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fb9eb0" />
          <stop offset="100%" stopColor="#cf4a66" />
        </linearGradient>
      </defs>

      {/* Reborde gingival superior en herradura */}
      <path
        d="M 22 148 C 20 52, 85 8, 180 8 C 275 8, 340 52, 338 148 C 312 148, 304 132, 296 116 C 278 64, 236 34, 180 34 C 124 34, 82 64, 64 116 C 56 132, 48 148, 22 148 Z"
        fill="url(#upper-gum-rim)"
        stroke="#fda4af"
        strokeWidth="2"
      />

      {/* Bóveda del Paladar Duro y Blando */}
      <path
        d="M 52 146 C 56 64, 108 26, 180 26 C 252 26, 304 64, 308 146 Q 180 154 52 146 Z"
        fill="url(#palate-vault-grad)"
        stroke="#f9a8d4"
        strokeWidth="1.5"
      />

      {/* Papila incisiva (anterior, detrás de 11 y 21) */}
      <ellipse cx="180" cy="39" rx="7" ry="10" fill="#fca5a5" stroke="#be123c" strokeWidth="1.2" />

      {/* Rafe palatino medio */}
      <path
        d="M 180 49 L 180 142"
        stroke="#9f1239"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeDasharray="1 0"
        opacity="0.75"
      />

      {/* Rugas palatinas transversales (pliegues anatómicos del paladar duro) */}
      <path
        d="M 180 56 Q 145 50 118 62 M 180 56 Q 215 50 242 62"
        fill="none"
        stroke="#fecdd3"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <path
        d="M 180 72 Q 138 66 105 82 M 180 72 Q 222 66 255 82"
        fill="none"
        stroke="#fecdd3"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <path
        d="M 180 89 Q 142 84 102 102 M 180 89 Q 218 84 258 102"
        fill="none"
        stroke="#fda4af"
        strokeWidth="2.1"
        strokeLinecap="round"
      />
      <path
        d="M 180 106 Q 148 104 114 118 M 180 106 Q 212 104 246 118"
        fill="none"
        stroke="#fda4af"
        strokeWidth="1.8"
        strokeLinecap="round"
      />

      {/* Glándulas palatinas menores (textura posterior) */}
      <circle cx="145" cy="128" r="1.8" fill="#fecdd3" opacity="0.65" />
      <circle cx="162" cy="133" r="1.8" fill="#fecdd3" opacity="0.65" />
      <circle cx="198" cy="133" r="1.8" fill="#fecdd3" opacity="0.65" />
      <circle cx="215" cy="128" r="1.8" fill="#fecdd3" opacity="0.65" />

      {/* Etiqueta integrada dentro de la ilustración */}
      <rect x="105" y="122" width="150" height="22" rx="11" fill="rgba(76, 5, 25, 0.72)" stroke="#fda4af" strokeWidth="1" />
      <text x="180" y="137" textAnchor="middle" fill="#fff1f2" fontSize="10.5" fontWeight="800" letterSpacing="0.08em">
        PALADAR SUPERIOR
      </text>
    </svg>
  )
}

/**
 * Ilustración anatómica SVG de la Lengua (Cuerpo muscular, surco medio, papilas caliciformes en V y punta lingual)
 * que se ubica en el piso de la boca rodeada por la herradura de la Arcada Inferior.
 */
function IllustratedTongueSvg() {
  return (
    <svg
      viewBox="0 0 360 165"
      className="mx-auto h-40 w-full max-w-[360px] drop-shadow-[0_8px_18px_rgba(0,0,0,0.5)]"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="tongue-body-grad" cx="50%" cy="45%" r="58%">
          <stop offset="0%" stopColor="#fb7185" />
          <stop offset="55%" stopColor="#e11d48" />
          <stop offset="90%" stopColor="#9f1239" />
          <stop offset="100%" stopColor="#881337" />
        </radialGradient>
        <linearGradient id="lower-gum-rim" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#cf4a66" />
          <stop offset="100%" stopColor="#fb9eb0" />
        </linearGradient>
      </defs>

      {/* Reborde gingival inferior en herradura invertida */}
      <path
        d="M 22 12 C 20 108, 85 156, 180 156 C 275 156, 340 108, 338 12 C 312 12, 304 28, 296 44 C 278 96, 236 128, 180 128 C 124 128, 82 96, 64 44 C 56 28, 48 12, 22 12 Z"
        fill="url(#lower-gum-rim)"
        stroke="#fda4af"
        strokeWidth="2"
      />

      {/* Sombra del piso de la boca (espacio sublingual) */}
      <path
        d="M 55 14 C 62 98, 112 134, 180 134 C 248 134, 298 98, 305 14 Z"
        fill="#4c0519"
      />

      {/* Cuerpo muscular de la Lengua */}
      <path
        d="M 78 10 C 74 78, 110 132, 180 132 C 250 132, 286 78, 282 10 Q 180 -2 78 10 Z"
        fill="url(#tongue-body-grad)"
        stroke="#fecdd3"
        strokeWidth="2.2"
      />

      {/* V Lingual (Surco terminal y papilas caliciformes posteriores) */}
      <path
        d="M 118 28 L 180 48 L 242 28"
        fill="none"
        stroke="#881337"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <circle cx="132" cy="32" r="3" fill="#fda4af" stroke="#881337" strokeWidth="1" />
      <circle cx="154" cy="39" r="3" fill="#fda4af" stroke="#881337" strokeWidth="1" />
      <circle cx="180" cy="47" r="3.6" fill="#fda4af" stroke="#881337" strokeWidth="1.2" />
      <circle cx="206" cy="39" r="3" fill="#fda4af" stroke="#881337" strokeWidth="1" />
      <circle cx="228" cy="32" r="3" fill="#fda4af" stroke="#881337" strokeWidth="1" />

      {/* Surco medio lingual */}
      <path
        d="M 180 48 L 180 118"
        stroke="#881337"
        strokeWidth="2.8"
        strokeLinecap="round"
        opacity="0.85"
      />

      {/* Textura de papilas fungiformes y brillo húmedo */}
      <circle cx="140" cy="64" r="2" fill="#ffe4e6" opacity="0.75" />
      <circle cx="158" cy="82" r="2" fill="#ffe4e6" opacity="0.75" />
      <circle cx="132" cy="90" r="1.8" fill="#ffe4e6" opacity="0.7" />
      <circle cx="155" cy="105" r="2" fill="#ffe4e6" opacity="0.75" />
      <circle cx="220" cy="64" r="2" fill="#ffe4e6" opacity="0.75" />
      <circle cx="202" cy="82" r="2" fill="#ffe4e6" opacity="0.75" />
      <circle cx="228" cy="90" r="1.8" fill="#ffe4e6" opacity="0.7" />
      <circle cx="205" cy="105" r="2" fill="#ffe4e6" opacity="0.75" />
      <path
        d="M 145 58 Q 138 86 162 112"
        fill="none"
        stroke="#ffffff"
        strokeWidth="2.2"
        strokeLinecap="round"
        opacity="0.35"
      />

      {/* Etiqueta integrada en la lengua */}
      <rect x="115" y="68" width="130" height="22" rx="11" fill="rgba(76, 5, 25, 0.76)" stroke="#fecdd3" strokeWidth="1" />
      <text x="180" y="83" textAnchor="middle" fill="#fff1f2" fontSize="10.5" fontWeight="800" letterSpacing="0.08em">
        LENGUA · PISO BUCAL
      </text>
    </svg>
  )
}

/**
 * Ilustración interactiva de la DENTADURA DE FRENTE (Oclusión Frontal con encías, lengua de fondo y 32 dientes blanco hueso)
 */
function FrontalDentitionIllustration({
  chart,
  patientMarks,
  selected,
  onSelect,
}: {
  chart: OdontogramaPropio | null
  patientMarks: Record<number, PatientAffectionCode>
  selected: number
  onSelect: (numero: number) => void
}) {
  // Posiciones y anchos en perspectiva frontal (los molares posteriores se ven más angostos por la curvatura de la arcada)
  const widths = [26, 29, 33, 32, 34, 38, 40, 46, 46, 40, 38, 34, 32, 33, 29, 26]
  const totalWidth = widths.reduce((a, b) => a + b, 0)
  const startX = (760 - totalWidth) / 2

  function getToothAffection(numero: number) {
    return patientMarks[numero] || chart?.piezas.find(p => p.numero === numero)?.afeccion
  }

  let currentUpperX = startX
  const upperCoords = ARCADA_SUPERIOR.map((numero, idx) => {
    const w = widths[idx]
    const x = currentUpperX
    currentUpperX += w
    const dist = Math.abs(7.5 - idx)
    const archCurveY = -Math.round(dist * dist * 0.28)
    const unit = numero % 10
    const crownH = unit === 1 ? 56 : unit === 2 ? 51 : unit === 3 ? 58 : unit <= 5 ? 48 : 44
    return { numero, x, w, y: 82 + archCurveY, h: crownH }
  })

  let currentLowerX = startX
  const lowerCoords = ARCADA_INFERIOR.map((numero, idx) => {
    const w = widths[idx]
    const x = currentLowerX
    currentLowerX += w
    const dist = Math.abs(7.5 - idx)
    const archCurveY = Math.round(dist * dist * 0.25)
    const unit = numero % 10
    const crownH = unit <= 2 ? 48 : unit === 3 ? 54 : unit <= 5 ? 46 : 42
    return { numero, x, w, y: 144 + archCurveY, h: crownH }
  })

  return (
    <div className="rounded-2xl border border-rose-300/40 bg-gradient-to-b from-[#2b0916] via-[#1c0913] to-[#130c18] p-4 shadow-inner">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="text-xs font-extrabold uppercase tracking-wider text-rose-300">
            Ilustración Anatómica · Dentadura de Frente (Oclusión Frontal)
          </span>
          <p className="text-xs text-rose-100/90">
            Vista frontal de ambas arcadas en oclusión con encías, frenillos y lengua al fondo. Hacé clic en cualquier diente para seleccionarlo.
          </p>
        </div>
        <span className="rounded-full border border-rose-300/40 bg-rose-950/70 px-3 py-1 text-xs font-bold text-rose-100">
          Diente activo: #{selected}
        </span>
      </div>

      <svg viewBox="0 0 760 285" className="mx-auto w-full max-w-[780px] select-none overflow-visible">
        <defs>
          <linearGradient id="frontal-upper-gum" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#b83253" />
            <stop offset="45%" stopColor="#e25b78" />
            <stop offset="100%" stopColor="#f99bb0" />
          </linearGradient>
          <linearGradient id="frontal-lower-gum" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f99bb0" />
            <stop offset="55%" stopColor="#e25b78" />
            <stop offset="100%" stopColor="#b83253" />
          </linearGradient>
          <linearGradient id="frontal-bone-tooth" x1="0" y1="0" x2="0.8" y2="1">
            <stop offset="0%" stopColor="#FFFDF9" />
            <stop offset="50%" stopColor="#FAF1DE" />
            <stop offset="85%" stopColor="#E9DAC0" />
            <stop offset="100%" stopColor="#D1BA95" />
          </linearGradient>
        </defs>

        {/* Cavidad bucal oscura y lengua visible detrás de la oclusión */}
        <rect x="65" y="25" width="630" height="235" rx="110" fill="#2d0612" stroke="#881337" strokeWidth="3" />
        <ellipse cx="380" cy="155" rx="195" ry="52" fill="#e11d48" opacity="0.85" />
        <ellipse cx="380" cy="162" rx="150" ry="36" fill="#fb7185" opacity="0.75" />
        <path d="M 380 122 L 380 185" stroke="#881337" strokeWidth="2.5" opacity="0.7" />

        {/* Encía Superior (Maxilar) */}
        <path
          d="M 68 96 Q 380 8 692 96 L 680 102 Q 380 78 80 102 Z"
          fill="url(#frontal-upper-gum)"
          stroke="#fda4af"
          strokeWidth="1.5"
        />
        {/* Frenillo labial superior */}
        <path d="M 380 22 L 380 76" stroke="#fecdd3" strokeWidth="3.5" strokeLinecap="round" />

        {/* Encía Inferior (Mandibular) */}
        <path
          d="M 80 184 Q 380 205 680 184 L 692 195 Q 380 278 68 195 Z"
          fill="url(#frontal-lower-gum)"
          stroke="#fda4af"
          strokeWidth="1.5"
        />
        {/* Frenillo labial inferior */}
        <path d="M 380 202 L 380 256" stroke="#fecdd3" strokeWidth="3.2" strokeLinecap="round" />

        {/* Dientes Superiores en Vista Frontal */}
        {upperCoords.map(({ numero, x, w, y, h }) => {
          const aff = getToothAffection(numero)
          const affColor = aff ? colorPieza(aff) : undefined
          const isSel = selected === numero
          const isMissing = aff?.toLowerCase() === 'ausente'
          const unit = numero % 10
          // Forma de corona frontal según tipo de diente
          const path =
            unit === 3
              ? `M ${x + 2} ${y} L ${x + w - 2} ${y} L ${x + w - 1} ${y + h - 14} L ${x + w / 2} ${y + h + 4} L ${x + 1} ${y + h - 14} Z`
              : `M ${x + 2} ${y} L ${x + w - 2} ${y} C ${x + w} ${y + h * 0.6}, ${x + w - 2} ${y + h}, ${x + w - 6} ${y + h} L ${x + 6} ${y + h} C ${x + 2} ${y + h}, ${x} ${y + h * 0.6}, ${x + 2} ${y} Z`

          return (
            <g
              key={numero}
              onClick={() => onSelect(numero)}
              className="cursor-pointer transition-opacity hover:opacity-95"
              style={{ opacity: isMissing ? 0.3 : 1 }}
            >
              {/* Festón gingival */}
              <path
                d={`M ${x + 1} ${y + 3} Q ${x + w / 2} ${y - 8} ${x + w - 1} ${y + 3}`}
                fill="none"
                stroke="#f43f5e"
                strokeWidth="3.5"
                strokeLinecap="round"
              />
              <path
                d={path}
                fill="url(#frontal-bone-tooth)"
                stroke={isSel ? '#38bdf8' : affColor || '#b59c73'}
                strokeWidth={isSel ? 3 : affColor ? 2.5 : 1.3}
              />
              {affColor && !isMissing && <path d={path} fill={affColor} fillOpacity="0.52" />}
              {/* Brillo vertical del esmalte */}
              <line
                x1={x + w * 0.32}
                y1={y + 8}
                x2={x + w * 0.32}
                y2={y + h - 8}
                stroke="#ffffff"
                strokeWidth="2"
                strokeLinecap="round"
                opacity="0.75"
              />
              <text
                x={x + w / 2}
                y={y + h * 0.58}
                textAnchor="middle"
                fill={affColor ? '#ffffff' : '#1e293b'}
                fontSize="10"
                fontWeight="800"
              >
                {numero}
              </text>
            </g>
          )
        })}

        {/* Dientes Inferiores en Vista Frontal */}
        {lowerCoords.map(({ numero, x, w, y, h }) => {
          const aff = getToothAffection(numero)
          const affColor = aff ? colorPieza(aff) : undefined
          const isSel = selected === numero
          const isMissing = aff?.toLowerCase() === 'ausente'
          const unit = numero % 10
          const path =
            unit === 3
              ? `M ${x + 1} ${y + 12} L ${x + w / 2} ${y - 3} L ${x + w - 1} ${y + 12} L ${x + w - 2} ${y + h} L ${x + 2} ${y + h} Z`
              : `M ${x + 5} ${y} L ${x + w - 5} ${y} C ${x + w - 1} ${y}, ${x + w} ${y + h * 0.4}, ${x + w - 2} ${y + h} L ${x + 2} ${y + h} C ${x} ${y + h * 0.4}, ${x + 1} ${y}, ${x + 5} ${y} Z`

          return (
            <g
              key={numero}
              onClick={() => onSelect(numero)}
              className="cursor-pointer transition-opacity hover:opacity-95"
              style={{ opacity: isMissing ? 0.3 : 1 }}
            >
              <path
                d={path}
                fill="url(#frontal-bone-tooth)"
                stroke={isSel ? '#38bdf8' : affColor || '#b59c73'}
                strokeWidth={isSel ? 3 : affColor ? 2.5 : 1.3}
              />
              {affColor && !isMissing && <path d={path} fill={affColor} fillOpacity="0.52" />}
              <path
                d={`M ${x + 1} ${y + h - 2} Q ${x + w / 2} ${y + h + 7} ${x + w - 1} ${y + h - 2}`}
                fill="none"
                stroke="#f43f5e"
                strokeWidth="3.2"
                strokeLinecap="round"
              />
              <text
                x={x + w / 2}
                y={y + h * 0.62}
                textAnchor="middle"
                fill={affColor ? '#ffffff' : '#1e293b'}
                fontSize="9.5"
                fontWeight="800"
              >
                {numero}
              </text>
            </g>
          )
        })}

        {/* Indicadores de orientación */}
        <text x="85" y="25" fill="#fda4af" fontSize="11" fontWeight="800">
          LADO DERECHO (18–11 / 48–41)
        </text>
        <text x="380" y="18" textAnchor="middle" fill="#ffe4e6" fontSize="11" fontWeight="800">
          ENCÍA SUPERIOR · FRENILLO LABIAL
        </text>
        <text x="675" y="25" textAnchor="end" fill="#fda4af" fontSize="11" fontWeight="800">
          LADO IZQUIERDO (21–28 / 31–38)
        </text>
        <text x="380" y="275" textAnchor="middle" fill="#ffe4e6" fontSize="11" fontWeight="800">
          ENCÍA INFERIOR · MANDÍBULA
        </text>
      </svg>
    </div>
  )
}

/**
 * Ilustración interactiva de la VISTA LATERAL (Perfil Derecho: Cuadrantes 1 y 4 / Perfil Izquierdo: Cuadrantes 2 y 3)
 */
function LateralDentitionIllustration({
  chart,
  patientMarks,
  selected,
  onSelect,
}: {
  chart: OdontogramaPropio | null
  patientMarks: Record<number, PatientAffectionCode>
  selected: number
  onSelect: (numero: number) => void
}) {
  const rightUpper = [18, 17, 16, 15, 14, 13, 12, 11]
  const rightLower = [48, 47, 46, 45, 44, 43, 42, 41]
  const leftUpper = [21, 22, 23, 24, 25, 26, 27, 28]
  const leftLower = [31, 32, 33, 34, 35, 36, 37, 38]

  function getToothAffection(numero: number) {
    return patientMarks[numero] || chart?.piezas.find(p => p.numero === numero)?.afeccion
  }

  function renderProfileSide(
    title: string,
    subtitle: string,
    upperTeeth: number[],
    lowerTeeth: number[],
    facingRight: boolean
  ) {
    return (
      <div className="rounded-xl border border-rose-300/35 bg-[#220915] p-3.5">
        <div className="mb-2 flex items-center justify-between">
          <div>
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-rose-200">{title}</h4>
            <p className="text-[11px] text-rose-100/80">{subtitle}</p>
          </div>
          <span className="rounded-full bg-rose-950/80 px-2.5 py-0.5 text-[10px] font-bold text-rose-200">
            {facingRight ? 'Posterior → Anterior' : 'Anterior ← Posterior'}
          </span>
        </div>

        <svg viewBox="0 0 380 215" className="w-full select-none">
          {/* Lengua y bóveda palatina en corte sagital lateral */}
          <path
            d="M 20 55 Q 190 42 360 65 L 360 155 Q 190 172 20 155 Z"
            fill="#3b0718"
            stroke="#881337"
            strokeWidth="1.5"
          />
          <ellipse cx="190" cy="128" rx="135" ry="26" fill="#e11d48" opacity="0.65" />
          <text x="190" y="132" textAnchor="middle" fill="#ffe4e6" fontSize="9.5" fontWeight="800" opacity="0.9">
            LENGUA (VISTA LATERAL)
          </text>

          {/* Banda gingival superior */}
          <path d="M 18 22 Q 190 14 362 28 L 362 66 Q 190 56 18 66 Z" fill="#e25b78" opacity="0.88" />
          {/* Banda gingival inferior */}
          <path d="M 18 148 Q 190 158 362 148 L 362 192 Q 190 200 18 192 Z" fill="#e25b78" opacity="0.88" />

          {/* Hilera superior en perfil */}
          {upperTeeth.map((numero, idx) => {
            const unit = numero % 10
            const w = unit >= 6 ? 44 : unit >= 4 ? 36 : 32
            const x = 18 + idx * 42
            const aff = getToothAffection(numero)
            const affColor = aff ? colorPieza(aff) : undefined
            const isSel = selected === numero
            return (
              <g key={numero} onClick={() => onSelect(numero)} className="cursor-pointer">
                {/* Raíz en perfil dentro de la encía */}
                <path
                  d={`M ${x + 8} 54 L ${x + w / 2} 18 L ${x + w - 8} 54 Z`}
                  fill="#dfc89e"
                  opacity="0.55"
                />
                {/* Corona en perfil */}
                <rect
                  x={x + 2}
                  y={52}
                  width={w - 4}
                  height={44}
                  rx={8}
                  fill="#FAF2E1"
                  stroke={isSel ? '#38bdf8' : affColor || '#bda67e'}
                  strokeWidth={isSel ? 3 : affColor ? 2.4 : 1.3}
                />
                {affColor && (
                  <rect x={x + 2} y={52} width={w - 4} height={44} rx={8} fill={affColor} fillOpacity="0.55" />
                )}
                <text
                  x={x + w / 2}
                  y={78}
                  textAnchor="middle"
                  fill={affColor ? '#ffffff' : '#1e293b'}
                  fontSize="10"
                  fontWeight="800"
                >
                  {numero}
                </text>
              </g>
            )
          })}

          {/* Hilera inferior en perfil */}
          {lowerTeeth.map((numero, idx) => {
            const unit = numero % 10
            const w = unit >= 6 ? 44 : unit >= 4 ? 36 : 32
            const x = 18 + idx * 42
            const aff = getToothAffection(numero)
            const affColor = aff ? colorPieza(aff) : undefined
            const isSel = selected === numero
            return (
              <g key={numero} onClick={() => onSelect(numero)} className="cursor-pointer">
                <path
                  d={`M ${x + 8} 156 L ${x + w / 2} 195 L ${x + w - 8} 156 Z`}
                  fill="#dfc89e"
                  opacity="0.55"
                />
                <rect
                  x={x + 2}
                  y={114}
                  width={w - 4}
                  height={44}
                  rx={8}
                  fill="#FAF2E1"
                  stroke={isSel ? '#38bdf8' : affColor || '#bda67e'}
                  strokeWidth={isSel ? 3 : affColor ? 2.4 : 1.3}
                />
                {affColor && (
                  <rect x={x + 2} y={114} width={w - 4} height={44} rx={8} fill={affColor} fillOpacity="0.55" />
                )}
                <text
                  x={x + w / 2}
                  y={140}
                  textAnchor="middle"
                  fill={affColor ? '#ffffff' : '#1e293b'}
                  fontSize="10"
                  fontWeight="800"
                >
                  {numero}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
    )
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {renderProfileSide(
        'Perfil Lateral Derecho (Cuadrantes 1 y 4)',
        'Oclusión lateral de molares, premolares e incisivos derechos (18–11 / 48–41)',
        rightUpper,
        rightLower,
        true
      )}
      {renderProfileSide(
        'Perfil Lateral Izquierdo (Cuadrantes 2 y 3)',
        'Oclusión lateral de incisivos, premolares y molares izquierdos (21–28 / 31–38)',
        leftUpper,
        leftLower,
        false
      )}
    </div>
  )
}

function ToothButton({
  numero,
  record,
  patientMark,
  selected,
  labelMode,
  viewMode,
  position,
  isAiFlagged,
  onSelect,
}: {
  numero: number
  record?: PiezaRegistrada
  patientMark?: PatientAffectionCode
  selected: boolean
  labelMode: LabelMode
  viewMode: ViewMode
  position: number
  isAiFlagged?: boolean
  onSelect: () => void
}) {
  const effectiveAffection = patientMark || record?.afeccion
  const color = colorPieza(effectiveAffection)
  const name = nombrePieza(numero)
  const location = QUADRANTS[Math.floor(numero / 10)] || 'ubicación no disponible'
  const isUpper = numero < 30
  // Curvatura parabólica pronunciada en herradura para que parezca una boca abierta real
  const curveDist = Math.abs(7.5 - position)
  const archOffset = Math.round(curveDist * curveDist * 1.15)
  const signedOffset = isUpper ? archOffset : -archOffset
  const rotationDeg = Math.round((position - 7.5) * (isUpper ? 2.2 : -2.2))

  const toothStyle: CSSProperties | undefined =
    viewMode === '3d'
      ? {
          transform: `translateY(${signedOffset}px) rotateZ(${rotationDeg}deg) translateZ(${Math.round(20 - curveDist * 1.4)}px)`,
          borderColor: effectiveAffection ? color : undefined,
        }
      : effectiveAffection
        ? { borderColor: color, boxShadow: `0 0 0 2px ${color}` }
        : undefined

  return (
    <button
      type="button"
      title={'Diente ' + numero + ' · ' + name}
      aria-label={'Diente ' + numero + ': ' + name + (record ? ' · ' + record.afeccion : ' · sin registro') + (isAiFlagged ? ' · Hallazgo IA Dr. Annie' : '')}
      aria-pressed={selected}
      onClick={onSelect}
      style={toothStyle}
      className={
        'patient-tooth-button ' +
        (viewMode === '3d' ? 'patient-tooth-3d ' : '') +
        (labelMode === 'anatomical' ? 'patient-tooth-named ' : '') +
        (selected ? 'is-selected ' : '') +
        (isAiFlagged ? 'is-ai-flagged ' : '')
      }
    >
      <AnatomicalToothSvg numero={numero} activeAffection={effectiveAffection} selected={selected} />
      <span className="patient-tooth-label">
        {labelMode === 'fdi' ? numero : TOOTH_TYPES[numero % 10]}
        {isAiFlagged ? ' ✨' : ''}
      </span>
      {labelMode === 'anatomical' && <span className="patient-tooth-location">{titleCase(location)}</span>}
      {patientMark && (
        <span
          className="mt-0.5 inline-block h-2.5 w-2.5 rounded-full border border-white"
          style={{ backgroundColor: color }}
          aria-hidden="true"
        />
      )}
    </button>
  )
}

export function MiOdontograma({ token }: { token: string }) {
  const [result, setResult] = useState<{ token: string; attempt: number; chart?: OdontogramaPropio; error?: string } | null>(null)
  const [selected, setSelected] = useState(11)
  const [attempt, setAttempt] = useState(0)
  const [labelMode, setLabelMode] = useState<LabelMode>('fdi')
  const [viewMode, setViewMode] = useState<ViewMode>('3d')
  const [mouthPerspective, setMouthPerspective] = useState<MouthPerspective>('completa')
  const [rotation, setRotation] = useState(0)
  const [patientMarks, setPatientMarks] = useState<Record<number, PatientAffectionCode>>({})
  const [sendingReport, setSendingReport] = useState(false)
  const [reportFeedback, setReportFeedback] = useState<string>('')
  const [drAnnieData, setDrAnnieData] = useState<{
    estudioId: number
    diagnosticoSugerido: string
    findings: Array<{ piezaFdi: number; patologiaNombre: string; afeccionOdontograma: string }>
  } | null>(null)

  useEffect(() => {
    try {
      const raw = localStorage.getItem('novadent_dr_annie_findings')
      if (raw) {
        setDrAnnieData(JSON.parse(raw))
      }
    } catch {
      // ignore
    }
  }, [])

  // Never render cached clinical data for a different authenticated session.
  const current = result?.token === token && result.attempt === attempt ? result : null
  const chart = current?.chart ?? null
  const error = current?.error ?? ''
  const loading = current === null
  const selectedRecord = chart?.piezas.find(pieza => pieza.numero === selected)
  const selectedPatientMark = patientMarks[selected]
  const selectedPatientAffection = PATIENT_AFFECTIONS.find(item => item.code === selectedPatientMark)

  useEffect(() => {
    const controller = new AbortController()
    apiRequest<OdontogramaPropio>('/portal-paciente/odontograma', { token, signal: controller.signal })
      .then(data => {
        if (!controller.signal.aborted) setResult({ token, attempt, chart: data })
      })
      .catch(failure => {
        if (!controller.signal.aborted) {
          setResult({
            token,
            attempt,
            error: failure instanceof Error ? failure.message : 'No se pudo cargar el odontograma.',
          })
        }
      })
    return () => controller.abort()
  }, [token, attempt])

  const upperStyle: CSSProperties = { transform: 'perspective(980px) rotateX(16deg) rotateY(' + rotation + 'deg)' }
  const lowerStyle: CSSProperties = { transform: 'perspective(980px) rotateX(-14deg) rotateY(' + rotation + 'deg)' }

  function togglePatientMark(code: PatientAffectionCode) {
    setReportFeedback('')
    setPatientMarks(prev => {
      const next = { ...prev }
      if (next[selected] === code) {
        delete next[selected]
      } else {
        next[selected] = code
      }
      return next
    })
  }

  function clearPatientMark() {
    setReportFeedback('')
    setPatientMarks(prev => {
      const next = { ...prev }
      delete next[selected]
      return next
    })
  }

  async function reportMarkedToothToDentist() {
    if (!selectedPatientAffection || sendingReport) return
    setSendingReport(true)
    setReportFeedback('')
    try {
      await apiRequest('/portal-paciente/reportes', {
        method: 'POST',
        token,
        body: {
          pieza: selected,
          dolor: selectedPatientAffection.defaultPain,
          sintomas: `${selectedPatientAffection.label}: ${selectedPatientAffection.description}`,
          consentimientoFoto: false,
        },
      })
      setReportFeedback(
        `Observación sobre el diente ${selected} (${selectedPatientAffection.label}) enviada al odontólogo.`
      )
    } catch (failure) {
      setReportFeedback(
        failure instanceof Error ? failure.message : 'No se pudo enviar la observación al odontólogo.'
      )
    } finally {
      setSendingReport(false)
    }
  }

  function renderArch(label: string, teeth: number[], arch: 'upper' | 'lower') {
    const isUpper = arch === 'upper'
    const quadrants = isUpper
      ? [
          { number: 1, teeth: teeth.slice(0, 8) },
          { number: 2, teeth: teeth.slice(8) },
        ]
      : [
          { number: 4, teeth: teeth.slice(0, 8) },
          { number: 3, teeth: teeth.slice(8) },
        ]
    return (
      <section
        key={arch}
        role="group"
        aria-label={'Arcada ' + label}
        className={'patient-arch-panel ' + (arch === 'lower' ? 'is-lower' : 'is-upper')}
      >
        <div className="patient-arch-heading">
          <h3>
            Arcada {label} · {isUpper ? 'Maxilar Superior (Encía y Paladar)' : 'Mandíbula Inferior (Encía y Lengua)'}
          </h3>
          <span className="rounded-full bg-rose-950/60 px-3 py-0.5 text-[11px] font-bold text-rose-100">
            {isUpper ? 'Cuadrantes 1 (Derecho) y 2 (Izquierdo)' : 'Cuadrantes 4 (Derecho) y 3 (Izquierdo)'}
          </span>
        </div>

        {/* En la Arcada Inferior, la Lengua Ilustrada se sitúa en el centro de la herradura (entre los dientes inferiores) */}
        {!isUpper && viewMode === '3d' && (
          <div className="my-2 flex flex-col items-center" data-testid="anatomical-tongue-indicator">
            <IllustratedTongueSvg />
            <p className="mt-1 text-center text-xs font-bold text-rose-100">
              Lengua · Referencia de Arcada Inferior (Piso de la boca rodeado por los Cuadrantes 4 y 3)
            </p>
          </div>
        )}

        <div
          className={'patient-arch-row ' + (viewMode === '3d' ? 'patient-arch-3d ' + (isUpper ? 'is-upper' : 'is-lower') : '')}
          style={viewMode === '3d' ? (isUpper ? upperStyle : lowerStyle) : undefined}
        >
          {quadrants.map((quadrant, quadrantIndex) => (
            <div
              key={quadrant.number}
              role={labelMode === 'anatomical' ? 'group' : undefined}
              aria-label={
                labelMode === 'anatomical'
                  ? 'Cuadrante ' + quadrant.number + ' · ' + titleCase(QUADRANTS[quadrant.number])
                  : undefined
              }
              className={'patient-quadrant-panel ' + (viewMode === '3d' ? 'patient-quadrant-3d' : '')}
            >
              <div className="patient-quadrant-header-bar">
                <h4 className="patient-quadrant-heading">
                  Cuadrante {quadrant.number} · {titleCase(QUADRANTS[quadrant.number])}
                </h4>
                <span className="patient-quadrant-range">Piezas {QUADRANT_RANGES[quadrant.number]}</span>
              </div>
              <div className="patient-quadrant-teeth">
                {quadrant.teeth.map((numero, position) => (
                  <ToothButton
                    key={numero}
                    numero={numero}
                    record={chart?.piezas.find(pieza => pieza.numero === numero)}
                    patientMark={patientMarks[numero]}
                    selected={selected === numero}
                    labelMode={labelMode}
                    viewMode={viewMode}
                    position={position + quadrantIndex * 8}
                    isAiFlagged={Boolean(drAnnieData?.findings?.some(f => f.piezaFdi === numero))}
                    onSelect={() => setSelected(numero)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* En la Arcada Superior, el Paladar Ilustrado se ubica dentro de la curva de los dientes superiores */}
        {isUpper && viewMode === '3d' && (
          <div className="my-2 flex flex-col items-center">
            <IllustratedPalateSvg />
            <p className="mt-1 text-center text-xs font-bold text-rose-100">
              Paladar Superior · Bóveda del maxilar rodeada por los dientes superiores (Cuadrantes 1 y 2)
            </p>
          </div>
        )}

        {/* En Vista 2D mantenemos el indicador anatómico de lengua para la arcada inferior */}
        {!isUpper && viewMode === '2d' && (
          <div className="oral-anatomy-banner oral-tongue-box mt-3" data-testid="anatomical-tongue-indicator">
            <div className="text-xs font-bold">
              Lengua · Referencia de Arcada Inferior (Cuadrantes 4 y 3)
            </div>
          </div>
        )}
      </section>
    )
  }

  return (
    <section className="patient-chart-card rounded-2xl border border-slate-300 bg-white/90 p-5 shadow-lg shadow-blue-950/5 backdrop-blur-xl sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-slate-950">Mi odontograma</h2>
          <p className="mt-1 max-w-3xl text-sm font-medium text-slate-700">
            Explorá tu boca en vistas anatómicas ilustradas (boca abierta con paladar y lengua al centro, dentadura de frente, perfil lateral y plano 2D de 4 cuadrantes) con dientes en blanco hueso natural y marcado por colores.
          </p>
        </div>
        <span className="rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-900">
          Solo lectura
        </span>
      </div>

      {loading ? (
        <p role="status" className="mt-5 rounded-xl bg-blue-50 p-4 text-sm font-medium text-slate-800">
          Cargando tu odontograma…
        </p>
      ) : error ? (
        <div role="alert" className="mt-5 rounded-xl border border-red-300 bg-red-50 p-4 text-sm font-semibold text-red-900">
          <p>No se pudo cargar tu odontograma: {error}</p>
          <button
            type="button"
            className="mt-3 rounded-lg border border-red-400 bg-white px-3 py-2 font-bold text-red-900"
            onClick={() => setAttempt(value => value + 1)}
          >
            Reintentar
          </button>
        </div>
      ) : (
        chart && (
          <>
            {chart.registradoEn === null && chart.piezas.length === 0 && (
              <p className="mt-5 rounded-xl bg-blue-50/90 p-4 text-sm font-medium text-slate-800">
                Todavía no hay un odontograma profesional registrado para tu ficha.
              </p>
            )}

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2" role="group" aria-label="Opciones de visualización del odontograma">
                <button
                  type="button"
                  aria-label={labelMode === 'fdi' ? 'Mostrar nombres anatómicos' : 'Mostrar números FDI'}
                  aria-pressed={labelMode === 'anatomical'}
                  onClick={() => setLabelMode(value => (value === 'fdi' ? 'anatomical' : 'fdi'))}
                  className="patient-chart-control"
                >
                  {labelMode === 'fdi' ? 'Mostrar nombres' : 'Mostrar números FDI'}
                </button>
                <button
                  type="button"
                  aria-label={viewMode === '2d' ? 'Activar vista 3D interactiva' : 'Volver a vista 2D'}
                  aria-pressed={viewMode === '3d'}
                  onClick={() => setViewMode(value => (value === '2d' ? '3d' : '2d'))}
                  className="patient-chart-control"
                >
                  {viewMode === '2d' ? 'Vista 3D interactiva' : 'Vista 2D'}
                </button>
              </div>

              {viewMode === '3d' && (
                <div className="flex flex-wrap gap-1.5" role="group" aria-label="Perspectiva anatómica de la boca">
                  {[
                    { id: 'completa' as const, label: 'Vista completa (Boca + Frente + Lateral)' },
                    { id: 'boca' as const, label: 'Boca abierta (Lengua y Paladar)' },
                    { id: 'frente' as const, label: 'Dentadura de frente' },
                    { id: 'lateral' as const, label: 'Vista lateral' },
                  ].map(tab => (
                    <button
                      key={tab.id}
                      type="button"
                      aria-pressed={mouthPerspective === tab.id}
                      onClick={() => setMouthPerspective(tab.id)}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition ${
                        mouthPerspective === tab.id
                          ? 'border-rose-500 bg-rose-600 text-white shadow-xs'
                          : 'border-slate-300 bg-white text-slate-800 hover:bg-rose-50'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {viewMode === '3d' && (
              <div className="patient-rotation-control">
                <label htmlFor="dental-arch-rotation">Rotar arcada dental</label>
                <input
                  id="dental-arch-rotation"
                  aria-label="Rotar arcada dental"
                  type="range"
                  min="-24"
                  max="24"
                  value={rotation}
                  onChange={event => setRotation(Number(event.target.value))}
                />
              </div>
            )}

            {drAnnieData?.findings?.length ? (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2.5 rounded-xl border border-emerald-300 bg-emerald-50/90 p-3 text-xs text-emerald-950">
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-emerald-800">✨ Dr. Annie (IA):</span>
                  <span>
                    Hallazgos radiográficos en piezas:{' '}
                    <strong>{drAnnieData.findings.map(f => f.piezaFdi).join(', ')}</strong>
                  </span>
                </div>
                <span className="rounded-full bg-emerald-200/80 px-2.5 py-0.5 text-[11px] font-bold text-emerald-900">
                  Sincronizado con tu ficha
                </span>
              </div>
            ) : null}

            <div className={'mt-5 patient-chart-scene space-y-5 ' + (viewMode === '3d' ? 'is-3d' : 'is-2d')}>
              {viewMode === '3d' && (
                <p className="patient-3d-note">
                  Vista de perspectiva 3D anatómica e ilustrativa con boca abierta (paladar superior y lengua al centro), dentadura de frente y vista lateral en color blanco hueso. No es un modelo anatómico validado para diagnóstico.
                </p>
              )}

              {/* Ilustración de Dentadura de Frente (Oclusión Frontal) */}
              {viewMode === '3d' && (mouthPerspective === 'completa' || mouthPerspective === 'frente') && (
                <FrontalDentitionIllustration
                  chart={chart}
                  patientMarks={patientMarks}
                  selected={selected}
                  onSelect={setSelected}
                />
              )}

              {/* Ilustración de Vista Lateral (Perfil Derecho e Izquierdo) */}
              {viewMode === '3d' && (mouthPerspective === 'completa' || mouthPerspective === 'lateral') && (
                <LateralDentitionIllustration
                  chart={chart}
                  patientMarks={patientMarks}
                  selected={selected}
                  onSelect={setSelected}
                />
              )}

              {/* Arcadas en Herradura (Boca Abierta con Paladar y Lengua en 3D / Plano de 4 Cuadrantes en 2D) */}
              <div className="patient-mouth-horseshoe-wrapper">
                {renderArch('superior', ARCADA_SUPERIOR, 'upper')}

                <div className="patient-cruciform-divider" aria-hidden="true">
                  <span>← Lado Derecho (Cuadrantes 1 y 4)</span>
                  <span>➕ Plano Oclusal · Línea Media Sagital</span>
                  <span>Lado Izquierdo (Cuadrantes 2 y 3) →</span>
                </div>

                {renderArch('inferior', ARCADA_INFERIOR, 'lower')}
              </div>
            </div>

            {/* Leyenda cromática de esmalte blanco hueso y afecciones */}
            <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-slate-300 bg-white/95 px-4 py-3 text-xs font-medium text-slate-800">
              <span className="font-extrabold text-slate-950">Colores del odontograma:</span>
              <span className="inline-flex items-center gap-1.5 font-semibold">
                <i
                  className="inline-block h-3.5 w-3.5 rounded-full border border-amber-800/50"
                  style={{ backgroundColor: '#FAF2E1' }}
                />
                Blanco hueso (Esmalte natural)
              </span>
              {PATIENT_AFFECTIONS.map(aff => (
                <span key={aff.code} className="inline-flex items-center gap-1.5 font-semibold">
                  <i className="inline-block h-3.5 w-3.5 rounded-full" style={{ backgroundColor: aff.color }} />
                  {aff.label}
                </span>
              ))}
            </div>

            <aside
              aria-live="polite"
              className="patient-selected-tooth mt-4 space-y-4 rounded-2xl border border-blue-200 bg-blue-50/90 p-5"
            >
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-blue-800">Pieza seleccionada</p>
                <h3 className="mt-1 text-xl font-extrabold text-slate-950">
                  <span>Diente {selected}</span>
                  <span className="mx-2 text-blue-500">·</span>
                  <span>{nombrePieza(selected)}</span>
                </h3>
                {selectedRecord ? (
                  <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="font-bold text-slate-700">Afección registrada</dt>
                      <dd className="mt-1 font-extrabold text-slate-950">{selectedRecord.afeccion}</dd>
                    </div>
                    <div>
                      <dt className="font-bold text-slate-700">Tratamiento registrado</dt>
                      <dd className="mt-1 font-semibold text-slate-900">
                        {selectedRecord.tratamiento || 'No registrado.'}
                      </dd>
                    </div>
                  </dl>
                ) : (
                  <p className="mt-3 text-sm font-medium text-slate-800">
                    Sin registro profesional para esta pieza.
                  </p>
                )}
              </div>

              {/* Selector interactivo para que el paciente identifique afecciones o traumatismos por golpe con color */}
              <div className="border-t border-blue-300/80 pt-4">
                <p className="text-xs font-extrabold uppercase tracking-wide text-blue-900">
                  Señalar qué sentís o ves en esta pieza (Simulador visual para el paciente)
                </p>
                <p className="mt-1 text-xs font-medium text-slate-700">
                  Elegí una opción para identificar la pieza con su color correspondiente en todas las vistas de la boca (por ejemplo, rojo intenso en caso de golpe o traumatismo).
                </p>

                <div
                  className="mt-3 flex flex-wrap gap-2"
                  role="group"
                  aria-label="Marcar afección percibida por el paciente"
                >
                  {PATIENT_AFFECTIONS.map(aff => {
                    const isMarked = selectedPatientMark === aff.code
                    return (
                      <button
                        key={aff.code}
                        type="button"
                        aria-pressed={isMarked}
                        onClick={() => togglePatientMark(aff.code)}
                        className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold transition ${
                          isMarked
                            ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                            : 'border-slate-300 bg-white text-slate-900 hover:border-blue-600'
                        }`}
                      >
                        <span
                          className="inline-block h-3.5 w-3.5 rounded-full border border-white/60"
                          style={{ backgroundColor: aff.color }}
                        />
                        {aff.label}
                      </button>
                    )
                  })}
                  {selectedPatientMark && (
                    <button
                      type="button"
                      onClick={clearPatientMark}
                      className="inline-flex items-center rounded-xl border border-slate-400 bg-white px-3 py-2 text-xs font-bold text-slate-800 hover:bg-slate-100"
                    >
                      Restaurar blanco hueso
                    </button>
                  )}
                </div>

                {selectedPatientAffection && (
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-300 bg-white p-3.5 text-xs">
                    <div>
                      <span
                        className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-extrabold"
                        style={{
                          backgroundColor: selectedPatientAffection.badgeBg,
                          color: selectedPatientAffection.color,
                        }}
                      >
                        Marca del paciente: {selectedPatientAffection.label}
                      </span>
                      <p className="mt-1 font-medium text-slate-800">{selectedPatientAffection.description}</p>
                    </div>
                    <button
                      type="button"
                      disabled={sendingReport}
                      onClick={() => void reportMarkedToothToDentist()}
                      className="rounded-xl bg-blue-700 px-4 py-2 text-xs font-bold text-white hover:bg-blue-800 disabled:opacity-50"
                    >
                      {sendingReport ? 'Enviando…' : 'Informar esta pieza al odontólogo'}
                    </button>
                  </div>
                )}

                {reportFeedback && (
                  <p className="mt-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-950">
                    {reportFeedback}
                  </p>
                )}
              </div>
            </aside>
          </>
        )
      )}
    </section>
  )
}
