import { ApiListPage } from '../components/ApiListPage'

type Patient = { id: number; nombre: string; apellido: string; dni: string; telefono?: string; email: string; obraSocial?: string }

export function PacientesPage() {
  return <ApiListPage<Patient> title="Pacientes" description="Fichas consultadas desde la API de Novadent." path="/pacientes" columns={[
    { label: 'Paciente', value: row => <span className="font-medium text-slate-900">{row.nombre} {row.apellido}</span> },
    { label: 'DNI', value: row => row.dni },
    { label: 'Email', value: row => row.email },
    { label: 'Teléfono', value: row => row.telefono || '—' },
    { label: 'Cobertura', value: row => row.obraSocial || 'Particular' },
  ]} />
}
