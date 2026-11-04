import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ChatbotPage } from './ChatbotPage'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function setApiBase() {
  vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:8080')
}

describe('ChatbotPage', () => {
  it('envía al endpoint real y presenta citas y versiones del contrato', async () => {
    setApiBase()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      respuesta: 'La clínica atiende de lunes a viernes.',
      intencion: 'consulta_general',
      accionesSugeridas: [],
      timestamp: '2026-11-02T12:00:00',
      citas: [{ id: 'source-1', documento: 'horarios.md — Atención', version: '2026-10', fragmento: 'Lunes a viernes de 9 a 17.' }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })))

    render(<ChatbotPage />)
    fireEvent.change(screen.getByLabelText('Tu pregunta'), { target: { value: '¿Qué horarios tienen?' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }))

    expect(await screen.findByText('La clínica atiende de lunes a viernes.')).toBeInTheDocument()
    expect(screen.getByText('horarios.md — Atención · versión 2026-10')).toBeInTheDocument()
    expect(screen.getByText(/No brinda diagnósticos ni reemplaza la consulta con un profesional/)).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledWith('http://localhost:8080/api/chatbot/ask', expect.objectContaining({ method: 'POST' }))
  })

  it('muestra la negativa del servidor sin inventar una respuesta de respaldo', async () => {
    setApiBase()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      respuesta: 'No tengo información suficiente en las fuentes aprobadas para responder esa consulta.',
      intencion: 'consulta_general', accionesSugeridas: [], timestamp: '2026-11-02T12:00:00', citas: [],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })))

    render(<ChatbotPage />)
    fireEvent.change(screen.getByLabelText('Tu pregunta'), { target: { value: 'Pregunta fuera de las fuentes' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }))

    expect(await screen.findByText(/No tengo información suficiente/)).toBeInTheDocument()
    expect(screen.getByText('Sin evidencia suficiente en las fuentes.')).toBeInTheDocument()
  })

  it('explica 403 sin mostrar contenido ficticio', async () => {
    setApiBase()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 403 })))

    render(<ChatbotPage />)
    fireEvent.change(screen.getByLabelText('Tu pregunta'), { target: { value: 'Consulta' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }))

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Tu usuario no tiene permiso'))
    expect(screen.queryByText(/$15\.000/)).not.toBeInTheDocument()
  })
})
