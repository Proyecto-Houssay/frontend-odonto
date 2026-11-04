import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { apiRequest, ApiError } from '../lib/api'

type InventoryItem = { id: number; nombre: string; categoria: string; cantidadDisponible: number; unidadMedida: string; estado: string }
type Report = { tipo: string; desde?: string; hasta?: string; totalTurnos?: number; porEstado?: Record<string, number>; anio?: number; reportesFinancierosDisponibles?: boolean }

export function ReportsPage() {
  const [items, setItems] = useState<InventoryItem[]>([])
  const [inventoryLoading, setInventoryLoading] = useState(true)
  const [inventoryError, setInventoryError] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [year, setYear] = useState(String(new Date().getFullYear()))
  const [periodReport, setPeriodReport] = useState<Report | null>(null)
  const [annualReport, setAnnualReport] = useState<Report | null>(null)
  const [reportLoading, setReportLoading] = useState(true)
  const [reportError, setReportError] = useState('')

  async function loadInventory() {
    try { setItems(await apiRequest<InventoryItem[]>('/api/reports/inventario')) }
    catch (error) { setInventoryError(error instanceof ApiError ? error.message : 'No se pudo cargar el inventario.') }
    finally { setInventoryLoading(false) }
  }

  async function loadReports(event?: FormEvent) {
    event?.preventDefault()
    if ((from && !to) || (!from && to)) {
      setReportError('Elegí ambas fechas para consultar un período.')
      return
    }
    setReportLoading(true)
    setReportError('')
    setReportLoading(true)
    setReportError('')
    const periodQuery = from ? `?desde=${encodeURIComponent(from)}&hasta=${encodeURIComponent(to)}` : ''
    try {
      const [period, annual] = await Promise.all([
        apiRequest<Report>(`/api/reports/atenciones${periodQuery}`),
        apiRequest<Report>(`/api/reports/anual?anio=${encodeURIComponent(year)}`),
      ])
      setPeriodReport(period)
      setAnnualReport(annual)
    } catch (error) {
      setReportError(error instanceof ApiError ? error.message : 'No se pudieron cargar los informes.')
    } finally { setReportLoading(false) }
  }

  useEffect(() => {
    let active = true
    apiRequest<InventoryItem[]>('/api/reports/inventario')
      .then((data) => { if (active) setItems(data) })
      .catch((error) => { if (active) setInventoryError(error instanceof ApiError ? error.message : 'No se pudo cargar el inventario.') })
      .finally(() => { if (active) setInventoryLoading(false) })

    Promise.all([
      apiRequest<Report>('/api/reports/atenciones'),
      apiRequest<Report>(`/api/reports/anual?anio=${encodeURIComponent(year)}`),
    ]).then(([period, annual]) => {
      if (active) { setPeriodReport(period); setAnnualReport(annual); setReportError('') }
    }).catch((error) => {
      if (active) setReportError(error instanceof ApiError ? error.message : 'No se pudieron cargar los informes.')
    }).finally(() => { if (active) setReportLoading(false) })

    return () => { active = false }
  }, [year])

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6">
      <header>
        <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">Datos registrados</p>
        <h1 className="mt-1 text-3xl font-bold text-slate-950">Informes e inventario</h1>
        <p className="mt-2 text-sm text-slate-600">Los resultados vienen del backend. La sección es de consulta; no muestra valores de demostración como si fueran reales.</p>
      </header>

      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h2 className="text-xl font-bold text-slate-900">Inventario</h2><p className="text-sm text-slate-600">Existencias persistidas en el sistema.</p></div>
          <button onClick={() => { setInventoryLoading(true); setInventoryError(''); void loadInventory() }} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-50">Reintentar</button>
        </div>
        {inventoryLoading && <p role="status" className="text-sm text-slate-500">Cargando inventario…</p>}
        {inventoryError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{inventoryError}</p>}
        {!inventoryLoading && !inventoryError && items.length === 0 && <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">No hay insumos registrados.</p>}
        {!!items.length && <div className="overflow-x-auto"><table className="w-full min-w-[600px] text-left text-sm">
          <thead className="border-b text-xs uppercase text-slate-500"><tr><th className="py-3">Insumo</th><th>Categoría</th><th>Existencia</th><th>Estado</th></tr></thead>
          <tbody>{items.map((item) => <tr key={item.id} className="border-b last:border-0"><td className="py-3 font-medium">{item.nombre}</td><td>{item.categoria}</td><td>{item.cantidadDisponible} {item.unidadMedida}</td><td>{item.estado}</td></tr>)}</tbody>
        </table></div>}
      </section>

      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div><h2 className="text-xl font-bold text-slate-900">Turnos por período</h2><p className="text-sm text-slate-600">Conteo de turnos registrados; el sistema aún no distingue una atención efectivamente realizada.</p></div>
        <form onSubmit={loadReports} className="flex flex-wrap items-end gap-3">
          <label className="grid gap-1 text-sm">Desde<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2" /></label>
          <label className="grid gap-1 text-sm">Hasta<input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2" /></label>
          <label className="grid gap-1 text-sm">Año<input type="number" min="1" max="9999" value={year} onChange={(e) => setYear(e.target.value)} className="w-28 rounded-lg border border-slate-300 px-3 py-2" /></label>
          <button disabled={reportLoading} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{reportLoading ? 'Cargando…' : 'Consultar'}</button>
        </form>
        {reportError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{reportError}</p>}
        {(periodReport || annualReport) && <div className="grid gap-4 sm:grid-cols-2">
          {periodReport && <ReportCard title="Período" report={periodReport} />}
          {annualReport && <ReportCard title={`Año ${annualReport.anio}`} report={annualReport} />}
        </div>}
        <aside className="rounded-lg bg-amber-50 p-3 text-sm text-amber-950">Ganancias y cobros no están disponibles: el backend no tiene registros ni endpoints financieros. No se presentan cifras estimadas.</aside>
      </section>
    </main>
  )
}

function ReportCard({ title, report }: { title: string; report: Report }) {
  return <article className="rounded-xl border border-slate-200 p-4"><h3 className="font-semibold text-slate-900">{title}</h3>
    <p className="mt-2 text-3xl font-bold text-blue-800">{report.totalTurnos ?? 0}</p><p className="text-sm text-slate-600">turnos registrados</p>
    {report.porEstado && <ul className="mt-3 space-y-1 text-sm text-slate-700">{Object.entries(report.porEstado).map(([status, count]) => <li key={status} className="flex justify-between"><span>{status}</span><span>{count}</span></li>)}</ul>}
  </article>
}
