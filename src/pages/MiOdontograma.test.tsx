import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MiOdontograma } from './MiOdontograma'

const response = (body: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  text: async () => JSON.stringify(body),
}) as Response

describe('MiOdontograma', () => {
  const fetchMock = vi.fn()
  beforeEach(() => { vi.stubGlobal('fetch', fetchMock) })
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks() })

  it('shows 32 FDI teeth and the actual professional record for the selected tooth', async () => {
    fetchMock.mockResolvedValue(response({ registradoEn: '2026-11-03T12:00:00', piezas: [
      { numero: 11, afeccion: 'caries', tratamiento: 'Empaste indicado por el profesional' },
    ] }))
    render(<MiOdontograma token="patient-token" />)

    expect(await screen.findByRole('button', { name: /Diente 11/ })).not.toBeNull()
    expect(screen.getAllByRole('button', { name: /^Diente / })).toHaveLength(32)
    expect(screen.getByText('caries')).not.toBeNull()
    expect(screen.getByText('Empaste indicado por el profesional')).not.toBeNull()
    expect(fetchMock).toHaveBeenCalledWith('/api/portal-paciente/odontograma', expect.objectContaining({
      headers: expect.objectContaining({ Authorization: 'Bearer patient-token' }),
    }))
    fireEvent.click(screen.getByRole('button', { name: /Diente 12/ }))
    expect(screen.getByText('Sin registro profesional para esta pieza.')).not.toBeNull()
    expect(screen.queryByText('sano')).toBeNull()
  })

  it('does not invent a diagnosis when no chart has been registered', async () => {
    fetchMock.mockResolvedValue(response({ registradoEn: null, piezas: [] }))
    render(<MiOdontograma token="patient-token" />)
    expect(await screen.findByText('Todavía no hay un odontograma profesional registrado para tu ficha.')).not.toBeNull()
    expect(screen.getAllByRole('button', { name: /^Diente / })).toHaveLength(32)
    expect(screen.getByText('Sin registro profesional para esta pieza.')).not.toBeNull()
  })

  it('offers a retry after a loading error rather than treating it as an empty chart', async () => {
    fetchMock.mockResolvedValueOnce(response({ message: 'No disponible' }, 503))
      .mockResolvedValueOnce(response({ registradoEn: null, piezas: [] }))
    render(<MiOdontograma token="patient-token" />)
    expect(await screen.findByRole('alert')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    await waitFor(() => expect(screen.getByText('Todavía no hay un odontograma profesional registrado para tu ficha.')).not.toBeNull())
  })

  it('does not leave the previous patient chart visible when the session changes', async () => {
    fetchMock.mockResolvedValueOnce(response({ registradoEn: '2026-11-03', piezas: [
      { numero: 11, afeccion: 'caries', tratamiento: 'Tratamiento privado' },
    ] })).mockImplementationOnce(() => new Promise(() => {}))
    const view = render(<MiOdontograma token="first-token" />)
    expect(await screen.findByText('Tratamiento privado')).not.toBeNull()
    view.rerender(<MiOdontograma token="second-token" />)
    expect(screen.queryByText('Tratamiento privado')).toBeNull()
    expect(screen.getByRole('status')).not.toBeNull()
  })

  it('lets the patient switch from FDI numbers to anatomical names and inspect an interactive 3D-style arch', async () => {
    fetchMock.mockResolvedValue(response({ registradoEn: null, piezas: [] }))
    render(<MiOdontograma token="patient-token" />)

    await screen.findByText('Todavía no hay un odontograma profesional registrado para tu ficha.')
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar nombres anatómicos' }))
    expect(screen.getByText('Incisivo central superior derecho')).not.toBeNull()
    expect(screen.getByRole('group', { name: 'Arcada superior' })).not.toBeNull()
    const upperRight = screen.getByRole('group', { name: 'Cuadrante 1 · Superior derecho' })
    const tooth11 = within(upperRight).getByRole('button', { name: /Diente 11: Incisivo central superior derecho/ })
    expect(tooth11.textContent).toContain('Incisivo central')
    expect(tooth11.textContent).toContain('Superior derecho')
    expect(screen.getByRole('group', { name: 'Cuadrante 2 · Superior izquierdo' })).not.toBeNull()
    expect(screen.getByRole('group', { name: 'Cuadrante 3 · Inferior izquierdo' })).not.toBeNull()
    expect(screen.getByRole('group', { name: 'Cuadrante 4 · Inferior derecho' })).not.toBeNull()
    expect(screen.getByRole('slider', { name: 'Rotar arcada dental' })).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Volver a vista 2D' }))
    expect(screen.queryByRole('slider', { name: 'Rotar arcada dental' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Activar vista 3D interactiva' }))
    expect(screen.getByText(/Vista de perspectiva 3D/)).not.toBeNull()
    expect(screen.getByRole('slider', { name: 'Rotar arcada dental' })).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar números FDI' }))
    expect(screen.queryByRole('group', { name: /^Cuadrante / })).toBeNull()
    expect(screen.getByRole('button', { name: /Diente 11:/ }).textContent).toContain('11')
  })
})
