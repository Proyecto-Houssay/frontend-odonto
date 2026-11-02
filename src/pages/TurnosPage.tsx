import React from 'react'
import { Calendar, Plus } from 'lucide-react'

export const TurnosPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Calendar className="w-7 h-7 text-emerald-600" />
            Gestión de Turnos
          </h2>
          <p className="text-sm text-slate-500">
            Agenda médica, asignación de citas y disponibilidad de consultorios.
          </p>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-4 py-2.5 rounded-xl shadow-xs transition-colors"
        >
          <Plus className="w-5 h-5" />
          Nuevo Turno
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
        <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Calendar className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-semibold text-slate-700">Agenda de Turnos (Placeholder)</h3>
        <p className="text-sm text-slate-500 max-w-md mx-auto mt-2">
          Se integrará con el endpoint <code className="text-xs bg-slate-100 p-1 rounded">/api/turnos</code> para validación de disponibilidad y asignación por profesional.
        </p>
      </div>
    </div>
  )
}
