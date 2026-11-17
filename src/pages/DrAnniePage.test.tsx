import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { UserRole } from '../auth/role'
import { DrAnniePage, FALLBACK_CATALOGO } from './DrAnniePage'

const mockSession = {
  current: { token: 'dentist-token', role: 'ODONTOLOGO' as UserRole },
}

vi.mock('../auth/useAuth', () => ({
  useAuth: () => ({ session: mockSession.current }),
}))

const jsonResponse = (body: unknown, status = 200) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  }) as Response

describe('DrAnniePage', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    mockSession.current = { token: 'dentist-token', role: 'ODONTOLOGO' }
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('fetches the AI catalog and patient list, displays OPERATIVO status, and runs a backend analysis', async () => {
    fetchMock.mockImplementation((path: string, init?: RequestInit) => {
      if (path === '/api/ia/diagnostico-imagen/catalogo') {
        return Promise.resolve(jsonResponse(FALLBACK_CATALOGO))
      }
      if (path === '/api/pacientes') {
        return Promise.resolve(
          jsonResponse([{ id: 10, nombre: 'Ana', apellido: 'Nieto', dni: '44239570' }])
        )
      }
      if (path === '/api/ia/diagnostico-imagen/paciente/10') {
        return Promise.resolve(
          jsonResponse([
            {
              id: 55,
              fechaAnalisis: '2026-10-14T15:30:00',
              pacienteId: 10,
              tipoImagen: 'RADIOGRAFIA_PANORAMICA',
              diagnosticoSugerido: 'Estudio previo panorámico registrado.',
              nivelUrgencia: 'ALTA',
              indiceSeveridad: 6.5,
            },
          ])
        )
      }
      if (path === '/api/ia/diagnostico-imagen/analizar' && init?.method === 'POST') {
        return Promise.resolve(
          jsonResponse({
            id: 101,
            tipoImagen: 'RADIOGRAFIA_PERIAPICAL',
            diagnosticoSugerido:
              'Estudio de Radiografía Periapical Intraoral. Se identificaron 2 hallazgo(s) clínico(s) de interés.',
            hallazgos: [
              {
                patologia: 'LESION_PERIAPICAL',
                piezaDental: 'Pieza 36 (Primer molar inferior izquierdo)',
                severidad: 'SEVERA',
                confianza: 0.97,
                zonaAfectada: 'Ápice de raíz mesial y distal',
                descripcion: 'Área radiolúcida periapical delimitada.',
                tratamientoSugerido:
                  'Tratamiento endodóntico birradicular (conductoterapia completa) y posterior rehabilitación coronal.',
              },
            ],
            tratamientosSugeridos: [
              'Tratamiento endodóntico birradicular (conductoterapia completa) y posterior rehabilitación coronal.',
            ],
            nivelUrgencia: 'URGENTE',
            indiceSeveridad: 8.5,
            observacionesIA: 'Análisis completado satisfactoriamente.',
            modeloUtilizado: FALLBACK_CATALOGO.versionModelo,
            fechaAnalisis: '2026-11-14T18:00:00',
            pacienteId: 10,
            historiaClinicaId: 5,
            diagnosticoCreadoId: 88,
          })
        )
      }
      return Promise.resolve(jsonResponse([]))
    })

    render(
      <MemoryRouter>
        <DrAnniePage />
      </MemoryRouter>
    )

    expect(screen.getByTestId('dr-annie-status-badge').textContent).toContain('OPERATIVO')
    expect(await screen.findByRole('option', { name: /Ana Nieto/i })).not.toBeNull()

    fireEvent.change(screen.getByLabelText('Tipo de imagen dental'), {
      target: { value: 'RADIOGRAFIA_PERIAPICAL' },
    })
    fireEvent.change(screen.getByLabelText('Paciente asociado'), {
      target: { value: '10' },
    })

    expect(await screen.findByText('Estudio previo panorámico registrado.')).not.toBeNull()

    fireEvent.change(screen.getByLabelText('Observaciones clínicas'), {
      target: { value: 'Dolor a la percusión en pieza 36' },
    })
    fireEvent.click(
      screen.getByRole('checkbox', {
        name: /Guardar diagnóstico y tratamientos sugeridos en la Historia Clínica/i,
      })
    )

    fireEvent.click(screen.getByRole('button', { name: /Analizar con Dr\. Annie/i }))

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/ia/diagnostico-imagen/analizar',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ Authorization: 'Bearer dentist-token' }),
        })
      )
    )

    expect(await screen.findByText(/URGENTE · Atención inmediata/i)).not.toBeNull()
    expect(screen.getByText('8.5 / 10')).not.toBeNull()
    expect(screen.getByText(/Pieza 36 \(Primer molar inferior izquierdo\)/i)).not.toBeNull()
    expect(screen.getByText(/Confianza 97%/i)).not.toBeNull()
    expect(screen.getByText(/Vinculado a Historia Clínica \(Diagnóstico #88\)/i)).not.toBeNull()
  })

  it('falls back cleanly to the local diagnostic engine when the backend is offline or restricted', async () => {
    fetchMock.mockRejectedValue(new Error('network down'))

    render(
      <MemoryRouter>
        <DrAnniePage />
      </MemoryRouter>
    )

    fireEvent.change(screen.getByLabelText('Tipo de imagen dental'), {
      target: { value: 'TOMOGRAFIA_CONE_BEAM' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Cargar estudio de muestra/i }))
    fireEvent.click(screen.getByRole('button', { name: /Analizar con Dr\. Annie/i }))

    expect(
      (await screen.findAllByText(/Pieza 48 \(Tercer molar inferior derecho\)/i)).length
    ).toBeGreaterThan(0)
    expect(screen.getByText(/ALTA · Prioridad clínica/i)).not.toBeNull()
    expect(
      screen.getAllByText(/Planificación quirúrgica especializada en 3D/i).length
    ).toBeGreaterThan(0)
  })

  it('allows a logged-in PACIENTE to call POST /api/ia/diagnostico-imagen/analizar directly against the backend', async () => {
    mockSession.current = { token: 'patient-token', role: 'PACIENTE' }
    fetchMock.mockImplementation((path: string, init?: RequestInit) => {
      if (path === '/api/ia/diagnostico-imagen/catalogo') {
        return Promise.resolve(jsonResponse(FALLBACK_CATALOGO))
      }
      if (path === '/api/portal-paciente/perfil') {
        return Promise.resolve(jsonResponse({ id: 7, nombre: 'Ana', apellido: 'Nieto' }))
      }
      if (path === '/api/ia/diagnostico-imagen/paciente/7') {
        return Promise.resolve(jsonResponse([]))
      }
      if (path === '/api/ia/diagnostico-imagen/analizar' && init?.method === 'POST') {
        return Promise.resolve(
          jsonResponse({
            id: 202,
            tipoImagen: 'BITE_WING',
            diagnosticoSugerido: 'Estudio Bite-wing analizado para el paciente.',
            hallazgos: [
              {
                patologia: 'CARIES_DENTAL',
                piezaDental: 'Pieza 15 (Segundo premolar superior derecho)',
                severidad: 'LEVE',
                confianza: 0.92,
                zonaAfectada: 'Superficie interproximal distal',
                descripcion: 'Caries interproximal incipiente.',
                tratamientoSugerido: 'Aplicación tópica de barniz con flúor.',
              },
            ],
            tratamientosSugeridos: ['Aplicación tópica de barniz con flúor.'],
            nivelUrgencia: 'MEDIA',
            indiceSeveridad: 4.0,
            observacionesIA: 'Análisis completado.',
            modeloUtilizado: FALLBACK_CATALOGO.versionModelo,
            fechaAnalisis: '2026-11-14T19:00:00',
            pacienteId: 7,
            historiaClinicaId: null,
            diagnosticoCreadoId: null,
          })
        )
      }
      return Promise.resolve(jsonResponse([]))
    })

    render(
      <MemoryRouter>
        <DrAnniePage />
      </MemoryRouter>
    )

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/portal-paciente/perfil',
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: 'Bearer patient-token' }),
        })
      )
    )

    fireEvent.change(screen.getByLabelText('Tipo de imagen dental'), {
      target: { value: 'BITE_WING' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Analizar con Dr\. Annie/i }))

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/ia/diagnostico-imagen/analizar',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ Authorization: 'Bearer patient-token' }),
        })
      )
    )

    expect(await screen.findByText('Estudio Bite-wing analizado para el paciente.')).not.toBeNull()
    expect(screen.getByText(/Pieza 15 \(Segundo premolar superior derecho\)/i)).not.toBeNull()
  })
})
