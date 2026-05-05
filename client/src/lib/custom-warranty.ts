// Dealer-created custom warranty providers, plans, tiers, terms and coverage.
// Stored in localStorage and merged into the live brochure via getAllPlans()
// in dealer-config.ts. Each custom plan is shaped exactly like a brochure
// WarrantyPlan so all downstream surfaces work without per-plan branching.
//
// Ported from easydrive-finder-main.

import { useSyncExternalStore } from 'react'
import type { WarrantyPlan, PricingTier } from './bridgewarranty'

const KEY = 'edc.customWarranty.v1'
const EVT = 'edc.customWarranty.updated'

type Store = {
  plans: WarrantyPlan[]
}

const EMPTY: Store = { plans: [] }

function read(): Store {
  if (typeof window === 'undefined') return EMPTY
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return EMPTY
    const p = JSON.parse(raw) as Partial<Store>
    return { plans: p.plans ?? [] }
  } catch {
    return EMPTY
  }
}

function write(s: Store) {
  if (typeof window === 'undefined') return
  localStorage.setItem(KEY, JSON.stringify(s))
  window.dispatchEvent(new Event(EVT))
}

let cachedRaw: string | null = '__init__'
let cachedStore: Store = EMPTY

function snapshot(): Store {
  if (typeof window === 'undefined') return EMPTY
  const raw = localStorage.getItem(KEY) ?? ''
  if (raw !== cachedRaw) {
    cachedRaw = raw
    cachedStore = read()
  }
  return cachedStore
}

export function useCustomWarranty(): Store {
  return useSyncExternalStore(
    (cb) => {
      const h = () => cb()
      window.addEventListener(EVT, h)
      window.addEventListener('storage', h)
      return () => {
        window.removeEventListener(EVT, h)
        window.removeEventListener('storage', h)
      }
    },
    snapshot,
    () => EMPTY,
  )
}

export function listCustomPlans(): WarrantyPlan[] {
  return snapshot().plans
}

export function getCustomPlanBySlug(slug: string): WarrantyPlan | undefined {
  return snapshot().plans.find((p) => p.slug === slug)
}

export function upsertCustomPlan(plan: WarrantyPlan) {
  const s = read()
  const idx = s.plans.findIndex((p) => p.slug === plan.slug)
  if (idx >= 0) s.plans[idx] = plan
  else s.plans.push(plan)
  write(s)
}

export function deleteCustomPlan(slug: string) {
  const s = read()
  s.plans = s.plans.filter((p) => p.slug !== slug)
  write(s)
}

// ── Helpers for building a plan from the editor form ────────────

export function newPlanSlug(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'plan'
  return `custom-${base}-${Date.now().toString(36)}`
}

export function blankTier(): PricingTier {
  return {
    perClaimAmount: 5000,
    deductible: 100,
    terms: [
      { label: '12 mo / 20,000 km', months: 12, km: '20,000' },
      { label: '24 mo / 40,000 km', months: 24, km: '40,000' },
    ],
    rows: [{ label: 'Base Price', values: [0, 0] }],
  }
}

export function blankCustomPlan(provider: string, name: string): WarrantyPlan {
  return {
    name,
    slug: newPlanSlug(name),
    provider,
    eligibility: 'Dealer-defined eligibility.',
    claimRange: 'Per dealer policy',
    deductible: 'Per dealer policy',
    premiumFees: false,
    highlights: [],
    includedCoverage: [],
    coverageDetails: [],
    benefits: [],
    pricingTiers: [blankTier()],
  }
}
