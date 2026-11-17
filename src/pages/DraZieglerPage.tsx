import { useEffect, useState, type ChangeEvent } from 'react'
import { AlertCircle, CircleDollarSign, FileImage, LoaderCircle, ScanEye, Sparkles } from 'lucide-react'
import { apiRequest } from '../lib/api'

type GeminiStatus = { configurado: boolean; modelo: string; proveedor: string; nombreAsistente: string }
type PriceEstimate = { code: string; prestation: string; priceArs: string }
type Analysis = {
  diagnosticoSugerido: string
  modeloUtilizado: string
  fechaAnalisis: string
  estimacionesPrecio: PriceEstimate[]
  aclaracionPrecio: string
}

export function DraZieglerPage({ token }: { token: string }) {
  const [status, setStatus] = useState<GeminiStatus | null>(null)
  const [statusError, setStatusError] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!token) return
    apiRequest<GeminiStatus>('/ai/status', { token })
      .then(setStatus)
      .catch(() => setStatusError('No se pudo consultar el estado de Gemini. Revisá que el backend esté activo.'))
  }, [token])

  function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const candidate = event.target.files?.[0] ?? null
    event.target.value = ''
    setError('')
    setAnalysis(null)
    if (!candidate) { setFile(null); return }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(candidate.type)) {
      setFile(null)
      setError('Elegí una imagen JPG, PNG o WebP.')
      return
    }
    if (candidate.size > 20 * 1024 * 1024) {
      setFile(null)
      setError('La imagen supera el límite de 20 MB.')
      return
    }
    setFile(candidate)
  }

  async function analyze() {
    if (!token || !file) return
    setLoading(true)
    setError('')
    setAnalysis(null)
    try {
      const form = new FormData()
      form.append('file', file)
      setAnalysis(await apiRequest<Analysis>('/ai/analizar', { token, method: 'POST', body: form }))
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'No se pudo analizar la imagen.'
      try { setError(JSON.parse(message).message || message) } catch { setError(message) }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-8">
      <header>
        <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-cyan-700"><ScanEye size={16} /> Novadent · Asistente de imágenes</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">Dra. Ziegler</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Revisá una imagen dental y recibí una orientación informativa para preparar la consulta con un odontólogo.</p>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="flex items-start gap-3">
          <span className="rounded-xl bg-cyan-50 p-2 text-cyan-800"><FileImage size={20} /></span>
          <div>
            <h2 className="font-semibold text-slate-900">Cargá una radiografía o imagen dental</h2>
            <p className="mt-1 text-sm text-slate-600">Formatos JPG, PNG o WebP · máximo 20 MB</p>
          </div>
        </div>
        <label className="mt-5 flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 text-center hover:border-cyan-500 hover:bg-cyan-50/40">
          <FileImage className="mb-2 text-slate-500" size={26} />
          <span className="text-sm font-medium text-slate-800">{file?.name || 'Elegir una imagen'}</span>
          <span className="mt-1 text-xs text-slate-500">La imagen seleccionada queda en esta sesión hasta que elijas analizarla.</span>
          <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={selectFile} />
        </label>

        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
          Al presionar «Analizar», la imagen se enviará a Google Gemini para generar una orientación. Usá imágenes autorizadas y evitá incluir datos personales identificables. El resultado es informativo: no es un diagnóstico ni reemplaza la evaluación odontológica.
        </div>

        {(statusError || (status && !status.configurado)) && <div className="mt-4 flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"><AlertCircle size={18} className="mt-0.5 shrink-0" /><span>{statusError || 'Gemini todavía no está configurado. Añadí GEMINI_API_KEY al .env del backend y reinicialo.'}</span></div>}
        {status?.configurado && <p className="mt-3 text-xs text-emerald-800">Gemini conectado · modelo {status.modelo}</p>}
        {error && <p role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
        <button type="button" onClick={() => void analyze()} disabled={!file || !status?.configurado || loading} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-cyan-700 px-4 py-3 text-sm font-semibold text-white hover:bg-cyan-800 disabled:cursor-not-allowed disabled:bg-slate-300">
          {loading ? <LoaderCircle size={18} className="animate-spin" /> : <Sparkles size={18} />}{loading ? 'Analizando…' : 'Analizar imagen'}
        </button>
      </section>

      {analysis && <section className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm sm:p-7">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Orientación informativa · {analysis.modeloUtilizado}</p>
        <div className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-800">{analysis.diagnosticoSugerido}</div>
        <p className="mt-5 border-t border-slate-100 pt-4 text-xs leading-5 text-amber-800">La imagen no permite determinar qué tipo de brackets necesitás. La elección requiere evaluación de dientes, mordida y maxilares por un ortodoncista.</p>
      </section>}

      {analysis && <section className="rounded-2xl border border-cyan-100 bg-white p-5 shadow-sm sm:p-7">
        <div className="flex items-center gap-2 text-slate-900"><CircleDollarSign size={20} className="text-cyan-700" /><h2 className="font-semibold">Referencias de costo del nomenclador</h2></div>
        <p className="mt-2 text-sm text-slate-600">Valores particulares en pesos argentinos. Son referencias de la clínica, no una cotización personalizada ni una recomendación de tratamiento.</p>
        {analysis.estimacionesPrecio?.length ? <ul className="mt-4 divide-y divide-slate-100">
          {analysis.estimacionesPrecio.map((estimate) => <li key={estimate.code} className="flex flex-wrap items-baseline justify-between gap-2 py-3 text-sm">
            <span className="text-slate-700">{estimate.prestation}</span><strong className="text-slate-950">{estimate.priceArs}</strong>
          </li>)}
        </ul> : <p className="mt-4 text-sm text-slate-600">El nomenclador no tiene precios de ortodoncia disponibles. Consultá en la clínica.</p>}
        <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-900">{analysis.aclaracionPrecio || 'Confirmá cobertura, duración y valores vigentes con el ortodoncista. Los controles mensuales se cobran aparte cuando corresponda.'}</p>
      </section>}
    </div>
  )
}
