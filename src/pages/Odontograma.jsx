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

function ToothIcon({ color, lower, molar }) {
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
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const signatureRef = useRef(null), signatureBox = useRef(null), savingRef = useRef(false), revision = useRef(0)
  const patientId = demoMode ? patientNumber(selectedDemoPatientId) : patientNumber(pacienteId ?? manualPatient)
  const selectedDemoPatient = demoPatients.find(patient => patient.id === patientId)
  const bearer = (token || manualToken).trim().replace(/^Bearer\s+/i, '')
  const baseUrl = apiUrl.replace(/\/$/, '')
  const teeth = ALL_TEETH.filter(number => chart[number]).map(numero => ({ numero, ...CONDITION[chart[numero]] }))
  const total = teeth.reduce((sum, item) => sum + item.costoEstimado, 0)
  const diagnosis = CONDITION[chart[selected]]
  const canSign = (demoMode || verified) && patientId && teeth.length > 0 && accepted && !saving
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
  }, [])

  function assign(code) {
    if (saving || chart[selected] === code) return
    const nextChart = { ...chart, [selected]: code }
    setChart(nextChart)
    if (demoMode) setDemoCharts(previous => ({ ...previous, [patientId]: nextChart }))
    revoke(); setError(''); setNotice('')
  }
  function removeSelectedCondition() {
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
  function capture() {
    if (!canSign) return
    if (!signatureRef.current || signatureRef.current.isEmpty()) { setError('Dibuje una firma antes de capturarla.'); return }
    const canvas = signatureRef.current.getCanvas()
    setSignature({ png: signatureRef.current.toDataURL('image/png'), ratio: canvas ? canvas.width / canvas.height : 500 / 180 })
    setError(''); setNotice('Firma capturada para este paciente, presupuesto y consentimiento.')
  }
  async function save() {
    if (demoMode || savingRef.current || !canSign || !signature || !bearer) return
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

  return <main className="odontogram-page">
    <style>{STYLES}</style>
    <header className="odontogram-header"><div><p className="odontogram-eyebrow">NOVADENT · SIMULACIÓN ACADÉMICA</p><h1>Odontograma y presupuesto</h1>
      <p>Evaluación manual de dentición permanente. Sin diagnóstico automático ni cobros.</p></div><span className="odontogram-badge">32 piezas · FDI</span></header>
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
        {!token ? <label>Token Bearer (solo en memoria)<input type="password" autoComplete="off" value={manualToken} disabled={saving} onChange={e => setManualToken(e.target.value)} aria-label="Token Bearer (solo en memoria)" placeholder="Pegue el JWT de Swagger" /></label> : <p>Token proporcionado por la aplicación (no se almacena).</p>}
        <p className="odontogram-access">{verified ? 'Catálogo verificado' : 'Se requiere JWT clínico para verificar el catálogo y firmar.'}{!patientId ? ' Ingrese un ID de paciente positivo.' : ''}</p>
        {backendMode ? <p className="odontogram-local-api-notice" role="note">Este modo usa la API en <code>/api</code>. Para conectarse a MySQL local, ejecutá el frontend con Vite y Spring Boot en tu PC. Una página abierta desde Vercel no puede acceder al backend ni a la base local de tu computadora.</p> : null}
      </>}
    </section>
    {error ? <p className="odontogram-error" role="alert">{error}</p> : null}
    {notice ? <p className="odontogram-notice" role="status">{notice}</p> : null}
    <div className="odontogram-workspace">
      <section className="odontogram-card" aria-label="Odontograma FDI">
        <h2>Seleccione una pieza</h2><p>Vista del profesional: derecha del paciente a la izquierda. Seleccionar no registra una afección.</p>
        <div className="odontogram-scroll" tabIndex={0} role="region" aria-label="Arcadas dentales, desplazamiento horizontal disponible">
          <div className="odontogram-arches">{ARCHES.map((arch, index) => <div key={index}>
            <h3>{index === 0 ? 'Arcada superior' : 'Arcada inferior'}</h3>
            <div className={`odontogram-arch ${index === 1 ? 'odontogram-lower' : ''}`}>
              {arch.map((number, position) => { const condition = CONDITION[chart[number]], color = condition?.color || '#94a3b8'
                const offset = Math.round(46 * Math.sin(Math.PI * position / 15))
                return <button key={number} type="button" className={`odontogram-tooth ${selected === number ? 'odontogram-selected' : ''}`} style={{ marginTop: index === 0 ? 46 - offset : offset, '--tooth-color': color }}
                  disabled={saving} aria-label={`Diente ${number}: ${condition?.nombre || 'Sin evaluar'}`} aria-pressed={selected === number} onClick={() => setSelected(number)}>
                  <span>{number}</span><ToothIcon color={color} lower={index === 1} molar={number % 10 >= 6} /><small>{condition?.nombre || 'Sin evaluar'}</small>
                </button>
              })}
            </div>
          </div>)}</div>
        </div>
        <div className="odontogram-legend" aria-label="Leyenda de afecciones">{CATALOG.map(item => <span key={item.afeccion}><i style={{ background: item.color }} />{item.nombre}</span>)}<span><i style={{ background: '#94a3b8' }} />Sin evaluar</span></div>
      </section>
      <section className="odontogram-card odontogram-diagnosis" aria-label="Ficha de la pieza seleccionada">
        <p className="odontogram-eyebrow">FICHA DE LA PIEZA</p><h2>Diente {selected}</h2><p>{toothName(selected)}</p>
        <dl><dt>Afección seleccionada</dt><dd>{diagnosis?.nombre || 'Sin evaluar'}</dd><dt>Descripción</dt><dd>{diagnosis?.descripcion || 'No se ha registrado una evaluación.'}</dd>
          <dt>Tratamiento ilustrativo</dt><dd>{diagnosis?.tratamiento || 'A seleccionar por el profesional.'}</dd><dt>Costo estimado</dt><dd>{diagnosis ? `${formatMoney(diagnosis.costoEstimado)} ARS` : 'Sin estimar'}</dd></dl>
        <h3>Asignar afección</h3><div className="odontogram-conditions">{CATALOG.map(item => <button type="button" key={item.afeccion} disabled={saving} aria-label={`Asignar ${item.nombre}`} aria-pressed={chart[selected] === item.afeccion} onClick={() => assign(item.afeccion)}><i style={{ background: item.color }} />{item.nombre}</button>)}</div>
        <button type="button" className="odontogram-link-button" disabled={!chart[selected] || saving} onClick={removeSelectedCondition}>Quitar marca del diente {selected}</button>
      </section>
    </div>
    <section className="odontogram-card" aria-label="Resumen a firmar"><h2>Presupuesto ilustrativo</h2><p>Solo incluye piezas marcadas explícitamente. Los valores requieren validación profesional.</p>
      {teeth.length ? <ul className="odontogram-estimate">{teeth.map(tooth => <li key={tooth.numero} data-testid="estimate-row"><strong>{tooth.numero} · {tooth.nombre}</strong><span>{tooth.tratamiento}</span><b>{formatMoney(tooth.costoEstimado)} ARS</b></li>)}</ul> : <p>No hay dientes marcados.</p>}
      <p className="odontogram-total" data-testid="estimate-total">Total estimado <strong>{formatMoney(total)} ARS</strong></p>
      <p className="odontogram-draft">{saved ? `Registro inmutable #${saved.id}` : 'BORRADOR NO GUARDADO · aún sin confirmación de persistencia'}</p>
    </section>
    <section className="odontogram-card" aria-label="Consentimiento y firma"><h2>Consentimiento y firma</h2><p>Versión {demoMode ? `${VERSION} · demostración` : VERSION} · firma manuscrita electrónica</p><p>{consentText}</p>
      <label className="odontogram-consent"><input type="checkbox" checked={accepted} disabled={(!verified && !demoMode) || !patientId || !teeth.length || saving} onChange={e => { revoke({ consent: false }); setAccepted(e.target.checked); setError('') }} />Acepto el consentimiento para este paciente y el presupuesto mostrado.</label>
      <p id="signature-help">Revise el resumen, acepte el consentimiento y firme con mouse o con el dedo. Si cambia el área de firma, deberá volver a firmar.</p>
      <div ref={signatureBox} className={`odontogram-signature ${!canSign ? 'odontogram-signature-disabled' : ''}`} aria-disabled={!canSign}>
        <SignatureCanvas ref={signatureRef} clearOnResize={false} penColor="#172554" minWidth={0.6} maxWidth={2.4}
          onBegin={() => { if (!canSign) { signatureRef.current?.clear(); return }; revoke({ consent: false, clearCanvas: false }) }}
          onEnd={() => { if (!canSign) signatureRef.current?.clear() }}
          canvasProps={{ width: 500, height: 180, className: 'odontogram-canvas', 'aria-label': 'Área para dibujar firma manuscrita', 'aria-describedby': 'signature-help' }} />
      </div>
      <div className="odontogram-actions"><button type="button" disabled={!canSign} onClick={capture}>Capturar firma</button><button type="button" disabled={saving} onClick={() => { revoke({ consent: false }); setError(''); setNotice('Firma eliminada.') }}>Limpiar firma</button></div>
      {signature ? <figure className="odontogram-preview"><img src={signature.png} alt="Vista previa de la firma capturada" /><figcaption>Firma vinculada al presupuesto actual.</figcaption></figure> : null}
      <div className="odontogram-actions"><button type="button" className="odontogram-primary" disabled={demoMode || !canSign || !signature || !bearer || Boolean(saved)} onClick={save}>{demoMode ? 'Guardar requiere backend' : saving ? 'Guardando…' : 'Guardar odontograma'}</button>
        <button type="button" disabled={!signature || !accepted || !patientId || !teeth.length || saving} onClick={download}>Descargar PDF con Firma</button></div>
      <p>{demoMode ? 'El PDF se descarga como borrador académico firmado y no se guarda en MySQL ni en el backend. No es un comprobante de pago.' : 'El PDF puede descargarse como borrador firmado; solo se informa guardado tras recibir HTTP 201 y verificar la respuesta. No es un comprobante de pago.'}</p>
    </section>
  </main>
}

const STYLES = `
.odontogram-page{font-family:Inter,system-ui,sans-serif;color:#172554;max-width:1500px;margin:auto;padding:24px;line-height:1.5}
.odontogram-page *{box-sizing:border-box}.odontogram-page h1{font-size:clamp(1.6rem,3vw,2.3rem);font-weight:750;margin:4px 0}.odontogram-page h2{font-size:1.2rem;font-weight:700;margin:0 0 8px}.odontogram-page h3{font-size:.95rem;font-weight:650;margin:10px 0}.odontogram-page p{margin:6px 0 14px;color:#475569}.odontogram-eyebrow{font-size:.7rem;letter-spacing:.12em;font-weight:700;color:#0f766e!important}.odontogram-header{display:flex;justify-content:space-between;align-items:center;gap:16px;margin-bottom:20px}.odontogram-badge{background:#ccfbf1;color:#115e59;padding:8px 14px;border-radius:24px;white-space:nowrap;font-weight:650;font-size:.85rem}.odontogram-card{min-width:0;border:1px solid #dbe3ee;border-radius:16px;padding:22px;background:white;margin-bottom:20px;box-shadow:0 3px 12px #17255406}.odontogram-credentials{display:flex;flex-wrap:wrap;gap:16px;align-items:end}.odontogram-credentials label{display:grid;gap:6px;flex:1;min-width:180px;font-size:.85rem;font-weight:600}.odontogram-credentials input{border:1px solid #94a3b8;border-radius:8px;padding:11px;width:100%;min-height:44px;color:#172554}.odontogram-access{width:100%;font-size:.8rem;margin:0!important}.odontogram-workspace{display:grid;grid-template-columns:1fr;gap:20px}.odontogram-page button{cursor:pointer;min-height:44px;border:1px solid #cbd5e1;border-radius:8px;padding:9px 14px;font-size:.9rem;background:white;color:#172554;font-weight:600}.odontogram-page button:disabled{opacity:.55;cursor:not-allowed}.odontogram-page button:focus-visible,.odontogram-page input:focus-visible,.odontogram-scroll:focus-visible{outline:3px solid #0d9488;outline-offset:3px}.odontogram-scroll{overflow-x:auto;padding:4px 3px 14px}.odontogram-arches{min-width:870px}.odontogram-arch{display:grid;grid-template-columns:repeat(16,minmax(48px,1fr));gap:4px;min-height:166px;align-items:start}.odontogram-page .odontogram-tooth{padding:5px 1px 7px;min-height:113px;border:1px solid transparent;background:#f8fafc;display:flex;align-items:center;flex-direction:column;gap:1px}.odontogram-tooth svg{width:38px;height:52px}.odontogram-tooth span{font-size:.88rem;font-weight:750}.odontogram-tooth small{font-size:.56rem;color:#334155;line-height:1.2}.odontogram-page .odontogram-selected{border:2px solid #0f766e;background:#f0fdfa;box-shadow:0 0 0 2px #ccfbf1}.odontogram-legend{display:flex;flex-wrap:wrap;gap:12px;margin-top:14px;font-size:.8rem}.odontogram-legend span{display:flex;gap:6px;align-items:center}.odontogram-page i{display:inline-block;width:11px;height:11px;border-radius:50%;flex-shrink:0}.odontogram-diagnosis dt{font-size:.75rem;color:#64748b;margin-top:14px}.odontogram-diagnosis dd{margin:3px 0;font-size:.9rem}.odontogram-conditions{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px}.odontogram-conditions button{display:flex;align-items:center;gap:7px;padding:8px!important}.odontogram-conditions button[aria-pressed=true]{border-color:#0f766e;background:#f0fdfa}.odontogram-page .odontogram-link-button{border:0;text-decoration:underline;margin-top:10px;padding-left:0}.odontogram-estimate{list-style:none;padding:0;margin:18px 0}.odontogram-estimate li{display:grid;grid-template-columns:150px 1fr auto;gap:12px;border-bottom:1px solid #e2e8f0;padding:12px 0;font-size:.9rem}.odontogram-estimate span{color:#475569}.odontogram-total{display:flex;justify-content:space-between;gap:12px;padding:14px;background:#f0fdfa;border-radius:10px;font-size:1.15rem;color:#115e59!important}.odontogram-draft{font-size:.8rem;font-weight:650}.odontogram-consent{display:flex;gap:10px;align-items:center;font-weight:600;min-height:48px;margin:14px 0}.odontogram-consent input{width:22px;height:22px;flex-shrink:0}.odontogram-signature{border:1px dashed #64748b;border-radius:8px;width:100%;max-width:650px;height:182px;background:#f8fafc;overflow:hidden}.odontogram-canvas{display:block;width:100%;height:180px;touch-action:none}.odontogram-signature-disabled{pointer-events:none;opacity:.5}.odontogram-actions{display:flex;gap:12px;flex-wrap:wrap;margin:16px 0}.odontogram-page .odontogram-primary{background:#0f766e;border-color:#0f766e;color:white}.odontogram-preview{margin:16px 0}.odontogram-preview img{max-width:100%;max-height:150px;border:1px solid #cbd5e1;background:white}.odontogram-preview figcaption{font-size:.8rem;color:#64748b}.odontogram-error,.odontogram-notice{padding:14px;border-radius:8px}.odontogram-error{background:#fef2f2;color:#991b1b!important;border:1px solid #fecaca}.odontogram-notice{background:#ecfdf5;color:#065f46!important;border:1px solid #a7f3d0}@media(max-width:640px){.odontogram-page{padding:12px}.odontogram-card{padding:16px}.odontogram-header{display:block}.odontogram-badge{display:inline-block;margin:4px 0}.odontogram-conditions{grid-template-columns:1fr 1fr}.odontogram-estimate li{grid-template-columns:1fr auto}.odontogram-estimate span{grid-column:1/-1;grid-row:2}.odontogram-actions button{flex:1;min-width:145px}.odontogram-total{font-size:1rem}}
.odontogram-credentials select{border:1px solid #94a3b8;border-radius:8px;padding:11px;width:100%;min-height:44px;color:#172554}.odontogram-demo-patient-form{display:flex;flex:2;flex-wrap:wrap;align-items:end;gap:8px;min-width:min(100%,320px)}.odontogram-demo-patient-form label{flex-basis:100%;min-width:0}.odontogram-demo-patient-form input{flex:1;min-width:180px}
.odontogram-backend-link{display:inline-block;color:#0f766e;font-weight:700;text-decoration:underline;text-underline-offset:3px}.odontogram-local-api-notice{width:100%;padding:12px 14px;border:1px solid #bfdbfe;border-radius:8px;background:#eff6ff;color:#1e3a8a!important;font-size:.86rem}.odontogram-local-api-notice code{font-weight:700}
`
