import { useContext, useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Camera, CheckCircle2, CircleAlert, LoaderCircle, ShieldCheck, UserRound, X } from 'lucide-react'
import { AuthContext } from '../auth/context'
import { ApiError, apiRequest } from '../lib/api'

type Patient = {
  id: number
  nombre: string
  apellido: string
  dni: string
  telefono: string | null
  email: string
  fechaNacimiento: string
}

const MATCH_THRESHOLD = 0.5
const LIVE_THRESHOLD = 0.6
const DEMO_PATIENT = { id: 9100, nombre: 'Ficha de prueba (turno)', demo: true as const }

function maskDni(value: string) {
  return value.replace(/\d(?=\d{4})/g, '•')
}

function rotateImage(image: HTMLImageElement, quarterTurns: number) {
  const canvas = document.createElement('canvas')
  const sideways = quarterTurns % 2 !== 0
  canvas.width = sideways ? image.naturalHeight : image.naturalWidth
  canvas.height = sideways ? image.naturalWidth : image.naturalHeight
  const context = canvas.getContext('2d')
  if (!context) return canvas
  context.translate(canvas.width / 2, canvas.height / 2)
  context.rotate((quarterTurns * Math.PI) / 2)
  context.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2)
  return canvas
}

export const FaceCheckin = ({ onVerified }: { onVerified: (patient: Patient | typeof DEMO_PATIENT | null) => void }) => {
  const session = useContext(AuthContext)?.session ?? null
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const imageUrlRef = useRef<string | null>(null)
  const [reference, setReference] = useState<File | null>(null)
  const [dni, setDni] = useState('')
  const [cameraReady, setCameraReady] = useState(false)
  const [consentAccepted, setConsentAccepted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [patient, setPatient] = useState<Patient | null>(null)
  const [demoAccessAvailable, setDemoAccessAvailable] = useState(false)
  const [demoRecordOpen, setDemoRecordOpen] = useState(false)

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach(track => track.stop())
    if (imageUrlRef.current) URL.revokeObjectURL(imageUrlRef.current)
  }, [])

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(track => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setCameraReady(false)
  }

  const selectReference = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null
    setReference(file)
    setPatient(null)
    setDemoAccessAvailable(false)
    setDemoRecordOpen(false)
    onVerified(null)
    setError('')
    setStatus('')
    if (imageUrlRef.current) URL.revokeObjectURL(imageUrlRef.current)
    imageUrlRef.current = file ? URL.createObjectURL(file) : null
    if (imageRef.current && imageUrlRef.current) {
      imageRef.current.src = imageUrlRef.current
    }
  }

  const startCamera = async () => {
    setError('')
    setPatient(null)
    setDemoAccessAvailable(false)
    setDemoRecordOpen(false)
    onVerified(null)
    if (!consentAccepted) {
      setError('Leé y aceptá el consentimiento antes de activar la cámara o comparar los rostros.')
      return
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Este navegador no permite acceder a la cámara en esta dirección. Abrí la aplicación en localhost o HTTPS.')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setCameraReady(true)
      setStatus('Cámara lista. El video se procesa solo en este dispositivo.')
    } catch {
      setError('No se pudo iniciar la cámara. Revisá el permiso del navegador y que ninguna otra aplicación la esté usando.')
    }
  }

  const verifyFace = async () => {
    setError('')
    setPatient(null)
    setDemoAccessAvailable(false)
    setDemoRecordOpen(false)
    onVerified(null)
    if (!consentAccepted) {
      setError('Se necesita tu consentimiento para procesar la foto y la cámara en este dispositivo.')
      return
    }
    if (!reference || !imageRef.current?.complete || !imageRef.current.naturalWidth) {
      setError('Seleccioná una foto de DNI con el rostro visible.')
      return
    }
    if (!cameraReady || !videoRef.current || videoRef.current.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      setError('Iniciá la cámara antes de verificar.')
      return
    }
    if (!dni.trim()) {
      setError('Ingresá el DNI para buscar la ficha después de verificar el rostro.')
      return
    }

    setBusy(true)
    setStatus('Cargando el reconocimiento facial local…')
    try {
      const { default: Human } = await import('@vladmandic/human')
      const human = new Human({
        modelBasePath: '/models/',
        backend: 'webgl',
        face: {
          enabled: true,
          detector: { rotation: true, maxDetected: 2, minConfidence: 0.25, minSize: 20 },
          mesh: { enabled: false },
          description: { enabled: true, minConfidence: 0.2 },
          antispoof: { enabled: true },
          liveness: { enabled: true },
          iris: { enabled: true },
          emotion: { enabled: false },
        },
        body: { enabled: false },
        hand: { enabled: false },
        object: { enabled: false },
        gesture: { enabled: false },
      })
      await human.load()
      await human.warmup()
      setStatus('Comparando el rostro de la foto con la cámara…')
      const referenceEmbeddings: number[][] = []
      for (let rotation = 0; rotation < 4; rotation += 1) {
        const orientedImage = rotation === 0 ? imageRef.current : rotateImage(imageRef.current, rotation)
        const result = await human.detect(orientedImage)
        if (result.face.length === 1 && result.face[0].embedding) {
          referenceEmbeddings.push(result.face[0].embedding)
        }
      }
      const liveResult = await human.detect(videoRef.current)
      const liveFace = liveResult.face.length === 1 ? liveResult.face[0] : null
      if (referenceEmbeddings.length === 0 || !liveFace?.embedding) {
        setError('No se pudo verificar. Asegurate de que haya un solo rostro visible, bien iluminado y enfocado en ambas imágenes.')
        return
      }
      if ((liveFace.real ?? 0) < LIVE_THRESHOLD || (liveFace.live ?? 0) < LIVE_THRESHOLD) {
        setError('No se pudo confirmar que el rostro frente a la cámara sea una persona presente. La ficha permanece oculta.')
        return
      }
      const similarity = Math.max(...referenceEmbeddings.map(embedding => human.match.similarity(embedding, liveFace.embedding!)))
      if (similarity < MATCH_THRESHOLD) {
        setError('El rostro no coincide con la foto seleccionada. La ficha permanece oculta.')
        return
      }

      setStatus('Rostro coincidente. Buscando la ficha…')
      const normalizedDni = dni.replace(/\D/g, '')
      let match: Patient | undefined
      if (session?.role === 'PACIENTE') {
        try {
          const ownProfile = await apiRequest<Patient>('/pacientes/mi-ficha', { token: session.token })
          if (ownProfile.dni.replace(/\D/g, '') === normalizedDni) match = ownProfile
        } catch (failure) {
          if (!(failure instanceof ApiError && failure.status === 404)) throw failure
        }
      } else {
        const patients = await apiRequest<Patient[]>('/pacientes', { token: session?.token })
        match = patients.find(candidate => candidate.dni.replace(/\D/g, '') === normalizedDni)
      }
      if (!match) {
        setDemoAccessAvailable(true)
        setStatus('El rostro coincide, pero ese DNI no tiene una ficha en el backend. Podés abrir la ficha local de demostración.')
        stopCamera()
        return
      }
      setPatient(match)
      onVerified(match)
      setStatus('Identidad verificada para esta demostración.')
      stopCamera()
    } catch (failure) {
      setError(failure instanceof Error ? `No se pudo completar la verificación: ${failure.message}` : 'No se pudo completar la verificación.')
    } finally {
      setBusy(false)
    }
  }

  const reset = () => {
    setPatient(null)
    setDemoAccessAvailable(false)
    setDemoRecordOpen(false)
    onVerified(null)
    setReference(null)
    setDni('')
    setConsentAccepted(false)
    setError('')
    setStatus('')
    stopCamera()
    if (imageUrlRef.current) URL.revokeObjectURL(imageUrlRef.current)
    imageUrlRef.current = null
    if (imageRef.current) imageRef.current.removeAttribute('src')
  }

  if (!session) return null

  return (
    <section className="mx-auto max-w-4xl space-y-6">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex items-start gap-4">
          <div className="rounded-xl bg-blue-50 p-3 text-blue-700"><ShieldCheck aria-hidden="true" className="h-6 w-6" /></div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Check-in de pacientes</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">La ficha permanece oculta hasta comparar el rostro de la foto del DNI con la cámara y encontrar una coincidencia.</p>
          </div>
        </div>
      </header>

      <div className="grid gap-5 md:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-slate-900">1. Foto del DNI</h2>
          <p className="mt-1 text-sm text-slate-500">La imagen solo se usa en esta pestaña y no se sube al servidor.</p>
          <label className="mt-4 block text-sm font-medium text-slate-700" htmlFor="dni-photo">Elegir foto de referencia</label>
          <input id="dni-photo" type="file" accept="image/*" onChange={selectReference} className="mt-2 block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:font-medium file:text-blue-700 hover:file:bg-blue-100" />
          {reference && <p className="mt-2 truncate text-xs text-slate-500">Archivo seleccionado: {reference.name}</p>}
          <label className="mt-4 block text-sm font-medium text-slate-700" htmlFor="dni-number">DNI para buscar la ficha</label>
          <input id="dni-number" inputMode="numeric" autoComplete="off" value={dni} onChange={event => setDni(event.target.value)} placeholder="Ingresá el DNI" className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
          <img ref={imageRef} alt="" className="hidden" />
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-slate-900">2. Cámara</h2>
          <p className="mt-1 text-sm text-slate-500">La cámara se activa solo cuando pulses el botón y aceptes el permiso.</p>
          <div className="mt-4 flex aspect-video items-center justify-center overflow-hidden rounded-xl bg-slate-950">
            <video ref={videoRef} autoPlay muted playsInline aria-label="Vista de la cámara" className={`h-full w-full object-cover ${cameraReady ? '' : 'hidden'}`} />
            {!cameraReady && <div className="flex flex-col items-center gap-2 text-slate-400"><Camera aria-hidden="true" className="h-8 w-8" /><span className="text-sm">Cámara apagada</span></div>}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {!cameraReady ? <button type="button" disabled={!consentAccepted} onClick={startCamera} className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"><Camera aria-hidden="true" className="h-4 w-4" />Permitir cámara</button> : <button type="button" onClick={stopCamera} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"><X aria-hidden="true" className="h-4 w-4" />Apagar cámara</button>}
            <button type="button" disabled={busy || !consentAccepted} onClick={verifyFace} className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60">{busy && <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" />}{busy ? 'Verificando…' : 'Verificar rostro'}</button>
          </div>
        </section>
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
        <input type="checkbox" checked={consentAccepted} onChange={event => {
          const accepted = event.target.checked
          setConsentAccepted(accepted)
          if (!accepted) {
            stopCamera()
            setPatient(null)
            setDemoAccessAvailable(false)
            setDemoRecordOpen(false)
            setStatus('Consentimiento revocado. Cámara apagada y ficha oculta.')
            setError('')
            onVerified(null)
          }
        }} className="mt-0.5 h-4 w-4 accent-blue-700" />
        <span><strong>Consiento la comparación facial para este check-in.</strong> La foto y la cámara se procesan en este navegador; no se envían al backend ni se guardan plantillas faciales. Puedo revocar el consentimiento desmarcando esta casilla; eso apagará la cámara y ocultará la ficha.</span>
      </label>

      {(status || error) && <div role={error ? 'alert' : 'status'} className={`flex items-start gap-3 rounded-xl border p-4 text-sm ${error ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-blue-200 bg-blue-50 text-blue-900'}`}>{error ? <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" /> : <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />}{error || status}</div>}

      {patient && <section aria-live="polite" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
        <div className="flex items-center gap-3"><UserRound aria-hidden="true" className="h-6 w-6 text-emerald-700" /><div><h2 className="font-bold text-emerald-950">{patient.nombre} {patient.apellido}</h2><p className="text-sm text-emerald-800">DNI: {maskDni(patient.dni)}</p></div></div>
        <p className="mt-4 text-sm text-emerald-900">Coincidencia facial para check-in. Verificá la identidad presencialmente antes de consultar información clínica.</p>
        <button type="button" onClick={reset} className="mt-4 rounded-lg border border-emerald-300 px-3 py-2 text-sm font-semibold text-emerald-900 hover:bg-emerald-100">Finalizar y ocultar ficha</button>
      </section>}

      {demoAccessAvailable && !demoRecordOpen && <section className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
        <h2 className="font-semibold text-blue-950">Ficha de prueba disponible</h2>
        <p className="mt-1 text-sm text-blue-900">Esta ficha es un ejemplo local y no corresponde a un registro encontrado en el backend.</p>
        <button type="button" onClick={() => { setDemoRecordOpen(true); onVerified(DEMO_PATIENT); setStatus('Se abrió la ficha demo local después de la coincidencia facial.') }} className="mt-3 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800">Abrir ficha de prueba</button>
      </section>}

      {demoRecordOpen && <section aria-live="polite" className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
        <p className="text-xs font-bold uppercase tracking-wide text-amber-800">Solo demostración local</p>
        <h2 className="mt-1 font-bold text-amber-950">Ficha de prueba (turno)</h2>
        <p className="mt-2 text-sm text-amber-900"><strong>Diente 16:</strong> fractura marcada en el odontograma demo.</p>
        <p className="mt-1 text-sm text-amber-900"><strong>Turno de prueba:</strong> mañana a las 10:00, hora local. No se reservó en la agenda del consultorio.</p>
        <p className="mt-3 text-xs text-amber-800">Esta información no está vinculada a la identidad reconocida ni a una ficha clínica real.</p>
        <button type="button" onClick={reset} className="mt-4 rounded-lg border border-amber-300 px-3 py-2 text-sm font-semibold text-amber-950 hover:bg-amber-100">Finalizar y ocultar ficha</button>
      </section>}

      <p className="rounded-xl bg-slate-100 p-4 text-xs leading-5 text-slate-600">Prototipo de demostración: la comparación facial puede fallar con fotos borrosas, giradas o con poca luz, y no equivale a una verificación oficial de identidad. Los modelos se cargan desde esta aplicación; el reconocimiento se ejecuta en el navegador.</p>
    </section>
  )
}
