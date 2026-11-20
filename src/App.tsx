import { lazy, Suspense, useEffect, type ReactNode } from 'react'
import { BrowserRouter, Link, Routes, Route, useParams } from 'react-router-dom'
import { AuthProvider } from './auth/AuthProvider'
import { useAuth } from './auth/useAuth'
import type { UserRole } from './auth/role'
import { DashboardLayout } from './components/layout/DashboardLayout'
import { DashboardHome } from './pages/DashboardHome'
import { LoginPage } from './pages/LoginPage'
import { PacientesPage } from './pages/PacientesPage'
import { TurnosPage } from './pages/TurnosPage'
import { OdontologosPage } from './pages/OdontologosPage'
import { HistoriasClinicasPage } from './pages/HistoriasClinicasPage'
import { UsuariosPage } from './pages/UsuariosPage'
import { PersonalPage } from './pages/PersonalPage'
import { MiCuentaPage } from './pages/MiCuentaPage'
import { InformesPage } from './pages/InformesPage'
import { ReportsPage } from './pages/ReportsPage'
import { TeletriajePage } from './pages/TeletriajePage'
import { CentroInteligentePage } from './pages/CentroInteligentePage'
import { NotFoundPage } from './pages/NotFoundPage'
import { PortalPaciente } from './pages/PortalPaciente'
import { SeguimientoPage } from './pages/SeguimientoPage'
import { ChatbotPage } from './pages/ChatbotPage'
import { DraZieglerPage } from './pages/DraZieglerPage'
import { FaceCheckin } from './components/FaceCheckin'

const Odontograma = lazy(() => import('./pages/Odontograma.jsx'))
function OdontogramaRoute({ demoMode, backendMode = false }: { demoMode: boolean; backendMode?: boolean }) {
  const { pacienteId } = useParams()
  const { session } = useAuth()
  return <Suspense fallback={<p>Cargando odontograma…</p>}><Odontograma pacienteId={pacienteId} token={session?.token || ''} demoMode={demoMode} backendMode={backendMode} /></Suspense>
}

function RoleRoute({ role, allowedRoles, children }: { role: UserRole | null; allowedRoles: UserRole[]; children: ReactNode }) {
  if (role && allowedRoles.includes(role)) return children
  return <section role="alert" className="rounded-2xl border border-amber-200 bg-white/95 p-6 shadow-sm">
    <h2 className="text-2xl font-bold text-slate-900">Acceso no disponible</h2>
    <p className="mt-2 text-sm text-slate-700">Esta sección no está habilitada para tu rol actual.</p>
    <Link to="/" className="mt-5 inline-flex min-h-10 items-center rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">Volver al inicio</Link>
  </section>
}

function AppRoutes() {
  const { session, logout } = useAuth()
  const hasPasswordResetToken = new URLSearchParams(window.location.search).has('token')

  useEffect(() => {
    if (hasPasswordResetToken && session) logout()
  }, [hasPasswordResetToken, session, logout])

  if (!session || hasPasswordResetToken) return <LoginPage />
  const role = session.role
  if (role === 'PACIENTE') return <PortalPaciente token={session.token} onLogout={logout} />

  return (
    <Routes>
      <Route path="/" element={<DashboardLayout />}>
        <Route index element={<DashboardHome role={role} token={session.token} onVerified={() => undefined} />} />
        <Route path="pacientes" element={<RoleRoute role={role} allowedRoles={['ODONTOLOGO', 'RECEPCIONISTA']}><PacientesPage /></RoleRoute>} />
        <Route path="seguimiento" element={<RoleRoute role={role} allowedRoles={['ODONTOLOGO']}><SeguimientoPage token={session.token} role={role} /></RoleRoute>} />
        <Route path="odontograma" element={<RoleRoute role={role} allowedRoles={['ODONTOLOGO', 'RECEPCIONISTA']}><OdontogramaRoute demoMode={false} /></RoleRoute>} />
        <Route path="odontograma/backend" element={<RoleRoute role={role} allowedRoles={['ODONTOLOGO', 'RECEPCIONISTA']}><OdontogramaRoute demoMode={false} backendMode /></RoleRoute>} />
        <Route path="odontograma/demo" element={<RoleRoute role={role} allowedRoles={['ODONTOLOGO']}><OdontogramaRoute demoMode /></RoleRoute>} />
        <Route path="pacientes/:pacienteId/odontograma" element={<RoleRoute role={role} allowedRoles={['ODONTOLOGO', 'RECEPCIONISTA']}><OdontogramaRoute demoMode={false} /></RoleRoute>} />
        <Route path="odontologos" element={<RoleRoute role={role} allowedRoles={['ADMINISTRADOR', 'RECEPCIONISTA']}><OdontologosPage /></RoleRoute>} />
        <Route path="personal" element={<RoleRoute role={role} allowedRoles={['ADMINISTRADOR']}><PersonalPage /></RoleRoute>} />
        <Route path="mi-cuenta" element={<MiCuentaPage />} />
        <Route path="turnos" element={<RoleRoute role={role} allowedRoles={['ODONTOLOGO', 'RECEPCIONISTA']}><TurnosPage token={session.token} /></RoleRoute>} />
        <Route path="teletriaje" element={<RoleRoute role={role} allowedRoles={['ODONTOLOGO', 'RECEPCIONISTA']}><TeletriajePage /></RoleRoute>} />
        <Route path="centro-inteligente" element={<RoleRoute role={role} allowedRoles={['ODONTOLOGO']}><CentroInteligentePage token={session.token} /></RoleRoute>} />
        <Route path="dra-ziegler" element={<RoleRoute role={role} allowedRoles={['ODONTOLOGO']}><DraZieglerPage token={session.token} /></RoleRoute>} />
        <Route path="dr-annie" element={<RoleRoute role={role} allowedRoles={['ODONTOLOGO']}><DraZieglerPage token={session.token} /></RoleRoute>} />
        <Route path="historias-clinicas" element={<RoleRoute role={role} allowedRoles={['ODONTOLOGO']}><HistoriasClinicasPage /></RoleRoute>} />
        <Route path="usuarios" element={<RoleRoute role={role} allowedRoles={['ADMINISTRADOR']}><UsuariosPage /></RoleRoute>} />
        <Route path="informes" element={<RoleRoute role={role} allowedRoles={['ADMINISTRADOR']}><ReportsPage /></RoleRoute>} />
        <Route path="informes/demo" element={<RoleRoute role={role} allowedRoles={['ADMINISTRADOR']}><InformesPage /></RoleRoute>} />
        <Route path="check-in" element={<RoleRoute role={role} allowedRoles={['ADMINISTRADOR', 'ODONTOLOGO', 'RECEPCIONISTA']}><FaceCheckin /></RoleRoute>} />
        <Route path="chatbot" element={<RoleRoute role={role} allowedRoles={['ADMINISTRADOR', 'ODONTOLOGO', 'RECEPCIONISTA']}><ChatbotPage /></RoleRoute>} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
