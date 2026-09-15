import { Activity } from 'lucide-react'

function App() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 max-w-md w-full text-center space-y-4">
        <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center mx-auto">
          <Activity className="w-6 h-6" />
        </div>
        <h1 className="text-2xl font-bold text-slate-800">Novadent - Sistema Odontológico</h1>
        <p className="text-slate-600 text-sm">
          Proyecto inicializado con éxito con React, Vite, TypeScript y Tailwind CSS.
        </p>
      </div>
    </div>
  )
}

export default App
