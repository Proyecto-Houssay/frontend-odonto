import { useEffect, useRef, useState } from 'react'
import SignatureCanvas from 'react-signature-canvas'
import { jsPDF } from 'jspdf'

export const VERSION = 'academic-v1'
export const CONSENT_TEXT = 'Comprendo que este odontograma y presupuesto son una simulación académica. Las afecciones seleccionadas, los tratamientos y los precios son ilustrativos y requieren validación profesional. He revisado los dientes marcados, sus tratamientos y el total estimado en ARS. Acepto registrar este presupuesto ilustrativo con mi firma manuscrita electrónica. No constituye un diagnóstico, una indicación de tratamiento ni un comprobante de pago.'
export const DEMO_CONSENT_TEXT = 'Comprendo que este odontograma y presupuesto son una simulación académica. Las afecciones seleccionadas, los tratamientos y los precios son ilustrativos y requieren validación profesional. He revisado los dientes marcados, sus tratamientos y el total estimado en ARS. Acepto generar este borrador ilustrativo con mi firma manuscrita electrónica. No constituye un diagnóstico, una indicación de tratamiento ni un comprobante de pago.'
export const CATALOG = [
  { afeccion: 'caries', nombre: 'Caries', color: '#ef4444', descripcion: 'Destrucción del esmalte por bacterias', tratamiento: 'Limpieza + empaste con resina compuesta', costoEstimado: 45000 },
  { afeccion: 'fractura', nombre: 'Fractura', color: '#f97316', descripcion: 'Rotura por golpe', tratamiento: 'Reconstrucción con corona o carilla', costoEstimado: 85000 },
  { afeccion: 'gingivitis', nombre: 'Gingivitis', color: '#eab308', descripcion: 'Inflamación de encía por placa', tratamiento: 'Limpieza ultrasónica + antiséptico', costoEstimado: 30000 },
  { afeccion: 'ausente', nombre: 'Ausente', color: '#6b7280', descripcion: 'Diente perdido', tratamiento: 'Implante dental o prótesis puente', costoEstimado: 250000 },
  { afeccion: 'sano', nombre: 'Sano', color: '#22c55e', descripcion: 'Sin afección visible', tratamiento: 'Control cada 6 meses', costoEstimado: 0 },
]
export const ARCHES = [
  [18,17,16,15,14,13,12,11,21,22,23,24,25,26,27,28],
  [48,47,46,45,44,43,42,41,31,32,33,34,35,36,37,38],
]
const ALL_TEETH = ARCHES.flat()
const CONDITION = Object.fromEntries(CATALOG.map(item => [item.afeccion, item]))
const DEMO_PATIENTS = [
  { id: 9001, nombre: 'Paciente de prueba 1' },
  { id: 9002, nombre: 'Paciente de prueba 2' },
]
const INITIAL_DEMO_CHARTS = {
  9001: { 16: 'caries', 26: 'gingivitis' },
  9002: { 21: 'ausente', 36: 'fractura' },
}
export const formatMoney = value => '$' + new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(value)
const patientNumber = value => /^\d+$/.test(String(value)) && Number.isSafeInteger(Number(value)) && Number(value) > 0 ? Number(value) : null
function tokenRole(token) {
  try {
    const payload = token.split('.')[1]
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))).role
  } catch { return null }
}
const toothName = number => {
  const names = ['Incisivo central', 'Incisivo lateral', 'Canino', 'Primer premolar', 'Segundo premolar', 'Primer molar', 'Segundo molar', 'Tercer molar']
  return `${names[number % 10 - 1]} ${number < 30 ? 'superior' : 'inferior'} ${number < 20 || number >= 40 ? 'derecho' : 'izquierdo'}`
}
function matchesCatalog(data) {
  return data?.versionCatalogo === VERSION && data?.versionConsentimiento === VERSION && data?.textoConsentimiento === CONSENT_TEXT
    && Array.isArray(data.afecciones) && data.afecciones.length === CATALOG.length
    && CATALOG.every((item, i) => Object.keys(item).every(key => data.afecciones[i]?.[key] === item[key]))
}
function matchesSaved(data, snapshot) {
  return Number.isSafeInteger(data?.id) && data.id > 0 && data.pacienteId === snapshot.pacienteId
    && Number.isSafeInteger(data.creadoPorId) && data.creadoPorId > 0 && Number.isFinite(Date.parse(data.creadoEn))
    && data.moneda === 'ARS' && data.versionCatalogo === VERSION && data.versionConsentimiento === VERSION
    && data.textoConsentimiento === CONSENT_TEXT && data.consentimientoAceptado === true && data.firmaBase64 === snapshot.firmaBase64
    && data.totalPresupuesto === snapshot.totalPresupuesto && Array.isArray(data.dientes) && data.dientes.length === snapshot.dientes.length
    && snapshot.dientes.every((tooth, i) => Object.keys(tooth).every(key => data.dientes[i]?.[key] === tooth[key]))
}

function formatPdfDate(value, includeTime = false) {
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires', day: '2-digit', month: '2-digit', year: 'numeric',
    ...(includeTime ? { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false } : {}),
  }).format(new Date(value))
}

/** Creates a paginated, text-based estimate; never treats an unsaved draft as persisted. */
export function createBudgetPdf(snapshot) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: false })
  const margin = 16, width = 178, bottom = 278
  let y = 20
  const nextPage = () => { doc.addPage(); y = 20 }
  const line = (text, size = 10) => {
    doc.setFontSize(size)
    const lines = doc.splitTextToSize(String(text), width)
    for (const part of lines) {
      if (y + 6 > bottom) nextPage()
      doc.text(part, margin, y); y += size >= 15 ? 8 : 6
    }
  }
  line(`Presupuesto Odontológico - Paciente ID: ${snapshot.pacienteId}`, 16)
  if (snapshot.pacienteNombre) line(`Paciente: ${snapshot.pacienteNombre}`)
  line(`Fecha de emisión (Buenos Aires): ${formatPdfDate(new Date())}`)
  line(snapshot.modoDemo ? 'DEMO EN NAVEGADOR - BORRADOR NO GUARDADO - no se enviaron datos al servidor'
    : snapshot.id ? `Guardado #${snapshot.id} | Fecha de registro (Buenos Aires, 24 h): ${formatPdfDate(snapshot.creadoEn, true)}` : 'BORRADOR NO GUARDADO - sin confirmación de persistencia')
  line(`Simulación académica | Catálogo: ${snapshot.versionCatalogo} | Moneda: ARS`)
  y += 4
  for (const tooth of snapshot.dientes) {
    // Keep each short treatment block together, but also split long text safely.
    if (y + 30 > bottom) nextPage()
    line(`Diente ${tooth.numero} - ${tooth.nombre}`, 12)
    line(tooth.descripcion)
    line(`Tratamiento: ${tooth.tratamiento}`)
    line(`Costo estimado: ${formatMoney(tooth.costoEstimado)} ARS`)
    y += 3
  }
  line(`TOTAL ESTIMADO: ${formatMoney(snapshot.totalPresupuesto)} ARS`, 14)
  y += 4
  line(`Consentimiento aceptado - versión ${snapshot.versionConsentimiento}`, 12)
  line(snapshot.textoConsentimiento)
  if (y + 60 > bottom) nextPage()
  line('Firma del paciente:', 11)
  line('Firma manuscrita electrónica (simulación académica)', 11)
  // Canvas backing has a fixed 180 CSS-pixel height; actual PNG ratio is recorded at capture.
  const ratio = snapshot.firmaAspectRatio || 500 / 180
  const imageWidth = Math.min(125, 44 * ratio), imageHeight = imageWidth / ratio
  doc.addImage(snapshot.firmaBase64, 'PNG', margin, y, imageWidth, imageHeight)
  return doc
}

const TOOTH_TYPES = {
  1: 'Incisivo C.', 2: 'Incisivo L.', 3: 'Canino', 4: '1° Premolar',
  5: '2° Premolar', 6: '1° Molar', 7: '2° Molar', 8: '3° Molar',
}
const QUADRANTS = {
  1: 'Sup. der.', 2: 'Sup. izq.', 3: 'Inf. izq.', 4: 'Inf. der.',
}

function ToothIcon({ color, lower, molar, viewMode = '2d', number = 11 }) {
  if (viewMode === '3d') {
    return (
      <svg viewBox="0 0 44 56" aria-hidden="true" focusable="false" style={{ transform: lower ? 'rotate(180deg)' : undefined }}>
        <defs>
          <linearGradient id={`enamel-${number}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="60%" stopColor="#f1f7ff" />
            <stop offset="100%" stopColor="#b8cee6" />
          </linearGradient>
        </defs>
        <path d="M9 5 C4 7 4 17 7 25 L12 47 Q15 56 19 38 Q22 30 25 38 Q30 56 32 47 L38 25 C42 12 36 2 29 5 Q22 8 16 5 Z"
          fill={color !== '#94a3b8' ? color : `url(#enamel-${number})`} fillOpacity={color !== '#94a3b8' ? 0.45 : 1}
          stroke={color} strokeWidth="2.4" />
        <path d={molar ? 'M12 13 Q16 20 22 14 Q28 20 33 13 M22 14 V26' : 'M12 13 Q22 19 33 13'} fill="none" stroke={color !== '#94a3b8' ? color : '#8298b2'} strokeWidth="1.6" />
        <path d="M10 26 L15 43 M34 26 L29 43" fill="none" stroke="#ffffff" strokeWidth="1.1" opacity=".8" />
      </svg>
    )
  }
  return <svg viewBox="0 0 44 56" aria-hidden="true" focusable="false" style={{ transform: lower ? 'rotate(180deg)' : undefined }}>
    <path d="M9 5 C4 7 4 17 7 25 L12 47 Q15 56 19 38 Q22 30 25 38 Q30 56 32 47 L38 25 C42 12 36 2 29 5 Q22 8 16 5 Z" fill={color} fillOpacity=".22" stroke={color} strokeWidth="2.4" />
    <path d={molar ? 'M12 13 Q16 20 22 14 Q28 20 33 13 M22 14 V26' : 'M12 13 Q22 19 33 13'} fill="none" stroke={color} strokeWidth="1.6" />
  </svg>
}

/**
 * Standalone page: route wrappers may pass pacienteId; no router/auth assumptions.
 * @param {{ pacienteId?: string | number | null, token?: string, apiUrl?: string, demoMode?: boolean, backendMode?: boolean }} props
 */
export default function Odontograma({ pacienteId, token = '', apiUrl = '/api', demoMode = false, backendMode = false } = {}) {
  const [manualPatient, setManualPatient] = useState('')
  const [apiPatients, setApiPatients] = useState([])
  const [loadingPatients, setLoadingPatients] = useState(false)
  const [manualToken, setManualToken] = useState('')
  const [demoPatients, setDemoPatients] = useState(DEMO_PATIENTS)
  const [demoCharts, setDemoCharts] = useState(INITIAL_DEMO_CHARTS)
  const [selectedDemoPatientId, setSelectedDemoPatientId] = useState(String(DEMO_PATIENTS[0].id))
  const [newDemoPatientName, setNewDemoPatientName] = useState('')
  const [chart, setChart] = useState({})
  const [selected, setSelected] = useState(11)
  const [accepted, setAccepted] = useState(false)
  const [signature, setSignature] = useState(null)
  const [saved, setSaved] = useState(null)
  const [verified, setVerified] = useState(false)
  const [saving, setSaving] = useState(false)
  const [recordState, setRecordState] = useState({ key: '', status: 'idle' })
  const [loadedFor, setLoadedFor] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [viewMode, setViewMode] = useState('2d')
  const [labelMode, setLabelMode] = useState('fdi')
  const [rotation, setRotation] = useState(0)
  const [patientSearch, setPatientSearch] = useState('')
  const [previousCharts, setPreviousCharts] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const signatureRef = useRef(null), signatureBox = useRef(null), savingRef = useRef(false), revision = useRef(0)
  const patientId = demoMode ? patientNumber(selectedDemoPatientId) : patientNumber(pacienteId ?? manualPatient)
  const selectedDemoPatient = demoPatients.find(patient => patient.id === patientId)
  const bearer = (token || manualToken).trim().replace(/^Bearer\s+/i, '')
  // This is presentation only. The API still enforces the authoritative role checks.
  const readOnly = !demoMode && tokenRole(bearer) === 'RECEPCIONISTA'
  const baseUrl = apiUrl.replace(/\/$/, '')
  const recordKey = `${patientId}|${bearer}`
  const recordStatus = recordState.key === recordKey ? recordState.status : 'loading'
  const persisted = readOnly && saved?.pacienteId === patientId && loadedFor === bearer ? saved : null
  const teeth = ALL_TEETH.filter(number => chart[number]).map(numero => ({ numero, ...CONDITION[chart[numero]] }))
  const total = teeth.reduce((sum, item) => sum + item.costoEstimado, 0)
  const visibleTeeth = readOnly ? persisted?.dientes || [] : teeth
  const visibleTotal = readOnly ? persisted?.totalPresupuesto || 0 : total
  const diagnosis = readOnly ? persisted?.dientes.find(tooth => tooth.numero === selected) : CONDITION[chart[selected]]
  const canSign = !readOnly && (demoMode || verified) && patientId && teeth.length > 0 && accepted && !saving
  const consentText = demoMode ? DEMO_CONSENT_TEXT : CONSENT_TEXT
  const snapshot = { pacienteId: patientId, pacienteNombre: demoMode ? selectedDemoPatient?.nombre : undefined, modoDemo: demoMode,
    dientes: teeth, totalPresupuesto: total, moneda: 'ARS', versionCatalogo: demoMode ? `${VERSION}-demo` : VERSION,
    consentimientoAceptado: accepted, versionConsentimiento: demoMode ? `${VERSION}-demo` : VERSION, textoConsentimiento: consentText,
    firmaBase64: signature?.png, firmaAspectRatio: signature?.ratio }

  function revoke({ consent = true, clearCanvas = true } = {}) {
    revision.current += 1; setSignature(null); setSaved(null); setNotice('')
    if (consent) setAccepted(false)
    if (clearCanvas) signatureRef.current?.clear()
  }
  useEffect(() => {
    revision.current += 1; setChart(demoMode ? demoCharts[patientId] || {} : {}); setSignature(null); setSaved(null); setAccepted(false); setError(''); setNotice('')
    signatureRef.current?.clear()
  }, [patientId, demoMode, demoCharts])

  useEffect(() => {
    const controller = new AbortController()
    setVerified(Boolean(demoMode))
    revision.current += 1; setSignature(null); setSaved(null); setAccepted(false); setNotice(''); signatureRef.current?.clear()
    if (demoMode) {
      setError('')
      return () => controller.abort()
    }
    if (!bearer) return () => controller.abort()
    async function verify() {
      try {
        const response = await fetch(`${baseUrl}/odontograma/catalogo`, { headers: { Authorization: `Bearer ${bearer}` }, signal: controller.signal })
        if (!response.ok) throw new Error('No fue posible verificar el catálogo. Revise el token y el acceso clínico.')
        const data = await response.json()
        if (!matchesCatalog(data)) throw new Error('El catálogo o consentimiento del servidor no coincide con esta versión. Actualice la aplicación.')
        if (!controller.signal.aborted) { setVerified(true); setError('') }
      } catch (failure) {
        if (!controller.signal.aborted) setError(failure.message || 'No fue posible verificar el catálogo.')
      }
    }
    void verify()
    return () => controller.abort()
  }, [bearer, baseUrl, demoMode])

  useEffect(() => {
    if (!readOnly || !verified || !patientId || !bearer) return
    const controller = new AbortController()
    async function loadLatest() {
      try {
        const headers = { Authorization: `Bearer ${bearer}` }
        const listResponse = await fetch(`${baseUrl}/odontograma?pacienteId=${patientId}`, { headers, signal: controller.signal })
        if (!listResponse.ok) throw new Error('No fue posible consultar los odontogramas de este paciente.')
        const records = await listResponse.json()
        if (!Array.isArray(records)) throw new Error('El listado de odontogramas no es válido.')
        const latest = records.filter(record => record.pacienteId === patientId && Number.isSafeInteger(record.id))
          .sort((a, b) => Date.parse(b.creadoEn) - Date.parse(a.creadoEn) || b.id - a.id)[0]
        if (!latest) { if (!controller.signal.aborted) setRecordState({ key: recordKey, status: 'empty' }); return }
        const detailResponse = await fetch(`${baseUrl}/odontograma/${latest.id}`, { headers, signal: controller.signal })
        if (!detailResponse.ok) throw new Error('No fue posible abrir el último odontograma.')
        const detail = await detailResponse.json()
        if (detail?.id !== latest.id || detail.pacienteId !== patientId || !Array.isArray(detail.dientes)
          || !detail.dientes.every(tooth => ALL_TEETH.includes(tooth.numero) && CONDITION[tooth.afeccion])
          || !Number.isSafeInteger(detail.totalPresupuesto)) throw new Error('La respuesta del odontograma no es válida.')
        if (!controller.signal.aborted) {
          // A stale backend may still return the signature; never retain it in reception state.
          const receptionDetail = { ...detail }
          delete receptionDetail.firmaBase64
          setSaved(receptionDetail); setLoadedFor(bearer); setRecordState({ key: recordKey, status: 'loaded' })
        }
      } catch (failure) {
        if (!controller.signal.aborted) { setRecordState({ key: recordKey, status: 'error' }); setError(failure.message || 'No fue posible cargar el odontograma.') }
      }
    }
    void loadLatest()
    return () => controller.abort()
  }, [readOnly, verified, patientId, bearer, baseUrl, recordKey])

  useEffect(() => {
    const canvas = signatureRef.current?.getCanvas(), box = signatureBox.current
    if (!canvas || !box || typeof ResizeObserver === 'undefined') return
    let previous = ''
    const observer = new ResizeObserver(() => {
      const width = Math.round(canvas.getBoundingClientRect().width)
      if (!width) return
      const dpr = Math.min(window.devicePixelRatio || 1, 2), dimensions = `${width}:${dpr}`
      if (previous === dimensions) return
      const wasSized = Boolean(previous); previous = dimensions
      canvas.width = Math.round(width * dpr); canvas.height = Math.round(180 * dpr)
      canvas.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0)
      signatureRef.current.clear()
      if (wasSized) {
        revision.current += 1; setSignature(null); setSaved(null); setAccepted(false)
        setNotice('El área de firma cambió de tamaño. Revise el consentimiento y vuelva a firmar.')
      }
    })
    observer.observe(box)
    return () => observer.disconnect()
  }, [readOnly])

  function assign(code) {
    if (readOnly || saving || chart[selected] === code) return
    const nextChart = { ...chart, [selected]: code }
    setChart(nextChart)
    if (demoMode) setDemoCharts(previous => ({ ...previous, [patientId]: nextChart }))
    revoke(); setError(''); setNotice('')
  }
  function removeSelectedCondition() {
    if (readOnly) return
    const nextChart = { ...chart }
    delete nextChart[selected]
    setChart(nextChart)
    if (demoMode) setDemoCharts(previous => ({ ...previous, [patientId]: nextChart }))
    revoke()
  }
  function addDemoPatient(event) {
    event.preventDefault()
    const nombre = newDemoPatientName.trim()
    if (!nombre) { setError('Ingrese un nombre para el paciente temporal.'); return }
    const id = Math.max(9000, ...demoPatients.map(patient => patient.id)) + 1
    setDemoPatients(previous => [...previous, { id, nombre }])
    setDemoCharts(previous => ({ ...previous, [id]: {} }))
    setSelectedDemoPatientId(String(id)); setNewDemoPatientName(''); setError('')
  }
  async function loadApiPatients() {
    if (!bearer || loadingPatients) return
    setLoadingPatients(true); setError('')
    try {
      const response = await fetch(`${baseUrl}/pacientes`, { headers: { Authorization: `Bearer ${bearer}` } })
      if (!response.ok) throw new Error('No se pudieron cargar los pacientes registrados.')
      const list = await response.json()
      if (Array.isArray(list)) {
        setApiPatients(list)
        if (!manualPatient && list.length > 0 && list[0]?.id) setManualPatient(String(list[0].id))
      }
    } catch (failure) {
      setError(failure.message || 'No se pudieron cargar los pacientes registrados.')
    } finally {
      setLoadingPatients(false)
    }
  }

  async function loadPatientHistory(targetPatientId) {
    if (!targetPatientId || !bearer) return
    setLoadingHistory(true)
    try {
      const response = await fetch(`${baseUrl}/odontograma?pacienteId=${targetPatientId}`, {
        headers: { Authorization: `Bearer ${bearer}` }
      })
      if (response.ok) {
        const data = await response.json()
        if (Array.isArray(data)) {
          setPreviousCharts(data.filter(d => Number.isSafeInteger(d.id)).sort((a,b) => Date.parse(b.creadoEn) - Date.parse(a.creadoEn)))
          setShowHistory(true)
        }
      }
    } catch {
      // ignore
    } finally {
      setLoadingHistory(false)
    }
  }

  async function loadPreviousChart(id) {
    if (!bearer) return
    setError('')
    try {
      const response = await fetch(`${baseUrl}/odontograma/${id}`, {
        headers: { Authorization: `Bearer ${bearer}` }
      })
      if (!response.ok) throw new Error('No se pudo cargar el odontograma previo.')
      const data = await response.json()
      if (Array.isArray(data.dientes)) {
        const newChart = {}
        for (const t of data.dientes) {
          if (ALL_TEETH.includes(t.numero) && CONDITION[t.afeccion]) {
            newChart[t.numero] = t.afeccion
          }
        }
        setChart(newChart)
        revoke({ consent: true })
        setNotice(`Odontograma #${id} cargado en la evaluación actual para revisión.`)
      }
    } catch (e) {
      setError(e.message || 'Error al cargar el odontograma previo.')
    }
  }

  function capture() {
    if (!canSign) return
    if (!signatureRef.current || signatureRef.current.isEmpty()) { setError('Dibuje una firma antes de capturarla.'); return }
    const canvas = signatureRef.current.getCanvas()
    setSignature({ png: signatureRef.current.toDataURL('image/png'), ratio: canvas ? canvas.width / canvas.height : 500 / 180 })
    setError(''); setNotice('Firma capturada para este paciente, presupuesto y consentimiento.')
  }
  async function save() {
    if (demoMode || readOnly || savingRef.current || !canSign || !signature || !bearer) return
    savingRef.current = true; setSaving(true); setError(''); setNotice('')
    const currentRevision = revision.current, currentSnapshot = snapshot
    const body = { pacienteId: patientId, dientes: teeth.map(({ numero, afeccion }) => ({ numero, afeccion })),
      consentimientoAceptado: true, versionConsentimiento: VERSION, firmaBase64: signature.png }
    try {
      const response = await fetch(`${baseUrl}/odontograma`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bearer}` }, body: JSON.stringify(body) })
      if (response.status !== 201) {
        const messages = { 400: 'Revise los datos, el consentimiento y la firma.', 401: 'La sesión venció; vuelva a iniciar sesión en el frontend.',
          403: 'Se requiere el rol ODONTOLOGO o ADMINISTRADOR.', 404: 'El paciente no existe.' }
        throw new Error(messages[response.status] || 'El servidor no confirmó el guardado. No se reintentó automáticamente.')
      }
      const data = await response.json()
      if (!matchesSaved(data, currentSnapshot)) throw new Error('La respuesta no coincide con el presupuesto firmado. Verifique el registro en la API antes de reintentar.')
      if (revision.current === currentRevision) {
        setSaved({ ...data, firmaAspectRatio: signature.ratio }); setNotice(`Guardado #${data.id}. Copia inmutable confirmada por la API.`)
      }
    } catch (failure) {
      if (revision.current === currentRevision) setError(`No se guardó o no se pudo confirmar. ${failure.message || 'Revise la conexión.'} El borrador se conserva; verifique la API antes de reintentar.`)
    } finally { savingRef.current = false; setSaving(false) }
  }
  function download() {
    if (!signature || !accepted || !patientId || !teeth.length) return
    try { createBudgetPdf(saved || snapshot).save(`presupuesto_paciente_${patientId}.pdf`); setError('') }
    catch { setError('No se pudo generar el PDF. El odontograma y la firma se conservan.') }
  }

  const filteredPatients = apiPatients.filter(p => !patientSearch || `${p.nombre} ${p.apellido} ${p.dni} ${p.id}`.toLowerCase().includes(patientSearch.toLowerCase()))
  const selectedPatientData = apiPatients.find(p => String(p.id) === String(patientId))

  return <main className="odontogram-page">
    <style>{STYLES}</style>
    <header className="odontogram-header">
      <div>
        <p className="odontogram-eyebrow">NOVADENT · ODONTOLOGÍA CLÍNICA</p>
        <h1>Odontograma y presupuesto</h1>
        <p>Evaluación clínica de dentición permanente, registro interactivo 2D / 3D y firma digital.</p>
      </div>
      <span className="odontogram-badge">32 piezas · FDI</span>
    </header>
    <section className="odontogram-card odontogram-credentials" aria-label="Paciente y acceso">
      {demoMode ? <>
        <label>Paciente de prueba<select aria-label="Paciente de prueba" value={selectedDemoPatientId} onChange={event => { setSelectedDemoPatientId(event.target.value); setError('') }}>
          {demoPatients.map(patient => <option key={patient.id} value={patient.id}>{patient.nombre} · ID {patient.id}</option>)}
        </select></label>
        <form className="odontogram-demo-patient-form" onSubmit={addDemoPatient}>
          <label htmlFor="new-demo-patient">Agregar paciente temporal</label>
          <input id="new-demo-patient" maxLength={80} value={newDemoPatientName} onChange={event => setNewDemoPatientName(event.target.value)} placeholder="Nombre para esta sesión" />
          <button type="submit">Agregar</button>
        </form>
        <p className="odontogram-access" role="status">Modo demostración. Los pacientes y cambios quedan solo en esta sesión del navegador; no se conectan a MySQL ni se envían al backend.</p>
        <a className="odontogram-backend-link" href="/odontograma/backend">Abrir modo de guardado en backend local</a>
      </> : <>
        <label>ID de paciente{pacienteId != null ? <input value={pacienteId} readOnly aria-label="ID de paciente" /> : <input type="text" inputMode="numeric" value={manualPatient} disabled={saving} onChange={e => setManualPatient(e.target.value)} aria-label="ID de paciente" placeholder="ID existente en la API" />}</label>
        {pacienteId == null && apiPatients.length > 0 ? <label>Paciente registrado<select aria-label="Paciente registrado" value={manualPatient} disabled={saving} onChange={e => { setManualPatient(e.target.value); setError('') }}><option value="">Seleccionar paciente…</option>{apiPatients.map(p => <option key={p.id} value={String(p.id)}>{p.nombre} {p.apellido} · DNI {p.dni} (ID {p.id})</option>)}</select></label> : null}
        {pacienteId == null && bearer ? <button type="button" disabled={loadingPatients || saving} onClick={loadApiPatients}>{loadingPatients ? 'Cargando pacientes…' : apiPatients.length > 0 ? 'Actualizar lista' : 'Elegir paciente de la lista'}</button> : null}
        {!token ? <label>Token Bearer (solo en memoria)<input type="password" autoComplete="off" value={manualToken} disabled={saving} onChange={e => setManualToken(e.target.value)} aria-label="Token Bearer (solo en memoria)" placeholder="Pegue el JWT de Swagger" /></label> : null}
        <p className="odontogram-access">{verified ? 'Catálogo verificado' : readOnly ? 'Se requiere una sesión válida para consultar el odontograma.' : 'Se requiere JWT clínico para verificar el catálogo y firmar.'}{!patientId ? ' Ingrese un ID de paciente positivo.' : ''}</p>
        {backendMode ? <p className="odontogram-local-api-notice" role="note">Este modo usa la API en <code>/api</code>. Para conectarse a MySQL local, ejecutá el frontend con Vite y Spring Boot en tu PC. Una página abierta desde Vercel no puede acceder al backend ni a la base local de tu computadora.</p> : null}

        {/* Panel enriquecido de Pacientes y Casos Clínicos */}
        {apiPatients.length > 0 ? (
          <div className="odontogram-patients-panel">
            <div className="odontogram-patients-header">
              <div>
                <h4>Expedientes de Pacientes y Casos Clínicos</h4>
                <p className="odontogram-panel-subtitle">Seleccioná un paciente para evaluar sus piezas dentales y consultar su historial.</p>
              </div>
              <input
                type="text"
                className="odontogram-search-input"
                placeholder="Buscar por nombre o DNI…"
                value={patientSearch}
                onChange={e => setPatientSearch(e.target.value)}
              />
            </div>
            <div className="odontogram-patient-chips">
              {filteredPatients.slice(0, 8).map(p => {
                const isSelected = String(p.id) === String(patientId)
                return (
                  <button
                    key={p.id}
                    type="button"
                    className={`odontogram-patient-chip ${isSelected ? 'is-selected' : ''}`}
                    onClick={() => {
                      setManualPatient(String(p.id))
                      setError('')
                      void loadPatientHistory(p.id)
                    }}
                  >
                    <strong>{p.nombre} {p.apellido}</strong>
                    <span>DNI {p.dni} · ID {p.id}</span>
                  </button>
                )
              })}
            </div>
            {selectedPatientData ? (
              <div className="odontogram-selected-case">
                <div className="odontogram-case-header">
                  <div>
                    <h5>Caso activo: <strong>{selectedPatientData.nombre} {selectedPatientData.apellido}</strong> (ID {selectedPatientData.id})</h5>
                    <p className="odontogram-case-meta">DNI: {selectedPatientData.dni} {selectedPatientData.telefono ? `· Tel: ${selectedPatientData.telefono}` : ''} {selectedPatientData.email ? `· ${selectedPatientData.email}` : ''}</p>
                  </div>
                  <button
                    type="button"
                    className="odontogram-history-btn"
                    onClick={() => {
                      if (!showHistory && patientId) void loadPatientHistory(patientId)
                      setShowHistory(v => !v)
                    }}
                  >
                    {loadingHistory ? 'Consultando historial…' : showHistory ? 'Ocultar historial' : '📋 Ver odontogramas previos'}
                  </button>
                </div>
                {showHistory ? (
                  <div className="odontogram-history-list">
                    {previousCharts.length === 0 ? (
                      <p className="odontogram-empty-history">No hay odontogramas previos registrados para este paciente en el sistema.</p>
                    ) : (
                      previousCharts.map(hist => (
                        <div key={hist.id} className="odontogram-history-item">
                          <div>
                            <strong>Odontograma #{hist.id}</strong>
                            <span className="odontogram-history-date">Registrado: {formatPdfDate(hist.creadoEn, true)}</span>
                            <div className="odontogram-history-total">Total estimado: {formatMoney(hist.totalPresupuesto)} ARS</div>
                          </div>
                          {!readOnly ? (
                            <button
                              type="button"
                              className="odontogram-btn-small"
                              onClick={() => void loadPreviousChart(hist.id)}
                            >
                              Cargar en odontograma
                            </button>
                          ) : null}
                        </div>
                      ))
                    )}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </>}
    </section>
    {error ? <p className="odontogram-error" role="alert">{error}</p> : null}
    {notice ? <p className="odontogram-notice" role="status">{notice}</p> : null}
    {readOnly ? <p className="odontogram-notice" role="status">Vista de recepción · solo lectura. El diagnóstico no puede modificarse desde este rol.</p> : null}
    {readOnly && verified && patientId && recordStatus === 'loading' ? <p role="status">Cargando último odontograma guardado…</p> : null}
    {readOnly && recordStatus === 'empty' ? <p role="status">Este paciente todavía no tiene odontogramas guardados.</p> : null}
    <div className="odontogram-workspace">
      <section className="odontogram-card" aria-label="Odontograma FDI">
        <div className="odontogram-card-header">
          <div>
            <h2>Seleccione una pieza</h2>
            <p>Vista del profesional: derecha del paciente a la izquierda. Seleccionar no registra una afección.</p>
          </div>
          <div className="odontogram-view-controls">
            <div className="odontogram-control-group">
              <button
                type="button"
                className={`odontogram-toggle-btn ${viewMode === '3d' ? 'is-active' : ''}`}
                aria-label={viewMode === '2d' ? 'Activar vista 3D interactiva' : 'Volver a vista 2D'}
                aria-pressed={viewMode === '3d'}
                onClick={() => setViewMode(v => v === '2d' ? '3d' : '2d')}
              >
                {viewMode === '2d' ? 'Vista 3D interactiva' : 'Vista 2D'}
              </button>
              <button
                type="button"
                className={`odontogram-toggle-btn ${labelMode === 'anatomical' ? 'is-active' : ''}`}
                aria-label={labelMode === 'fdi' ? 'Mostrar nombres anatómicos' : 'Mostrar números FDI'}
                aria-pressed={labelMode === 'anatomical'}
                onClick={() => setLabelMode(v => v === 'fdi' ? 'anatomical' : 'fdi')}
              >
                {labelMode === 'fdi' ? 'Mostrar nombres anatómicos' : 'Mostrar números FDI'}
              </button>
            </div>
            {viewMode === '3d' ? (
              <div className="odontogram-rotation-box">
                <label htmlFor="dental-arch-rotation">Rotar 3D ({rotation}°)</label>
                <input
                  id="dental-arch-rotation"
                  aria-label="Rotar arcada dental"
                  type="range"
                  min="-24"
                  max="24"
                  value={rotation}
                  onChange={e => setRotation(Number(e.target.value))}
                />
              </div>
            ) : null}
          </div>
        </div>

        <div className={`odontogram-scroll ${viewMode === '3d' ? 'odontogram-scroll-3d' : ''}`} tabIndex={0} role="region" aria-label="Arcadas dentales, desplazamiento horizontal disponible">
          <div className="odontogram-arches">
            {ARCHES.map((arch, index) => {
              const isUpper = index === 0
              const archStyle = viewMode === '3d'
                ? { transform: `perspective(1000px) rotateX(${isUpper ? 24 : -22}deg) rotateY(${rotation}deg)` }
                : undefined
              return (
                <div key={index}>
                  <h3>{isUpper ? 'Arcada superior' : 'Arcada inferior'}</h3>
                  <div className={`odontogram-arch ${index === 1 ? 'odontogram-lower' : ''} ${viewMode === '3d' ? 'is-3d-arch' : ''}`} style={archStyle}>
                    {arch.map((number, position) => {
                      const condition = readOnly ? persisted?.dientes.find(tooth => tooth.numero === number) : CONDITION[chart[number]], color = condition?.color || '#94a3b8'
                      const offset = Math.round(46 * Math.sin(Math.PI * position / 15))
                      const arch3dOffset = Math.round(Math.abs(7.5 - (position % 8)) * 2)
                      const toothStyle = viewMode === '3d'
                        ? { transform: `translateY(${arch3dOffset}px) translateZ(12px) rotateX(-7deg)`, '--tooth-color': color }
                        : { marginTop: index === 0 ? 46 - offset : offset, '--tooth-color': color }
                      return (
                        <button
                          key={number}
                          type="button"
                          className={`odontogram-tooth ${selected === number ? 'odontogram-selected' : ''} ${viewMode === '3d' ? 'odontogram-tooth-3d' : ''}`}
                          style={toothStyle}
                          disabled={saving}
                          aria-label={`Diente ${number}: ${condition?.nombre || 'Sin evaluar'}`}
                          aria-pressed={selected === number}
                          onClick={() => setSelected(number)}
                        >
                          <span>{labelMode === 'fdi' ? number : (TOOTH_TYPES[number % 10] || number)}</span>
                          <ToothIcon color={color} lower={index === 1} molar={number % 10 >= 6} viewMode={viewMode} number={number} />
                          <small>{labelMode === 'anatomical' ? (QUADRANTS[Math.floor(number / 10)] || condition?.nombre || 'Sin evaluar') : (condition?.nombre || 'Sin evaluar')}</small>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
        <div className="odontogram-legend" aria-label="Leyenda de afecciones">
          {CATALOG.map(item => <span key={item.afeccion}><i style={{ background: item.color }} />{item.nombre}</span>)}
          <span><i style={{ background: '#94a3b8' }} />Sin evaluar</span>
        </div>
      </section>

      <section className="odontogram-card odontogram-diagnosis" aria-label="Ficha de la pieza seleccionada">
        <p className="odontogram-eyebrow">FICHA DE LA PIEZA</p>
        <h2>Diente {selected}</h2>
        <p>{toothName(selected)}</p>
        <dl>
          <dt>Afección seleccionada</dt>
          <dd>{diagnosis?.nombre || 'Sin evaluar'}</dd>
          <dt>Descripción</dt>
          <dd>{diagnosis?.descripcion || 'No se ha registrado una evaluación.'}</dd>
          <dt>Tratamiento ilustrativo</dt>
          <dd>{diagnosis?.tratamiento || 'A seleccionar por el profesional.'}</dd>
          <dt>Costo estimado</dt>
          <dd>{diagnosis ? `${formatMoney(diagnosis.costoEstimado)} ARS` : 'Sin estimar'}</dd>
        </dl>
        {!readOnly ? <>
          <h3>Asignar afección</h3>
          <div className="odontogram-conditions">
            {CATALOG.map(item => <button type="button" key={item.afeccion} disabled={saving} aria-label={`Asignar ${item.nombre}`} aria-pressed={chart[selected] === item.afeccion} onClick={() => assign(item.afeccion)}><i style={{ background: item.color }} />{item.nombre}</button>)}
          </div>
          <button type="button" className="odontogram-link-button" disabled={!chart[selected] || saving} onClick={removeSelectedCondition}>Quitar marca del diente {selected}</button>
        </> : null}
      </section>
    </div>
    <section className="odontogram-card" aria-label="Resumen a firmar"><h2>Presupuesto ilustrativo</h2><p>Solo incluye piezas marcadas explícitamente. Los valores requieren validación profesional.</p>
      {visibleTeeth.length ? <ul className="odontogram-estimate">{visibleTeeth.map(tooth => <li key={tooth.numero} data-testid="estimate-row"><strong>{tooth.numero} · {tooth.nombre}</strong><span>{tooth.tratamiento}</span><b>{formatMoney(tooth.costoEstimado)} ARS</b></li>)}</ul> : <p>No hay dientes marcados.</p>}
      <p className="odontogram-total" data-testid="estimate-total">Total estimado <strong>{formatMoney(visibleTotal)} ARS</strong></p>
      {persisted || (!readOnly && saved) ? <p className="odontogram-draft">Registro inmutable #{(persisted || saved).id}</p> : !readOnly ? <p className="odontogram-draft">BORRADOR NO GUARDADO · aún sin confirmación de persistencia</p> : null}
    </section>
    {readOnly ? persisted ? <section className="odontogram-card" aria-label="Consentimiento registrado"><h2>Consentimiento registrado</h2>
      <p>{persisted.consentimientoAceptado ? 'Consentimiento aceptado' : 'Consentimiento no aceptado'} · versión {persisted.versionConsentimiento}</p>
      <p>{persisted.textoConsentimiento}</p>
      <p>La firma está reservada para odontología y administración.</p>
    </section> : null : <section className="odontogram-card" aria-label="Consentimiento y firma">
      <h2>Consentimiento y firma</h2>
      <p>Versión {demoMode ? `${VERSION} · demostración` : VERSION} · firma manuscrita electrónica</p>
      <p>{consentText}</p>
      <label className="odontogram-consent">
        <input type="checkbox" checked={accepted} disabled={(!verified && !demoMode) || !patientId || !teeth.length || saving} onChange={e => { revoke({ consent: false }); setAccepted(e.target.checked); setError('') }} />
        Acepto el consentimiento para este paciente y el presupuesto mostrado.
      </label>
      <p id="signature-help">Revise el resumen, acepte el consentimiento y firme con mouse o con el dedo. Si cambia el área de firma, deberá volver a firmar.</p>

      <div className="odontogram-signature-guide">
        {!patientId ? (
          <span className="odontogram-hint-tag hint-warning">⚠️ Seleccioná un paciente para habilitar la firma</span>
        ) : visibleTeeth.length === 0 ? (
          <span className="odontogram-hint-tag hint-warning">⚠️ Marcá al menos una pieza dental en el odontograma</span>
        ) : !accepted ? (
          <span className="odontogram-hint-tag hint-action">👉 Tildá "Acepto el consentimiento" o hacé clic en el recuadro para firmar</span>
        ) : signature ? (
          <span className="odontogram-hint-tag hint-success">✅ Firma capturada y vinculada al presupuesto actual</span>
        ) : (
          <span className="odontogram-hint-tag hint-ready">✍️ Dibujá tu firma en el recuadro y presioná "Capturar firma"</span>
        )}
      </div>

      <div
        ref={signatureBox}
        className={`odontogram-signature ${!canSign ? 'odontogram-signature-disabled' : ''}`}
        aria-disabled={!canSign}
        onClick={() => {
          if (!readOnly && patientId && teeth.length > 0 && !accepted && !saving) {
            setAccepted(true)
            setError('')
            setNotice('Consentimiento activado al seleccionar la firma.')
          }
        }}
      >
        <SignatureCanvas
          ref={signatureRef}
          clearOnResize={false}
          penColor="#0f172a"
          minWidth={0.8}
          maxWidth={2.8}
          onBegin={() => {
            if (!canSign) {
              if (!readOnly && patientId && teeth.length > 0 && !accepted) {
                setAccepted(true)
              } else {
                signatureRef.current?.clear()
                return
              }
            }
            revoke({ consent: false, clearCanvas: false })
          }}
          onEnd={() => { if (!canSign) signatureRef.current?.clear() }}
          canvasProps={{ width: 500, height: 180, className: 'odontogram-canvas', 'aria-label': 'Área para dibujar firma manuscrita', 'aria-describedby': 'signature-help' }}
        />
      </div>

      <div className="odontogram-actions">
        <button type="button" className="odontogram-capture-btn" disabled={!canSign} onClick={capture}>Capturar firma</button>
        <button type="button" disabled={saving} onClick={() => { revoke({ consent: false }); setError(''); setNotice('Firma eliminada.') }}>Limpiar firma</button>
      </div>
      {signature ? <figure className="odontogram-preview"><img src={signature.png} alt="Vista previa de la firma capturada" /><figcaption>Firma vinculada al presupuesto actual.</figcaption></figure> : null}
      <div className="odontogram-actions">
        <button type="button" className="odontogram-primary" disabled={demoMode || !canSign || !signature || !bearer || Boolean(saved)} onClick={save}>{demoMode ? 'Guardar requiere backend' : saving ? 'Guardando…' : 'Guardar odontograma'}</button>
        <button type="button" disabled={!signature || !accepted || !patientId || !teeth.length || saving} onClick={download}>Descargar PDF con Firma</button>
      </div>
      <p>{demoMode ? 'El PDF se descarga como borrador académico firmado y no se guarda en MySQL ni en el backend. No es un comprobante de pago.' : 'El PDF puede descargarse como borrador firmado; solo se informa guardado tras recibir HTTP 201 y verificar la respuesta. No es un comprobante de pago.'}</p>
    </section>}
  </main>
}

const STYLES = `
.odontogram-page{font-family:Inter,system-ui,sans-serif;color:#1E293B;max-width:1500px;margin:auto;padding:24px;line-height:1.5}
.odontogram-page *{box-sizing:border-box}.odontogram-page h1{font-size:clamp(1.6rem,3vw,2.3rem);font-weight:750;margin:4px 0;color:#1E293B}.odontogram-page h2{font-size:1.2rem;font-weight:700;margin:0 0 8px;color:#1E293B}.odontogram-page h3{font-size:.95rem;font-weight:650;margin:10px 0;color:#1E293B}.odontogram-page p{margin:6px 0 14px;color:#475569}.odontogram-eyebrow{font-size:.7rem;letter-spacing:.12em;font-weight:700;color:#1D4ED8!important}.odontogram-header{display:flex;justify-content:space-between;align-items:center;gap:16px;margin-bottom:20px}.odontogram-badge{background:#DBEAFE;color:#1D4ED8;border:1px solid rgba(29,78,216,0.25);padding:8px 14px;border-radius:24px;white-space:nowrap;font-weight:650;font-size:.85rem}
.odontogram-card{min-width:0;border:1px solid #94A3B8;border-radius:18px;padding:22px;background:rgba(226,232,240,0.86);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);margin-bottom:20px;box-shadow:0 4px 16px rgba(15,23,42,0.05)}
.odontogram-card-header{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:14px;margin-bottom:12px}
.odontogram-credentials{display:flex;flex-wrap:wrap;gap:16px;align-items:end}
.odontogram-credentials label{display:grid;gap:6px;flex:1;min-width:180px;font-size:.85rem;font-weight:600;color:#475569}
.odontogram-credentials input,.odontogram-credentials select{border:1px solid #94A3B8;border-radius:8px;padding:11px;width:100%;min-height:44px;color:#1E293B;background:rgba(255,255,255,0.9)}
.odontogram-access{width:100%;font-size:.8rem;margin:0!important;color:#475569}
.odontogram-workspace{display:grid;grid-template-columns:1fr;gap:20px}
.odontogram-page button{cursor:pointer;min-height:44px;border:1px solid #CBD5E1;border-radius:8px;padding:9px 14px;font-size:.9rem;background:white;color:#1E293B;font-weight:600}
.odontogram-page button:disabled{opacity:.55;cursor:not-allowed}
.odontogram-page button:focus-visible,.odontogram-page input:focus-visible,.odontogram-scroll:focus-visible{outline:3px solid #1D4ED8;outline-offset:3px}
.odontogram-scroll{overflow-x:auto;padding:4px 3px 14px}
.odontogram-arches{min-width:870px}
.odontogram-arch{display:grid;grid-template-columns:repeat(16,minmax(48px,1fr));gap:4px;min-height:166px;align-items:start}
.odontogram-page .odontogram-tooth{padding:5px 1px 7px;min-height:113px;border:1px solid #CBD5E1;background:rgba(255,255,255,0.9);display:flex;align-items:center;flex-direction:column;gap:1px;border-radius:8px}
.odontogram-tooth svg{width:38px;height:52px}
.odontogram-tooth span{font-size:.88rem;font-weight:750;color:#1E293B}
.odontogram-tooth small{font-size:.56rem;color:#475569;line-height:1.2;text-align:center;padding:0 2px}
.odontogram-page .odontogram-selected{border:2px solid #1D4ED8;background:#DBEAFE;box-shadow:0 0 0 2px rgba(29,78,216,0.25)}
.odontogram-legend{display:flex;flex-wrap:wrap;gap:12px;margin-top:14px;font-size:.8rem;color:#475569}
.odontogram-legend span{display:flex;gap:6px;align-items:center}
.odontogram-page i{display:inline-block;width:11px;height:11px;border-radius:50%;flex-shrink:0}
.odontogram-diagnosis dt{font-size:.75rem;color:#475569;margin-top:14px}
.odontogram-diagnosis dd{margin:3px 0;font-size:.9rem;color:#1E293B;font-weight:500}
.odontogram-conditions{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px}
.odontogram-conditions button{display:flex;align-items:center;gap:7px;padding:8px!important}
.odontogram-conditions button[aria-pressed=true]{border-color:#1D4ED8;background:#DBEAFE;color:#1D4ED8}
.odontogram-page .odontogram-link-button{border:0;text-decoration:underline;margin-top:10px;padding-left:0;color:#1D4ED8}
.odontogram-estimate{list-style:none;padding:0;margin:18px 0}
.odontogram-estimate li{display:grid;grid-template-columns:150px 1fr auto;gap:12px;border-bottom:1px solid #CBD5E1;padding:12px 0;font-size:.9rem}
.odontogram-estimate span{color:#475569}
.odontogram-total{display:flex;justify-content:space-between;gap:12px;padding:14px;background:#DBEAFE;border-radius:10px;font-size:1.15rem;color:#1D4ED8!important;border:1px solid rgba(29,78,216,0.25)}
.odontogram-draft{font-size:.8rem;font-weight:650;color:#475569}
.odontogram-consent{display:flex;gap:10px;align-items:center;font-weight:600;min-height:48px;margin:14px 0;color:#1E293B}
.odontogram-consent input{width:22px;height:22px;flex-shrink:0}
.odontogram-signature{border:1px dashed #94A3B8;border-radius:8px;width:100%;max-width:650px;height:182px;background:#ffffff;overflow:hidden}
.odontogram-canvas{display:block;width:100%;height:180px;touch-action:none}
.odontogram-signature-disabled{opacity:.6;cursor:pointer}
.odontogram-actions{display:flex;gap:12px;flex-wrap:wrap;margin:16px 0}
.odontogram-page .odontogram-primary{background:#1D4ED8;border-color:#1D4ED8;color:white}
.odontogram-page .odontogram-primary:hover{background:#1E40AF;border-color:#1E40AF}
.odontogram-preview{margin:16px 0}
.odontogram-preview img{max-width:100%;max-height:150px;border:1px solid #CBD5E1;background:white}
.odontogram-preview figcaption{font-size:.8rem;color:#475569}
.odontogram-error,.odontogram-notice{padding:14px;border-radius:8px}
.odontogram-error{background:#fef2f2;color:#991b1b!important;border:1px solid #fecaca}
.odontogram-notice{background:#ecfdf5;color:#065f46!important;border:1px solid #a7f3d0}
.odontogram-demo-patient-form{display:flex;flex:2;flex-wrap:wrap;align-items:end;gap:8px;min-width:min(100%,320px)}
.odontogram-demo-patient-form label{flex-basis:100%;min-width:0}
.odontogram-demo-patient-form input{flex:1;min-width:180px}
.odontogram-backend-link{display:inline-block;color:#1D4ED8;font-weight:700;text-decoration:underline;text-underline-offset:3px}
.odontogram-local-api-notice{width:100%;padding:12px 14px;border:1px solid #94A3B8;border-radius:8px;background:rgba(226,232,240,0.9);color:#1E293B!important;font-size:.86rem}
.odontogram-local-api-notice code{font-weight:700}

/* Controles de Vista 2D / 3D */
.odontogram-view-controls{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:10px}
.odontogram-control-group{display:flex;gap:8px;flex-wrap:wrap}
.odontogram-toggle-btn{border-radius:8px;padding:7px 12px!important;font-weight:600;font-size:0.82rem!important;border:1px solid #CBD5E1;background:rgba(255,255,255,0.9);color:#1E293B;min-height:36px!important;transition:all 0.15s ease}
.odontogram-toggle-btn.is-active{background:#1D4ED8!important;color:white!important;border-color:#1D4ED8!important}
.odontogram-rotation-box{display:flex;align-items:center;gap:8px;font-size:0.82rem;font-weight:600;color:#1D4ED8;background:#DBEAFE;padding:5px 10px;border-radius:8px;border:1px solid #CBD5E1}
.odontogram-rotation-box input{accent-color:#1D4ED8;width:120px;cursor:pointer}
.odontogram-scroll-3d{perspective:1100px;overflow-x:auto;padding:12px 4px 20px}
.is-3d-arch{transform-style:preserve-3d;transition:transform 0.2s ease}
.odontogram-tooth-3d{border-radius:44% 44% 28% 28%!important;background:linear-gradient(145deg,rgba(255,255,255,0.98),rgba(224,236,250,0.9))!important;box-shadow:inset 2px 1px 3px rgba(255,255,255,0.95),0 5px 8px rgba(15,23,42,0.12)!important}
.odontogram-tooth-3d:hover{transform:translateY(-2px) scale(1.03)!important;box-shadow:0 7px 12px rgba(15,23,42,0.18)!important}

/* Panel de Pacientes y Casos */
.odontogram-patients-panel{width:100%;margin-top:16px;border-top:1px solid #CBD5E1;padding-top:16px}
.odontogram-patients-header{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:10px;margin-bottom:12px}
.odontogram-patients-header h4{font-size:0.95rem;font-weight:700;color:#1D4ED8;margin:0}
.odontogram-panel-subtitle{font-size:0.78rem;color:#475569;margin:2px 0 0!important}
.odontogram-search-input{min-height:38px!important;padding:6px 12px!important;border:1px solid #CBD5E1!important;border-radius:8px!important;font-size:0.85rem!important;max-width:280px;background:rgba(255,255,255,0.95)}
.odontogram-patient-chips{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px}
.odontogram-patient-chip{display:flex;flex-direction:column;align-items:start;text-align:left;padding:7px 12px!important;border-radius:10px!important;border:1px solid #CBD5E1!important;background:rgba(255,255,255,0.85)!important;font-size:0.8rem!important;min-height:auto!important;transition:all 0.15s ease}
.odontogram-patient-chip:hover{border-color:#1D4ED8!important;background:#DBEAFE!important}
.odontogram-patient-chip.is-selected{border-color:#1D4ED8!important;background:#DBEAFE!important;color:#1D4ED8!important;box-shadow:0 0 0 2px #1D4ED8!important}
.odontogram-patient-chip strong{font-size:0.85rem;color:#1E293B}
.odontogram-patient-chip span{font-size:0.72rem;color:#475569}
.odontogram-selected-case{background:rgba(219,234,254,0.6);border:1px solid #CBD5E1;border-radius:12px;padding:12px 16px;margin-top:6px}
.odontogram-case-header{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:8px}
.odontogram-case-header h5{margin:0;font-size:0.92rem;color:#1D4ED8}
.odontogram-case-meta{font-size:0.76rem;color:#475569;margin:2px 0 0!important}
.odontogram-history-btn{font-size:0.8rem!important;min-height:34px!important;padding:5px 12px!important;border-color:#1D4ED8!important;color:#1D4ED8!important;background:white!important}
.odontogram-history-list{margin-top:10px;display:grid;gap:8px;border-top:1px dashed #CBD5E1;padding-top:10px}
.odontogram-history-item{display:flex;justify-content:space-between;align-items:center;background:white;padding:10px 14px;border-radius:8px;border:1px solid #CBD5E1;font-size:0.85rem}
.odontogram-history-date{font-size:0.75rem;color:#475569;margin-left:8px}
.odontogram-history-total{font-size:0.8rem;font-weight:700;color:#1D4ED8;margin-top:2px}
.odontogram-empty-history{font-size:0.78rem;font-style:italic;color:#475569;margin:4px 0!important}
.odontogram-btn-small{min-height:30px!important;padding:4px 10px!important;font-size:0.76rem!important;background:#1D4ED8!important;color:white!important;border-radius:6px!important;border:0!important}

/* Guía visual de firma */
.odontogram-signature-guide{margin-bottom:8px;font-size:0.82rem}
.odontogram-hint-tag{display:inline-block;padding:5px 12px;border-radius:6px;font-weight:600}
.hint-warning{background:#fef3c7;color:#92400e;border:1px solid #fde68a}
.hint-action{background:#fef9c3;color:#854d0e;border:1px dashed #eab308}
.hint-ready{background:#DBEAFE;color:#1D4ED8;border:1px solid #bfdbfe}
.hint-success{background:#dcfce7;color:#166534;border:1px solid #bbf7d0}
.odontogram-capture-btn{background:#1D4ED8!important;color:white!important;border-color:#1D4ED8!important}

/* Dark mode overrides */
html[data-theme="dark"] .odontogram-page{color:#f1f5f9}
html[data-theme="dark"] .odontogram-card{background:rgba(15,23,42,0.88)!important;border-color:rgba(51,65,85,0.7)!important;box-shadow:0 4px 20px rgba(0,0,0,0.4)!important;color:#f1f5f9!important}
html[data-theme="dark"] .odontogram-page p{color:#94a3b8!important}
html[data-theme="dark"] .odontogram-page h1,html[data-theme="dark"] .odontogram-page h2,html[data-theme="dark"] .odontogram-page h3{color:#f8fafc!important}
html[data-theme="dark"] .odontogram-credentials input,html[data-theme="dark"] .odontogram-credentials select{background:#0f172a!important;border-color:#334155!important;color:#f1f5f9!important}
html[data-theme="dark"] .odontogram-tooth{background:#1e293b!important;border-color:#334155!important;color:#f1f5f9!important}
html[data-theme="dark"] .odontogram-tooth small{color:#cbd5e1!important}
html[data-theme="dark"] .odontogram-tooth-3d{background:linear-gradient(145deg,#1e3a56,#12263d)!important;border-color:#475569!important;color:#f1f5f9!important;box-shadow:0 6px 10px rgba(0,0,0,0.4)!important}
html[data-theme="dark"] .odontogram-selected{background:#134e4a!important;border-color:#14b8a6!important;box-shadow:0 0 0 2px #0d9488!important}
html[data-theme="dark"] .odontogram-conditions button{background:#0f172a!important;border-color:#334155!important;color:#f1f5f9!important}
html[data-theme="dark"] .odontogram-page button{background:#1e293b;border-color:#475569;color:#f1f5f9}
html[data-theme="dark"] .odontogram-page button:hover{background:#334155}
html[data-theme="dark"] .odontogram-toggle-btn{background:#1e293b;border-color:#475569;color:#f1f5f9}
html[data-theme="dark"] .odontogram-toggle-btn.is-active{background:#0f766e!important;color:white!important}
html[data-theme="dark"] .odontogram-rotation-box{background:#134e4a;color:#5eead4}
html[data-theme="dark"] .odontogram-patients-panel{border-color:#334155}
html[data-theme="dark"] .odontogram-patients-header h4{color:#5eead4}
html[data-theme="dark"] .odontogram-panel-subtitle{color:#94a3b8}
html[data-theme="dark"] .odontogram-patient-chip{background:#1e293b!important;border-color:#334155!important;color:#f1f5f9!important}
html[data-theme="dark"] .odontogram-patient-chip span{color:#94a3b8}
html[data-theme="dark"] .odontogram-patient-chip.is-selected{background:#134e4a!important;border-color:#14b8a6!important;color:#5eead4!important}
html[data-theme="dark"] .odontogram-selected-case{background:rgba(19,78,74,0.4);border-color:#14b8a6}
html[data-theme="dark"] .odontogram-case-header h5{color:#5eead4}
html[data-theme="dark"] .odontogram-case-meta{color:#cbd5e1}
html[data-theme="dark"] .odontogram-history-item{background:#0f172a;border-color:#334155;color:#f1f5f9}
html[data-theme="dark"] .odontogram-history-btn{background:#1e293b!important;color:#5eead4!important;border-color:#14b8a6!important}
html[data-theme="dark"] .odontogram-signature{background:#ffffff!important;border-color:#64748b}
html[data-theme="dark"] .odontogram-estimate li{border-color:#334155!important}
html[data-theme="dark"] .odontogram-total{background:rgba(13,148,136,0.25)!important;border:1px solid rgba(20,184,166,0.4)!important;color:#5eead4!important}
html[data-theme="dark"] .odontogram-badge{background:rgba(13,148,136,0.25);color:#5eead4;border:1px solid rgba(20,184,166,0.35)}

@media(max-width:640px){.odontogram-page{padding:12px}.odontogram-card{padding:16px}.odontogram-header{display:block}.odontogram-badge{display:inline-block;margin:4px 0}.odontogram-conditions{grid-template-columns:1fr 1fr}.odontogram-estimate li{grid-template-columns:1fr auto}.odontogram-estimate span{grid-column:1/-1;grid-row:2}.odontogram-actions button{flex:1;min-width:145px}.odontogram-total{font-size:1rem}}
`
