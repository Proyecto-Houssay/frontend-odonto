import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { DashboardLayout } from './components/layout/DashboardLayout'
import { DashboardHome } from './pages/DashboardHome'
import { PacientesPage } from './pages/PacientesPage'
import { TurnosPage } from './pages/TurnosPage'
import { OdontologosPage } from './pages/OdontologosPage'
import { HistoriasClinicasPage } from './pages/HistoriasClinicasPage'
import { UsuariosPage } from './pages/UsuariosPage'
import { InformesPage } from './pages/InformesPage'
import { NotFoundPage } from './pages/NotFoundPage'

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Ruta raíz con Layout contenedor y Outlet */}
        <Route path="/" element={<DashboardLayout />}>
          <Route index element={<DashboardHome />} />
          <Route path="pacientes" element={<PacientesPage />} />
          <Route path="odontologos" element={<OdontologosPage />} />
          <Route path="turnos" element={<TurnosPage />} />
          <Route path="historias-clinicas" element={<HistoriasClinicasPage />} />
          <Route path="usuarios" element={<UsuariosPage />} />
          <Route path="informes" element={<InformesPage />} />
        </Route>

        {/* Ruta para capturar cualquier enlace no encontrado (404) */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
