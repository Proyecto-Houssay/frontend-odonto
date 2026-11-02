import React from 'react'
import { Users, Calendar, Stethoscope, ClipboardList, CheckCircle2 } from 'lucide-react'

export const DashboardHome: React.FC = () => {
  const stats = [
    { label: 'Pacientes Registrados', value: '128', icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Turnos del Día', value: '14', icon: Calendar, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Odontólogos en Servicio', value: '4', icon: Stethoscope, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: 'Historias Clínicas', value: '96', icon: ClipboardList, color: 'text-amber-600', bg: 'bg-amber-50' },
  ]

  const teamAssignments = [
    { role: 'Login & Autenticación', dev: 'Mateo', status: 'En desarrollo' },
    { role: 'Dashboard & Layout Base', dev: 'Braian', status: 'En desarrollo' },
    { role: 'Gestión de Pacientes', dev: 'Braian / Equipo', status: 'En backlog' },
    { role: 'Gestión de Usuarios', dev: 'Kevin', status: 'En desarrollo' },
    { role: 'Gestión de Informes y Caja', dev: 'Josué', status: 'En desarrollo' },
    { role: 'Historias Clínicas', dev: 'Iris', status: 'En desarrollo' },
  ]

  return (
    <div className="space-y-6">
      {/* Bienvenida */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-6 sm:p-8 text-white shadow-sm">
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
          Bienvenido al Sistema Odontológico Novadent
        </h2>
        <p className="mt-2 text-blue-100 text-sm sm:text-base max-w-2xl">
          Estructura del Dashboard y sistema de enrutamiento base inicializado con éxito.
          Desde este panel podrás acceder a todos los módulos clínicos y administrativos.
        </p>
      </div>

      {/* Tarjetas de estadísticas de muestra */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <div
              key={stat.label}
              className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4"
            >
              <div className={`w-12 h-12 rounded-xl ${stat.bg} ${stat.color} flex items-center justify-center flex-shrink-0`}>
                <Icon className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs font-medium text-slate-500">{stat.label}</span>
                <p className="text-2xl font-bold text-slate-800">{stat.value}</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Estado del equipo y módulos */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
        <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-blue-600" />
          Distribución de Módulos (Sprint 1)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {teamAssignments.map((item) => (
            <div
              key={item.role}
              className="p-4 rounded-xl border border-slate-100 bg-slate-50/60 flex items-center justify-between"
            >
              <div>
                <p className="text-sm font-semibold text-slate-800">{item.role}</p>
                <p className="text-xs text-slate-500">Responsable: <span className="font-medium text-slate-700">{item.dev}</span></p>
              </div>
              <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                {item.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
