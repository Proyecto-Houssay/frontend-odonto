import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { ReportsPage } from './ReportsPage'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('ReportsPage', () => {
  it('muestra inventario persistido y métricas de informes del backend', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:8080')
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      const body = url.endsWith('/inventario')
        ? [{ id: 7, nombre: 'Guantes', categoria: 'Descartables', cantidadDisponible: 12, unidadMedida: 'cajas', estado: 'DISPONIBLE' }]
        : { tipo: 'Turnos registrados', totalTurnos: 4, porEstado: { PENDIENTE: 2, CANCELADO: 2 }, anio: 2026 }
      return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }))

    render(<ReportsPage />)

    expect(await screen.findByText('Guantes')).toBeInTheDocument()
    expect(screen.getByText('12 cajas')).toBeInTheDocument()
    expect(await screen.findAllByText('4')).toHaveLength(2)
    expect(screen.getByText(/Ganancias y cobros no están disponibles/)).toBeInTheDocument()
  })

  it('representa un inventario vacío como vacío, no completa con datos estáticos', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:8080')
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const body = String(input).endsWith('/inventario') ? [] : { totalTurnos: 0, porEstado: {}, anio: 2026 }
      return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }))

    render(<ReportsPage />)

    expect(await screen.findByText('No hay insumos registrados.')).toBeInTheDocument()
    expect(screen.queryByText('Guantes')).not.toBeInTheDocument()
  })
})
