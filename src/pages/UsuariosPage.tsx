import React from 'react'
import { UserCheck, Plus } from 'lucide-react'

export const UsuariosPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <UserCheck className="w-7 h-7 text-purple-600" />
            Gestión de Usuarios
          </h2>
          <p className="text-sm text-slate-500">
            Administración de cuentas, roles (administrador, recepcionista, odontólogo) y accesos.
          </p>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-medium px-4 py-2.5 rounded-xl shadow-xs transition-colors"
        >
          <Plus className="w-5 h-5" />
          Nuevo Usuario
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
        <div className="w-16 h-16 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <UserCheck className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-semibold text-slate-700">Módulo de Usuarios (Placeholder)</h3>
        <p className="text-sm text-slate-500 max-w-md mx-auto mt-2">
          Área asignada a <span className="font-semibold text-slate-700">Kevin</span>. Aquí se gestionarán las cuentas, contraseñas, fotos de perfil y mensajes del sistema.
        </p>
      </div>
    </div>
  )
}
