import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { SeguimientoPage } from './SeguimientoPage'

const response = (body: unknown) => ({ ok: true, status: 200, text: async () => JSON.stringify(body) }) as Response

describe('SeguimientoPage', () => {
  const fetchMock = vi.fn()
  beforeEach(() => vi.stubGlobal('fetch', fetchMock))
  afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks() })

  it('lets a dentist inspect and review a patient report', async () => {
    const summary = { id: 9, pacienteId: 7, pieza: 11, dolor: 6, sintomas: 'Molestia', estado: 'PENDIENTE', fotoDisponible: false }
    fetchMock.mockResolvedValueOnce(response([summary]))
      .mockResolvedValueOnce(response({ ...summary, fotoBase64: null }))
      .mockResolvedValueOnce(response({ ...summary, estado: 'REVISADO', revisionProfesional: 'Control en consulta.' }))
      .mockResolvedValueOnce(response([{ ...summary, estado: 'REVISADO', revisionProfesional: 'Control en consulta.' }]))

    render(<SeguimientoPage token="dentist-token" role="ODONTOLOGO" />)
    fireEvent.click(await screen.findByRole('button', { name: /Reporte #9/ }))
    fireEvent.change(await screen.findByLabelText('Nota profesional'), { target: { value: 'Control en consulta.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Registrar revisión' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/seguimiento/reportes/9/revision', expect.objectContaining({
      method: 'PUT',
      headers: expect.objectContaining({ Authorization: 'Bearer dentist-token' }),
      body: expect.stringContaining('Control en consulta.'),
    })))
    expect(await screen.findByText('Revisión registrada')).not.toBeNull()
  })
})
