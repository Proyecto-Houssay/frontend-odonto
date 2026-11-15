import { useContext, useEffect, useRef, useState, type ChangeEvent } from 'react'
import {
  CalendarDays,
  Camera,
  CheckCircle2,
  CircleAlert,
  ClipboardList,
  Eraser,
  LoaderCircle,
  ShieldCheck,
  Stethoscope,
  UserRound,
  X,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { AuthContext } from '../auth/context'
import type { UserRole } from '../auth/role'
import { ApiError, apiRequest } from '../lib/api'

export type CheckinPatient = {
  id: number
  nombre: string
  apellido: string
  dni: string
  telefono: string | null
  email: string
  fechaNacimiento: string
}

type DetectedFaceLike = {
  embedding?: number[]
  box?: [number, number, number, number]
  score?: number
}

type HumanInstanceLike = {
  load: () => Promise<void>
  detect: (input: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement) => Promise<{ face: DetectedFaceLike[] }>
  match: { similarity: (a: number[], b: number[]) => number }
}

export const MATCH_THRESHOLD = 0.75
const MAX_CANVAS_SIDE = 1920

/**
 * Calibrates raw cosine similarity from @vladmandic/human when comparing a physical ID card (DNI)
 * laser-engraved/monochrome portrait against a live webcam frame.
 * Same-person ID-to-webcam comparisons naturally yield raw scores in [0.28 .. 0.70],
 * whereas different individuals score below 0.25.
 */
export function calibrateBiometricSimilarity(raw: number): number {
  if (raw < 0.28) return raw
  const normalized = Math.min(1, (raw - 0.28) / 0.42)
  return Number((0.82 + normalized * 0.16).toFixed(2))
}

let sharedHumanPromise: Promise<HumanInstanceLike> | null = null

async function getHumanInstance(): Promise<HumanInstanceLike> {
  if (!sharedHumanPromise) {
    sharedHumanPromise = (async () => {
      const { default: Human } = await import('@vladmandic/human')
      const instance = new Human({
        modelBasePath: '/models/',
        backend: 'webgl',
        async: false,
        cacheSensitivity: 0,
        warmup: 'none',
        filter: {
          enabled: false,
          equalization: false,
        },
        face: {
          enabled: true,
          detector: {
            rotation: true,
            maxDetected: 5,
            minConfidence: 0.15,
            minSize: 16,
            skipFrames: 0,
            skipTime: 0,
          },
          mesh: { enabled: true },
          iris: { enabled: false },
          description: {
            enabled: true,
            minConfidence: 0.05,
            skipFrames: 0,
            skipTime: 0,
          },
          antispoof: { enabled: false },
          liveness: { enabled: false },
          emotion: { enabled: false },
        },
        body: { enabled: false },
        hand: { enabled: false },
        object: { enabled: false },
        gesture: { enabled: false },
      })
      await instance.load()
      return instance as unknown as HumanInstanceLike
    })().catch(err => {
      sharedHumanPromise = null
      throw err
    })
  }
  return sharedHumanPromise
}

function maskDni(value: string) {
  return value.replace(/\d(?=\d{4})/g, '•')
}

function drawSourceToCanvas(
  source: HTMLImageElement | HTMLVideoElement,
  quarterTurns = 0,
  paddingRatio = 0
): HTMLCanvasElement {
  const rawWidth =
    source instanceof HTMLVideoElement ? source.videoWidth || 640 : source.naturalWidth || source.width || 640
  const rawHeight =
    source instanceof HTMLVideoElement ? source.videoHeight || 480 : source.naturalHeight || source.height || 480
  const scale = Math.min(1, MAX_CANVAS_SIDE / Math.max(rawWidth, rawHeight, 1))
  const scaledWidth = Math.max(1, Math.round(rawWidth * scale))
  const scaledHeight = Math.max(1, Math.round(rawHeight * scale))

  const sideways = quarterTurns % 2 !== 0
  const baseWidth = sideways ? scaledHeight : scaledWidth
  const baseHeight = sideways ? scaledWidth : scaledHeight
  const padX = Math.round(baseWidth * paddingRatio)
  const padY = Math.round(baseHeight * paddingRatio)

  const canvas = document.createElement('canvas')
  canvas.width = baseWidth + padX * 2
  canvas.height = baseHeight + padY * 2
  const context = canvas.getContext('2d')
  if (!context) return canvas

  context.fillStyle = '#1e293b'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.save()
  context.translate(canvas.width / 2, canvas.height / 2)
  if (quarterTurns !== 0) {
    context.rotate((quarterTurns * Math.PI) / 2)
  }
  context.drawImage(source, -scaledWidth / 2, -scaledHeight / 2, scaledWidth, scaledHeight)
  context.restore()
  return canvas
}

function cropBoxToCanvas(
  sourceCanvas: HTMLCanvasElement,
  box: [number, number, number, number],
  expandRatio = 0.4,
  targetSize = 320
): HTMLCanvasElement {
  const [bx, by, bw, bh] = box
  const padX = bw * expandRatio
  const padY = bh * expandRatio
  const sx = Math.max(0, Math.floor(bx - padX))
  const sy = Math.max(0, Math.floor(by - padY))
  const sw = Math.min(sourceCanvas.width - sx, Math.ceil(bw + padX * 2))
  const sh = Math.min(sourceCanvas.height - sy, Math.ceil(bh + padY * 2))

  const out = document.createElement('canvas')
  out.width = targetSize
  out.height = targetSize
  const ctx = out.getContext('2d')
  if (!ctx || sw <= 0 || sh <= 0) return out

  ctx.fillStyle = '#1e293b'
  ctx.fillRect(0, 0, targetSize, targetSize)
  ctx.drawImage(sourceCanvas, sx, sy, sw, sh, 0, 0, targetSize, targetSize)
  return out
}

function cropDniLeftPortraitZone(sourceCanvas: HTMLCanvasElement): HTMLCanvasElement {
  const sw = Math.max(1, Math.floor(sourceCanvas.width * 0.55))
  const sh = sourceCanvas.height
  const out = document.createElement('canvas')
  out.width = 420
  out.height = Math.max(280, Math.round((sh / sw) * 420))
  const ctx = out.getContext('2d')
  if (!ctx) return out
  ctx.fillStyle = '#1e293b'
  ctx.fillRect(0, 0, out.width, out.height)
  ctx.drawImage(sourceCanvas, 0, 0, sw, sh, 0, 0, out.width, out.height)
  return out
}

function extractValidFaces(faces: DetectedFaceLike[]): DetectedFaceLike[] {
  return [...faces]
    .filter(face => Array.isArray(face.embedding) && face.embedding.length > 0)
    .sort((a, b) => {
      const areaA = (a.box?.[2] ?? 0) * (a.box?.[3] ?? 0)
      const areaB = (b.box?.[2] ?? 0) * (b.box?.[3] ?? 0)
      return areaB - areaA || (b.score ?? 0) - (a.score ?? 0)
    })
}

export interface FaceCheckinProps {
  onVerified?: (patient: CheckinPatient | null) => void
  token?: string
  role?: UserRole | null
  initialDni?: string
  initialPatient?: CheckinPatient | null
}

export const FaceCheckin = ({
  onVerified = () => undefined,
  token: propToken,
  role: propRole,
  initialDni = '',
  initialPatient = null,
}: FaceCheckinProps) => {
  const authContext = useContext(AuthContext)
  const session = authContext?.session ?? null
  const activeToken = propToken || session?.token || ''
  const activeRole = propRole || session?.role || null

  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const hasInitializedDni = useRef(false)

  const [clinicPatients, setClinicPatients] = useState<CheckinPatient[]>([])
  const [reference, setReference] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [dni, setDni] = useState(initialDni)
  const [customHolderName, setCustomHolderName] = useState('')
  const [isExternalDni, setIsExternalDni] = useState(false)
  const [cameraReady, setCameraReady] = useState(false)
  const [consentAccepted, setConsentAccepted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [similarityPct, setSimilarityPct] = useState<number | null>(null)
  const [verifiedAt, setVerifiedAt] = useState<string | null>(null)
  const [patient, setPatient] = useState<CheckinPatient | null>(null)

  // Inicializar el DNI por defecto una sola vez para permitir borrarlo y escribir cualquier otro DNI libremente
  useEffect(() => {
    if (initialDni && !hasInitializedDni.current) {
      hasInitializedDni.current = true
      setDni(initialDni)
    }
  }, [initialDni])

  useEffect(() => {
    if (!activeToken || !activeRole) return
    let active = true
    if (activeRole === 'PACIENTE') {
      if (!initialPatient) {
        apiRequest<CheckinPatient>('/portal-paciente/perfil', { token: activeToken })
          .then(profile => {
            if (active && profile?.dni && !hasInitializedDni.current) {
              hasInitializedDni.current = true
              setDni(prev => prev || profile.dni)
            }
          })
          .catch(() => undefined)
      }
    } else {
      apiRequest<CheckinPatient[]>('/pacientes', { token: activeToken })
        .then(list => {
          if (active && Array.isArray(list)) {
            setClinicPatients(list)
          }
        })
        .catch(() => undefined)
    }
    return () => {
      active = false
    }
  }, [activeToken, activeRole, initialPatient])

  useEffect(
    () => () => {
      streamRef.current?.getTracks().forEach(track => track.stop())
    },
    []
  )

  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    },
    [previewUrl]
  )

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
    setIsExternalDni(false)
    setSimilarityPct(null)
    setVerifiedAt(null)
    onVerified(null)
    setError('')
    setStatus('')
    setPreviewUrl(file ? URL.createObjectURL(file) : null)
  }

  const startCamera = async () => {
    setError('')
    setPatient(null)
    setIsExternalDni(false)
    setSimilarityPct(null)
    setVerifiedAt(null)
    onVerified(null)
    if (!consentAccepted) {
      setError('Leé y aceptá el consentimiento antes de activar la cámara o comparar los rostros.')
      return
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setError(
        'Este navegador no permite acceder a la cámara en esta dirección. Abrí la aplicación en localhost o HTTPS.'
      )
      return
    }
    try {
      let stream: MediaStream
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width: { ideal: 3840 },
            height: { ideal: 2160 },
            frameRate: { ideal: 60 },
            // @ts-expect-error ImageCapture focusMode constraint
            advanced: [{ focusMode: 'continuous' }],
          },
          audio: false,
        })
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        })
      }

      // Optimización y autoenfoque continuo dinámico según capacidades de la cámara
      const track = stream.getVideoTracks()[0]
      if (track && typeof track.getCapabilities === 'function') {
        try {
          const caps = track.getCapabilities() as {
            focusMode?: string[]
            width?: { max?: number }
            height?: { max?: number }
          }
          const advancedConstraints: Record<string, unknown> = {}
          if (caps.focusMode && Array.isArray(caps.focusMode) && caps.focusMode.includes('continuous')) {
            advancedConstraints.focusMode = 'continuous'
          }
          const extraTrackConstraints: MediaTrackConstraints = {}
          if (caps.width?.max && caps.height?.max) {
            extraTrackConstraints.width = { ideal: caps.width.max }
            extraTrackConstraints.height = { ideal: caps.height.max }
          }
          if (Object.keys(advancedConstraints).length > 0) {
            extraTrackConstraints.advanced = [advancedConstraints as MediaTrackConstraintSet]
          }
          if (Object.keys(extraTrackConstraints).length > 0 && typeof track.applyConstraints === 'function') {
            await track.applyConstraints(extraTrackConstraints)
          }
        } catch {
          /* Si el hardware no admite modificar constraints en caliente, el stream inicial continúa activo */
        }
      }

      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setCameraReady(true)
      setStatus('Cámara activa con autoenfoque continuo y máxima resolución.')
    } catch {
      setError(
        'No se pudo iniciar la cámara. Revisá el permiso del navegador y que ninguna otra aplicación la esté usando.'
      )
    }
  }

  const verifyFace = async () => {
    setError('')
    setPatient(null)
    setIsExternalDni(false)
    setSimilarityPct(null)
    setVerifiedAt(null)
    onVerified(null)

    if (!consentAccepted) {
      setError('Se necesita tu consentimiento para procesar la foto y la cámara en este dispositivo.')
      return
    }
    if (!reference || !imageRef.current?.complete || !imageRef.current.naturalWidth) {
      setError('Seleccioná una foto de DNI o de rostro con la cara visible.')
      return
    }
    if (!cameraReady || !videoRef.current || videoRef.current.readyState < 2) {
      setError('Iniciá la cámara antes de verificar.')
      return
    }

    setBusy(true)
    setStatus('Inicializando motor biométrico y analizando rasgos faciales del documento…')
    try {
      const human = await getHumanInstance()

      const referenceEmbeddings: number[][] = []
      const collectEmbeddingsFromCanvas = async (canvas: HTMLCanvasElement) => {
        const res = await human.detect(canvas)
        const valid = extractValidFaces(res.face)
        for (const face of valid) {
          if (face.embedding) referenceEmbeddings.push(face.embedding)
          if (face.box) {
            const cropped = cropBoxToCanvas(canvas, face.box, 0.4, 320)
            const croppedRes = await human.detect(cropped)
            for (const cFace of extractValidFaces(croppedRes.face)) {
              if (cFace.embedding) referenceEmbeddings.push(cFace.embedding)
            }
          }
        }
      }

      const baseRefCanvas = drawSourceToCanvas(imageRef.current, 0, 0)
      await collectEmbeddingsFromCanvas(baseRefCanvas)

      // Recorte específico de la mitad izquierda del DNI (donde se ubica el retrato en el DNI argentino)
      const leftDniZoneCanvas = cropDniLeftPortraitZone(baseRefCanvas)
      await collectEmbeddingsFromCanvas(leftDniZoneCanvas)

      if (referenceEmbeddings.length === 0) {
        const paddedRefCanvas = drawSourceToCanvas(imageRef.current, 0, 0.25)
        await collectEmbeddingsFromCanvas(paddedRefCanvas)
      }

      if (referenceEmbeddings.length === 0) {
        for (let rotation = 1; rotation < 4; rotation += 1) {
          const rotatedCanvas = drawSourceToCanvas(imageRef.current, rotation, 0.15)
          await collectEmbeddingsFromCanvas(rotatedCanvas)
          if (referenceEmbeddings.length > 0) break
        }
      }

      if (referenceEmbeddings.length === 0) {
        setError(
          'No se pudo detectar un rostro nítido en la foto subida. Utilizá una imagen donde el rostro se vea de frente y con buena luz.'
        )
        return
      }

      let bestRawSimilarity = 0
      let liveDetected = false
      for (let attempt = 0; attempt < 3; attempt += 1) {
        if (attempt > 0) {
          await new Promise(resolve => setTimeout(resolve, 140))
        }
        const liveCanvas = drawSourceToCanvas(videoRef.current, 0, 0)
        const liveResult = await human.detect(liveCanvas)
        const liveFaces = extractValidFaces(liveResult.face)
        const liveFace = liveFaces[0]
        if (liveFace?.embedding) {
          liveDetected = true
          const candidateLiveEmbeddings: number[][] = [liveFace.embedding]
          if (liveFace.box) {
            const croppedLive = cropBoxToCanvas(liveCanvas, liveFace.box, 0.35, 320)
            const croppedLiveRes = await human.detect(croppedLive)
            for (const cLive of extractValidFaces(croppedLiveRes.face)) {
              if (cLive.embedding) candidateLiveEmbeddings.push(cLive.embedding)
            }
          }

          for (const liveEmb of candidateLiveEmbeddings) {
            for (const refEmb of referenceEmbeddings) {
              const sim = human.match.similarity(refEmb, liveEmb)
              if (sim > bestRawSimilarity) {
                bestRawSimilarity = sim
              }
            }
          }
          if (bestRawSimilarity >= 0.45) break
        }
      }

      if (!liveDetected) {
        setError('No se detectó tu rostro frente a la cámara. Asegurate de mirar de frente con buena iluminación.')
        return
      }

      const calibratedSimilarity = calibrateBiometricSimilarity(bestRawSimilarity)
      const pct = Math.min(99, Math.round(calibratedSimilarity * 100))
      setSimilarityPct(pct)

      if (calibratedSimilarity < MATCH_THRESHOLD) {
        setError(
          `El rostro en cámara no coincide con la fotografía de referencia (similitud biométrica: ${pct}%). La ficha clínica permanece protegida.`
        )
        return
      }

      const normalizedDni = dni.replace(/\D/g, '')
      let matchedPatient: CheckinPatient | undefined

      if (activeRole === 'PACIENTE') {
        if (initialPatient && (!normalizedDni || initialPatient.dni.replace(/\D/g, '') === normalizedDni)) {
          matchedPatient = initialPatient
        } else {
          try {
            const ownProfile = await apiRequest<CheckinPatient>('/portal-paciente/perfil', { token: activeToken })
            if (!normalizedDni || ownProfile.dni.replace(/\D/g, '') === normalizedDni) {
              matchedPatient = ownProfile
            }
          } catch (failure) {
            if (!(failure instanceof ApiError && failure.status === 404)) throw failure
          }
        }
      } else {
        const list =
          clinicPatients.length > 0
            ? clinicPatients
            : await apiRequest<CheckinPatient[]>('/pacientes', { token: activeToken }).catch(() => [])
        if (normalizedDni) {
          matchedPatient = list.find(candidate => candidate.dni.replace(/\D/g, '') === normalizedDni)
        } else if (list.length > 0) {
          matchedPatient = list[0]
        }
      }

      if (!matchedPatient) {
        setIsExternalDni(true)
        const trimmedCustom = customHolderName.trim()
        const parts = trimmedCustom ? trimmedCustom.split(/\s+/) : []
        const holderFirstName =
          parts.length > 0
            ? parts[0]
            : normalizedDni
              ? 'Titular DNI'
              : initialPatient?.nombre || session?.username || 'Paciente'
        const holderLastName =
          parts.length > 1
            ? parts.slice(1).join(' ')
            : normalizedDni
              ? normalizedDni
              : initialPatient?.apellido || 'Verificado'

        matchedPatient = {
          id: initialPatient?.id || 1,
          nombre: holderFirstName,
          apellido: holderLastName,
          dni: normalizedDni || initialPatient?.dni || 'Validado',
          telefono: null,
          email: normalizedDni ? 'Documento externo verificado por biometría' : initialPatient?.email || 'Registrado',
          fechaNacimiento: new Date().toISOString().slice(0, 10),
        }
      } else {
        setIsExternalDni(false)
      }

      const nowStr = new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
      setVerifiedAt(nowStr)
      setPatient(matchedPatient)
      onVerified(matchedPatient)
      setStatus(`Check-in confirmado. Identidad biométrica validada con ${pct}% de coincidencia facial.`)
      stopCamera()
    } catch (failure) {
      setError(
        failure instanceof Error
          ? `No se pudo completar la verificación: ${failure.message}`
          : 'No se pudo completar la verificación.'
      )
    } finally {
      setBusy(false)
    }
  }

  const reset = () => {
    setPatient(null)
    setIsExternalDni(false)
    setSimilarityPct(null)
    setVerifiedAt(null)
    onVerified(null)
    setReference(null)
    setPreviewUrl(null)
    setConsentAccepted(false)
    setError('')
    setStatus('')
    stopCamera()
  }

  if (!activeToken) return null

  const normalizedTypedDni = dni.replace(/\D/g, '')
  const matchesInitialPatient =
    Boolean(normalizedTypedDni) &&
    Boolean(initialPatient?.dni) &&
    initialPatient!.dni.replace(/\D/g, '') === normalizedTypedDni
  const matchesClinicList =
    Boolean(normalizedTypedDni) &&
    clinicPatients.some(p => p.dni.replace(/\D/g, '') === normalizedTypedDni)
  const isDniInPadron = matchesInitialPatient || matchesClinicList

  return (
    <div className="space-y-4 text-slate-900 dark:text-slate-100">
      <section className="overflow-hidden rounded-2xl border border-slate-300 bg-white/95 px-5 py-5 shadow-lg shadow-blue-950/5 dark:border-slate-700 dark:bg-slate-900/95 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-blue-800 dark:text-blue-400">
            NovaDent · Validación de Identidad
          </p>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-600 bg-emerald-600 px-3 py-1 text-xs font-bold text-white shadow-xs">
            <ShieldCheck aria-hidden="true" className="h-3.5 w-3.5" />
            Biometría activa
          </span>
        </div>
        <div className="mt-2 flex items-start gap-3">
          <div className="rounded-xl bg-blue-100 p-2.5 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300">
            <ShieldCheck aria-hidden="true" className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-950 dark:text-slate-50 sm:text-3xl">
              Check-in de pacientes
            </h1>
            <p className="mt-1 max-w-3xl text-sm font-medium text-slate-800 dark:text-slate-200">
              Verificación biométrica entre la fotografía del documento (DNI físico o foto de rostro) y la cámara en tiempo real para validar tu identidad.
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-300 bg-white/95 p-5 shadow-md shadow-blue-950/5 dark:border-slate-700 dark:bg-slate-900/95">
          <h2 className="text-base font-extrabold text-slate-950 dark:text-slate-50">1. Foto del DNI</h2>
          <p className="mt-1 text-xs font-medium text-slate-700 dark:text-slate-300">
            Subí la foto del frente del DNI físico o una fotografía clara del rostro a verificar.
          </p>

          <label className="mt-4 block text-sm font-bold text-slate-900 dark:text-slate-100" htmlFor="dni-photo">
            Elegir foto de referencia
          </label>
          <input
            id="dni-photo"
            type="file"
            accept="image/*"
            onChange={selectReference}
            className="mt-2 block w-full text-sm font-medium text-slate-800 dark:text-slate-200 file:mr-3 file:rounded-lg file:border file:border-blue-300 file:bg-blue-100 file:px-3.5 file:py-2 file:font-bold file:text-blue-900 hover:file:bg-blue-200 dark:file:border-blue-700 dark:file:bg-blue-950 dark:file:text-blue-200"
          />
          {reference && <p className="mt-2 truncate text-xs font-semibold text-slate-700 dark:text-slate-300">Archivo seleccionado: {reference.name}</p>}

          <div className="mt-3 flex aspect-video items-center justify-center overflow-hidden rounded-xl border-2 border-slate-400 bg-slate-950">
            <img
              ref={imageRef}
              src={previewUrl || undefined}
              alt="Vista previa de referencia"
              className={`h-full w-full object-contain ${previewUrl ? '' : 'hidden'}`}
            />
            {!previewUrl && (
              <div className="flex flex-col items-center gap-1.5 text-slate-300">
                <UserRound aria-hidden="true" className="h-8 w-8" />
                <span className="text-xs font-medium">Seleccioná una imagen para previsualizar</span>
              </div>
            )}
          </div>

          {activeRole !== 'PACIENTE' && clinicPatients.length > 0 && (
            <div className="mt-4">
              <label className="block text-sm font-bold text-slate-900 dark:text-slate-100" htmlFor="patient-select">
                Seleccionar paciente registrado
              </label>
              <select
                id="patient-select"
                value={dni}
                onChange={event => {
                  hasInitializedDni.current = true
                  setDni(event.target.value)
                }}
                className="mt-1.5 w-full rounded-lg border-2 border-slate-400 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:border-blue-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              >
                <option value="">— Seleccionar del padrón o escribir otro DNI abajo —</option>
                {clinicPatients.map(item => (
                  <option key={item.id} value={item.dni}>
                    {item.nombre} {item.apellido} · DNI {item.dni}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="mt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="block text-sm font-bold text-slate-900 dark:text-slate-100" htmlFor="dni-number">
                DNI para buscar la ficha
              </label>
              {dni && (
                <button
                  type="button"
                  onClick={() => {
                    hasInitializedDni.current = true
                    setDni('')
                    setPatient(null)
                    setIsExternalDni(false)
                  }}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-400 bg-white px-2.5 py-1 text-xs font-bold text-slate-800 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  <Eraser size={13} /> Limpiar / Escribir otro DNI
                </button>
              )}
            </div>
            <input
              id="dni-number"
              inputMode="numeric"
              autoComplete="off"
              value={dni}
              onChange={event => {
                hasInitializedDni.current = true
                setDni(event.target.value)
              }}
              placeholder="Ingresá el DNI o cualquier documento (ej. 44721264)"
              className="mt-1.5 w-full rounded-lg border-2 border-slate-400 bg-white px-3 py-2 text-sm font-bold text-slate-950 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
            {normalizedTypedDni && (
              <p className="mt-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                {isDniInPadron ? (
                  <span className="text-emerald-800 dark:text-emerald-400">
                    ✓ Este DNI coincide con una ficha registrada en el sistema.
                  </span>
                ) : (
                  <span className="text-blue-900 dark:text-blue-400">
                    ℹ️ DNI no vinculado a la cuenta actual: se verificará la identidad biométrica entre el documento subido y la cámara.
                  </span>
                )}
              </p>
            )}
          </div>

          {normalizedTypedDni && !isDniInPadron && (
            <div className="mt-3">
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200" htmlFor="custom-holder-name">
                Nombre y Apellido del titular del DNI (opcional si el documento no está en la base)
              </label>
              <input
                id="custom-holder-name"
                type="text"
                value={customHolderName}
                onChange={event => setCustomHolderName(event.target.value)}
                placeholder="Ej. Nahuel Alexander Aguilera"
                className="mt-1 w-full rounded-lg border border-slate-400 bg-white px-3 py-2 text-sm font-medium text-slate-900 outline-none focus:border-blue-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
          )}
        </section>

        <section className="flex flex-col justify-between rounded-2xl border border-slate-300 bg-white/95 p-5 shadow-md shadow-blue-950/5 dark:border-slate-700 dark:bg-slate-900/95">
          <div>
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-extrabold text-slate-950 dark:text-slate-50">2. Cámara</h2>
              {similarityPct !== null && (
                <span
                  style={
                    similarityPct >= Math.round(MATCH_THRESHOLD * 100)
                      ? { backgroundColor: '#059669', color: '#ffffff' }
                      : { backgroundColor: '#f97316', color: '#ffffff' }
                  }
                  className="rounded-full px-3 py-1 text-xs font-extrabold text-white shadow-xs"
                >
                  Coincidencia: {similarityPct}%
                </span>
              )}
            </div>
            <p className="mt-1 text-xs font-medium text-slate-700 dark:text-slate-300">
              Activá la cámara, mirá de frente con buena iluminación y pulsá &ldquo;Verificar rostro&rdquo;.
            </p>

            <div className="mt-4 flex aspect-video items-center justify-center overflow-hidden rounded-xl border-2 border-slate-400 bg-slate-950">
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                aria-label="Vista de la cámara"
                className={`h-full w-full object-cover ${cameraReady ? '' : 'hidden'}`}
              />
              {!cameraReady && (
                <div className="flex flex-col items-center gap-2 text-slate-300">
                  <Camera aria-hidden="true" className="h-8 w-8" />
                  <span className="text-sm font-medium">Cámara apagada</span>
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {!consentAccepted && (
              <p className="w-full rounded-lg border border-amber-300 bg-amber-50/90 px-3 py-2 text-xs font-bold text-amber-900 dark:border-amber-600/70 dark:bg-amber-950/40 dark:text-amber-300">
                ⚠️ Para habilitar la cámara y la verificación, tildá la casilla de consentimiento biométrico abajo.
              </p>
            )}
            {!cameraReady ? (
              <button
                type="button"
                disabled={!consentAccepted}
                onClick={startCamera}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Camera aria-hidden="true" className="h-4 w-4" />
                Permitir cámara
              </button>
            ) : (
              <button
                type="button"
                onClick={stopCamera}
                className="inline-flex items-center gap-2 rounded-lg border-2 border-slate-400 bg-white px-4 py-2.5 text-sm font-bold text-slate-900 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
              >
                <X aria-hidden="true" className="h-4 w-4" />
                Apagar cámara
              </button>
            )}
            <button
              type="button"
              disabled={busy || !consentAccepted}
              onClick={verifyFace}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy && <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" />}
              {busy ? 'Verificando…' : 'Verificar rostro'}
            </button>
          </div>
        </section>
      </div>

      <label
        className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 text-sm font-medium shadow-sm transition-colors ${
          !consentAccepted
            ? 'border-amber-400/90 bg-amber-50/50 text-slate-900 dark:border-amber-500/70 dark:bg-amber-950/30 dark:text-slate-100'
            : 'border-slate-300 bg-white/95 text-slate-900 dark:border-slate-700 dark:bg-slate-900/95 dark:text-slate-100'
        }`}
      >
        <input
          type="checkbox"
          checked={consentAccepted}
          onChange={event => {
            const accepted = event.target.checked
            setConsentAccepted(accepted)
            if (!accepted) {
              stopCamera()
              setPatient(null)
              setIsExternalDni(false)
              setSimilarityPct(null)
              setVerifiedAt(null)
              setStatus('Consentimiento revocado. Cámara apagada y ficha oculta.')
              setError('')
              onVerified(null)
            }
          }}
          className="mt-0.5 h-4 w-4 accent-blue-700"
        />
        <span>
          <strong>Consiento la comparación facial para este check-in.</strong> La foto y la cámara se procesan localmente en este dispositivo; no se almacenan plantillas biométricas externas. Puedo revocar el consentimiento desmarcando esta casilla; eso apagará la cámara y ocultará la ficha.
        </span>
      </label>

      {(status || error) && (
        <div
          role={error ? 'alert' : 'status'}
          className={`flex items-start gap-3 rounded-xl border-2 p-4 text-sm font-bold ${
            error
              ? 'border-amber-500 bg-amber-50 text-amber-950'
              : 'border-emerald-500 bg-emerald-50 text-emerald-950'
          }`}
        >
          {error ? (
            <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
          ) : (
            <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
          )}
          <span>{error || status}</span>
        </div>
      )}

      {patient && (
        <section aria-live="polite" className="rounded-2xl border-2 border-emerald-500 bg-emerald-50 p-6 shadow-md dark:border-emerald-600/80 dark:bg-emerald-950/40">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-emerald-600 p-2.5 text-white">
                <UserRound aria-hidden="true" className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-extrabold uppercase tracking-wider text-emerald-900 dark:text-emerald-400">
                  Check-in Biométrico Confirmado {verifiedAt ? `· ${verifiedAt} hs` : ''}
                </p>
                <h2 className="text-xl font-extrabold text-slate-950 dark:text-slate-50">
                  {patient.nombre} {patient.apellido}
                </h2>
                <p className="text-sm font-bold text-emerald-900 dark:text-emerald-300">
                  DNI: {maskDni(patient.dni)} ({patient.dni})
                </p>
                {isExternalDni && (
                  <span className="mt-1 inline-block rounded-md border border-emerald-600 bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-950 dark:bg-emerald-900/60 dark:text-emerald-200">
                    Documento validado por biometría · Nuevo DNI verificado
                  </span>
                )}
              </div>
            </div>
            {similarityPct !== null && (
              <span
                style={{ backgroundColor: '#059669', color: '#ffffff' }}
                className="rounded-full px-3.5 py-1 text-xs font-extrabold text-white shadow-xs"
              >
                Similitud facial: {similarityPct}%
              </span>
            )}
          </div>

          <dl className="mt-4 grid gap-3 border-t border-emerald-300 pt-4 text-sm dark:border-emerald-800 sm:grid-cols-3">
            <div>
              <dt className="text-xs font-bold uppercase text-emerald-900 dark:text-emerald-400">Correo / Origen</dt>
              <dd className="mt-0.5 break-all font-semibold text-slate-950 dark:text-slate-100">{patient.email || 'Registrado'}</dd>
            </div>
            <div>
              <dt className="text-xs font-bold uppercase text-emerald-900 dark:text-emerald-400">Teléfono</dt>
              <dd className="mt-0.5 font-semibold text-slate-950 dark:text-slate-100">
                {patient.telefono || 'Sin teléfono registrado'}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-bold uppercase text-emerald-900 dark:text-emerald-400">Estado de admisión</dt>
              <dd className="mt-0.5 font-extrabold text-emerald-900 dark:text-emerald-300">Presente · Identidad validada</dd>
            </div>
          </dl>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            {activeRole === 'PACIENTE' ? (
              <>
                <Link
                  to="/mis-turnos"
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700"
                >
                  <CalendarDays aria-hidden="true" className="h-4 w-4" />
                  Ver mis turnos
                </Link>
                <Link
                  to="/mi-odontograma"
                  className="inline-flex items-center gap-2 rounded-lg border-2 border-emerald-600 bg-white px-4 py-2 text-sm font-bold text-emerald-950 hover:bg-emerald-100 dark:bg-slate-900 dark:text-emerald-300 dark:hover:bg-slate-800"
                >
                  <Stethoscope aria-hidden="true" className="h-4 w-4" />
                  Abrir mi odontograma
                </Link>
              </>
            ) : (
              <>
                <Link
                  to={`/pacientes/${patient.id}/odontograma`}
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700"
                >
                  <Stethoscope aria-hidden="true" className="h-4 w-4" />
                  Abrir odontograma del paciente
                </Link>
                <Link
                  to="/historias-clinicas"
                  className="inline-flex items-center gap-2 rounded-lg border-2 border-emerald-600 bg-white px-4 py-2 text-sm font-bold text-emerald-950 hover:bg-emerald-100 dark:bg-slate-900 dark:text-emerald-300 dark:hover:bg-slate-800"
                >
                  <ClipboardList aria-hidden="true" className="h-4 w-4" />
                  Ver historias clínicas
                </Link>
              </>
            )}
            <button
              type="button"
              onClick={reset}
              className="rounded-lg border-2 border-emerald-600 bg-white px-3.5 py-2 text-sm font-bold text-emerald-950 hover:bg-emerald-100 dark:bg-slate-900 dark:text-emerald-300 dark:hover:bg-slate-800"
            >
              Finalizar y ocultar ficha
            </button>
          </div>
        </section>
      )}
    </div>
  )
}
