export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
    this.name = 'ApiError'
  }
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '')
  if (!apiBaseUrl) {
    throw new ApiError('Falta configurar VITE_API_BASE_URL para conectar con el backend.', 0)
  }

  let response: Response
  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      ...init,
      headers: { Accept: 'application/json', ...init.headers },
      signal: init.signal ?? AbortSignal.timeout(12_000),
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      throw new ApiError('El backend tardó demasiado en responder. Reintentá.', 0)
    }
    throw new ApiError('No se pudo conectar con el backend. Comprobá que esté iniciado y reintentá.', 0)
  }

  if (!response.ok) {
    const message = response.status === 401
      ? 'La sesión no está autorizada. Iniciá sesión nuevamente.'
      : response.status === 403
        ? 'Tu usuario no tiene permiso para esta operación.'
        : `El backend respondió con error ${response.status}.`
    throw new ApiError(message, response.status)
  }

  return response.json() as Promise<T>
}
