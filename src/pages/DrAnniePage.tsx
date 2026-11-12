import { ScanLine, ShieldCheck, Sparkles } from 'lucide-react'

export function DrAnniePage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-teal-950 p-7 text-white shadow-xl sm:p-10">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-teal-300/30 bg-teal-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-teal-100">
          <Sparkles className="h-4 w-4" /> Análisis con IA
        </div>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Tu asistente odontológico</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
          Un solo espacio para el análisis de imágenes con inteligencia artificial.
        </p>
      </section>
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 text-teal-700">
            <ScanLine className="h-7 w-7" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[.16em] text-teal-700">Asistente IA</p>
            <h2 className="mt-1 text-2xl font-bold text-slate-900">Dr. Annie</h2>
          </div>
        </div>
        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <strong>En preparación</strong>
          <p className="mt-1 leading-6">
            Dr. Annie todavía no está conectado a un servicio de análisis. No se generarán diagnósticos ni recomendaciones hasta que esté disponible.
          </p>
        </div>
        <p className="mt-5 flex gap-2 border-t border-slate-100 pt-4 text-xs leading-5 text-slate-500">
          <ShieldCheck className="h-4 w-4 shrink-0 text-teal-700" />
          No cargues radiografías por ahora. Esta pantalla no transmite ni analiza imágenes.
        </p>
      </section>
    </div>
  )
}
