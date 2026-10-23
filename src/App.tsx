import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Routes, Route, useParams } from 'react-router-dom'
import { AuthProvider } from './auth/AuthProvider'
import { useAuth } from './auth/useAuth'
import { DashboardLayout } from './components/layout/DashboardLayout'
import { DashboardHome } from './pages/DashboardHome'
import { LoginPage } from './pages/LoginPage'
import { PacientesPage } from './pages/PacientesPage'
import { TurnosPage } from './pages/TurnosPage'
import { OdontologosPage } from './pages/OdontologosPage'
import { HistoriasClinicasPage } from './pages/HistoriasClinicasPage'
import { UsuariosPage } from './pages/UsuariosPage'
import { InformesPage } from './pages/InformesPage'
import { NotFoundPage } from './pages/NotFoundPage'

const Odontograma = lazy(() => import('./pages/Odontograma.jsx'))
function OdontogramaRoute({ demoMode, backendMode = false }: { demoMode: boolean; backendMode?: boolean }) {
  const { pacienteId } = useParams()
  const { session } = useAuth()
  return <Suspense fallback={<p>Cargando odontograma…</p>}><Odontograma pacienteId={pacienteId} token={session?.token || ''} demoMode={demoMode} backendMode={backendMode} /></Suspense>
}

function AppRoutes() {
  const { session, logout } = useAuth()
  const hasPasswordResetToken = new URLSearchParams(window.location.search).has('token')

  useEffect(() => {
    if (hasPasswordResetToken && session) logout()
  }, [hasPasswordResetToken, session, logout])

  if (!session || hasPasswordResetToken) return <LoginPage />

  return (
    <Routes>
      <Route path="/" element={<DashboardLayout />}>
        <Route index element={<DashboardHome />} />
        <Route path="pacientes" element={<PacientesPage />} />
        <Route path="odontograma" element={<OdontogramaRoute demoMode={false} backendMode />} />
        <Route path="odontograma/backend" element={<OdontogramaRoute demoMode={false} backendMode />} />
        <Route path="odontograma/demo" element={<OdontogramaRoute demoMode />} />
        <Route path="pacientes/:pacienteId/odontograma" element={<OdontogramaRoute demoMode={false} />} />
        <Route path="odontologos" element={<OdontologosPage />} />
        <Route path="turnos" element={<TurnosPage />} />
        <Route path="historias-clinicas" element={<HistoriasClinicasPage />} />
        <Route path="usuarios" element={<UsuariosPage />} />
        <Route path="informes" element={<InformesPage />} />
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
