export const API_BASE_URL = '/api'

type ApiRequestOptions = {
  method?: string
  token?: string
  body?: unknown
  signal?: AbortSignal
}

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

function readMessage(payload: unknown, status: number): string {
  if (typeof payload === 'string' && payload.trim()) return payload
  if (payload && typeof payload === 'object') {
    const data = payload as Record<string, unknown>
    for (const key of ['message', 'detail', 'error']) {
      if (typeof data[key] === 'string' && data[key]) return data[key] as string
    }
  }
  if (status === 401) return 'La sesión venció o no tenés autorización. Iniciá sesión nuevamente.'
  if (status === 403) return 'Tu usuario no tiene permisos para realizar esta acción.'
  if (status === 404) return 'No se encontró el recurso solicitado.'
  return `La API respondió con el estado ${status}.`
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { method = 'GET', token, body, signal } = options
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token.replace(/^Bearer\s+/i, '')}`

  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      ...(signal ? { signal } : {}),
    })
  } catch (failure) {
    if (failure instanceof DOMException && failure.name === 'AbortError') throw failure
    throw new Error('No se pudo conectar con el backend. Revisá que Spring Boot esté iniciado en el puerto 8080.')
  }

  const raw = await response.text()
  let payload: unknown = null
  if (raw) {
    try {
      payload = JSON.parse(raw)
    } catch {
      payload = raw
    }
  }
  if (!response.ok) throw new ApiError(readMessage(payload, response.status), response.status)
  return payload as T
}
