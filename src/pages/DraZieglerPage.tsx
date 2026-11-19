import { useEffect, useState, type ChangeEvent } from 'react'
import { AlertCircle, CheckCircle2, CircleDollarSign, FileImage, LoaderCircle, Sparkles } from 'lucide-react'
import { apiRequest } from '../lib/api'
import { DrAnniePage } from './DrAnniePage'

type GeminiStatus = { configurado: boolean; modelo: string; proveedor: string; nombreAsistente: string; modo?: string }
type PriceEstimate = { code: string; prestation: string; priceArs: string }
type Analysis = {
  diagnosticoSugerido: string
  modeloUtilizado: string
  fechaAnalisis: string
  etapaDentariaVisible: 'PRIMARIA' | 'MIXTA' | 'PERMANENTE' | 'NO_DETERMINABLE'
  estimacionesPrecio: PriceEstimate[]
  aclaracionPrecio: string
}

const DEFAULT_TARIFFS: Record<'PRIMARIA' | 'MIXTA' | 'PERMANENTE', PriceEstimate[]> = {
  PERMANENTE: [
    { code: '06.01', prestation: 'Consulta-Estudio — Diagnóstico, pronóstico y plan de tratamiento', priceArs: '$ 68.587,00' },
    { code: '06.03', prestation: 'Tratamiento de Dentición Permanente', priceArs: '$ 609.026,00' },
  ],
  MIXTA: [
    { code: '06.01', prestation: 'Consulta-Estudio — Diagnóstico, pronóstico y plan de tratamiento', priceArs: '$ 68.587,00' },
    { code: '06.02', prestation: 'Tratamiento de Dentición Primaria o Mixta', priceArs: '$ 490.266,00' },
  ],
  PRIMARIA: [
    { code: '06.01', prestation: 'Consulta-Estudio — Diagnóstico, pronóstico y plan de tratamiento', priceArs: '$ 68.587,00' },
    { code: '06.02', prestation: 'Tratamiento de Dentición Primaria o Mixta', priceArs: '$ 490.266,00' },
  ],
}

export function DraZieglerPage({ token }: { token: string }) {
  const [status, setStatus] = useState<GeminiStatus | null>(null)
  const [statusError, setStatusError] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [selectedStage, setSelectedStage] = useState<'PERMANENTE' | 'MIXTA' | 'PRIMARIA'>('PERMANENTE')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!token) return
    apiRequest<GeminiStatus>('/ai/status', { token })
      .then(res => {
        setStatus(res)
        setStatusError('')
      })
      .catch(() => setStatusError(''))
  }, [token])

  function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const candidate = event.target.files?.[0] ?? null
    event.target.value = ''
    setError('')
    setAnalysis(null)
    if (!candidate) {
      setFile(null)
      setPreviewUrl(null)
      return
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(candidate.type)) {
      setFile(null)
      setPreviewUrl(null)
      setError('Elegí una imagen JPG, PNG o WebP.')
      return
    }
    if (candidate.size > 20 * 1024 * 1024) {
      setFile(null)
      setPreviewUrl(null)
      setError('La imagen supera el límite de 20 MB.')
      return
    }
    setFile(candidate)
    const reader = new FileReader()
    reader.onload = () => setPreviewUrl(typeof reader.result === 'string' ? reader.result : null)
    reader.onerror = () => setPreviewUrl(null)
    reader.readAsDataURL(candidate)
  }

  async function analyze() {
    if (!token || !file) return
    setLoading(true)
    setError('')
    setAnalysis(null)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await apiRequest<Analysis>('/ai/analizar', { token, method: 'POST', body: form })
      setAnalysis(res)
      if (res.etapaDentariaVisible === 'PRIMARIA' || res.etapaDentariaVisible === 'MIXTA' || res.etapaDentariaVisible === 'PERMANENTE') {
        setSelectedStage(res.etapaDentariaVisible)
      }
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'No se pudo analizar la imagen.'
      try { setError(JSON.parse(message).message || message) } catch { setError(message) }
    } finally {
      setLoading(false)
    }
  }

  const displayedPrices = analysis?.estimacionesPrecio?.length
    ? analysis.estimacionesPrecio
    : DEFAULT_TARIFFS[selectedStage]

  return (
    <div className="space-y-8 pb-8">
      {/* Estación Clínica Integral de Diagnóstico por Imagen y Derivación a Historia Clínica */}
      <DrAnniePage />

      {/* Módulo Complementario de Orientación Ortodóncica y Referencias del Nomenclador (Dra. Ziegler · Gemini) */}
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-3xl border border-slate-300 bg-white p-6 shadow-sm sm:p-7">
          <div className="flex items-start justify-between gap-3 flex-wrap border-b border-slate-200 pb-4">
            <div className="flex items-start gap-3">
              <span className="rounded-2xl bg-cyan-50 p-3 text-cyan-800"><FileImage size={22} /></span>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-cyan-700">
                  Orientación de Ortodoncia y Aranceles · Gemini
                </p>
                <h2 className="text-xl font-extrabold text-slate-950">
                  Evaluación de Etapa Dentaria y Nomenclador de Ortodoncia
                </h2>
                <p className="mt-1 text-xs text-slate-600">
                  Subí una imagen para obtener orientación conversacional de ortodoncia y consultar los aranceles de referencia por etapa dentaria.
                </p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
              <CheckCircle2 size={14} />
              Dra. Ziegler activa · {status?.modelo || 'Motor Clínico Autónomo'}
            </span>
          </div>

          <div className="mt-5 grid gap-6 lg:grid-cols-2">
            <div>
              <label className="flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-center hover:border-cyan-500 hover:bg-cyan-50/40">
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt="Vista previa de la imagen dental seleccionada"
                    className="mb-3 max-h-44 rounded-lg border border-slate-200 object-contain shadow-xs"
                  />
                ) : (
                  <FileImage className="mb-2 text-slate-500" size={26} />
                )}
                <span className="text-sm font-medium text-slate-800">{file?.name || 'Elegir una imagen para orientación ortodóncica'}</span>
                <span className="mt-1 text-xs text-slate-500">Formatos JPG, PNG o WebP · máximo 20 MB</span>
                <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={selectFile} />
              </label>

              {statusError && (
                <div className="mt-3 flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
                  <AlertCircle size={18} className="mt-0.5 shrink-0" />
                  <span>{statusError}</span>
                </div>
              )}
              {error && <p role="alert" className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}

              <button
                type="button"
                onClick={() => void analyze()}
                disabled={!file || loading}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-700 px-4 py-3 text-sm font-extrabold text-white hover:bg-cyan-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {loading ? <LoaderCircle size={18} className="animate-spin" /> : <Sparkles size={18} />}
                {loading ? 'Analizando orientación…' : 'Analizar orientación ortodóncica'}
              </button>
            </div>

            <div className="rounded-2xl border border-cyan-100 bg-slate-50/70 p-5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 text-slate-900">
                  <CircleDollarSign size={20} className="text-cyan-700" />
                  <h3 className="font-bold">Referencias de costo del nomenclador</h3>
                </div>
                <div className="flex gap-1" role="group" aria-label="Etapa dentaria">
                  {(['PERMANENTE', 'MIXTA', 'PRIMARIA'] as const).map(stage => (
                    <button
                      key={stage}
                      type="button"
                      onClick={() => setSelectedStage(stage)}
                      className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                        selectedStage === stage
                          ? 'bg-cyan-700 text-white'
                          : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {stage}
                    </button>
                  ))}
                </div>
              </div>
              <p className="mt-2 text-xs text-slate-600">
                Aranceles particulares en pesos argentinos del tarifario oficial según etapa dentaria ({selectedStage.toLowerCase()}).
              </p>
              <ul className="mt-3 divide-y divide-slate-200">
                {displayedPrices.map(estimate => (
                  <li key={estimate.code} className="flex flex-wrap items-baseline justify-between gap-2 py-2.5 text-sm">
                    <span className="text-slate-800 font-medium">{estimate.code} · {estimate.prestation}</span>
                    <strong className="text-slate-950 font-extrabold">{estimate.priceArs}</strong>
                  </li>
                ))}
              </ul>
              <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-900">
                {analysis?.aclaracionPrecio ||
                  'El arancel mostrado es una referencia informativa del nomenclador oficial; la elección de aparatología y cotización definitiva requieren evaluación clínica de dientes, mordida y maxilares.'}
              </p>
            </div>
          </div>

          {analysis && (
            <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50/40 p-5">
              <p className="text-xs font-bold uppercase tracking-wide text-emerald-800">
                Orientación informativa · {analysis.modeloUtilizado}
              </p>
              <div className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-800">
                {analysis.diagnosticoSugerido}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
