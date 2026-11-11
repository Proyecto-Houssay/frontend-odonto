import type { ElementType } from 'react'
import { NavLink } from 'react-router-dom'
import { BarChart3, CalendarDays, ClipboardCheck, ClipboardList, LayoutDashboard, MessageCircle, Sparkles, Stethoscope, Users, UserRoundCog, Video, X } from 'lucide-react'
import { useAuth } from '../../auth/useAuth'
import { roleFromToken, type UserRole } from '../../auth/role'
import { NovadentBrand } from '../brand/NovadentBrand'

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

type StaffRole = Exclude<UserRole, 'PACIENTE'>
type NavItem = { label: string; to: string; icon: ElementType; roles: StaffRole[] }

const STAFF_ROLES: StaffRole[] = ['ADMINISTRADOR', 'ODONTOLOGO', 'RECEPCIONISTA']
const navItems: NavItem[] = [
  { label: 'Inicio', to: '/', icon: LayoutDashboard, roles: STAFF_ROLES },
  { label: 'Pacientes', to: '/pacientes', icon: Users, roles: STAFF_ROLES },
  { label: 'Turnos', to: '/turnos', icon: CalendarDays, roles: STAFF_ROLES },
  { label: 'Teletriaje', to: '/teletriaje', icon: Video, roles: STAFF_ROLES },
  { label: 'Centro inteligente', to: '/centro-inteligente', icon: Sparkles, roles: ['ADMINISTRADOR', 'ODONTOLOGO'] },
  { label: 'Odontólogos', to: '/odontologos', icon: Stethoscope, roles: ['ADMINISTRADOR', 'RECEPCIONISTA'] },
  { label: 'Historias Clínicas', to: '/historias-clinicas', icon: ClipboardList, roles: ['ADMINISTRADOR', 'ODONTOLOGO'] },
  { label: 'Odontograma', to: '/odontograma', icon: ClipboardList, roles: STAFF_ROLES },
  { label: 'Seguimiento', to: '/seguimiento', icon: ClipboardCheck, roles: ['ADMINISTRADOR', 'ODONTOLOGO'] },
  { label: 'Gestión de Usuarios', to: '/usuarios', icon: UserRoundCog, roles: ['ADMINISTRADOR'] },
  { label: 'Informes', to: '/informes', icon: BarChart3, roles: ['ADMINISTRADOR'] },
  { label: 'Informes (demo)', to: '/informes/demo', icon: BarChart3, roles: ['ADMINISTRADOR'] },
  { label: 'Asistente IA', to: '/chatbot', icon: MessageCircle, roles: ['ADMINISTRADOR'] },
]

const plannedByRole: Record<StaffRole, { label: string; icon: ElementType }[]> = {
  ADMINISTRADOR: [],
  ODONTOLOGO: [],
  RECEPCIONISTA: [
    { label: 'Confirmaciones', icon: ClipboardCheck },
  ],
}

const roleLabel: Record<StaffRole, string> = {
  ADMINISTRADOR: 'Administración',
  ODONTOLOGO: 'Odontología',
  RECEPCIONISTA: 'Recepción',
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { session } = useAuth()
  const role = session?.role || roleFromToken(session?.token || '')
  const staffRole = role && role !== 'PACIENTE' ? role : null

  return <>
    {isOpen ? <div className="fixed inset-0 z-40 bg-slate-900/45 backdrop-blur-sm lg:hidden" onClick={onClose} aria-hidden="true" /> : null}
    <aside className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-[#CBD5E1] bg-[#DCE6F1]/90 shadow-xl shadow-slate-900/10 backdrop-blur-xl transition-transform duration-300 lg:static lg:z-auto lg:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="flex items-start justify-between gap-2 border-b border-[#CBD5E1] px-5 py-6">
        <NovadentBrand compact />
        <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-600 hover:bg-[#DBEAFE] lg:hidden" aria-label="Cerrar menú"><X className="h-5 w-5" /></button>
      </div>
      <nav aria-label="Navegación principal" className="flex-1 overflow-y-auto px-4 py-5">
        <p className="px-3 text-[0.7rem] font-bold uppercase tracking-[0.16em] text-[#475569]">Espacio de {staffRole ? roleLabel[staffRole] : 'trabajo'}</p>
        <div className="mt-3 space-y-1">
          {navItems.filter(item => staffRole && item.roles.includes(staffRole)).map(({ label, to, icon: Icon }) =>
            <NavLink key={to} to={to} end={to === '/' || to === '/informes' || to === '/informes/demo'} onClick={() => { if (window.innerWidth < 1024) onClose() }}
              className={({ isActive }) => `flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${isActive ? 'bg-[#DBEAFE] text-[#1D4ED8] font-bold border border-blue-300/70 shadow-xs' : 'text-[#475569] hover:bg-[#DBEAFE]/60 hover:text-[#1D4ED8]'}`}>
              <Icon aria-hidden="true" className="h-5 w-5 shrink-0" />
              <span>{label}</span>
            </NavLink>,
          )}
        </div>
        {staffRole && plannedByRole[staffRole].length ? <div className="mt-8 border-t border-[#CBD5E1] pt-5">
          <p className="px-3 text-[0.7rem] font-bold uppercase tracking-[0.16em] text-[#475569]">En preparación</p>
          <ul className="mt-3 space-y-1">{plannedByRole[staffRole].map(({ label, icon: Icon }) =>
            <li key={label} className="flex min-h-10 items-center gap-3 rounded-xl px-3 py-2 text-sm text-[#475569]">
              <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
              <span>{label}</span>
              <span className="ml-auto text-[0.6rem] font-semibold uppercase tracking-wide">Pronto</span>
            </li>,
          )}</ul>
        </div> : null}
      </nav>
      <div className="border-t border-[#CBD5E1] p-4">
        <div className="rounded-xl border border-[#CBD5E1] bg-[#DBEAFE]/80 px-3 py-3 text-xs text-[#475569]">
          <p className="font-bold text-[#1D4ED8]">{staffRole ? roleLabel[staffRole] : 'NovaDent'}</p>
          <p className="mt-1 break-all text-[#475569]">{session?.username || 'Sesión activa'}</p>
        </div>
      </div>
    </aside>
  </>
}
