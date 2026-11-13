import { ApiListPage } from '../components/ApiListPage'

type Dentist = { id: number; nombre: string; apellido: string; matricula: string; email?: string; telefono?: string; activo: boolean; especialidad?: { nombre: string } }

export function OdontologosPage() {
  return <ApiListPage<Dentist> title="Equipo de odontología" description="Profesionales y especialidades registradas en el backend." path="/odontologos" columns={[
    { label: 'Profesional', value: row => <span className="font-medium text-slate-900">Dr. {row.nombre} {row.apellido}</span> },
    { label: 'Matrícula', value: row => row.matricula },
    { label: 'Especialidad', value: row => row.especialidad?.nombre || 'General' },
    { label: 'Contacto', value: row => row.email || row.telefono || '—' },
    { label: 'Estado', value: row => <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${row.activo ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{row.activo ? 'Activo' : 'Inactivo'}</span> },
  ]} />
}
