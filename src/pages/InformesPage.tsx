import React from 'react'
import { BarChart3, Download } from 'lucide-react'

export const InformesPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <BarChart3 className="w-7 h-7 text-emerald-600" />
            Informes y Balances
          </h2>
          <p className="text-sm text-slate-500">
            Reportes financieros, cobros, balances anuales e inventario de insumos odontológicos.
          </p>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-4 py-2.5 rounded-xl shadow-xs transition-colors"
        >
          <Download className="w-5 h-5" />
          Exportar Informe
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
        <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <BarChart3 className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-semibold text-slate-700">Módulo de Informes (Placeholder)</h3>
        <p className="text-sm text-slate-500 max-w-md mx-auto mt-2">
          Área asignada a <span className="font-semibold text-slate-700">Josué</span>. Aquí se visualizarán los gráficos de facturación, atenciones realizadas y control de stock de insumos.
        </p>
      </div>
    </div>
  )
}
