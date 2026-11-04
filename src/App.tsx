import { useEffect, useState } from 'react'
import { BrowserRouter, Link, Navigate, Route, Routes } from 'react-router-dom'
import { ChatbotPage } from './pages/ChatbotPage'
import { ReportsPage } from './pages/ReportsPage'
import { LoginPage } from './pages/LoginPage'
import { clearSession, getSession } from './lib/api'
import type { UserSession } from './lib/api'

function App() {
  const [session, setSession] = useState<UserSession | null>(() => getSession())
  const canChat = session?.role === 'ADMIN' || session?.role === 'PATIENT'
  const canViewReports = session?.role === 'ADMIN' || session?.role === 'RECEPCIONISTA' || session?.role === 'ODONTOLOGO'
  const home = canViewReports ? '/informes' : '/chatbot'

  useEffect(() => {
    const expire = () => setSession(null)
    window.addEventListener('novadent:session-expired', expire)
    return () => window.removeEventListener('novadent:session-expired', expire)
  }, [])

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-50">
        <nav className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
            <Link to={session ? home : '/ingresar'} className="font-bold text-slate-950">Novadent</Link>
            <div className="flex gap-4 text-sm font-semibold">
              {canChat && <Link className="text-slate-700 hover:text-blue-700" to="/chatbot">Asistente</Link>}
              {canViewReports && <Link className="text-slate-700 hover:text-blue-700" to="/informes">Informes</Link>}
              {session && <span className="text-slate-500">{session.role}</span>}
              {session
                ? <button className="text-slate-700 hover:text-blue-700" onClick={() => { clearSession(); setSession(null) }}>Salir</button>
                : <Link className="text-slate-700 hover:text-blue-700" to="/ingresar">Ingresar</Link>}
            </div>
          </div>
        </nav>
        <Routes>
          <Route path="/" element={<Navigate to={session ? home : '/ingresar'} replace />} />
          <Route path="/ingresar" element={session
            ? <Navigate to={home} replace />
            : <LoginPage onLogin={setSession} />} />
          <Route path="/chatbot" element={canChat ? <ChatbotPage /> : <Navigate to={session ? home : '/ingresar'} replace />} />
          <Route path="/informes" element={canViewReports ? <ReportsPage /> : <Navigate to={session ? home : '/ingresar'} replace />} />
          <Route path="*" element={<Navigate to={session ? home : '/ingresar'} replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}

export default App
