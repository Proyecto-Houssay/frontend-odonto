import { afterEach, expect, it, vi } from 'vitest'
import { createBudgetPdf, ARCHES, CATALOG, CONSENT_TEXT, VERSION } from './Odontograma.jsx'

afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs() })

it('generates a real multipage PDF with all 32 teeth, consent, total and PNG signature', () => {
  const snapshot = { pacienteId: 7, dientes: ARCHES.flat().map(numero => ({ numero, ...CATALOG[3] })), totalPresupuesto: 8000000,
    firmaBase64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGD4DwABBAEAX+XDSwAAAABJRU5ErkJggg==', firmaAspectRatio: 1,
    textoConsentimiento: CONSENT_TEXT, versionConsentimiento: VERSION, versionCatalogo: VERSION, creadoEn: '2026-10-20T12:00:00Z' }
  const doc = createBudgetPdf(snapshot)
  const output = doc.output('arraybuffer')
  expect(output.byteLength).toBeGreaterThan(3000)
  expect(doc.getNumberOfPages()).toBeGreaterThan(1)
  const raw = new TextDecoder('latin1').decode(output)
  expect(raw).toContain('/Subtype /Image')
  expect(raw).toContain('8.000.000')
  for (const n of ARCHES.flat()) expect(raw).toContain(`Diente ${n}`)
  expect(raw).toContain('academic-v1')
  expect(raw).toContain('BORRADOR NO GUARDADO')
  expect(raw).toContain('Firma del paciente:')
})

it('uses Buenos Aires issuance date and 24-hour registration time even on a Tokyo host', () => {
  vi.stubEnv('TZ', 'Asia/Tokyo')
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-21T01:02:33Z'))
  const snapshot = { id: 2, pacienteId: 7, dientes: [{ numero: 11, ...CATALOG[0] }], totalPresupuesto: 45000,
    firmaBase64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGD4DwABBAEAX+XDSwAAAABJRU5ErkJggg==', firmaAspectRatio: 1,
    textoConsentimiento: CONSENT_TEXT, versionConsentimiento: VERSION, versionCatalogo: VERSION,
    creadoEn: '2026-10-20T20:02:33.166147Z' }
  expect(new Date(snapshot.creadoEn).getHours()).toBe(5)
  const raw = new TextDecoder('latin1').decode(createBudgetPdf(snapshot).output('arraybuffer'))
  expect(raw).toContain('Fecha de emisión \\(Buenos Aires\\): 20/10/2026')
  expect(raw).toContain('Fecha de registro \\(Buenos Aires, 24 h\\): 20/10/2026, 17:02:33')
  expect(raw).not.toContain('05:02:33')
})
