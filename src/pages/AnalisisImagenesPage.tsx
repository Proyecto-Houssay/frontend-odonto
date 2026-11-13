import { useCallback, useEffect, useState, type ChangeEvent, type DragEvent, type FormEvent } from 'react'
import {
  AlertCircle,
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  FileImage,
  ImageUp,
  LoaderCircle,
  RefreshCw,
  ScanEye,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  X,
} from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { apiRequest, errorMessage } from '../lib/api'

type Catalog = { estadoServicio: string; versionModelo: string; almacenamientoDisponible?: boolean }
type RadiographAnalysis = {
  diagnosticoSugerido: string
  modeloUtilizado: string
  fechaAnalisis: string
  recomendaciones?: string
  resultadoProveedor?: Record<string, unknown> | null
}
  diagnosticoSugerido: string
  modeloUtilizado: string
  fechaAnalisis: string
  resultadoProveedor?: Record<string, unknown> | null
}
type Coverage = 'SUPERIOR' | 'INFERIOR' | 'AMBAS' | 'INDETERMINADA'
type OrthodonticGuidance = {
  alcance: string
  recomendacion: string
  alternativasAConversar: string[]
  profesionalRecomendado: string
  profesionalesDisponibles: { id: number; nombre: string; email?: string; telefono?: string; especialidad: string }[]
  aviso: string
}

const coverageOptions: { value: Coverage; label: string }[] = [
  { value: 'INDETERMINADA', label: 'A determinar en consulta' },
  { value: 'SUPERIOR', label: 'Arcada superior' },
  { value: 'INFERIOR', label: 'Arcada inferior' },
  { value: 'AMBAS', label: 'Ambas arcadas' },
]

export function AnalisisImagenesPage() {
  const { token } = useAuth()
  const [catalog, setCatalog] = useState<Catalog | null>(null)
  const [catalogError, setCatalogError] = useState('')
  const [loadingCatalog, setLoadingCatalog] = useState(true)
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [fileError, setFileError] = useState('')
  const [caseLabel, setCaseLabel] = useState('')
  const [coverage, setCoverage] = useState<Coverage>('INDETERMINADA')
  const [observations, setObservations] = useState('')
  const [guidance, setGuidance] = useState<OrthodonticGuidance | null>(null)
  const [guidanceError, setGuidanceError] = useState('')
  const [loadingGuidance, setLoadingGuidance] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [imageUrl, setImageUrl] = useState('')
  const [radiographResult, setRadiographResult] = useState<string | null>(null)
  const [radiographError, setRadiographError] = useState('')
  const [loadingRadiograph, setLoadingRadiograph] = useState(false)

  const loadCatalog = useCallback(async () => {
    if (!token) return
    setLoadingCatalog(true)
    setCatalogError('')
    try {
      setCatalog(await apiRequest<Catalog>('/ia/diagnostico-imagen/catalogo', token))
    } catch (error) {
      setCatalogError(errorMessage(error))
    } finally {
      setLoadingCatalog(false)
    }
  }, [token])

  useEffect(() => { void loadCatalog() }, [loadCatalog])

  useEffect(() => {
    if (!file || !file.type.startsWith('image/')) {
      setPreviewUrl('')
      return
    }
    const localUrl = URL.createObjectURL(file)
    setPreviewUrl(localUrl)
    return () => URL.revokeObjectURL(localUrl)
  }, [file])

  function acceptFile(nextFile?: File) {
    setFileError('')
    setGuidance(null)
    if (!nextFile) return
    const supportedImageType = ['image/jpeg', 'image/png', 'image/webp'].includes(nextFile.type)
    const isDicom = nextFile.type === 'application/dicom' || /\.(dcm|dicom)$/i.test(nextFile.name)
    const allowed = supportedImageType || isDicom
    if (!allowed) {
      setFileError('Elegí una imagen (JPG, PNG, WebP o DICOM).')
      return
    }
    if (nextFile.size > 25 * 1024 * 1024) {
      setFileError('El archivo supera el límite de 25 MB para la vista previa local.')
      return
    }
    setFile(nextFile)
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    acceptFile(event.target.files?.[0])
    event.target.value = ''
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault()
    setDragging(false)
    acceptFile(event.dataTransfer.files[0])
  }

  async function submitGuidance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!token) return
    setGuidanceError('')
    setGuidance(null)
    setLoadingGuidance(true)
    try {
      const result = await apiRequest<OrthodonticGuidance>('/ia/diagnostico-imagen/orientacion-ortodoncia', token, {
        method: 'POST',
        body: JSON.stringify({ coberturaObservada: coverage }),
      })
      setGuidance(result)
    } catch (error) {
      setGuidanceError(errorMessage(error))
    } finally {
      setLoadingGuidance(false)
    }
  }

  async function analyzeRadiograph() {
    if (!token) return
    setRadiographError('')
    setRadiographResult(null)
    const usePrivateUpload = Boolean(file && catalog?.almacenamientoDisponible)
    let parsedUrl: URL | null = null
    if (!usePrivateUpload) {
      try { parsedUrl = new URL(imageUrl.trim()) } catch {
        setRadiographError(file ? 'El almacenamiento privado no está configurado. Ingresá la URL HTTPS pública de la panorámica.' : 'Ingresá la URL HTTPS pública de la panorámica.')
        return
      }
      if (parsedUrl.protocol !== 'https:') {
        setRadiographError('La URL de la imagen tiene que empezar con https://.')
        return
      }
    }
    if (!providerReady) {
      setRadiographError('El proveedor no está configurado. Revisá ANNIE_API_KEY en el backend.')
      return
    }

    setLoadingRadiograph(true)
    try {
      const result = usePrivateUpload
        ? await apiRequest<RadiographAnalysis>('/ia/diagnostico-imagen/upload', token, {
          method: 'POST',
          body: (() => { const form = new FormData(); form.append('archivo', file!); form.append('tipoImagen', 'RADIOGRAFIA_PANORAMICA'); form.append('guardarEnHistoria', 'false'); if (observations.trim()) form.append('observaciones', observations.trim()); return form })(),
        })
        : await apiRequest<RadiographAnalysis>('/ia/diagnostico-imagen/analizar', token, {
          method: 'POST',
          body: JSON.stringify({
          tipoImagen: 'RADIOGRAFIA_PANORAMICA',
          pacienteId: null,
          historiaClinicaId: null,
          observacionesOdontologo: observations.trim() || null,
          guardarEnHistoria: false,
          nombreArchivo: file?.name || caseLabel.trim() || 'radiografia-panoramica',
          imagenUrl: parsedUrl!.toString(),
          }),
        })
      setRadiographResult(result)
      await loadCatalog()
    } catch (error) {
      setRadiographError(errorMessage(error))
      await loadCatalog()
    } finally {
      setLoadingRadiograph(false)
    }
  }

  const providerStatus = catalog?.estadoServicio
  const providerOperational = providerStatus === 'OPERATIVO_PANORAMICAS'
  const providerRejected = providerStatus === 'CREDENCIAL_RECHAZADA'
  const providerReady = providerOperational || ['CLAVE_SIN_VALIDAR', 'ERROR_PROVEEDOR', 'ERROR_CONEXION'].includes(providerStatus || '')

  return (
    <div className="space-y-6 pb-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-cyan-700"><ScanEye size={16} /> Novadent · Ortodoncia</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">Radiografías para ortodoncia</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Cargá el estudio, completá lo que observaste y prepará una orientación para conversar sobre brackets con un especialista.</p>
        </div>
        <button type="button" onClick={() => void loadCatalog()} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50">
          <RefreshCw size={16} className={loadingCatalog ? 'animate-spin' : ''} /> Actualizar conexión
        </button>
      </header>

      <section className="rounded-2xl border border-cyan-200 bg-cyan-50 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-xl bg-cyan-100 p-2 text-cyan-800"><ShieldCheck size={20} /></div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-cyan-950">Orientación ortodóntica disponible</p>
            <p className="mt-1 text-sm leading-6 text-cyan-900">La radiografía queda en esta pantalla para que vos la revises. La orientación usa la arcada que indiques y no afirma si necesitás brackets; esa decisión requiere evaluación del ortodoncista.</p>
          </div>
          <span className="hidden rounded-full bg-cyan-100 px-3 py-1 text-xs font-semibold text-cyan-900 sm:inline-flex">LISTO PARA CARGAR</span>
        </div>
      </section>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)]">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-cyan-50 p-2.5 text-cyan-700"><ImageUp size={20} /></div>
              <div><h2 className="font-semibold text-slate-900">Cargá tu radiografía</h2><p className="mt-0.5 text-sm text-slate-500">Elegí un archivo de tu dispositivo para verlo acá.</p></div>
            </div>
          </div>

          <div className="space-y-5 p-5 sm:p-6">
            {!file ? <label onDragOver={event => { event.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={handleDrop} className={`flex min-h-64 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-8 text-center transition ${dragging ? 'border-cyan-500 bg-cyan-50' : 'border-slate-300 bg-slate-50/70 hover:border-cyan-400 hover:bg-cyan-50/50'}`}>
              <input type="file" accept="image/png,image/jpeg,image/webp,image/dicom,.dcm,.dicom" onChange={handleFileChange} className="sr-only" />
              <div className="rounded-2xl bg-white p-3 text-cyan-700 shadow-sm"><ImageUp size={28} /></div>
              <span className="mt-4 font-semibold text-slate-800">Arrastrá la imagen o buscala en tu dispositivo</span>
              <span className="mt-1.5 text-sm text-slate-500">JPG, PNG, WebP o DICOM · máximo 25 MB</span>
              <span className="mt-4 rounded-lg bg-cyan-700 px-4 py-2 text-sm font-semibold text-white">Elegir archivo</span>
            </label> : <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-950">
              <div className="flex items-center justify-between gap-3 bg-white px-4 py-3">
                <div className="flex min-w-0 items-center gap-3"><div className="rounded-lg bg-cyan-50 p-2 text-cyan-700"><FileImage size={18} /></div><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-800">{file.name}</p><p className="text-xs text-slate-500">{(file.size / (1024 * 1024)).toFixed(2)} MB · vista local</p></div></div>
                <button type="button" onClick={() => { setFile(null); setGuidance(null) }} aria-label="Quitar radiografía" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-rose-600"><X size={18} /></button>
              </div>
              {previewUrl ? <img src={previewUrl} alt="Vista previa de la radiografía cargada" className="max-h-[430px] w-full object-contain" /> : <div className="flex min-h-56 flex-col items-center justify-center gap-2 px-6 text-center text-white"><FileImage size={36} className="text-cyan-300" /><p className="font-medium">Archivo DICOM cargado</p><p className="text-sm text-slate-300">El navegador no genera vista previa de DICOM; el archivo sigue seleccionado localmente.</p></div>}
            </div>}
            {fileError && <p role="alert" className="flex items-center gap-2 text-sm text-rose-700"><AlertCircle size={17} />{fileError}</p>}

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">Nombre o referencia del caso <span className="font-normal text-slate-400">opcional</span></span>
              <input value={caseLabel} onChange={event => setCaseLabel(event.target.value)} placeholder="Ej. Caso 01" className="w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100" />
            </label>

            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-600">
              <span className="font-semibold text-slate-800">Privacidad del archivo:</span> {catalog?.almacenamientoDisponible ? 'se guardará temporalmente en el bucket privado configurado, se compartirá con DR. ANNIE mediante una URL firmada y se eliminará al finalizar la solicitud.' : 'esta carga se muestra solo en tu navegador. Para analizarla, configurá almacenamiento privado o ingresá abajo una URL HTTPS pública.'}
            </div>

            <label className="block">
              {!catalog?.almacenamientoDisponible && <><span className="mb-2 block text-sm font-medium text-slate-700">URL HTTPS pública de esta panorámica</span>
              <input type="url" value={imageUrl} onChange={event => setImageUrl(event.target.value)} placeholder="https://tu-almacenamiento.com/radiografia.jpg" className="w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100" />
              <span className="mt-1.5 block text-xs leading-5 text-slate-500">El proveedor necesita esta URL para leer la imagen. La URL se envía a DR. ANNIE cuando presionás “Analizar panorámica”.</span>
              </>}
            </label>
          </div>
        </section>

        <div className="space-y-6">
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
              <div className="flex items-center gap-3"><div className="rounded-xl bg-indigo-50 p-2.5 text-indigo-700"><Stethoscope size={20} /></div><div><h2 className="font-semibold text-slate-900">Datos para la orientación</h2><p className="mt-0.5 text-sm text-slate-500">Completalos después de revisar el estudio.</p></div></div>
            </div>
            <form onSubmit={submitGuidance} className="space-y-5 p-5 sm:p-6">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Arcada que querés evaluar</span>
                <select value={coverage} onChange={event => setCoverage(event.target.value as Coverage)} className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-700 outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100">
                  {coverageOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
                <span className="mt-1.5 block text-xs leading-5 text-slate-500">La selección la hacés vos; el servicio no interpreta automáticamente la radiografía.</span>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Observaciones del caso <span className="font-normal text-slate-400">opcional</span></span>
                <textarea rows={3} value={observations} onChange={event => setObservations(event.target.value)} placeholder="Anotá acá lo que quieras tener presente durante la consulta…" className="w-full resize-y rounded-xl border border-slate-200 px-3.5 py-3 text-sm outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100" />
                <span className="mt-1.5 block text-xs text-slate-500">Las observaciones quedan en esta vista; el endpoint actual solo recibe la arcada elegida.</span>
              </label>

              {guidanceError && <div role="alert" className="flex gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"><AlertCircle size={18} className="mt-0.5 shrink-0" /><span>{guidanceError}</span></div>}

              <button type="submit" disabled={loadingGuidance} className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-700 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-cyan-800 disabled:cursor-wait disabled:bg-slate-400">
                {loadingGuidance ? <LoaderCircle size={18} className="animate-spin" /> : <Sparkles size={18} />}
                {loadingGuidance ? 'Preparando orientación…' : 'Consultar opciones para brackets'}
                {!loadingGuidance && <ArrowRight size={17} />}
              </button>
            </form>
          </section>

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-4"><p className="text-xs font-semibold uppercase tracking-wide text-cyan-700">Resultado informativo</p><h2 className="mt-1 font-semibold text-slate-900">Opciones para conversar</h2></div>
            {guidance ? <div className="space-y-4 p-5">
              <div className="rounded-xl bg-cyan-50 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-cyan-800">{guidance.alcance}{caseLabel.trim() ? ` · ${caseLabel.trim()}` : ''}</p><p className="mt-2 text-sm leading-6 text-slate-800">{guidance.recomendacion}</p></div>
              <div><p className="text-sm font-semibold text-slate-800">Alternativas para conversar con el especialista</p><ul className="mt-2 space-y-2">{guidance.alternativasAConversar.map(option => <li key={option} className="flex gap-2 rounded-xl border border-slate-200 p-3 text-sm text-slate-700"><CheckCircle2 size={17} className="mt-0.5 shrink-0 text-cyan-700" /><span>{option}</span></li>)}</ul></div>
              <div className="rounded-xl border border-slate-200 p-3"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Profesional recomendado</p><p className="mt-1 text-sm font-medium text-slate-800">{guidance.profesionalRecomendado}</p>{guidance.profesionalesDisponibles.length > 0 && <ul className="mt-2 divide-y divide-slate-100">{guidance.profesionalesDisponibles.map(professional => <li key={professional.id} className="py-2 text-sm text-slate-700"><span className="font-medium">{professional.nombre}</span><span className="block text-xs text-slate-500">{professional.especialidad}{professional.email ? ` · ${professional.email}` : ''}</span></li>)}</ul>}</div>
              <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">{guidance.aviso}</p>
            </div> : <div className="flex min-h-48 flex-col items-center justify-center px-6 py-8 text-center"><div className="rounded-2xl bg-slate-50 p-3 text-slate-400"><BadgeCheck size={26} /></div><h3 className="mt-4 font-semibold text-slate-800">La orientación aparecerá aquí</h3><p className="mt-1.5 max-w-sm text-sm leading-6 text-slate-500">Cargá el estudio, elegí la arcada que querés evaluar y consultá las opciones informativas.</p></div>}
          </section>
        </div>
      </div>

      <section className={`rounded-2xl border p-4 sm:p-5 ${providerOperational ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
        <div className="flex items-start gap-3">
          <div className={`mt-0.5 rounded-xl p-2 ${providerOperational ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'}`}>{providerOperational ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}</div>
          <div className="min-w-0 flex-1">
            <p className={`font-semibold ${providerOperational ? 'text-emerald-900' : 'text-amber-950'}`}>{loadingCatalog ? 'Consultando análisis automático de panorámicas…' : providerOperational ? 'Análisis panorámico operativo' : providerRejected ? 'Clave de DR. ANNIE rechazada' : providerStatus === 'CLAVE_SIN_VALIDAR' ? 'Clave cargada, todavía sin validar' : providerStatus === 'ERROR_CONEXION' ? 'No se pudo conectar con DR. ANNIE' : providerStatus === 'ERROR_PROVEEDOR' ? 'DR. ANNIE devolvió un error' : 'Análisis automático de radiografías no configurado'}</p>
            <p className={`mt-1 text-sm leading-6 ${providerOperational ? 'text-emerald-800' : 'text-amber-900'}`}>{catalogError || (providerRejected
              ? 'DR. ANNIE rechazó ANNIE_API_KEY. Actualizá la clave en el .env del backend y reinicialo; el botón de análisis queda bloqueado para evitar reenvíos.'
              : providerStatus === 'CLAVE_SIN_VALIDAR'
                ? 'Hay una clave cargada, pero DR. ANNIE todavía no la aceptó. La primera prueba enviará la panorámica al proveedor.'
                : providerStatus === 'ERROR_CONEXION'
                  ? 'No se pudo alcanzar el servicio. Revisá la conexión del backend; podés reintentar cuando se restablezca.'
                  : providerStatus === 'ERROR_PROVEEDOR'
                    ? 'El proveedor respondió con un error distinto de autenticación. Revisá el mensaje del análisis antes de reintentar.'
                : providerOperational
                  ? `${catalog?.versionModelo || 'DR. ANNIE'} detecta hallazgos generales en panorámicas. No determina por sí solo si necesitás brackets; el resultado debe revisarlo un ortodoncista.`
                  : 'Se requiere ANNIE_API_KEY y almacenamiento privado S3 configurado para cargar archivos locales, o bien una URL HTTPS pública. La imagen no se envía hasta que presiones analizar.')}</p>
          </div>
          <span className={`hidden rounded-full px-3 py-1 text-xs font-semibold sm:inline-flex ${providerOperational ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'}`}>{loadingCatalog ? 'CONSULTANDO' : providerOperational ? 'OPERATIVO' : providerRejected ? 'CLAVE RECHAZADA' : providerStatus === 'CLAVE_SIN_VALIDAR' ? 'SIN VALIDAR' : providerStatus === 'ERROR_CONEXION' ? 'SIN CONEXIÓN' : providerStatus === 'ERROR_PROVEEDOR' ? 'ERROR DEL PROVEEDOR' : 'PENDIENTE'}</span>
        </div>
        {radiographError && <p role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{radiographError}</p>}
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">Al continuar, autorizás enviar esta panorámica a DR. ANNIE/HCDS para su análisis. {catalog?.almacenamientoDisponible && 'Antes, el backend la subirá al bucket privado y generará una URL temporal; al finalizar la llamada intentará eliminar el archivo.'}</div>
        <button type="button" onClick={() => void analyzeRadiograph()} disabled={!providerReady || loadingCatalog || loadingRadiograph || (catalog?.almacenamientoDisponible ? !file : !imageUrl.trim())} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-cyan-800 disabled:cursor-not-allowed disabled:bg-slate-300 sm:w-auto">
          {loadingRadiograph ? <LoaderCircle size={18} className="animate-spin" /> : <Sparkles size={18} />}
          {loadingRadiograph ? 'Analizando panorámica…' : 'Analizar panorámica'}
        </button>
        {radiographResult && <div className="mt-4 space-y-3 rounded-xl border border-emerald-200 bg-white p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-emerald-900"><CheckCircle2 size={17} /> Análisis recibido · {radiographResult.modeloUtilizado}</div>
          <p className="text-sm leading-6 text-slate-700">{radiographResult.diagnosticoSugerido}</p>
          {radiographResult.resultadoProveedor && <details className="rounded-lg border border-slate-200"><summary className="cursor-pointer px-3 py-2 text-sm font-medium text-slate-700">Ver hallazgos del proveedor</summary><pre className="max-h-72 overflow-auto border-t border-slate-100 bg-slate-950 p-3 text-xs text-slate-100">{JSON.stringify(radiographResult.resultadoProveedor, null, 2)}</pre></details>}
          <p className="text-xs leading-5 text-amber-800">Es una detección preliminar de la panorámica; no prescribe brackets ni reemplaza la evaluación del ortodoncista.</p>
        </div>}
      </section>
    </div>
  )
}
