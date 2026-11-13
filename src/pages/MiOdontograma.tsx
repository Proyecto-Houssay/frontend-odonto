import { useEffect, useState, type CSSProperties } from 'react'
import { apiRequest } from '../lib/api'

type PiezaRegistrada = { numero: number; afeccion: string; tratamiento: string | null }
type OdontogramaPropio = { registradoEn: string | null; piezas: PiezaRegistrada[] }
type LabelMode = 'fdi' | 'anatomical'
type ViewMode = '2d' | '3d'

const ARCADA_SUPERIOR = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28]
const ARCADA_INFERIOR = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38]
const TOOTH_TYPES: Record<number, string> = {
  1: 'Incisivo central', 2: 'Incisivo lateral', 3: 'Canino', 4: 'Primer premolar',
  5: 'Segundo premolar', 6: 'Primer molar', 7: 'Segundo molar', 8: 'Tercer molar',
}
const QUADRANTS: Record<number, string> = {
  1: 'superior derecho', 2: 'superior izquierdo', 3: 'inferior izquierdo', 4: 'inferior derecho',
}
const COLORES: Record<string, string> = {
  caries: '#ef4444', fractura: '#f97316', gingivitis: '#eab308', ausente: '#6b7280', sano: '#22c55e',
}

function nombrePieza(numero: number) {
  return (TOOTH_TYPES[numero % 10] || 'Pieza dental') + ' ' + (QUADRANTS[Math.floor(numero / 10)] || '')
}

function titleCase(value: string) {
  return value.charAt(0).toLocaleUpperCase('es-AR') + value.slice(1)
}

function colorPieza(afeccion: string | undefined) {
  if (!afeccion) return '#94a3b8'
  return COLORES[afeccion.toLocaleLowerCase('es-AR').trim()] || '#2563eb'
}

function ToothButton({ numero, record, selected, labelMode, viewMode, position, onSelect }: {
  numero: number; record?: PiezaRegistrada; selected: boolean; labelMode: LabelMode
  viewMode: ViewMode; position: number; onSelect: () => void
}) {
  const color = colorPieza(record?.afeccion)
  const name = nombrePieza(numero)
  const location = QUADRANTS[Math.floor(numero / 10)] || 'ubicación no disponible'
  const archOffset = Math.round(Math.abs(7.5 - position) * 1.5)
  const toothStyle: CSSProperties | undefined = viewMode === '3d'
    ? { transform: 'translateY(' + archOffset + 'px) translateZ(12px) rotateX(-7deg)' }
    : undefined

  return <button type="button" title={'Diente ' + numero + ' · ' + name}
    aria-label={'Diente ' + numero + ': ' + name + (record ? ' · ' + record.afeccion : ' · sin registro')}
    aria-pressed={selected} onClick={onSelect} style={toothStyle}
    className={'patient-tooth-button ' + (viewMode === '3d' ? 'patient-tooth-3d ' : '')
      + (labelMode === 'anatomical' ? 'patient-tooth-named ' : '') + (selected ? 'is-selected' : '')}>
    <svg viewBox="0 0 44 56" aria-hidden="true" className="patient-tooth-icon">
      <defs><linearGradient id={'enamel-' + numero} x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#ffffff" /><stop offset="60%" stopColor="#f1f7ff" /><stop offset="100%" stopColor="#b8cee6" /></linearGradient></defs>
      <path d="M9 5 C4 7 4 17 7 25 L12 47 Q15 56 19 38 Q22 30 25 38 Q30 56 32 47 L38 25 C42 12 36 2 29 5 Q22 8 16 5 Z"
        fill={record ? color : 'url(#enamel-' + numero + ')'} fillOpacity={record ? 0.55 : 1}
        stroke={selected ? '#1d4ed8' : color} strokeWidth={selected ? 3 : 2} />
      <path d="M12 13 Q22 19 33 13 M18 18 Q22 22 26 18" fill="none" stroke={selected ? '#1d4ed8' : '#8298b2'} strokeWidth="1.5" />
      <path d="M10 26 L15 43 M34 26 L29 43" fill="none" stroke="#ffffff" strokeWidth="1.1" opacity=".8" />
    </svg>
    <span className="patient-tooth-label">{labelMode === 'fdi' ? numero : TOOTH_TYPES[numero % 10]}</span>
    {labelMode === 'anatomical' && <span className="patient-tooth-location">{titleCase(location)}</span>}
  </button>
}

export function MiOdontograma({ token }: { token: string }) {
  const [result, setResult] = useState<{ token: string; attempt: number; chart?: OdontogramaPropio; error?: string } | null>(null)
  const [selected, setSelected] = useState(11)
  const [attempt, setAttempt] = useState(0)
  const [labelMode, setLabelMode] = useState<LabelMode>('fdi')
  const [viewMode, setViewMode] = useState<ViewMode>('3d')
  const [rotation, setRotation] = useState(0)

  // Never render cached clinical data for a different authenticated session.
  const current = result?.token === token && result.attempt === attempt ? result : null
  const chart = current?.chart ?? null
  const error = current?.error ?? ''
  const loading = current === null
  const selectedRecord = chart?.piezas.find(pieza => pieza.numero === selected)

  useEffect(() => {
    const controller = new AbortController()
    apiRequest<OdontogramaPropio>('/portal-paciente/odontograma', { token, signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) setResult({ token, attempt, chart: data }) })
      .catch(failure => {
        if (!controller.signal.aborted) {
          setResult({ token, attempt, error: failure instanceof Error ? failure.message : 'No se pudo cargar el odontograma.' })
        }
      })
    return () => controller.abort()
  }, [token, attempt])

  const upperStyle: CSSProperties = { transform: 'perspective(900px) rotateX(24deg) rotateY(' + rotation + 'deg)' }
  const lowerStyle: CSSProperties = { transform: 'perspective(900px) rotateX(-22deg) rotateY(' + rotation + 'deg)' }

  function renderArch(label: string, teeth: number[], arch: 'upper' | 'lower') {
    const isUpper = arch === 'upper'
    const quadrants = isUpper
      ? [{ number: 1, teeth: teeth.slice(0, 8) }, { number: 2, teeth: teeth.slice(8) }]
      : [{ number: 4, teeth: teeth.slice(0, 8) }, { number: 3, teeth: teeth.slice(8) }]
    return <section key={arch} role="group" aria-label={'Arcada ' + label} className={'patient-arch-panel ' + (arch === 'lower' ? 'is-lower' : '')}>
      <h3 className="patient-arch-heading">Arcada {label}</h3>
      <div className={'patient-arch-row ' + (viewMode === '3d' ? 'patient-arch-3d ' + (isUpper ? 'is-upper' : 'is-lower') : '')}
        style={viewMode === '3d' ? (isUpper ? upperStyle : lowerStyle) : undefined}>
        {quadrants.map((quadrant, quadrantIndex) => <div key={quadrant.number}
          role={labelMode === 'anatomical' ? 'group' : undefined}
          aria-label={labelMode === 'anatomical' ? 'Cuadrante ' + quadrant.number + ' · ' + titleCase(QUADRANTS[quadrant.number]) : undefined}
          className={'patient-quadrant-panel ' + (viewMode === '3d' ? 'patient-quadrant-3d' : '')}>
          {labelMode === 'anatomical' && <h4 className="patient-quadrant-heading">Cuadrante {quadrant.number} · {titleCase(QUADRANTS[quadrant.number])}</h4>}
          <div className="patient-quadrant-teeth">
            {quadrant.teeth.map((numero, position) => <ToothButton key={numero} numero={numero}
              record={chart?.piezas.find(pieza => pieza.numero === numero)} selected={selected === numero}
              labelMode={labelMode} viewMode={viewMode} position={position + quadrantIndex * 8}
              onSelect={() => setSelected(numero)} />)}
          </div>
        </div>)}
      </div>
    </section>
  }

  return <section className="patient-chart-card rounded-2xl border border-white/70 bg-white/75 p-5 shadow-lg shadow-blue-950/5 backdrop-blur-xl sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="text-xl font-bold text-blue-950">Mi odontograma</h2>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">Consultá las piezas y tratamientos registrados para tu ficha. Solo el equipo profesional puede modificarlos.</p>
      </div>
      <span className="rounded-full border border-green-200 bg-green-50/90 px-3 py-1 text-xs font-semibold text-green-900">Solo lectura</span>
    </div>
    {loading ? <p role="status" className="mt-5 rounded-xl bg-blue-50 p-4 text-sm text-slate-700">Cargando tu odontograma…</p>
      : error ? <div role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        <p>No se pudo cargar tu odontograma: {error}</p>
        <button type="button" className="mt-3 rounded-lg border border-red-300 bg-white px-3 py-2 font-semibold" onClick={() => setAttempt(value => value + 1)}>Reintentar</button>
      </div> : chart && <>
        {chart.registradoEn === null && chart.piezas.length === 0 && <p className="mt-5 rounded-xl bg-blue-50/85 p-4 text-sm text-slate-700">Todavía no hay un odontograma profesional registrado para tu ficha.</p>}
        <div className="mt-5 flex flex-wrap gap-2" role="group" aria-label="Opciones de visualización del odontograma">
          <button type="button" aria-label={labelMode === 'fdi' ? 'Mostrar nombres anatómicos' : 'Mostrar números FDI'}
            aria-pressed={labelMode === 'anatomical'} onClick={() => setLabelMode(value => value === 'fdi' ? 'anatomical' : 'fdi')}
            className="patient-chart-control">{labelMode === 'fdi' ? 'Mostrar nombres' : 'Mostrar números FDI'}</button>
          <button type="button" aria-label={viewMode === '2d' ? 'Activar vista 3D interactiva' : 'Volver a vista 2D'}
            aria-pressed={viewMode === '3d'} onClick={() => setViewMode(value => value === '2d' ? '3d' : '2d')}
            className="patient-chart-control">{viewMode === '2d' ? 'Vista 3D interactiva' : 'Vista 2D'}</button>
        </div>
        {viewMode === '3d' && <div className="patient-rotation-control">
          <label htmlFor="dental-arch-rotation">Rotar arcada dental</label>
          <input id="dental-arch-rotation" aria-label="Rotar arcada dental" type="range" min="-24" max="24" value={rotation}
            onChange={event => setRotation(Number(event.target.value))} />
        </div>}
        <div className={'mt-5 patient-chart-scene ' + (viewMode === '3d' ? 'is-3d' : 'is-2d')}>
          {viewMode === '3d' && <p className="patient-3d-note">Vista de perspectiva 3D ilustrativa. No es un modelo anatómico validado para diagnóstico.</p>}
          {renderArch('superior', ARCADA_SUPERIOR, 'upper')}
          {renderArch('inferior', ARCADA_INFERIOR, 'lower')}
        </div>
        <p className="mt-4 text-xs text-slate-600">Numeración FDI. Las piezas sin registro aparecen en gris; eso no significa que estén sanas.</p>
        <aside aria-live="polite" className="patient-selected-tooth mt-4 rounded-2xl border border-blue-100 bg-blue-50/80 p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-blue-700">Pieza seleccionada</p>
          <h3 className="mt-1 text-xl font-extrabold text-blue-950"><span>Diente {selected}</span><span className="mx-2 text-blue-400">·</span><span>{nombrePieza(selected)}</span></h3>
          {selectedRecord ? <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div><dt className="font-semibold text-slate-600">Afección registrada</dt><dd className="mt-1 font-bold text-slate-950">{selectedRecord.afeccion}</dd></div>
            <div><dt className="font-semibold text-slate-600">Tratamiento registrado</dt><dd className="mt-1 text-slate-800">{selectedRecord.tratamiento || 'No registrado.'}</dd></div>
          </dl> : <p className="mt-3 text-sm text-slate-700">Sin registro profesional para esta pieza.</p>}
        </aside>
      </>}
  </section>
}
