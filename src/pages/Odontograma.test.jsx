import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import Odontograma, { ARCHES, CATALOG, CONSENT_TEXT, VERSION, formatMoney } from './Odontograma.jsx'

const mocks = vi.hoisted(() => ({ empty: true, canvas: null, pdfSave: vi.fn(), pdfText: vi.fn(), png: 'data:image/png;base64,SIGNATURE' }))
vi.mock('react-signature-canvas', async () => {
  const { forwardRef, useImperativeHandle } = await import('react')
  return { default: forwardRef(function SignatureMock(props, ref) {
  useImperativeHandle(ref, () => ({ isEmpty: () => mocks.empty, clear: () => { mocks.empty = true }, toDataURL: () => mocks.png, getCanvas: () => mocks.canvas }))
  return <button aria-label="Dibujar firma de prueba" onClick={() => { mocks.empty = false; props.onBegin?.(); props.onEnd?.() }}>Firma</button>
}) }
})
vi.mock('jspdf', () => ({ jsPDF: class {
  internal = { pageSize: { getHeight: () => 297, getWidth: () => 210 } }
  setFontSize() {} setFont() {} setTextColor() {}
  splitTextToSize(text) { return [text] }
  text(...args) { mocks.pdfText(...args) }
  addPage() {} addImage() {} save(...args) { mocks.pdfSave(...args) }
} }))

const catalog = { versionCatalogo: VERSION, versionConsentimiento: VERSION, textoConsentimiento: CONSENT_TEXT, afecciones: CATALOG }
beforeEach(() => {
  mocks.empty = true; mocks.canvas = null; mocks.pdfSave.mockClear(); mocks.pdfText.mockClear()
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => catalog })))
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
async function mount(props = {}) {
  render(<Odontograma pacienteId={7} token="demo-token" {...props} />)
  await screen.findByText('Catálogo verificado')
}
function mark() {
  fireEvent.click(screen.getByRole('button', { name: 'Diente 11: Sin evaluar' }))
  fireEvent.click(screen.getByRole('button', { name: 'Asignar Caries' }))
}
function sign() {
  fireEvent.click(screen.getByRole('checkbox', { name: /Acepto el consentimiento/ }))
  fireEvent.click(screen.getByRole('button', { name: 'Dibujar firma de prueba' }))
  fireEvent.click(screen.getByRole('button', { name: 'Capturar firma' }))
}
function savedResponse(body) {
  return { id: 15, pacienteId: body.pacienteId, creadoEn: '2026-10-20T12:00:00Z', creadoPorId: 73,
    moneda: 'ARS', versionCatalogo: VERSION, dientes: body.dientes.map(({ numero, afeccion }) => ({ numero, ...CATALOG.find(c => c.afeccion === afeccion) })),
    totalPresupuesto: 45000, consentimientoAceptado: true, versionConsentimiento: VERSION, textoConsentimiento: CONSENT_TEXT, firmaBase64: mocks.png }
}

describe('Odontograma académico', () => {
  it('has exact 32 FDI positions, catalog and integer money', () => {
    expect(ARCHES).toEqual([[18,17,16,15,14,13,12,11,21,22,23,24,25,26,27,28],[48,47,46,45,44,43,42,41,31,32,33,34,35,36,37,38]])
    expect(new Set(ARCHES.flat()).size).toBe(32)
    expect(CATALOG.map(c => [c.afeccion,c.color,c.costoEstimado])).toEqual([['caries','#ef4444',45000],['fractura','#f97316',85000],['gingivitis','#eab308',30000],['ausente','#6b7280',250000],['sano','#22c55e',0]])
    expect(formatMoney(45000)).toBe('$45.000')
  })
  it('works standalone and selection alone never marks healthy', async () => {
    await mount()
    expect(screen.getAllByRole('button', { name: /Diente \d+: Sin evaluar/ })).toHaveLength(32)
    fireEvent.click(screen.getByRole('button', { name: 'Diente 11: Sin evaluar' }))
    expect(screen.getByRole('heading', { name: /Diente 11/ })).toBeInTheDocument()
    expect(screen.getByText('No hay dientes marcados.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Guardar odontograma' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Asignar Sano' }))
    expect(screen.getByRole('button', { name: 'Diente 11: Sano' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId('estimate-total')).toHaveTextContent('$0')
  })
  it('supports a session-only demo flow without contacting the backend', async () => {
    render(<Odontograma demoMode />)
    expect(await screen.findByText(/Modo demostración/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Abrir modo de guardado en backend local' })).toHaveAttribute('href', '/odontograma/backend')
    expect(fetch).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Guardar requiere backend' })).toBeDisabled()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Diente 16: Caries' })).toBeInTheDocument())
    fireEvent.change(screen.getByRole('combobox', { name: 'Paciente de prueba' }), { target: { value: '9002' } })
    await waitFor(() => expect(screen.getByRole('button', { name: 'Diente 21: Ausente' })).toBeInTheDocument())
    expect(screen.getByTestId('estimate-total')).toHaveTextContent('$335.000')
    fireEvent.change(screen.getByRole('combobox', { name: 'Paciente de prueba' }), { target: { value: '9001' } })
    await waitFor(() => expect(screen.getByRole('button', { name: 'Diente 16: Caries' })).toBeInTheDocument())

    fireEvent.change(screen.getByLabelText('Agregar paciente temporal'), { target: { value: 'Paciente temporal' } })
    fireEvent.click(screen.getByRole('button', { name: 'Agregar' }))
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Paciente de prueba' })).toHaveValue('9003'))

    fireEvent.click(screen.getByRole('button', { name: 'Diente 11: Sin evaluar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Asignar Caries' }))
    fireEvent.click(screen.getByRole('checkbox', { name: /Acepto el consentimiento/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Dibujar firma de prueba' }))
    fireEvent.click(screen.getByRole('button', { name: 'Capturar firma' }))
    expect(screen.getByAltText('Vista previa de la firma capturada')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Descargar PDF con Firma' })).toBeEnabled()

    fireEvent.click(screen.getByRole('button', { name: 'Descargar PDF con Firma' }))
    expect(mocks.pdfSave).toHaveBeenCalledWith('presupuesto_paciente_9003.pdf')
    expect(mocks.pdfText.mock.calls.flat(2).join(' ')).toContain('DEMO EN NAVEGADOR - BORRADOR NO GUARDADO')
    expect(mocks.pdfText.mock.calls.flat(2).join(' ')).toContain('Paciente: Paciente temporal')
    expect(fetch).not.toHaveBeenCalled()
  })
  it('replaces conditions without duplicates, shows full treatment and total', async () => {
    await mount(); mark()
    expect(screen.getByText('Destrucción del esmalte por bacterias')).toBeInTheDocument()
    expect(screen.getByTestId('estimate-total')).toHaveTextContent('$45.000')
    fireEvent.click(screen.getByRole('button', { name: 'Asignar Fractura' }))
    expect(screen.getByTestId('estimate-total')).toHaveTextContent('$85.000')
    expect(screen.getAllByTestId('estimate-row')).toHaveLength(1)
  })
  it('places the diagnosis card below the chart in a single-column workspace', async () => {
    await mount()
    const chart = screen.getByRole('region', { name: 'Odontograma FDI' })
    const diagnosis = screen.getByRole('region', { name: 'Ficha de la pieza seleccionada' })
    expect(chart.compareDocumentPosition(diagnosis) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(getComputedStyle(chart.parentElement).gridTemplateColumns).toBe('1fr')
    expect(screen.getByRole('button', { name: 'Descargar PDF con Firma' })).toBeDisabled()
  })
  it('rejects empty capture, previews and clears signature', async () => {
    await mount(); mark()
    fireEvent.click(screen.getByRole('checkbox', { name: /Acepto el consentimiento/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Capturar firma' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Dibuje una firma')
    fireEvent.click(screen.getByRole('button', { name: 'Dibujar firma de prueba' }))
    fireEvent.click(screen.getByRole('button', { name: 'Capturar firma' }))
    expect(screen.getByAltText('Vista previa de la firma capturada')).toHaveAttribute('src', mocks.png)
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar firma' }))
    expect(screen.queryByAltText('Vista previa de la firma capturada')).not.toBeInTheDocument()
  })
  it('invalidates signature on condition/consent changes, not tooth selection', async () => {
    await mount(); mark(); sign()
    fireEvent.click(screen.getByRole('button', { name: 'Diente 12: Sin evaluar' }))
    expect(screen.getByAltText('Vista previa de la firma capturada')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Asignar Sano' }))
    expect(screen.queryByAltText('Vista previa de la firma capturada')).not.toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: /Acepto el consentimiento/ })).not.toBeChecked()
    sign()
    fireEvent.click(screen.getByRole('checkbox', { name: /Acepto el consentimiento/ }))
    expect(screen.queryByAltText('Vista previa de la firma capturada')).not.toBeInTheDocument()
  })
  it('invalidates signature on new stroke and patient change', async () => {
    const view = render(<Odontograma pacienteId={7} token="demo-token" />)
    await screen.findByText('Catálogo verificado'); mark(); sign()
    fireEvent.click(screen.getByRole('button', { name: 'Dibujar firma de prueba' }))
    expect(screen.queryByAltText('Vista previa de la firma capturada')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Capturar firma' }))
    view.rerender(<Odontograma pacienteId={8} token="demo-token" />)
    expect(screen.queryByAltText('Vista previa de la firma capturada')).not.toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: /Acepto el consentimiento/ })).not.toBeChecked()
    expect(screen.getByText('No hay dientes marcados.')).toBeInTheDocument()
  })
  it('uses masked in-memory token without assuming existing authentication', async () => {
    render(<Odontograma />)
    const token = screen.getByLabelText('Token Bearer (solo en memoria)')
    expect(token).toHaveAttribute('type', 'password')
    fireEvent.change(token, { target: { value: 'manual-token' } })
    await screen.findByText(/Catálogo verificado/)
    expect(localStorage.length).toBe(0)
  })
  it('verifies the catalog, then posts the exact DTO with the in-memory JWT only after consent and signature', async () => {
    fetch.mockImplementation(async (url, options = {}) => {
      if (String(url).endsWith('/odontograma/catalogo')) return { ok: true, status: 200, json: async () => catalog }
      return { ok: true, status: 201, json: async () => savedResponse(JSON.parse(options.body)) }
    })
    render(<Odontograma backendMode />)
    fireEvent.change(screen.getByLabelText('ID de paciente'), { target: { value: '7' } })
    fireEvent.change(screen.getByLabelText('Token Bearer (solo en memoria)'), { target: { value: 'manual-token' } })
    expect(await screen.findByText('Catálogo verificado')).toBeInTheDocument()
    expect(screen.getByRole('note')).toHaveTextContent('Una página abierta desde Vercel no puede acceder al backend ni a la base local')
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch.mock.calls[0][0]).toBe('/api/odontograma/catalogo')
    expect(fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer manual-token')

    mark()
    const save = screen.getByRole('button', { name: 'Guardar odontograma' })
    expect(save).toBeDisabled()
    fireEvent.click(screen.getByRole('checkbox', { name: /Acepto el consentimiento/ }))
    expect(save).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Dibujar firma de prueba' }))
    expect(save).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Capturar firma' }))
    expect(save).toBeEnabled()
    fireEvent.click(save)

    await screen.findByText(/Guardado #15/)
    expect(fetch).toHaveBeenCalledTimes(2)
    const [url, options] = fetch.mock.calls[1]
    expect(url).toBe('/api/odontograma')
    expect(options.method).toBe('POST')
    expect(options.headers).toEqual({ 'Content-Type': 'application/json', Authorization: 'Bearer manual-token' })
    expect(JSON.parse(options.body)).toEqual({ pacienteId: 7, dientes: [{ numero: 11, afeccion: 'caries' }], consentimientoAceptado: true, versionConsentimiento: VERSION, firmaBase64: mocks.png })
    expect(localStorage.length).toBe(0)
  })
  it('saves once with canonical input and downloads server snapshot', async () => {
    await mount(); mark(); sign()
    let complete
    fetch.mockImplementationOnce((url, options) => new Promise(resolve => {
      complete = () => resolve({ ok: true, status: 201, json: async () => savedResponse(JSON.parse(options.body)) })
    }))
    const save = screen.getByRole('button', { name: 'Guardar odontograma' })
    fireEvent.click(save); fireEvent.click(save)
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(save).toBeDisabled()
    complete()
    await screen.findByText(/Guardado #15/)
    const [, options] = fetch.mock.calls[1]
    expect(options.headers.Authorization).toBe('Bearer demo-token')
    expect(JSON.parse(options.body)).toEqual({ pacienteId: 7, dientes: [{ numero: 11, afeccion: 'caries' }], consentimientoAceptado: true, versionConsentimiento: VERSION, firmaBase64: mocks.png })
    fireEvent.click(screen.getByRole('button', { name: 'Descargar PDF con Firma' }))
    expect(mocks.pdfSave).toHaveBeenCalledWith('presupuesto_paciente_7.pdf')
    expect(mocks.pdfText.mock.calls.flat(2).join(' ')).toContain('Guardado #15')
  })
  it.each([400,401,403,404,500])('preserves unsaved chart on HTTP %s', async status => {
    await mount(); mark(); sign()
    fetch.mockResolvedValueOnce({ ok: false, status, text: async () => 'Error de prueba' })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar odontograma' }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/No se guardó/))
    expect(screen.getByTestId('estimate-total')).toHaveTextContent('$45.000')
    expect(screen.getByAltText('Vista previa de la firma capturada')).toBeInTheDocument()
    expect(screen.queryByText(/Guardado #/)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Descargar PDF con Firma' }))
    expect(mocks.pdfText.mock.calls.flat(2).join(' ')).toContain('BORRADOR NO GUARDADO')
  })
  it('does not sign before catalog parity and consent are confirmed', async () => {
    fetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ ...catalog, textoConsentimiento: 'changed' }) })
    render(<Odontograma pacienteId={7} token="demo-token" />)
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/catálogo/))
    mark()
    expect(screen.getByRole('button', { name: 'Capturar firma' })).toBeDisabled()
  })
  it('sizes the canvas to CSS pixels and revokes consent and PNG on actual resize', async () => {
    let resize, width = 300
    const transform = vi.fn()
    mocks.canvas = document.createElement('canvas')
    mocks.canvas.getBoundingClientRect = () => ({ width })
    mocks.canvas.getContext = () => ({ setTransform: transform })
    vi.stubGlobal('ResizeObserver', class { constructor(callback) { resize = callback } observe() { resize() } disconnect() {} })
    await mount(); mark(); sign()
    expect(mocks.canvas.width).toBe(300)
    expect(mocks.canvas.height).toBe(180)
    expect(transform).toHaveBeenCalledWith(1,0,0,1,0,0)
    act(() => resize())
    expect(screen.getByAltText('Vista previa de la firma capturada')).toBeInTheDocument()
    width = 400; act(() => resize())
    expect(screen.queryByAltText('Vista previa de la firma capturada')).not.toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: /Acepto el consentimiento/ })).not.toBeChecked()
    expect(screen.getByRole('status')).toHaveTextContent('cambió de tamaño')
  })
  it('does not claim saved on a mismatching HTTP 201 response', async () => {
    await mount(); mark(); sign()
    fetch.mockImplementationOnce(async (url, options) => ({ status: 201, json: async () => ({ ...savedResponse(JSON.parse(options.body)), totalPresupuesto: 1 }) }))
    fireEvent.click(screen.getByRole('button', { name: 'Guardar odontograma' }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('respuesta no coincide'))
    expect(screen.getByTestId('estimate-total')).toHaveTextContent('$45.000')
    expect(screen.getByAltText('Vista previa de la firma capturada')).toBeInTheDocument()
    expect(screen.queryByText(/Guardado #/)).not.toBeInTheDocument()
  })
  it('never associates an in-flight old patient save with a new patient', async () => {
    const view = render(<Odontograma pacienteId={7} token="demo-token" />)
    await screen.findByText('Catálogo verificado'); mark(); sign()
    let complete
    fetch.mockImplementationOnce((url, options) => new Promise(resolve => { complete = () => resolve({ status: 201, json: async () => savedResponse(JSON.parse(options.body)) }) }))
    fireEvent.click(screen.getByRole('button', { name: 'Guardar odontograma' }))
    view.rerender(<Odontograma pacienteId={8} token="demo-token" />)
    await act(async () => complete())
    expect(screen.queryByText(/Guardado #/)).not.toBeInTheDocument()
    expect(screen.getByText('No hay dientes marcados.')).toBeInTheDocument()
  })
})
