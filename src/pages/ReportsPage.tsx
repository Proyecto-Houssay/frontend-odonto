import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { apiRequest, ApiError, getSession } from '../lib/api'

type InventoryItem = { id: number; nombre: string; categoria: string; cantidadDisponible: number; unidadMedida: string; stockMinimo: number; estado: string }
type InventoryRequest = Omit<InventoryItem, 'id' | 'estado'> & { stockMinimo: number }
type Report = {
  tipo?: string; desde?: string; hasta?: string; totalTurnos?: number; totalAtenciones?: number
  porEstado?: Record<string, number>; anio?: number; ingresosRegistrados?: number
  egresosRegistrados?: number; gananciaNetaRegistrada?: number; cantidadMovimientos?: number
  sinRegistrosFinancieros?: boolean; sinRegistros?: boolean
}
type Movement = { id: number; fecha: string; tipo: 'INGRESO' | 'EGRESO'; importe: number; concepto: string; medioPago?: string; turnoId?: number }
type MovementRequest = Omit<Movement, 'id'>

export function ReportsPage() {
  const role = getSession()?.role
  const canManageInventory = role === 'ADMIN'
  const canRecordFinance = role === 'ADMIN'
  const canViewCobros = role === 'ADMIN' || role === 'RECEPCIONISTA'
  const canViewAnnual = role === 'ADMIN' || role === 'RECEPCIONISTA'
  const [items, setItems] = useState<InventoryItem[]>([])
  const [inventoryLoading, setInventoryLoading] = useState(true)
  const [inventoryError, setInventoryError] = useState('')
  const [inventoryMessage, setInventoryMessage] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [inventoryForm, setInventoryForm] = useState<InventoryRequest>({ nombre: '', categoria: '', cantidadDisponible: 0, unidadMedida: '', stockMinimo: 0 })
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [year, setYear] = useState(String(new Date().getFullYear()))
  const [periodReport, setPeriodReport] = useState<Report | null>(null)
  const [annualReport, setAnnualReport] = useState<Report | null>(null)
  const [financeReport, setFinanceReport] = useState<Report | null>(null)
  const [cobros, setCobros] = useState<Movement[]>([])
  const [financeForm, setFinanceForm] = useState<MovementRequest>({ tipo: 'INGRESO', fecha: localToday(), importe: 0, concepto: '', medioPago: '', turnoId: undefined })
  const [reportLoading, setReportLoading] = useState(true)
  const [reportError, setReportError] = useState('')
  const [financeMessage, setFinanceMessage] = useState('')

  async function loadInventory() {
    setInventoryError('')
    try { setItems(await apiRequest<InventoryItem[]>('/api/reports/inventario')) }
    catch (error) { setInventoryError(error instanceof ApiError ? error.message : 'No se pudo cargar el inventario.') }
    finally { setInventoryLoading(false) }
  }

  function startEditing(item: InventoryItem) {
    setEditingId(item.id)
    setInventoryForm({ nombre: item.nombre, categoria: item.categoria, cantidadDisponible: item.cantidadDisponible, unidadMedida: item.unidadMedida, stockMinimo: item.stockMinimo })
    setInventoryMessage('')
  }

  async function saveInventory(event: FormEvent) {
    event.preventDefault()
    setInventoryMessage('')
    setInventoryError('')
    try {
      await apiRequest<InventoryItem>(editingId ? `/api/reports/inventario/${editingId}` : '/api/reports/inventario', {
        method: editingId ? 'PUT' : 'POST', body: JSON.stringify(inventoryForm),
      })
      setInventoryMessage(editingId ? 'Insumo actualizado.' : 'Insumo registrado.')
      setEditingId(null)
      setInventoryForm({ nombre: '', categoria: '', cantidadDisponible: 0, unidadMedida: '', stockMinimo: 0 })
      setInventoryLoading(true)
      await loadInventory()
    } catch (error) { setInventoryError(error instanceof ApiError ? error.message : 'No se pudo guardar el insumo.') }
  }

  async function loadReports(event?: FormEvent) {
    event?.preventDefault()
    if ((from && !to) || (!from && to)) {
      setReportError('Elegí ambas fechas para consultar un período.')
      return
    }
    if (event) setReportLoading(true)
    setReportError('')
    const periodQuery = from ? `?desde=${encodeURIComponent(from)}&hasta=${encodeURIComponent(to)}` : ''
    const yearFrom = `${year}-01-01`
    const yearTo = `${year}-12-31`
    const financeFrom = from || yearFrom
    const financeTo = to || yearTo
    try {
      const periodPromise = apiRequest<Report>(`/api/reports/atenciones${periodQuery}`)
      const annualPromise = canViewAnnual
        ? apiRequest<Report>(`/api/reports/anual?anio=${encodeURIComponent(year)}`)
        : apiRequest<Report>(`/api/reports/atenciones?desde=${yearFrom}&hasta=${yearTo}`).then((report) => ({ ...report, anio: Number(year) }))
      const cobrosPromise = canViewCobros
        ? apiRequest<Movement[]>(`/api/reports/cobros?desde=${financeFrom}&hasta=${financeTo}`)
        : Promise.resolve([])
      const financePromise = canViewAnnual
        ? apiRequest<Report>(`/api/reports/ganancias?desde=${financeFrom}&hasta=${financeTo}`)
        : Promise.resolve(null)
      const [period, annual, charges, finance] = await Promise.all([periodPromise, annualPromise, cobrosPromise, financePromise])
      setPeriodReport(period)
      setAnnualReport(annual)
      setCobros(charges)
      setFinanceReport(finance)
    } catch (error) {
      setReportError(error instanceof ApiError ? error.message : 'No se pudieron cargar los informes.')
    } finally { setReportLoading(false) }
  }

  async function saveMovement(event: FormEvent) {
    event.preventDefault()
    setFinanceMessage('')
    setReportError('')
    try {
      const payload = { ...financeForm, turnoId: financeForm.tipo === 'INGRESO' ? Number(financeForm.turnoId) : undefined }
      await apiRequest<Movement>('/api/finanzas/movimientos', { method: 'POST', body: JSON.stringify(payload) })
      setFinanceMessage('Movimiento financiero guardado.')
      setReportLoading(true)
      await loadReports()
    } catch (error) { setReportError(error instanceof ApiError ? error.message : 'No se pudo guardar el movimiento.') }
  }

  // The initial request uses default dates; filter changes take effect only when the user submits the form.
  // oxlint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void loadInventory(); void loadReports() }, [])

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6">
      <header>
        <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">Datos registrados</p>
        <h1 className="mt-1 text-3xl font-bold text-slate-950">Informes e inventario</h1>
        <p className="mt-2 text-sm text-slate-600">Los informes se calculan a partir de los datos persistidos. Los resultados vacíos se muestran como tales.</p>
      </header>

      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h2 className="text-xl font-bold text-slate-900">Inventario</h2><p className="text-sm text-slate-600">Existencias persistidas. Solo ADMIN puede registrar o editar insumos.</p></div>
          <button onClick={() => { setInventoryLoading(true); void loadInventory() }} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-50">Actualizar</button>
        </div>
        {inventoryLoading && <p role="status" className="text-sm text-slate-500">Cargando inventario…</p>}
        {inventoryError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{inventoryError}</p>}
        {inventoryMessage && <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800">{inventoryMessage}</p>}
        {!inventoryLoading && !inventoryError && items.length === 0 && <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">No hay insumos registrados.</p>}
        {!!items.length && <div className="overflow-x-auto"><table className="w-full min-w-[600px] text-left text-sm">
          <thead className="border-b text-xs uppercase text-slate-500"><tr><th className="py-3">Insumo</th><th>Categoría</th><th>Existencia</th><th>Estado</th>{canManageInventory && <th>Acciones</th>}</tr></thead>
          <tbody>{items.map((item) => <tr key={item.id} className="border-b last:border-0"><td className="py-3 font-medium">{item.nombre}</td><td>{item.categoria}</td><td>{item.cantidadDisponible} {item.unidadMedida}</td><td>{item.estado}</td>{canManageInventory && <td><button onClick={() => startEditing(item)} className="font-semibold text-blue-700 underline">Editar</button></td>}</tr>)}</tbody>
        </table></div>}
        {canManageInventory && <form onSubmit={saveInventory} className="grid gap-3 border-t border-slate-200 pt-4 sm:grid-cols-2 lg:grid-cols-3">
          <h3 className="font-semibold sm:col-span-2 lg:col-span-3">{editingId ? 'Editar insumo' : 'Registrar insumo'}</h3>
          <label className="grid gap-1 text-sm">Nombre<input required maxLength={100} value={inventoryForm.nombre} onChange={(e) => setInventoryForm({ ...inventoryForm, nombre: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2" /></label>
          <label className="grid gap-1 text-sm">Categoría<input required maxLength={50} value={inventoryForm.categoria} onChange={(e) => setInventoryForm({ ...inventoryForm, categoria: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2" /></label>
          <label className="grid gap-1 text-sm">Cantidad<input required type="number" min="0" value={inventoryForm.cantidadDisponible} onChange={(e) => setInventoryForm({ ...inventoryForm, cantidadDisponible: Number(e.target.value) })} className="rounded-lg border border-slate-300 px-3 py-2" /></label>
          <label className="grid gap-1 text-sm">Unidad<input required maxLength={20} value={inventoryForm.unidadMedida} onChange={(e) => setInventoryForm({ ...inventoryForm, unidadMedida: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2" /></label>
          <label className="grid gap-1 text-sm">Stock mínimo<input required type="number" min="0" value={inventoryForm.stockMinimo} onChange={(e) => setInventoryForm({ ...inventoryForm, stockMinimo: Number(e.target.value) })} className="rounded-lg border border-slate-300 px-3 py-2" /></label>
          <div className="flex items-end gap-2"><button className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white">Guardar</button>{editingId && <button type="button" onClick={() => setEditingId(null)} className="rounded-lg border px-4 py-2 text-sm">Cancelar</button>}</div>
        </form>}
      </section>

      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div><h2 className="text-xl font-bold text-slate-900">Turnos y atenciones</h2><p className="text-sm text-slate-600">Las atenciones cuentan solo los turnos con estado COMPLETADO.</p></div>
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
      </section>

      {canViewCobros && <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div><h2 className="text-xl font-bold text-slate-900">Cobros registrados</h2><p className="text-sm text-slate-600">Movimientos de ingreso vinculados a turnos, en el período consultado.</p></div>
        {cobros.length === 0
          ? <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">No hay cobros registrados para {from && to ? `${from} a ${to}` : `el año ${year}`}.</p>
          : <div className="overflow-x-auto"><table className="w-full min-w-[600px] text-left text-sm"><thead className="border-b text-xs uppercase text-slate-500"><tr><th className="py-3">Fecha</th><th>Concepto</th><th>Turno</th><th>Medio</th><th>Importe</th></tr></thead><tbody>
            {cobros.map((charge) => <tr key={charge.id} className="border-b last:border-0"><td className="py-3">{charge.fecha}</td><td>{charge.concepto}</td><td>{charge.turnoId}</td><td>{charge.medioPago || '—'}</td><td>{formatMoney(charge.importe)}</td></tr>)}
          </tbody></table></div>}
      </section>}

      {financeReport && <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div><h2 className="text-xl font-bold text-slate-900">Ganancias del período</h2><p className="text-sm text-slate-600">{from && to ? `${from} a ${to}` : `Año ${year}`}. Cálculo sobre movimientos efectivamente registrados.</p></div>
        <dl className="grid gap-3 sm:grid-cols-3">
          <FinanceMetric label="Ingresos registrados" amount={financeReport.ingresosRegistrados ?? 0} />
          <FinanceMetric label="Egresos registrados" amount={financeReport.egresosRegistrados ?? 0} />
          <FinanceMetric label="Resultado neto" amount={financeReport.gananciaNetaRegistrada ?? 0} />
        </dl>
        {financeReport.sinRegistros && <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">No hay movimientos financieros registrados para este período.</p>}
      </section>}

      {canRecordFinance && <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div><h2 className="text-xl font-bold text-slate-900">Registrar movimiento</h2><p className="text-sm text-slate-600">ADMIN registra cobros vinculados a un turno y egresos con su concepto.</p></div>
        {financeMessage && <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800">{financeMessage}</p>}
        <form onSubmit={saveMovement} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="grid gap-1 text-sm">Tipo<select value={financeForm.tipo} onChange={(e) => setFinanceForm({ ...financeForm, tipo: e.target.value as MovementRequest['tipo'], turnoId: undefined })} className="rounded-lg border border-slate-300 px-3 py-2"><option value="INGRESO">Cobro / ingreso</option><option value="EGRESO">Egreso</option></select></label>
          <label className="grid gap-1 text-sm">Fecha<input required type="date" value={financeForm.fecha} onChange={(e) => setFinanceForm({ ...financeForm, fecha: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2" /></label>
          <label className="grid gap-1 text-sm">Importe<input required type="number" min="0.01" step="0.01" value={financeForm.importe || ''} onChange={(e) => setFinanceForm({ ...financeForm, importe: Number(e.target.value) })} className="rounded-lg border border-slate-300 px-3 py-2" /></label>
          <label className="grid gap-1 text-sm">Concepto<input required maxLength={160} value={financeForm.concepto} onChange={(e) => setFinanceForm({ ...financeForm, concepto: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2" /></label>
          <label className="grid gap-1 text-sm">Medio de pago<input maxLength={40} value={financeForm.medioPago} onChange={(e) => setFinanceForm({ ...financeForm, medioPago: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2" /></label>
          {financeForm.tipo === 'INGRESO' && <label className="grid gap-1 text-sm">ID del turno<input required type="number" min="1" value={financeForm.turnoId || ''} onChange={(e) => setFinanceForm({ ...financeForm, turnoId: Number(e.target.value) })} className="rounded-lg border border-slate-300 px-3 py-2" /></label>}
          <button className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white sm:col-span-2 lg:col-span-3">Guardar movimiento</button>
        </form>
      </section>}
    </main>
  )
}

function ReportCard({ title, report }: { title: string; report: Report }) {
  return <article className="rounded-xl border border-slate-200 p-4"><h3 className="font-semibold text-slate-900">{title}</h3>
    <p className="mt-2 text-3xl font-bold text-blue-800">{report.totalAtenciones ?? 0}</p><p className="text-sm text-slate-600">atenciones completadas</p>
    <p className="mt-3 text-sm text-slate-700">Turnos registrados: {report.totalTurnos ?? 0}</p>
    {report.porEstado && <ul className="mt-3 space-y-1 text-sm text-slate-700">{Object.entries(report.porEstado).map(([status, count]) => <li key={status} className="flex justify-between"><span>{status}</span><span>{count}</span></li>)}</ul>}
  </article>
}

function formatMoney(amount: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(amount)
}

function FinanceMetric({ label, amount }: { label: string; amount: number }) {
  return <div className="rounded-xl border border-slate-200 p-4"><dt className="text-sm text-slate-600">{label}</dt><dd className="mt-1 text-2xl font-bold text-blue-800">{formatMoney(amount)}</dd></div>
}

function localToday() {
  const now = new Date()
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10)
}
