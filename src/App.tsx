import { BrowserRouter, Link, Navigate, Route, Routes } from 'react-router-dom'
import { ChatbotPage } from './pages/ChatbotPage'
import { ReportsPage } from './pages/ReportsPage'

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-50">
        <nav className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
            <Link to="/chatbot" className="font-bold text-slate-950">Novadent</Link>
            <div className="flex gap-4 text-sm font-semibold">
              <Link className="text-slate-700 hover:text-blue-700" to="/chatbot">Asistente</Link>
              <Link className="text-slate-700 hover:text-blue-700" to="/informes">Informes</Link>
            </div>
          </div>
        </nav>
        <Routes>
          <Route path="/" element={<Navigate to="/chatbot" replace />} />
          <Route path="/chatbot" element={<ChatbotPage />} />
          <Route path="/informes" element={<ReportsPage />} />
          <Route path="*" element={<Navigate to="/chatbot" replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}

export default App
