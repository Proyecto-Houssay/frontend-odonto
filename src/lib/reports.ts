import { apiRequest } from './api'

export interface ResumenInformes {
  modulo: string
  estado: string
  totalAtencionesRegistradas: number
  totalItemsInventario: number
  reportesDisponibles: string[]
}

export interface InventarioItem {
  id: number
  nombre: string
  categoria: string
  cantidadDisponible: number
  unidadMedida: string
  estado: string
}

export interface MesAnualReport {
  mes: number
  nombreMes: string
  atenciones: number
}

export interface AnualReport {
  anio: number
  totalAtenciones: number
  meses: MesAnualReport[]
}

export async function fetchResumenInformes(token?: string): Promise<ResumenInformes> {
  return apiRequest<ResumenInformes>('/reports', { token })
}

export async function fetchReporteInventario(token?: string): Promise<InventarioItem[]> {
  return apiRequest<InventarioItem[]>('/reports/inventario', { token })
}

export async function fetchReporteAnual(anio: number, token?: string): Promise<AnualReport> {
  return apiRequest<AnualReport>(`/reports/anual?anio=${anio}`, { token })
}
