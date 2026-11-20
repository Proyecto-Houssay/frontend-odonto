import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react'
import {
  Camera,
  CheckCircle2,
  Clock,
  Inbox,
  Mail,
  MailOpen,
  RefreshCw,
  Send,
  ShieldCheck,
  Upload,
  UserCircle2,
  X,
} from 'lucide-react'
import { useAuth } from '../auth/useAuth'
import { apiRequest } from '../lib/api'

export type PerfilUsuarioResponse = {
  id: number
  username: string
  nombreMostrar: string
  email: string
  rol: string
  fotoBase64?: string | null
}

export type MensajeUsuarioDto = {
  id: number
  destinatarioId: number
  remitenteId?: number | null
  remitenteNombre: string
  asunto: string
  contenido: string
  leido: boolean
  creadoEn: string
  leidoEn?: string | null
}

const MAX_PHOTO_BYTES = 1_048_576 // 1 MB
const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg']

const ROLE_BADGE_STYLES: Record<string, string> = {
  ADMINISTRADOR: 'bg-purple-100 text-purple-800 border-purple-200',
  ODONTOLOGO: 'bg-blue-100 text-blue-800 border-blue-200',
  RECEPCIONISTA: 'bg-teal-100 text-teal-800 border-teal-200',
  PACIENTE: 'bg-emerald-100 text-emerald-800 border-emerald-200',
}

function formatMessageDate(isoDate?: string | null): string {
  if (!isoDate) return ''
  const parsed = new Date(isoDate)
  if (Number.isNaN(parsed.getTime())) return isoDate
  return parsed.toLocaleString('es-AR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export const MiCuentaPage: React.FC = () => {
  const { session } = useAuth()
  const token = session?.token || ''

  const [perfil, setPerfil] = useState<PerfilUsuarioResponse | null>(null)
  const [nombreMostrar, setNombreMostrar] = useState('')
  const [selectedPhotoDataUrl, setSelectedPhotoDataUrl] = useState<string | null>(null)
  const [selectedPhotoName, setSelectedPhotoName] = useState('')

  const [mensajes, setMensajes] = useState<MensajeUsuarioDto[]>([])
  const [filtroMensajes, setFiltroMensajes] = useState<'TODOS' | 'NO_LEIDOS' | 'LEIDOS'>('TODOS')

  const [showSendForm, setShowSendForm] = useState(false)
  const [destinatarioUsername, setDestinatarioUsername] = useState('')
  const [asuntoNuevo, setAsuntoNuevo] = useState('')
  const [contenidoNuevo, setContenidoNuevo] = useState('')
  const [sendingMsg, setSendingMsg] = useState(false)

  const [loading, setLoading] = useState(true)
  const [savingProfile, setSavingProfile] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [markingId, setMarkingId] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const loadData = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true)
      setError('')
      try {
        const [perfilRes, mensajesRes] = await Promise.all([
          apiRequest<PerfilUsuarioResponse>('/mi-cuenta/perfil', { token, signal }),
          apiRequest<MensajeUsuarioDto[]>('/mi-cuenta/mensajes', { token, signal }),
        ])
        setPerfil(perfilRes)
        setNombreMostrar(perfilRes.nombreMostrar || '')
        setMensajes(Array.isArray(mensajesRes) ? mensajesRes : [])
      } catch (failure) {
        if (failure instanceof DOMException && failure.name === 'AbortError') return
        setError(
          failure instanceof Error
            ? failure.message
            : 'No se pudo cargar la información de tu cuenta.'
        )
      } finally {
        setLoading(false)
      }
    },
    [token]
  )

  useEffect(() => {
    const controller = new AbortController()
    void loadData(controller.signal)
    return () => controller.abort()
  }, [loadData])

  const unreadCount = useMemo(
    () => mensajes.filter(item => !item.leido).length,
    [mensajes]
  )

  const filteredMensajes = useMemo(() => {
    return mensajes.filter(item => {
      if (filtroMensajes === 'NO_LEIDOS') return !item.leido
      if (filtroMensajes === 'LEIDOS') return item.leido
      return true
    })
  }, [mensajes, filtroMensajes])

  async function handleSaveNombreMostrar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = nombreMostrar.trim()
    if (!trimmed) {
      setError('El nombre para mostrar es obligatorio.')
      return
    }
    setSavingProfile(true)
    setError('')
    setNotice('')
    try {
      const updated = await apiRequest<PerfilUsuarioResponse>('/mi-cuenta/perfil', {
        method: 'PUT',
        token,
        body: { nombreMostrar: trimmed },
      })
      setPerfil(updated)
      setNombreMostrar(updated.nombreMostrar)
      setNotice('Nombre para mostrar guardado correctamente.')
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : 'No se pudo guardar el nombre para mostrar.'
      )
    } finally {
      setSavingProfile(false)
    }
  }

  function handleSelectPhotoFile(event: ChangeEvent<HTMLInputElement>) {
    setError('')
    setNotice('')
    setSelectedPhotoDataUrl(null)
    setSelectedPhotoName('')

    const file = event.target.files?.[0]
    if (!file) return

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      setError('Formato de archivo no válido. Solo se permiten imágenes PNG o JPEG.')
      event.target.value = ''
      return
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setError('La imagen seleccionada supera el tamaño máximo permitido de 1 MB.')
      event.target.value = ''
      return
    }

    setSelectedPhotoName(file.name)
    const reader = new FileReader()
    reader.onload = () => {
      setSelectedPhotoDataUrl(typeof reader.result === 'string' ? reader.result : null)
    }
    reader.onerror = () => {
      setError('No se pudo leer el archivo de imagen seleccionado.')
    }
    reader.readAsDataURL(file)
  }

  async function handleUploadPhoto() {
    if (!selectedPhotoDataUrl) {
      setError('Seleccioná una imagen PNG o JPEG válida antes de subir.')
      return
    }
    setUploadingPhoto(true)
    setError('')
    setNotice('')
    try {
      const updated = await apiRequest<PerfilUsuarioResponse>('/mi-cuenta/foto', {
        method: 'PUT',
        token,
        body: { fotoBase64: selectedPhotoDataUrl },
      })
      setPerfil(updated)
      setSelectedPhotoDataUrl(null)
      setSelectedPhotoName('')
      setNotice('Foto de perfil actualizada correctamente.')
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : 'No se pudo subir la foto de perfil.'
      )
    } finally {
      setUploadingPhoto(false)
    }
  }

  async function handleMarkAsRead(mensaje: MensajeUsuarioDto) {
    if (mensaje.leido) return
    setMarkingId(mensaje.id)
    setError('')
    setNotice('')
    try {
      const updated = await apiRequest<MensajeUsuarioDto>(
        `/mi-cuenta/mensajes/${mensaje.id}/leido`,
        {
          method: 'PUT',
          token,
        }
      )
      setMensajes(curr =>
        curr.map(item => (item.id === mensaje.id ? updated : item))
      )
      setNotice(`Mensaje "${mensaje.asunto}" marcado como leído.`)
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : 'No se pudo marcar el mensaje como leído.'
      )
    } finally {
      setMarkingId(null)
    }
  }

  async function handleSendInternalMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!destinatarioUsername.trim() || !asuntoNuevo.trim() || !contenidoNuevo.trim()) {
      setError('Completá destinatario, asunto y contenido para enviar el mensaje.')
      return
    }
    setSendingMsg(true)
    setError('')
    setNotice('')
    try {
      await apiRequest<MensajeUsuarioDto>('/mi-cuenta/mensajes', {
        method: 'POST',
        token,
        body: {
          destinatarioUsername: destinatarioUsername.trim(),
          asunto: asuntoNuevo.trim(),
          contenido: contenidoNuevo.trim(),
        },
      })
      setDestinatarioUsername('')
      setAsuntoNuevo('')
      setContenidoNuevo('')
      setShowSendForm(false)
      setNotice('Mensaje interno enviado correctamente.')
      await loadData()
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : 'No se pudo enviar el mensaje interno.'
      )
    } finally {
      setSendingMsg(false)
    }
  }

  const currentAvatar = selectedPhotoDataUrl || perfil?.fotoBase64 || null
  const roleBadgeClass =
    ROLE_BADGE_STYLES[(perfil?.rol || '').toUpperCase()] ||
    'bg-slate-100 text-slate-800 border-slate-200'

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-2xl border border-white/70 bg-white/85 p-5 shadow-md shadow-blue-950/5 backdrop-blur-xl">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-blue-700">
            Espacio Personal · Identidad y Comunicaciones
          </p>
          <h2 className="mt-1 text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <UserCircle2 className="w-7 h-7 text-blue-600" />
            Mi Cuenta y Buzón de Mensajes
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Administrá tu nombre visible, tu foto de perfil institucional y consultá los avisos dirigidos a tu cuenta.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => void loadData()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Recargar
          </button>
          <button
            type="button"
            onClick={() => setShowSendForm(prev => !prev)}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
          >
            <Send className="w-4 h-4" />
            Enviar mensaje interno
          </button>
        </div>
      </div>

      {/* Alertas */}
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 flex items-center justify-between gap-3"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError('')}
            className="text-red-600 hover:text-red-900"
            aria-label="Cerrar error"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {notice && (
        <div
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 flex items-center justify-between gap-3"
        >
          <span>{notice}</span>
          <button
            type="button"
            onClick={() => setNotice('')}
            className="text-emerald-700 hover:text-emerald-950"
            aria-label="Cerrar aviso"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Formulario colapsable para enviar mensaje interno */}
      {showSendForm && (
        <section
          aria-label="Enviar mensaje interno"
          className="rounded-2xl border border-blue-200 bg-white p-5 shadow-md space-y-4"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Send className="w-4 h-4 text-blue-600" />
              Redactar Mensaje o Aviso Interno
            </h3>
            <button
              type="button"
              onClick={() => setShowSendForm(false)}
              className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"
              aria-label="Cerrar formulario de mensaje"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSendInternalMessage} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="msg-destinatario"
                className="block text-xs font-bold text-slate-700 mb-1"
              >
                Usuario o correo destinatario
              </label>
              <input
                id="msg-destinatario"
                required
                value={destinatarioUsername}
                onChange={e => setDestinatarioUsername(e.target.value)}
                placeholder="Ej. admin o usuario@novadent.com"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="msg-asunto"
                className="block text-xs font-bold text-slate-700 mb-1"
              >
                Asunto
              </label>
              <input
                id="msg-asunto"
                required
                maxLength={160}
                value={asuntoNuevo}
                onChange={e => setAsuntoNuevo(e.target.value)}
                placeholder="Motivo del aviso"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label
                htmlFor="msg-contenido"
                className="block text-xs font-bold text-slate-700 mb-1"
              >
                Contenido del mensaje
              </label>
              <textarea
                id="msg-contenido"
                required
                rows={3}
                maxLength={1000}
                value={contenidoNuevo}
                onChange={e => setContenidoNuevo(e.target.value)}
                placeholder="Escribí el detalle del mensaje interno..."
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div className="sm:col-span-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowSendForm(false)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={sendingMsg}
                className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {sendingMsg ? 'Enviando…' : 'Enviar mensaje'}
              </button>
            </div>
          </form>
        </section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* SECCIÓN 1: MI PERFIL Y FOTO */}
        <section
          aria-label="Mi Perfil y Foto"
          className="lg:col-span-5 rounded-2xl border border-white/70 bg-white/90 p-5 shadow-xs space-y-5"
        >
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <UserCircle2 className="w-5 h-5 text-blue-600" />
              Mi Perfil y Foto
            </h3>
            <p className="text-xs text-slate-600">
              Tus credenciales y rol de seguridad son administrados por la clínica.
            </p>
          </div>

          {/* Foto de perfil y cargador */}
          <div className="flex flex-col sm:flex-row items-center gap-4 rounded-xl border border-slate-200/80 bg-slate-50/70 p-4">
            <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-full border-2 border-blue-200 bg-blue-100 flex items-center justify-center">
              {currentAvatar ? (
                <img
                  src={currentAvatar}
                  alt="Foto de perfil del usuario"
                  className="h-full w-full object-cover"
                />
              ) : (
                <Camera className="h-9 w-9 text-blue-600" />
              )}
            </div>

            <div className="flex-1 space-y-2 text-center sm:text-left">
              <label
                htmlFor="foto-perfil-input"
                className="block text-xs font-bold text-slate-800"
              >
                Foto de perfil (PNG o JPEG, máx. 1 MB)
              </label>
              <input
                id="foto-perfil-input"
                type="file"
                accept="image/png,image/jpeg"
                onChange={handleSelectPhotoFile}
                className="block w-full text-xs text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-blue-700 hover:file:bg-blue-100"
              />
              {selectedPhotoName && (
                <p className="text-xs text-slate-600">
                  Archivo listo: <span className="font-semibold">{selectedPhotoName}</span>
                </p>
              )}
              <button
                type="button"
                onClick={() => void handleUploadPhoto()}
                disabled={!selectedPhotoDataUrl || uploadingPhoto}
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                <Upload className="w-3.5 h-3.5" />
                {uploadingPhoto ? 'Subiendo…' : 'Subir foto'}
              </button>
            </div>
          </div>

          {/* Datos de solo lectura */}
          <div className="space-y-3 text-xs">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 flex items-center justify-between">
              <span className="font-semibold text-slate-600">Usuario:</span>
              <span className="font-bold text-slate-900" data-testid="profile-username">
                @{perfil?.username || session?.username || 'usuario'}
              </span>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 flex items-center justify-between">
              <span className="font-semibold text-slate-600">Correo electrónico:</span>
              <span className="font-bold text-slate-900" data-testid="profile-email">
                {perfil?.email || '—'}
              </span>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-600">Rol del sistema:</span>
                <span
                  data-testid="profile-role"
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-bold ${roleBadgeClass}`}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  {perfil?.rol || session?.role || 'PACIENTE'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Rol de solo lectura gestionado exclusivamente por la administración.
              </p>
            </div>
          </div>

          {/* Formulario de nombre para mostrar */}
          <form onSubmit={handleSaveNombreMostrar} className="space-y-3 border-t border-slate-100 pt-4">
            <div>
              <label
                htmlFor="perfil-nombre-mostrar"
                className="block text-xs font-bold text-slate-700 mb-1"
              >
                Nombre para mostrar
              </label>
              <input
                id="perfil-nombre-mostrar"
                required
                maxLength={120}
                value={nombreMostrar}
                onChange={e => setNombreMostrar(e.target.value)}
                placeholder="Tu nombre visible en NovaDent"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={savingProfile}
              className="w-full rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {savingProfile ? 'Guardando…' : 'Guardar nombre para mostrar'}
            </button>
          </form>
        </section>

        {/* SECCIÓN 2: BUZÓN DE MENSAJES */}
        <section
          aria-label="Buzón de Mensajes"
          className="lg:col-span-7 rounded-2xl border border-white/70 bg-white/90 p-5 shadow-xs space-y-4"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <Inbox className="w-5 h-5 text-blue-600" />
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  Buzón de Mensajes y Avisos
                  <span
                    data-testid="unread-count-badge"
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${
                      unreadCount > 0
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {unreadCount} sin leer
                  </span>
                </h3>
                <p className="text-xs text-slate-600">
                  Comunicaciones internas dirigidas exclusivamente a tu usuario.
                </p>
              </div>
            </div>

            <div className="flex gap-1.5" role="group" aria-label="Filtrar mensajes">
              {(
                [
                  { value: 'TODOS', label: 'Todos' },
                  { value: 'NO_LEIDOS', label: 'No leídos' },
                  { value: 'LEIDOS', label: 'Leídos' },
                ] as const
              ).map(tab => (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setFiltroMensajes(tab.value)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                    filtroMensajes === tab.value
                      ? 'bg-blue-600 text-white'
                      : 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
              Cargando tu buzón de mensajes…
            </div>
          ) : filteredMensajes.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-10 text-center space-y-2">
              <MailOpen className="w-8 h-8 text-slate-400 mx-auto" />
              <p className="text-sm font-semibold text-slate-700">
                No tenés mensajes en tu buzón
              </p>
              <p className="text-xs text-slate-500">
                Cuando recibas notificaciones o avisos internos aparecerán ordenados acá.
              </p>
            </div>
          ) : (
            <ul className="space-y-3" aria-label="Lista de mensajes del usuario">
              {filteredMensajes.map(msg => (
                <li
                  key={msg.id}
                  className={`rounded-xl border p-4 transition-colors ${
                    msg.leido
                      ? 'border-slate-200 bg-white'
                      : 'border-blue-300 bg-blue-50/60 shadow-2xs'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                            msg.leido
                              ? 'bg-slate-100 text-slate-700'
                              : 'bg-blue-600 text-white'
                          }`}
                        >
                          {msg.leido ? (
                            <>
                              <MailOpen className="w-3 h-3" />
                              Leído
                            </>
                          ) : (
                            <>
                              <Mail className="w-3 h-3" />
                              Nuevo
                            </>
                          )}
                        </span>
                        <h4 className="text-sm font-bold text-slate-900">{msg.asunto}</h4>
                      </div>
                      <p className="text-xs text-slate-600">
                        De: <span className="font-semibold text-slate-800">{msg.remitenteNombre}</span>
                      </p>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{formatMessageDate(msg.creadoEn)}</span>
                    </div>
                  </div>

                  <p className="mt-2.5 text-sm text-slate-700 whitespace-pre-line">
                    {msg.contenido}
                  </p>

                  <div className="mt-3 flex items-center justify-end">
                    {!msg.leido ? (
                      <button
                        type="button"
                        disabled={markingId === msg.id}
                        onClick={() => void handleMarkAsRead(msg)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {markingId === msg.id ? 'Marcando…' : 'Marcar como leído'}
                      </button>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Leído
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
