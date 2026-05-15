// Dealer-side configuration for warranty retail pricing + add-on catalog.
// Persists in localStorage. Only stores OVERRIDES — costs come from the live
// BridgeWarranty catalog at read time so brochure updates flow through automatically.
//
// Ported from easydrive-finder-main. AddOn types are inlined here since this
// project does not have a shared orders.ts.

import { useSyncExternalStore } from 'react'
import {
  warrantyPlans,
  getPlanBySlug as getBrochurePlanBySlug,
  type WarrantyPlan,
  type PricingTier,
} from './bridgewarranty'
import { listCustomPlans, getCustomPlanBySlug } from './custom-warranty'

// ── Unified plan lookup (custom + brochure) ──────────────────────

export function getAllPlans(): WarrantyPlan[] {
  return [...listCustomPlans(), ...warrantyPlans]
}

export function getPlanBySlug(slug: string): WarrantyPlan | undefined {
  return getCustomPlanBySlug(slug) ?? getBrochurePlanBySlug(slug)
}

export function getAllProviders(): string[] {
  return Array.from(new Set(getAllPlans().map((p) => p.provider)))
}

export function getAllPlansByProvider(provider: string): WarrantyPlan[] {
  return getAllPlans().filter((p) => p.provider === provider)
}

// ── Types ────────────────────────────────────────────────────────

export type RetailCell = { retail: number | null; cost?: number | null }

export type WarrantyPlanConfig = {
  enabled: boolean
  tiers: Record<
    number,
    {
      rows: Record<string, (RetailCell | null)[]>
    }
  >
}

export type DealerProductConfig = {
  id: string
  group: string
  label: string
  description: string
  price: number
  cost: number
  taxable: boolean
  customerVisible: boolean
  dealerVisible: boolean
}

export type DealerConfig = {
  warrantyMarkupPct: number
  showRetailToCustomers: boolean
  warranty: Record<string, WarrantyPlanConfig>
  products: DealerProductConfig[]
}

const DEFAULT_PRODUCTS: DealerProductConfig[] = [
  { id: 'delivery',         group: 'delivery', label: 'Home Delivery (Ontario)',       description: 'Doorstep delivery anywhere in ON.',           price: 299,  cost: 150, taxable: true,  customerVisible: true, dealerVisible: true },
  { id: 'ppf_partial',      group: 'ppf',      label: 'PPF — Partial Front',           description: 'Bumper, partial hood, partial fenders.',       price: 899,  cost: 540, taxable: true,  customerVisible: true, dealerVisible: true },
  { id: 'ppf_full_front',   group: 'ppf',      label: 'PPF — Full Front',              description: 'Full bumper, full hood, full fenders, mirrors.',price: 1799, cost: 1080,taxable: true,  customerVisible: true, dealerVisible: true },
  { id: 'ppf_full_body',    group: 'ppf',      label: 'PPF — Full Body',               description: 'Self-healing film over the entire painted body.',price: 4995, cost: 2997,taxable: true,  customerVisible: true, dealerVisible: true },
  { id: 'ceramic_1yr',      group: 'ceramic',  label: 'Ceramic Coating — 1 year',      description: 'Entry-level hydrophobic protection.',          price: 499,  cost: 299, taxable: true,  customerVisible: true, dealerVisible: true },
  { id: 'ceramic_5yr',      group: 'ceramic',  label: 'Ceramic Coating — 5 year',      description: 'Multi-layer professional grade coating.',      price: 1299, cost: 779, taxable: true,  customerVisible: true, dealerVisible: true },
  { id: 'ceramic_lifetime', group: 'ceramic',  label: 'Ceramic Coating — Lifetime',    description: 'Lifetime warranty graphene coating.',          price: 2495, cost: 1497,taxable: true,  customerVisible: true, dealerVisible: true },
]

const DEFAULT_CONFIG: DealerConfig = {
  warrantyMarkupPct: 40,
  showRetailToCustomers: true,
  warranty: {},
  products: DEFAULT_PRODUCTS,
}

// ── Storage I/O ──────────────────────────────────────────────────

const STORAGE_KEY = 'edc.dealerConfig.v1'
const EVT = 'edc.dealerConfig.updated'

function read(): DealerConfig {
  if (typeof window === 'undefined') return DEFAULT_CONFIG
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_CONFIG
    const parsed = JSON.parse(raw) as Partial<DealerConfig>
    return {
      ...DEFAULT_CONFIG,
      ...parsed,
      warranty: parsed.warranty ?? {},
      products: parsed.products?.length ? parsed.products : DEFAULT_CONFIG.products,
    }
  } catch {
    return DEFAULT_CONFIG
  }
}

function write(cfg: DealerConfig) {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg))
  window.dispatchEvent(new Event(EVT))
}

export function getConfig(): DealerConfig {
  return read()
}

export function setConfig(patch: (cfg: DealerConfig) => DealerConfig) {
  write(patch(read()))
}

// ── React subscription ───────────────────────────────────────────

let cachedConfig: DealerConfig = DEFAULT_CONFIG
let cachedRaw: string | null = '__init__'

function getConfigSnapshot(): DealerConfig {
  if (typeof window === 'undefined') return DEFAULT_CONFIG
  const raw = localStorage.getItem(STORAGE_KEY)
  if (raw !== cachedRaw) {
    cachedRaw = raw
    cachedConfig = read()
  }
  return cachedConfig
}

export function useDealerConfig(): DealerConfig {
  return useSyncExternalStore(
    (cb) => {
      const handler = () => cb()
      window.addEventListener(EVT, handler)
      window.addEventListener('storage', handler)
      return () => {
        window.removeEventListener(EVT, handler)
        window.removeEventListener('storage', handler)
      }
    },
    getConfigSnapshot,
    () => DEFAULT_CONFIG,
  )
}

// ── Cost / retail helpers ────────────────────────────────────────

const isNumeric = (v: unknown): v is number => typeof v === 'number' && !isNaN(v)

function findPriceSource(tier: PricingTier, rowLabel: string) {
  const row = tier.rows.find((r) => r.label === rowLabel)
  if (row) return row
  return tier.mileageBands?.find((band) => band.label === rowLabel)
}

function getBrochureCost(plan: WarrantyPlan, tierIndex: number, termIndex: number, rowLabel: string): number | null {
  const tier = plan.pricingTiers[tierIndex]
  if (!tier) return null
  const source = findPriceSource(tier, rowLabel)
  if (!source) return null
  const dealerValue = source.dealerValues?.[termIndex]
  if (isNumeric(dealerValue)) return dealerValue
  const retailValue = source.values[termIndex]
  return isNumeric(retailValue) ? retailValue : null
}

function getBrochureRetail(plan: WarrantyPlan, tierIndex: number, termIndex: number, rowLabel: string): number | null {
  const tier = plan.pricingTiers[tierIndex]
  if (!tier) return null
  const source = findPriceSource(tier, rowLabel)
  if (!source) return null
  const value = source.values[termIndex]
  return isNumeric(value) ? value : null
}

export function getCost(
  plan: WarrantyPlan,
  tierIndex: number,
  termIndex: number,
  rowLabel: string,
  cfg?: DealerConfig,
): number | null {
  // Check for a dealer-overridden cost first
  if (cfg) {
    const costOverride = cfg.warranty[plan.slug]?.tiers?.[tierIndex]?.rows?.[rowLabel]?.[termIndex]?.cost
    if (costOverride != null) return costOverride
  }
  return getBrochureCost(plan, tierIndex, termIndex, rowLabel)
}

export function getRetail(
  cfg: DealerConfig,
  planSlug: string,
  tierIndex: number,
  termIndex: number,
  rowLabel: string,
): number | null {
  const plan = getPlanBySlug(planSlug)
  if (!plan) return null
  const cost = getCost(plan, tierIndex, termIndex, rowLabel)
  if (cost == null) return null
  const override = cfg.warranty[planSlug]?.tiers?.[tierIndex]?.rows?.[rowLabel]?.[termIndex]?.retail
  if (override != null) return override
  return getBrochureRetail(plan, tierIndex, termIndex, rowLabel) ?? Math.round(cost * (1 + cfg.warrantyMarkupPct / 100))
}

export function isPlanEnabled(cfg: DealerConfig, planSlug: string): boolean {
  const entry = cfg.warranty[planSlug]
  return entry ? entry.enabled : true
}

// ── Mutators ─────────────────────────────────────────────────────

function ensureSlot(
  cfg: DealerConfig,
  planSlug: string,
  tierIndex: number,
  rowLabel: string,
  termCount: number,
): { rows: Record<string, (RetailCell | null)[]> } {
  const planEntry = cfg.warranty[planSlug] ?? { enabled: true, tiers: {} }
  const tierEntry = planEntry.tiers[tierIndex] ?? { rows: {} }
  if (!tierEntry.rows[rowLabel]) {
    tierEntry.rows[rowLabel] = new Array(termCount).fill(null)
  }
  planEntry.tiers[tierIndex] = tierEntry
  cfg.warranty[planSlug] = planEntry
  return tierEntry
}

export function setRetailCell(
  planSlug: string,
  tierIndex: number,
  termIndex: number,
  rowLabel: string,
  retail: number | null,
) {
  setConfig((cfg) => {
    const next = structuredClone(cfg)
    const plan = getPlanBySlug(planSlug)
    const termCount = plan?.pricingTiers[tierIndex]?.terms.length ?? 0
    const tierEntry = ensureSlot(next, planSlug, tierIndex, rowLabel, termCount)
    const existing = tierEntry.rows[rowLabel][termIndex]
    tierEntry.rows[rowLabel][termIndex] = retail == null
      ? (existing?.cost != null ? { ...existing, retail: null } : null)
      : { ...(existing ?? {}), retail }
    return next
  })
}

export function setCostCell(
  planSlug: string,
  tierIndex: number,
  termIndex: number,
  rowLabel: string,
  cost: number | null,
) {
  setConfig((cfg) => {
    const next = structuredClone(cfg)
    const plan = getPlanBySlug(planSlug)
    const termCount = plan?.pricingTiers[tierIndex]?.terms.length ?? 0
    const tierEntry = ensureSlot(next, planSlug, tierIndex, rowLabel, termCount)
    const existing = tierEntry.rows[rowLabel][termIndex]
    tierEntry.rows[rowLabel][termIndex] = cost == null
      ? (existing?.retail != null ? { ...existing, cost: null } : null)
      : { ...(existing ?? { retail: null }), cost }
    return next
  })
}

export function setPlanEnabled(planSlug: string, enabled: boolean) {
  setConfig((cfg) => {
    const next = structuredClone(cfg)
    const entry = next.warranty[planSlug] ?? { enabled: true, tiers: {} }
    entry.enabled = enabled
    next.warranty[planSlug] = entry
    return next
  })
}

export function setMarkup(pct: number) {
  setConfig((cfg) => ({ ...cfg, warrantyMarkupPct: Math.max(0, Math.round(pct)) }))
}

export function setShowRetailToCustomers(on: boolean) {
  setConfig((cfg) => ({ ...cfg, showRetailToCustomers: on }))
}

export function applyMarkupToTier(planSlug: string, tierIndex: number, markupPct: number) {
  const plan = getPlanBySlug(planSlug)
  if (!plan) return
  const tier = plan.pricingTiers[tierIndex]
  if (!tier) return
  setConfig((cfg) => {
    const next = structuredClone(cfg)
    for (const row of [...tier.rows, ...(tier.mileageBands ?? [])]) {
      for (let t = 0; t < tier.terms.length; t++) {
        const cost = getCost(plan, tierIndex, t, row.label)
        if (cost == null) continue
        const tierEntry = ensureSlot(next, planSlug, tierIndex, row.label, tier.terms.length)
        tierEntry.rows[row.label][t] = { retail: Math.round(cost * (1 + markupPct / 100)) }
      }
    }
    return next
  })
}

export function fillEmptyOnTier(planSlug: string, tierIndex: number, markupPct: number) {
  const plan = getPlanBySlug(planSlug)
  if (!plan) return
  const tier = plan.pricingTiers[tierIndex]
  if (!tier) return
  setConfig((cfg) => {
    const next = structuredClone(cfg)
    for (const row of [...tier.rows, ...(tier.mileageBands ?? [])]) {
      for (let t = 0; t < tier.terms.length; t++) {
        const cost = getCost(plan, tierIndex, t, row.label)
        if (cost == null) continue
        const tierEntry = ensureSlot(next, planSlug, tierIndex, row.label, tier.terms.length)
        if (tierEntry.rows[row.label][t] == null) {
          tierEntry.rows[row.label][t] = { retail: Math.round(cost * (1 + markupPct / 100)) }
        }
      }
    }
    return next
  })
}

export function resetTierOverrides(planSlug: string, tierIndex: number) {
  setConfig((cfg) => {
    const next = structuredClone(cfg)
    if (next.warranty[planSlug]?.tiers?.[tierIndex]) {
      delete next.warranty[planSlug].tiers[tierIndex]
    }
    return next
  })
}

export function upsertProduct(p: DealerProductConfig) {
  setConfig((cfg) => {
    const next = structuredClone(cfg)
    const idx = next.products.findIndex((x) => x.id === p.id)
    if (idx >= 0) next.products[idx] = p
    else next.products.push(p)
    return next
  })
}

export function deleteProduct(id: string) {
  setConfig((cfg) => {
    const next = structuredClone(cfg)
    next.products = next.products.filter((p) => p.id !== id)
    return next
  })
}

export function getCustomerProducts(cfg?: DealerConfig): DealerProductConfig[] {
  return (cfg ?? read()).products.filter((p) => p.customerVisible)
}

export function getDealerProducts(cfg?: DealerConfig): DealerProductConfig[] {
  return (cfg ?? read()).products.filter((p) => p.dealerVisible)
}

// ── Dealer Guarantee store ───────────────────────────────────────

export type GuaranteeSection = {
  title: string
  body: string
}

export type GuaranteeConfig = {
  heading: string
  sections: GuaranteeSection[]
  footer: string
}

const GUARANTEE_STORAGE_KEY = 'edc.guarantee.v1'
const GUARANTEE_EVT = 'edc.guarantee.updated'

export const DEFAULT_GUARANTEE: GuaranteeConfig = {
  heading: 'EasyDrive Canada 30-Day Guarantee Policy',
  sections: [
    {
      title: '1. Vehicle Accuracy Guarantee',
      body: 'All vehicle descriptions, odometer readings, and condition disclosures are accurate to the best of our knowledge. If a material misrepresentation is discovered within 30 days of purchase, we will work with you to find an equitable resolution.',
    },
    {
      title: '2. Mechanical Disclosure',
      body: 'Any known mechanical defects have been disclosed prior to sale. Vehicles are sold in their disclosed condition. We encourage buyers to perform an independent inspection prior to finalizing the purchase.',
    },
    {
      title: '3. Title and Lien Guarantee',
      body: 'EasyDrive Canada guarantees that the vehicle will be delivered free and clear of any undisclosed liens or encumbrances. Title will be transferred to the buyer promptly upon receipt of full payment.',
    },
    {
      title: '4. Dispute Resolution',
      body: 'Any disputes arising from this sale will first be addressed through direct negotiation. If unresolved, disputes will be submitted to Ontario Mandatory Mediation. Ontario law governs this agreement.',
    },
    {
      title: '5. Contact',
      body: 'EasyDrive Canada Inc. - info@easydrivecanada.com',
    },
  ],
  footer: 'This guarantee is provided in addition to your statutory rights under Ontario consumer protection legislation, including the Motor Vehicle Dealers Act (MVDA). OMVIC registration ensures all transactions adhere to provincial standards.',
}

function readGuarantee(): GuaranteeConfig {
  if (typeof window === 'undefined') return DEFAULT_GUARANTEE
  try {
    const raw = localStorage.getItem(GUARANTEE_STORAGE_KEY)
    if (!raw) return DEFAULT_GUARANTEE
    const parsed = JSON.parse(raw) as Partial<GuaranteeConfig>
    return {
      ...DEFAULT_GUARANTEE,
      ...parsed,
      sections: parsed.sections?.length ? parsed.sections : DEFAULT_GUARANTEE.sections,
    }
  } catch {
    return DEFAULT_GUARANTEE
  }
}

function writeGuarantee(cfg: GuaranteeConfig) {
  if (typeof window === 'undefined') return
  localStorage.setItem(GUARANTEE_STORAGE_KEY, JSON.stringify(cfg))
  window.dispatchEvent(new Event(GUARANTEE_EVT))
}

export function getGuarantee(): GuaranteeConfig {
  return readGuarantee()
}

export function saveGuarantee(cfg: GuaranteeConfig) {
  writeGuarantee(cfg)
}

let cachedGuarantee: GuaranteeConfig = DEFAULT_GUARANTEE
let cachedGuaranteeRaw: string | null = '__init__'

function getGuaranteeSnapshot(): GuaranteeConfig {
  if (typeof window === 'undefined') return DEFAULT_GUARANTEE
  const raw = localStorage.getItem(GUARANTEE_STORAGE_KEY)
  if (raw !== cachedGuaranteeRaw) {
    cachedGuaranteeRaw = raw
    cachedGuarantee = readGuarantee()
  }
  return cachedGuarantee
}

export function useGuarantee(): GuaranteeConfig {
  return useSyncExternalStore(
    (cb) => {
      const handler = () => cb()
      window.addEventListener(GUARANTEE_EVT, handler)
      window.addEventListener('storage', handler)
      return () => {
        window.removeEventListener(GUARANTEE_EVT, handler)
        window.removeEventListener('storage', handler)
      }
    },
    getGuaranteeSnapshot,
    () => DEFAULT_GUARANTEE,
  )
}
