import React from 'react'
import { CalendarDays, ClipboardList, Stethoscope, Users } from 'lucide-react'

const demoStats = [
  { label: 'Pacientes registrados', value: '128', icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
  { label: 'Turnos del día', value: '14', icon: CalendarDays, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  { label: 'Odontólogos en servicio', value: '4', icon: Stethoscope, color: 'text-indigo-600', bg: 'bg-indigo-50' },
  { label: 'Historias clínicas', value: '96', icon: ClipboardList, color: 'text-amber-600', bg: 'bg-amber-50' },
]

export const InformesPage: React.FC = () => {
  return (
    <section className="space-y-6" aria-labelledby="reports-heading">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 id="reports-heading" className="text-2xl font-bold text-slate-800">Informes operativos</h1>
          <p className="mt-1 text-sm text-slate-500">Vista de demostración con el estilo del dashboard del equipo.</p>
        </div>
        <span className="w-fit rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
          Datos de ejemplo
        </span>
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
