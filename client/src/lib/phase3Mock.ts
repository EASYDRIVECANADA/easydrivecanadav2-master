export type Phase3VehicleStatus = 'AVAILABLE' | 'ON_HOLD' | 'CANCELLED'

export type Phase3HoldRecord = {
  vehicleId: string
  status: Phase3VehicleStatus
  holderEmail: string | null
  depositAmount: number
  holdStartedAt: number | null
  holdExpiresAt: number | null
  cancelledAt: number | null
}

export type Phase3Store = {
  version: 1
  holds: Record<string, Phase3HoldRecord>
}

export const PHASE3_STORE_KEY = 'edc_phase3_mock_store_v1'
export const PHASE3_CHANGE_EVENT = 'edc_phase3_mock_changed'

const HOLD_DURATION_MS = 72 * 60 * 60 * 1000

const nowMs = () => Date.now()

const safeParse = (raw: string | null): any => {
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

const getDefaultStore = (): Phase3Store => ({
  version: 1,
  holds: {},
})

export const readPhase3Store = (): Phase3Store => {
  if (typeof window === 'undefined') return getDefaultStore()
  const parsed = safeParse(window.localStorage.getItem(PHASE3_STORE_KEY))
  if (!parsed || typeof parsed !== 'object') return getDefaultStore()
  if ((parsed as any).version !== 1 || typeof (parsed as any).holds !== 'object') return getDefaultStore()
  return parsed as Phase3Store
}

export const writePhase3Store = (next: Phase3Store) => {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(PHASE3_STORE_KEY, JSON.stringify(next))
  window.dispatchEvent(new Event(PHASE3_CHANGE_EVENT))
}

const normalizeRecord = (r: Partial<Phase3HoldRecord>): Phase3HoldRecord => {
  return {
    vehicleId: String(r.vehicleId || ''),
    status: (r.status === 'ON_HOLD' || r.status === 'CANCELLED') ? r.status : 'AVAILABLE',
    holderEmail: typeof r.holderEmail === 'string' ? r.holderEmail : null,
    depositAmount: typeof r.depositAmount === 'number' && Number.isFinite(r.depositAmount) ? r.depositAmount : 1000,
    holdStartedAt: typeof r.holdStartedAt === 'number' ? r.holdStartedAt : null,
    holdExpiresAt: typeof r.holdExpiresAt === 'number' ? r.holdExpiresAt : null,
    cancelledAt: typeof r.cancelledAt === 'number' ? r.cancelledAt : null,
  }
}

export const getVehicleHoldRecord = (vehicleId: string): Phase3HoldRecord | null => {
  const store = readPhase3Store()
  const rec = store.holds[vehicleId]
  if (!rec) return null
  return normalizeRecord(rec)
}

export const getActiveHoldVehicleId = (): string | null => {
  const store = readPhase3Store()
  const active = Object.values(store.holds).find((r) => r && r.status === 'ON_HOLD')
  return active ? active.vehicleId : null
}

export const computeRemainingSeconds = (rec: Phase3HoldRecord | null): number | null => {
  if (!rec || rec.status !== 'ON_HOLD' || !rec.holdExpiresAt) return null
  const remaining = Math.floor((rec.holdExpiresAt - nowMs()) / 1000)
  return remaining >= 0 ? remaining : 0
}

export const placeOnHoldMock = (params: { vehicleId: string; holderEmail: string | null; depositAmount?: number }) => {
  const store = readPhase3Store()
  const activeVehicleId = getActiveHoldVehicleId()
  if (activeVehicleId && activeVehicleId !== params.vehicleId) {
    return { ok: false as const, reason: 'LOCKED_BY_OTHER_VEHICLE' as const, activeVehicleId }
  }

  const existing = normalizeRecord(store.holds[params.vehicleId] || { vehicleId: params.vehicleId })
  if (existing.status === 'ON_HOLD') {
    return { ok: false as const, reason: 'ALREADY_ON_HOLD' as const }
  }

  const start = nowMs()
  const nextRec: Phase3HoldRecord = {
    vehicleId: params.vehicleId,
    status: 'ON_HOLD',
    holderEmail: params.holderEmail,
    depositAmount: typeof params.depositAmount === 'number' ? params.depositAmount : 1000,
    holdStartedAt: start,
    holdExpiresAt: start + HOLD_DURATION_MS,
    cancelledAt: null,
  }

  const next: Phase3Store = {
    version: 1,
    holds: {
      ...store.holds,
      [params.vehicleId]: nextRec,
    },
  }

  writePhase3Store(next)
  return { ok: true as const, record: nextRec }
}

export const cancelHoldMock = (vehicleId: string) => {
  const store = readPhase3Store()
  const existing = normalizeRecord(store.holds[vehicleId] || { vehicleId })

  const nextRec: Phase3HoldRecord = {
    ...existing,
    status: 'CANCELLED',
    cancelledAt: nowMs(),
  }

  const next: Phase3Store = {
    version: 1,
    holds: {
      ...store.holds,
      [vehicleId]: nextRec,
    },
  }

  writePhase3Store(next)
  return nextRec
}

export const releaseHoldMock = (vehicleId: string) => {
  const store = readPhase3Store()
  const { [vehicleId]: _removed, ...rest } = store.holds
  const next: Phase3Store = {
    version: 1,
    holds: rest,
  }
  writePhase3Store(next)
}

export const expireHoldIfNeeded = (vehicleId: string) => {
  const rec = getVehicleHoldRecord(vehicleId)
  if (!rec || rec.status !== 'ON_HOLD' || !rec.holdExpiresAt) return rec

  if (nowMs() >= rec.holdExpiresAt) {
    return cancelHoldMock(vehicleId)
  }

  return rec
}

export const formatClock = (seconds: number | null): string => {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 0) return '—'
  const hrs = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`
}
