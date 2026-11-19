import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { PersonalPage } from './PersonalPage'

vi.mock('../auth/useAuth', () => ({
  useAuth: () => ({ session: { token: 'admin-token', role: 'ADMINISTRADOR', username: 'admin' } }),
}))

const jsonResponse = (body: unknown, status = 200) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    text: async () => (body === null ? '' : JSON.stringify(body)),
  }) as Response

describe('PersonalPage', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('loads the unified directory and staff list, filters directory entries, registers staff, and performs logical delete', async () => {
    const directorio = [
      {
        id: 1,
        tipoPersona: 'PERSONAL',
        nombreCompleto: 'Laura Gómez',
        dni: '34567890',
        rolOCargo: 'RECEPCIONISTA',
        email: 'lgomez@novadent.com',
        telefono: '1122334455',
        estado: 'ACTIVO',
        detalleAdicional: 'Horario: Lunes a Viernes 08:00 - 16:00',
      },
      {
        id: 2,
        tipoPersona: 'MEDICO',
        nombreCompleto: 'Martín Sánchez',
        dni: 'MN-4401',
        rolOCargo: 'Odontólogo · Ortodoncia',
        email: 'msanchez@novadent.com',
        telefono: '1155667788',
        estado: 'ACTIVO',
        detalleAdicional: 'MP MN-4401 · Consultorio: Box 2',
      },
    ]

    const personal = [
      {
        id: 1,
        nombre: 'Laura',
        apellido: 'Gómez',
        dni: '34567890',
        email: 'lgomez@novadent.com',
        telefono: '1122334455',
        cargo: 'RECEPCIONISTA',
        fechaIngreso: '2025-03-10',
        horarioLaboral: 'Lunes a Viernes 08:00 - 16:00',
        estado: 'ACTIVO',
      },
    ]

    fetchMock.mockImplementation((path: string, options?: { method?: string; body?: string }) => {
      if (path.startsWith('/api/directorio/buscar')) {
        return Promise.resolve(jsonResponse([...directorio]))
      }
      if (path === '/api/personal' && (!options?.method || options.method === 'GET')) {
        return Promise.resolve(jsonResponse([...personal]))
      }
      if (path === '/api/personal' && options?.method === 'POST') {
        const parsed = JSON.parse(options.body || '{}')
        const created = { id: 2, ...parsed, estado: parsed.estado || 'ACTIVO' }
        personal.push(created)
        directorio.push({
          id: 2,
          tipoPersona: 'PERSONAL',
          nombreCompleto: `${created.nombre} ${created.apellido}`,
          dni: created.dni,
          rolOCargo: created.cargo,
          email: created.email,
          telefono: created.telefono,
          estado: created.estado,
          detalleAdicional: `Horario: ${created.horarioLaboral}`,
        })
        return Promise.resolve(jsonResponse(created, 201))
      }
      if (path === '/api/personal/1' && options?.method === 'DELETE') {
        personal[0] = { ...personal[0], estado: 'INACTIVO' }
        return Promise.resolve(jsonResponse(personal[0]))
      }
      return Promise.resolve(jsonResponse([]))
    })

    render(
      <MemoryRouter>
        <PersonalPage />
      </MemoryRouter>
    )

    // Directorio Unificado cargado por defecto
    expect(await screen.findByText('Laura Gómez')).not.toBeNull()
    expect(screen.getByText('Martín Sánchez')).not.toBeNull()
    expect(screen.getByTestId('kpi-total-directorio').textContent).toBe('2')

    // Filtrar por tipo MEDICO
    fireEvent.click(screen.getByRole('button', { name: 'Médicos / Odontólogos' }))
    expect(screen.queryByText('Laura Gómez')).toBeNull()
    expect(screen.getByText('Martín Sánchez')).not.toBeNull()

    // Cambiar a la pestaña de Gestión de Personal y abrir formulario de alta
    fireEvent.click(screen.getByRole('button', { name: /\+ Registrar Personal/i }))
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Marcos' } })
    fireEvent.change(screen.getByLabelText('Apellido'), { target: { value: 'Díaz' } })
    fireEvent.change(screen.getByLabelText('DNI'), { target: { value: '38901234' } })
    fireEvent.change(screen.getByLabelText('Cargo / Puesto'), {
      target: { value: 'ASISTENTE_DENTAL' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar personal' }))

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/personal',
        expect.objectContaining({ method: 'POST' })
      )
    )
    expect(await screen.findByText('Marcos Díaz')).not.toBeNull()

    // Baja lógica de Laura Gómez
    fireEvent.click(screen.getByRole('button', { name: 'Dar de baja a Laura Gómez' }))
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/personal/1',
        expect.objectContaining({ method: 'DELETE' })
      )
    )
    expect(await screen.findByText(/Baja lógica aplicada/i)).not.toBeNull()
  })
})
