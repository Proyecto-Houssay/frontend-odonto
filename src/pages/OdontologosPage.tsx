import React from 'react'
import { Stethoscope, Plus } from 'lucide-react'

export const OdontologosPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Stethoscope className="w-7 h-7 text-indigo-600" />
            Equipo de Odontólogos
          </h2>
          <p className="text-sm text-slate-500">
            Registro de profesionales, especialidades y horarios de atención.
          </p>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-4 py-2.5 rounded-xl shadow-xs transition-colors"
        >
          <Plus className="w-5 h-5" />
          Registrar Odontólogo
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
        <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Stethoscope className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-semibold text-slate-700">Módulo de Odontólogos (Placeholder)</h3>
        <p className="text-sm text-slate-500 max-w-md mx-auto mt-2">
          Gestión del staff médico de la clínica, matrículas y disponibilidad horaria para turnos.
        </p>
      </div>
    </div>
  )
}
