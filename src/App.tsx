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
import { InformesPage } from './pages/InformesPage'
import { ReportsPage } from './pages/ReportsPage'
import { TeletriajePage } from './pages/TeletriajePage'
import { CentroInteligentePage } from './pages/CentroInteligentePage'
import { NotFoundPage } from './pages/NotFoundPage'
import { SeguimientoPage } from './pages/SeguimientoPage'
import { ChatbotPage } from './pages/ChatbotPage'
import { DrAnniePage } from './pages/DrAnniePage'

const Odontograma = lazy(() => import('./pages/Odontograma.jsx'))
function OdontogramaRoute({ demoMode, backendMode = false }: { demoMode: boolean; backendMode?: boolean }) {
  const { pacienteId } = useParams()
  const { session } = useAuth()
  return <Suspense fallback={<p>Cargando odontograma…</p>}><Odontograma pacienteId={pacienteId} token={session?.token || ''} demoMode={demoMode} backendMode={backendMode} /></Suspense>
}

function ClinicalRoute({ role, children, allowReception = false }: { role: UserRole | null; children: ReactNode; allowReception?: boolean }) {
  if (role === 'ADMINISTRADOR' || role === 'ODONTOLOGO' || (allowReception && role === 'RECEPCIONISTA')) return children
  return <section role="alert" className="rounded-2xl border border-amber-200 bg-white/95 p-6 shadow-sm">
    <h2 className="text-2xl font-bold text-slate-900">Acceso no disponible</h2>
    <p className="mt-2 text-sm text-slate-700">Esta sección clínica está reservada a odontología y administración. Tu cuenta no puede abrirla.</p>
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
  if (role === 'PACIENTE') return <DrAnniePage />

  return (
    <Routes>
      <Route path="/" element={<DashboardLayout />}>
        <Route index element={<DashboardHome role={role} token={session.token} />} />
        <Route path="pacientes" element={<PacientesPage />} />
        <Route path="seguimiento" element={<ClinicalRoute role={role}><SeguimientoPage token={session.token} role={role} /></ClinicalRoute>} />
        <Route path="odontograma" element={<ClinicalRoute role={role} allowReception><OdontogramaRoute demoMode={false} backendMode /></ClinicalRoute>} />
        <Route path="odontograma/backend" element={<ClinicalRoute role={role} allowReception><OdontogramaRoute demoMode={false} backendMode /></ClinicalRoute>} />
        <Route path="odontograma/demo" element={<ClinicalRoute role={role}><OdontogramaRoute demoMode /></ClinicalRoute>} />
        <Route path="pacientes/:pacienteId/odontograma" element={<ClinicalRoute role={role} allowReception><OdontogramaRoute demoMode={false} /></ClinicalRoute>} />
        <Route path="odontologos" element={<OdontologosPage />} />
        <Route path="turnos" element={<TurnosPage token={session.token} />} />
        <Route path="teletriaje" element={<ClinicalRoute role={role} allowReception><TeletriajePage /></ClinicalRoute>} />
        <Route path="centro-inteligente" element={<ClinicalRoute role={role}><CentroInteligentePage /></ClinicalRoute>} />
        <Route path="historias-clinicas" element={<ClinicalRoute role={role}><HistoriasClinicasPage /></ClinicalRoute>} />
        {role === 'ADMINISTRADOR' ? <Route path="usuarios" element={<UsuariosPage />} /> : null}
        <Route path="informes" element={<ReportsPage />} />
        {role === 'ADMINISTRADOR' ? <Route path="informes/demo" element={<InformesPage />} /> : null}
        {role === 'ADMINISTRADOR' ? <Route path="chatbot" element={<ChatbotPage />} /> : null}
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
