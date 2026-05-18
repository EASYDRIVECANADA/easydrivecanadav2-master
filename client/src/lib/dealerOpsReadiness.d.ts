export type ReadinessCheck = {
  key: string
  label: string
  passed: boolean
}

export type InventoryReadiness = {
  id: string
  category: string
  score: number
  missing: string[]
  checks: ReadinessCheck[]
  label: string
  href: string
}

export type DealReadiness = {
  id: string
  score: number
  status: string
  missing: string[]
  checks: ReadinessCheck[]
  label: string
  customer: string
}

export type AdminOpsTask = {
  id: string
  type: string
  title: string
  detail: string
  href: string
  severity: 'high' | 'medium' | 'low' | string
  createdAt: string
}

export function normalizeVehicleCategory(vehicle?: Record<string, unknown>): string
export function scoreInventoryReadiness(vehicle?: Record<string, unknown>): InventoryReadiness
export function scoreDealReadiness(submission?: Record<string, unknown>): DealReadiness
export function buildVehicleSearchText(vehicle?: Record<string, unknown>): string
export function buildVehicleJsonLd(
  vehicle?: Record<string, unknown>,
  options?: { siteUrl?: string; imageUrl?: string }
): Record<string, unknown>
export function vehicleMatchesSearch(vehicle?: Record<string, unknown>, query?: string): boolean
export function buildAdminOpsTasks(input?: {
  submissions?: Array<Record<string, unknown>>
  vehicles?: Array<Record<string, unknown>>
  leads?: Array<Record<string, unknown>>
  nowIso?: string
}): AdminOpsTask[]
