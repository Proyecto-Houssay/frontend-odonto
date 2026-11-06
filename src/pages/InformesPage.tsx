import React, { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  CalendarDays,
  ClipboardList,
  Stethoscope,
  Users,
  Boxes,
  Activity,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  Package,
  Layers
} from 'lucide-react'
import { useAuth } from '../auth/useAuth'
import {
  fetchResumenInformes,
  fetchReporteInventario,
  fetchReporteAnual,
  type ResumenInformes,
  type InventarioItem,
  type AnualReport
} from '../lib/reports'

const demoStats = [
  { label: 'Pacientes registrados', value: '128', icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
  { label: 'Turnos del día', value: '14', icon: CalendarDays, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  { label: 'Odontólogos en servicio', value: '4', icon: Stethoscope, color: 'text-indigo-600', bg: 'bg-indigo-50' },
  { label: 'Historias clínicas', value: '96', icon: ClipboardList, color: 'text-amber-600', bg: 'bg-amber-50' },
]

interface InformesPageProps {
  demoMode?: boolean
}

export const InformesPage: React.FC<InformesPageProps> = ({ demoMode = false }) => {
  const { session } = useAuth()
  const [resumen, setResumen] = useState<ResumenInformes | null>(null)
  const [inventario, setInventario] = useState<InventarioItem[]>([])
  const [reporteAnual, setReporteAnual] = useState<AnualReport | null>(null)
  const [isLoading, setIsLoading] = useState(!demoMode)
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    if (demoMode) return
    setIsLoading(true)
    setError(null)
    try {
      const [resumenData, inventarioData, anualData] = await Promise.all([
        fetchResumenInformes(session?.token),
        fetchReporteInventario(session?.token),
        fetchReporteAnual(new Date().getFullYear(), session?.token).catch(() => null)
      ])
      setResumen(resumenData)
      setInventario(inventarioData)
      setReporteAnual(anualData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo conectar con el servicio de informes.')
    } finally {
      setIsLoading(false)
    }
  }, [demoMode, session?.token])

  useEffect(() => {
    if (!demoMode) {
      loadData()
    }
  }, [demoMode, loadData])

  // Vista de Maqueta Demo (/informes/demo)
  if (demoMode) {
    return (
      <section className="space-y-6" aria-labelledby="reports-heading">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 id="reports-heading" className="text-2xl font-bold text-slate-800">Informes operativos</h1>
            <p className="mt-1 text-sm text-slate-500">Vista de demostración con el estilo del dashboard del equipo.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-fit rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
              Datos de ejemplo
            </span>
            <Link
              to="/informes"
              className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline px-3 py-1 rounded-full bg-blue-50 border border-blue-200"
            >
              <span>Ir a Informes Conectados (API Real)</span>
              <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        </header>

        <div role="note" className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
          Estas cifras son mocks del prototipo: no se consultan ni se guardan en el backend. Finanzas, cobros y caja quedaron fuera del alcance actual.
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {demoStats.map((stat) => {
            const Icon = stat.icon
            return (
              <article key={stat.label} className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
                <span className={'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ' + stat.bg + ' ' + stat.color}>
                  <Icon aria-hidden="true" className="h-6 w-6" />
                </span>
                <div>
                  <p className="text-xs font-medium text-slate-500">{stat.label}</p>
                  <p className="text-2xl font-bold text-slate-800">{stat.value}</p>
                </div>
              </article>
            )
          })}
        </div>
      </section>
    )
  }

  // Vista Conectada a la API Real (/informes)
  return (
    <section className="space-y-6" aria-labelledby="live-reports-heading">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 id="live-reports-heading" className="text-2xl font-bold text-slate-800">
            Informes y Gestión Odontológica
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Módulo conectado en tiempo real con la API de Spring Boot (<code>/api/reports</code>).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Conectado a la API backend
          </span>
          <button
            type="button"
            onClick={loadData}
            disabled={isLoading}
            className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors"
            title="Recargar informes"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <Link
            to="/informes/demo"
            className="text-xs text-slate-600 hover:text-slate-900 underline px-2 py-1"
          >
            Ver maqueta demo
          </Link>
        </div>
      </header>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={loadData}
            className="px-3 py-1 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* KPI Cards Conectadas a la API */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            <Activity aria-hidden="true" className="h-6 w-6" />
          </span>
          <div>
            <p className="text-xs font-medium text-slate-500">Atenciones Registradas</p>
            <p className="text-2xl font-bold text-slate-800">
              {isLoading ? '…' : (resumen?.totalAtencionesRegistradas ?? 0)}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">Turnos atendidos en BD</p>
          </div>
        </article>

        <article className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
            <Boxes aria-hidden="true" className="h-6 w-6" />
          </span>
          <div>
            <p className="text-xs font-medium text-slate-500">Insumos en Inventario</p>
            <p className="text-2xl font-bold text-slate-800">
              {isLoading ? '…' : (resumen?.totalItemsInventario ?? inventario.length)}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">Lotes monitoreados</p>
          </div>
        </article>

        <article className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
            <CheckCircle2 aria-hidden="true" className="h-6 w-6" />
          </span>
          <div>
            <p className="text-xs font-medium text-slate-500">Estado del Módulo</p>
            <p className="text-xl font-bold text-slate-800">
              {isLoading ? '…' : (resumen?.estado ?? 'DISPONIBLE')}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">Persistencia activa</p>
          </div>
        </article>

        <article className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
            <Layers aria-hidden="true" className="h-6 w-6" />
          </span>
          <div>
            <p className="text-xs font-medium text-slate-500">Reportes Disponibles</p>
            <p className="text-sm font-bold text-slate-800 mt-1">
              {isLoading ? '…' : (resumen?.reportesDisponibles?.join(', ') || 'inventario, anual')}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">Filtros por período</p>
          </div>
        </article>
      </div>

      {/* Tabla de Inventario de Insumos Conectada */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-blue-600" />
            <h2 className="font-bold text-slate-800 text-base">Inventario Clínico Oficial</h2>
          </div>
          <span className="text-xs text-slate-500 font-medium">
            {inventario.length} insumos registrados
          </span>
        </div>

        {inventario.length === 0 && !isLoading ? (
          <div className="p-8 text-center text-slate-500 text-sm">
            No hay insumos registrados en la base de datos o el inventario está vacío.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500 border-b border-slate-100">
                <tr>
                  <th className="px-6 py-3">Insumo</th>
                  <th className="px-6 py-3">Categoría</th>
                  <th className="px-6 py-3 text-right">Stock Disponible</th>
                  <th className="px-6 py-3">Unidad</th>
                  <th className="px-6 py-3 text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {inventario.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-3.5 font-medium text-slate-800">{item.nombre}</td>
                    <td className="px-6 py-3.5">
                      <span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-700">
                        {item.categoria}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-right font-bold text-slate-900">
                      {item.cantidadDisponible}
                    </td>
                    <td className="px-6 py-3.5 text-slate-500">{item.unidadMedida}</td>
                    <td className="px-6 py-3.5 text-center">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          item.estado === 'BAJO_STOCK' || item.cantidadDisponible <= 5
                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                            : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        }`}
                      >
                        {item.estado || (item.cantidadDisponible <= 5 ? 'BAJO_STOCK' : 'DISPONIBLE')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Resumen Anual de Atenciones si está disponible */}
      {reporteAnual && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-slate-800 text-base flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-indigo-600" />
              Atenciones Anuales ({reporteAnual.anio})
            </h2>
            <span className="text-xs font-semibold text-slate-700 bg-slate-100 px-3 py-1 rounded-full">
              Total: {reporteAnual.totalAtenciones} pacientes atendidos
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
            {reporteAnual.meses.map((m) => (
              <div key={m.mes} className="bg-slate-50 border border-slate-100 rounded-xl p-2.5 text-center">
                <p className="text-[11px] font-semibold uppercase text-slate-500">{m.nombreMes.slice(0, 3)}</p>
                <p className="text-lg font-bold text-slate-800 mt-0.5">{m.atenciones}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
