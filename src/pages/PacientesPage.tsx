import React from 'react'
import { Users, Plus, Search } from 'lucide-react'

export const PacientesPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Users className="w-7 h-7 text-blue-600" />
            Gestión de Pacientes
          </h2>
          <p className="text-sm text-slate-500">
            Registro, edición y consulta de datos personales de pacientes.
          </p>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2.5 rounded-xl shadow-xs transition-colors"
        >
          <Plus className="w-5 h-5" />
          Nuevo Paciente
        </button>
      </div>

      {/* Contenedor provisorio / placeholder */}
      <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
        <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Search className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-semibold text-slate-700">Módulo de Pacientes (Placeholder)</h3>
        <p className="text-sm text-slate-500 max-w-md mx-auto mt-2">
          Este espacio se conectará con los endpoints de la API Spring Boot (<code className="text-xs bg-slate-100 p-1 rounded">/api/pacientes</code>) desarrollados en la HU-01 del backend.
        </p>
      </div>
    </div>
  )
}
