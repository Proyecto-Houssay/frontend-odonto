import { ApiListPage } from '../components/ApiListPage'

type Appointment = { id: number; fecha: string; hora: string; estado: string; motivo?: string; paciente?: { nombre: string; apellido: string }; odontologo?: { nombre: string; apellido: string } }

export function TurnosPage() {
  return <ApiListPage<Appointment> title="Agenda de turnos" description="Citas, pacientes y profesionales consultados desde la API." path="/turnos" columns={[
    { label: 'Fecha', value: row => new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium' }).format(new Date(`${row.fecha}T12:00:00`)) },
    { label: 'Hora', value: row => row.hora.slice(0, 5) },
    { label: 'Paciente', value: row => `${row.paciente?.nombre || ''} ${row.paciente?.apellido || ''}`.trim() || '—' },
    { label: 'Profesional', value: row => `Dr. ${row.odontologo?.nombre || ''} ${row.odontologo?.apellido || ''}`.trim() },
    { label: 'Motivo', value: row => row.motivo || 'Consulta' },
    { label: 'Estado', value: row => row.estado },
  ]} />
}
