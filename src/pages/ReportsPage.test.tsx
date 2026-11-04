import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ReportsPage } from './ReportsPage'

afterEach(() => {
  cleanup()
  sessionStorage.clear()
  vi.unstubAllGlobals()
})

function setSession(role: 'ADMIN' | 'RECEPCIONISTA' = 'ADMIN') {
  sessionStorage.setItem('novadent.session', JSON.stringify({ token: 'signed-test-token', role, expiresAt: Date.now() + 60_000 }))
  vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:8080')
}

function setupFetch() {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const method = init?.method ?? 'GET'
    let body: unknown
    if (url.endsWith('/inventario')) {
      if (method === 'POST') body = { id: 1, nombre: 'Guantes', categoria: 'Descartables', cantidadDisponible: 12, unidadMedida: 'cajas', estado: 'DISPONIBLE' }
      else body = []
    } else if (url.includes('/cobros')) body = []
    else if (url.includes('/ganancias')) body = { ingresosRegistrados: 12000, egresosRegistrados: 2000, gananciaNetaRegistrada: 10000, sinRegistros: false }
    else if (url.includes('/anual')) body = { anio: 2026, totalTurnos: 4, totalAtenciones: 2, ingresosRegistrados: 0, egresosRegistrados: 0, gananciaNetaRegistrada: 0 }
    else if (url.includes('/finanzas/movimientos')) body = { id: 9, tipo: 'EGRESO' }
    else body = { totalTurnos: 4, totalAtenciones: 2, porEstado: { COMPLETADO: 2, PENDIENTE: 2 } }
    return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('ReportsPage', () => {
  it('muestra inventario, atenciones y datos financieros persistidos con bearer token', async () => {
    setSession()
    const fetchMock = setupFetch()
    render(<ReportsPage />)

    expect(await screen.findByText(/No hay insumos registrados/)).toBeInTheDocument()
    expect(await screen.findAllByText('Turnos registrados: 4')).toHaveLength(2)
    expect(screen.getByText('Cobros registrados')).toBeInTheDocument()
    expect(screen.getByText('Ganancias del período')).toBeInTheDocument()
    expect(screen.getByText('Registrar movimiento')).toBeInTheDocument()
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    for (const [, init] of fetchMock.mock.calls) {
      expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer signed-test-token')
    }
  })

  it('permite a ADMIN guardar un insumo mediante la API y refrescar la lista', async () => {
    setSession()
    const fetchMock = setupFetch()
    render(<ReportsPage />)

    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Guantes' } })
    fireEvent.change(screen.getByLabelText('Categoría'), { target: { value: 'Descartables' } })
    fireEvent.change(screen.getByLabelText('Cantidad'), { target: { value: '12' } })
    fireEvent.change(screen.getByLabelText('Unidad'), { target: { value: 'cajas' } })
    fireEvent.change(screen.getByLabelText('Stock mínimo'), { target: { value: '3' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('http://localhost:8080/api/reports/inventario', expect.objectContaining({ method: 'POST' })))
    expect(await screen.findByText('Insumo registrado.')).toBeInTheDocument()
  })

  it('no ofrece acciones de escritura a RECEPCIONISTA', async () => {
    setSession('RECEPCIONISTA')
    setupFetch()
    render(<ReportsPage />)

    expect(await screen.findByText('Cobros registrados')).toBeInTheDocument()
    expect(screen.queryByText('Registrar insumo')).not.toBeInTheDocument()
    expect(screen.queryByText('Registrar movimiento')).not.toBeInTheDocument()
  })
})
