import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { RefreshCw, Search } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { apiRequest, errorMessage } from '../lib/api'

type Column<T> = { label: string; value: (row: T) => ReactNode }

export function ApiListPage<T extends { id: number }>({ title, description, path, columns }: {
  title: string
  description: string
  path: string
  columns: Column<T>[]
}) {
  const { token } = useAuth()
  const [rows, setRows] = useState<T[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const refresh = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError('')
    try { setRows(await apiRequest<T[]>(path, token)) }
    catch (cause) { setError(errorMessage(cause)) }
    finally { setLoading(false) }
  }, [path, token])
  useEffect(() => { void refresh() }, [refresh])
  const filtered = rows.filter(row => JSON.stringify(row).toLowerCase().includes(query.toLowerCase()))

  return <div className="space-y-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-medium text-blue-700">NOVADENT · API EN VIVO</p><h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">{title}</h1><p className="mt-2 text-sm text-slate-500">{description}</p></div><button onClick={() => void refresh()} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"><RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Actualizar</button></div>
    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5"><p className="text-sm text-slate-500">{loading ? 'Consultando…' : `${filtered.length} registros`}</p><label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-slate-400"><Search size={16} /><input aria-label={`Buscar en ${title}`} value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar…" className="w-full bg-transparent text-sm text-slate-700 outline-none sm:w-56" /></label></div>
      {error ? <div role="alert" className="p-8 text-center text-sm text-rose-700">{error}<p className="mt-2 text-slate-500">Revisá tu acceso y la conexión con el backend.</p></div> : loading ? <div className="p-10 text-center text-sm text-slate-500">Cargando datos…</div> : filtered.length === 0 ? <div className="p-10 text-center text-sm text-slate-500">{rows.length ? 'No hay coincidencias con esa búsqueda.' : 'Todavía no hay registros.'}</div> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr>{columns.map(column => <th key={column.label} className="px-5 py-3 font-semibold">{column.label}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{filtered.map(row => <tr key={row.id} className="hover:bg-slate-50/70">{columns.map(column => <td key={column.label} className="whitespace-nowrap px-5 py-4 text-slate-700">{column.value(row)}</td>)}</tr>)}</tbody></table></div>}
    </div>
  </div>
}
