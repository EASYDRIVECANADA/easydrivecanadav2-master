'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import {
  useDealerConfig,
  isPlanEnabled,
  setPlanEnabled,
  setMarkup,
  setShowRetailToCustomers,
  setRetailCell,
  setCostCell,
  applyMarkupToTier,
  fillEmptyOnTier,
  resetTierOverrides,
  getCost,
  getRetail,
  useGuarantee,
  saveGuarantee,
  DEFAULT_GUARANTEE,
  type GuaranteeSection,
  getAllProviders,
  getAllPlansByProvider,
  getPlanBySlug,
  upsertProduct,
  deleteProduct,
  type DealerProductConfig,
} from '@/lib/dealer-config'
import {
  upsertCustomPlan,
  deleteCustomPlan,
  blankCustomPlan,
  blankTier,
  useCustomWarranty,
} from '@/lib/custom-warranty'
import type { WarrantyPlan } from '@/lib/bridgewarranty'
import CompanyProfileTab from './CompanyProfileTab'

const PRESETS_WEBHOOK_URL = 'https://primary-production-6722.up.railway.app/webhook/presets'

type TaxRateRow = {
  id: string
  user_id: string | null
  name: string | null
  description: string | null
  rate: number | null
  default_tax_rate: boolean | null
  default_to_sales: string | null
  default_to_purchases_or_costs: string | null
}

type ConfigTab = 'company' | 'warranty' | 'products' | 'taxes' | 'defaults' | 'guarantee'

const CONFIG_TABS: { key: ConfigTab; label: string }[] = [
  { key: 'company',   label: 'Company Profile' },
  { key: 'warranty',  label: 'Warranty plans' },
  { key: 'products',  label: 'Add-on products' },
  { key: 'taxes',     label: 'Tax rates' },
  { key: 'defaults',  label: 'Defaults' },
  { key: 'guarantee', label: '30-Day Guarantee' },
]

// ── Toggle component ─────────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
        checked ? 'bg-[#1EA7FF]' : 'bg-slate-200'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  )
}

// ── Breadcrumbs ──────────────────────────────────────────────────

function Crumbs({ items }: { items: { label: string; onClick?: () => void }[] }) {
  return (
    <nav className="flex items-center gap-1.5 text-sm text-slate-400">
      {items.map((it, i) => {
        const last = i === items.length - 1
        return (
          <span key={i} className="flex items-center gap-1.5">
            {it.onClick && !last ? (
              <button type="button" onClick={it.onClick} className="hover:text-slate-700 transition-colors">
                {it.label}
              </button>
            ) : (
              <span className={last ? 'font-semibold text-slate-800' : ''}>{it.label}</span>
            )}
            {!last && (
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            )}
          </span>
        )
      })}
    </nav>
  )
}

// ── Main page ────────────────────────────────────────────────────

export default function ConfigurationPage() {
  const cfg = useDealerConfig()
  const [tab, setTab] = useState<ConfigTab>('warranty')

  useEffect(() => {
    if (typeof window === 'undefined') return
    const requestedTab = new URLSearchParams(window.location.search).get('tab') as ConfigTab | null
    if (requestedTab && CONFIG_TABS.some((item) => item.key === requestedTab)) setTab(requestedTab)
  }, [])

  const selectTab = (nextTab: ConfigTab) => {
    setTab(nextTab)
    if (typeof window === 'undefined') return
    const url = nextTab === 'warranty'
      ? window.location.pathname
      : `${window.location.pathname}?tab=${encodeURIComponent(nextTab)}`
    window.history.replaceState(null, '', url)
  }

  const isCompanyTab = tab === 'company'

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="px-6 lg:px-8 pt-8 pb-4 border-b border-slate-100">
        <h1 className="text-2xl font-bold text-slate-900">Configurations</h1>
        <p className="text-sm text-slate-400 mt-0.5">Manage company information, bill of sale details, pricing defaults, and dealer-managed products.</p>
      </div>

      {/* Info banner */}
      <div className="mx-6 lg:mx-8 mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#1EA7FF]/30 bg-[#1EA7FF]/5 p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1EA7FF]/15 text-[#1EA7FF] flex-shrink-0">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div>
            <div className="font-semibold text-slate-900">{isCompanyTab ? 'Company Profile' : 'Dealer Pricing Configuration'}</div>
            <div className="text-sm text-slate-500 mt-0.5">
              {isCompanyTab
                ? 'These company details appear on generated bill of sale documents, including previews, emailed PDFs, and e-signature PDFs.'
                : 'Mark up dealer cost to your retail price for every base term and add-on. Customers only see your retail prices - never your costs.'}
            </div>
          </div>
        </div>
        {!isCompanyTab ? (
          <div className="flex items-center gap-3 rounded-full border border-slate-200 bg-white px-4 py-2">
            <span className="text-sm font-medium text-slate-700">Show Retail to Customers</span>
            <Toggle checked={cfg.showRetailToCustomers} onChange={setShowRetailToCustomers} />
          </div>
        ) : null}
      </div>

      {/* Tabs */}
      <div className="px-6 lg:px-8 mt-6 flex items-center gap-2">
        {CONFIG_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => selectTab(t.key)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-all ${
              tab === t.key
                ? 'bg-[#0B1F3A] text-white border-[#0B1F3A]'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="px-6 lg:px-8 py-6">
        {tab === 'company'   && <CompanyProfileTab />}
        {tab === 'warranty'  && <WarrantyConfigTab />}
        {tab === 'products'  && <ProductCatalogTab />}
        {tab === 'taxes'     && <TaxRatesConfigTab />}
        {tab === 'defaults'  && <DefaultsTab />}
        {tab === 'guarantee' && <GuaranteeTab />}
      </div>
    </div>
  )
}

// ── Warranty config tab ──────────────────────────────────────────

function WarrantyConfigTab() {
  const [providerSlug, setProviderSlug] = useState<string | null>(null)
  const [planSlug, setPlanSlug] = useState<string | null>(null)
  const [showAddPlan, setShowAddPlan] = useState(false)
  useCustomWarranty()
  const providers = getAllProviders()

  if (!providerSlug) {
    return (
      <div className="space-y-4">
        <Crumbs items={[{ label: 'Providers' }]} />
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Providers ({providers.length})
            </div>
            <button
              type="button"
              onClick={() => setShowAddPlan(true)}
              className="h-9 px-4 rounded-full bg-[#0B1F3A] text-white text-sm font-semibold hover:bg-[#1EA7FF] transition-colors inline-flex items-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add custom plan
            </button>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {providers.map((prov) => {
              const plans = getAllPlansByProvider(prov)
              return (
                <button
                  key={prov}
                  type="button"
                  onClick={() => setProviderSlug(prov)}
                  className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 text-left hover:border-[#1EA7FF]/40 hover:bg-[#1EA7FF]/5 transition-all"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-[#1EA7FF]">
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <div>
                      <div className="font-semibold text-slate-900">{prov} Warranty</div>
                      <div className="text-xs text-slate-400">{plans.length} plans</div>
                    </div>
                  </div>
                  <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              )
            })}
          </div>
        </div>
        {showAddPlan && (
          <CustomPlanDialog
            onClose={() => setShowAddPlan(false)}
            onSaved={(slug, prov) => {
              setShowAddPlan(false)
              setProviderSlug(prov)
              setPlanSlug(slug)
            }}
          />
        )}
      </div>
    )
  }

  if (!planSlug) {
    return (
      <div className="space-y-4">
        <Crumbs
          items={[
            { label: 'Providers', onClick: () => setProviderSlug(null) },
            { label: providerSlug },
          ]}
        />
        <PlansList provider={providerSlug} onPick={setPlanSlug} />
      </div>
    )
  }

  const plan = getPlanBySlug(planSlug)
  if (!plan) return null
  return (
    <div className="space-y-4">
      <Crumbs
        items={[
          { label: 'Providers', onClick: () => { setProviderSlug(null); setPlanSlug(null) } },
          { label: providerSlug, onClick: () => setPlanSlug(null) },
          { label: plan.name },
        ]}
      />
      <PlanEditor plan={plan} onBack={() => setPlanSlug(null)} onPickPlan={setPlanSlug} />
    </div>
  )
}

function planGroupKey(plan: WarrantyPlan): string {
  return plan.group || plan.slug
}

function planGroupLabel(plans: WarrantyPlan[]): string {
  const first = plans[0]
  if (!first) return 'Warranty Plan'
  if (first.group === 'powertrain') return 'Powertrain Warranty'
  return first.name
}

function planVariantLabel(plan: WarrantyPlan): string {
  if (plan.group === 'powertrain') return plan.name.replace(/^Powertrain\s+/i, '')
  return plan.name
}

function PlansList({ provider, onPick }: { provider: string; onPick: (slug: string) => void }) {
  const plans = getAllPlansByProvider(provider)
  const cfg = useDealerConfig()
  const [q, setQ] = useState('')
  const groupedPlans = useMemo(() => {
    const map = new Map<string, WarrantyPlan[]>()
    plans.forEach((plan) => {
      const key = planGroupKey(plan)
      map.set(key, [...(map.get(key) || []), plan])
    })
    return Array.from(map.entries()).map(([key, groupPlans]) => ({
      key,
      label: planGroupLabel(groupPlans),
      plans: groupPlans,
      defaultSlug: groupPlans[0]?.slug || key,
      tierCount: groupPlans.reduce((sum, plan) => sum + plan.pricingTiers.length, 0),
    }))
  }, [plans])
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return groupedPlans
    return groupedPlans.filter((entry) => {
      const searchText = [
        entry.label,
        ...entry.plans.map((plan) => plan.name),
        ...entry.plans.map((plan) => plan.claimRange),
      ].join(' ').toLowerCase()
      return searchText.includes(needle)
    })
  }, [groupedPlans, q])

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={`Search plans in ${provider} Warranty…`}
            className="h-10 w-full pl-9 pr-4 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1EA7FF]/30 transition-all"
          />
        </div>
        <span className="text-xs font-semibold text-slate-500 border border-slate-200 rounded-full px-3 py-1">
          {filtered.length} plan{filtered.length === 1 ? '' : 's'}
        </span>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {filtered.map((entry) => {
          const enabled = entry.plans.every((plan) => isPlanEnabled(cfg, plan.slug))
          const isCustom = entry.plans.length === 1 && entry.plans[0].slug.startsWith('custom-')
          return (
            <div key={entry.key} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4">
              <button type="button" onClick={() => onPick(entry.defaultSlug)} className="flex flex-1 items-start gap-3 text-left">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-[#1EA7FF]">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-slate-900">{entry.label}</div>
                  {entry.plans.length > 1 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {entry.plans.map((plan) => (
                        <span key={plan.slug} className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                          {planVariantLabel(plan)}
                        </span>
                      ))}
                    </div>
                  )}
                  {entry.tierCount > 0 && (
                    <span className="mt-2 inline-block text-[10px] font-semibold bg-slate-100 text-slate-500 px-2 py-0.5 rounded">
                      {entry.plans.length > 1 ? `${entry.plans.length} variants` : `${entry.tierCount} tier${entry.tierCount === 1 ? '' : 's'}`}
                    </span>
                  )}
                </div>
                <svg className="mt-2 h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
              <div className="ml-3 flex items-center gap-2">
                <Toggle checked={enabled} onChange={(c) => entry.plans.forEach((plan) => setPlanEnabled(plan.slug, c))} />
                {isCustom && (
                  <button
                    type="button"
                    onClick={() => {
                      const customPlan = entry.plans[0]
                      if (confirm(`Delete custom plan "${customPlan.name}"?`)) {
                        deleteCustomPlan(customPlan.slug)
                      }
                    }}
                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          )
        })}
        {filtered.length === 0 && (
          <div className="col-span-full rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-400">
            No plans match your search.
          </div>
        )}
      </div>
    </div>
  )
}

function PlanEditor({ plan, onBack, onPickPlan }: { plan: WarrantyPlan; onBack: () => void; onPickPlan: (slug: string) => void }) {
  const cfg = useDealerConfig()
  const [tierIndex, setTierIndex] = useState(0)
  const [bulkMarkup, setBulkMarkup] = useState<number>(cfg.warrantyMarkupPct)
  const siblingPlans = plan.group
    ? getAllPlansByProvider(plan.provider).filter((p) => p.group === plan.group)
    : []

  if (!plan.pricingTiers.length) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
        <svg className="mx-auto h-10 w-10 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10" />
        </svg>
        <div className="mt-3 font-semibold text-slate-900">{plan.name}</div>
        <div className="mt-1 text-sm text-slate-400">
          This plan has no standalone pricing — it's sold as an add-on alongside an existing warranty. No retail configuration needed.
        </div>
        <button type="button" onClick={onBack} className="mt-5 h-9 px-4 rounded-full border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors">
          Back to plans
        </button>
      </div>
    )
  }

  const tier = plan.pricingTiers[tierIndex]

  return (
    <div className="space-y-4">
      {siblingPlans.length > 1 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
            {planGroupLabel(siblingPlans)}
          </div>
          <div className="flex flex-wrap gap-2">
            {siblingPlans.map((sibling) => (
              <button
                key={sibling.slug}
                type="button"
                onClick={() => {
                  onPickPlan(sibling.slug)
                  setTierIndex(0)
                }}
                className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                  sibling.slug === plan.slug
                    ? 'border-[#0B1F3A] bg-[#0B1F3A] text-white'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-[#1EA7FF]/50 hover:bg-[#1EA7FF]/5'
                }`}
              >
                {planVariantLabel(sibling)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Plan card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#1EA7FF]/10 text-[#1EA7FF]">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div>
            <div className="text-lg font-bold text-slate-900">{plan.name}</div>
            <div className="text-sm text-slate-400">{plan.provider}</div>
            <span className="mt-1 inline-block text-[10px] font-semibold border border-slate-200 text-slate-500 px-2 py-0.5 rounded-full">
              {plan.pricingTiers.length} tier{plan.pricingTiers.length === 1 ? '' : 's'}
            </span>
          </div>
        </div>
      </div>

      {/* Tier picker */}
      {plan.pricingTiers.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {plan.pricingTiers.map((pt, i) => (
            <button
              key={pt.perClaimAmount}
              type="button"
              onClick={() => setTierIndex(i)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                i === tierIndex
                  ? 'border-[#1EA7FF] bg-[#1EA7FF]/10 text-[#1EA7FF]'
                  : 'border-slate-200 text-slate-500 hover:border-slate-400'
              }`}
            >
              ${pt.perClaimAmount.toLocaleString()} Per Claim
            </button>
          ))}
        </div>
      )}

      {/* Term grid */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-[10px] font-semibold bg-slate-100 text-slate-500 px-2 py-0.5 rounded">
              Per Claim: ${tier.perClaimAmount.toLocaleString()}
            </span>
            <span className="text-[10px] font-semibold border border-slate-200 text-slate-500 px-2 py-0.5 rounded-full">
              {tier.terms.length} terms
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-slate-500">Bulk markup</span>
            <input
              type="number"
              value={bulkMarkup}
              onChange={(e) => setBulkMarkup(Number(e.target.value) || 0)}
              className="h-9 w-20 rounded-lg border border-slate-200 px-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1EA7FF]/30"
            />
            <span className="text-sm text-slate-400">%</span>
            <button
              type="button"
              onClick={() => fillEmptyOnTier(plan.slug, tierIndex, bulkMarkup)}
              className="h-9 px-3 rounded-full border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Fill empty
            </button>
            <button
              type="button"
              onClick={() => applyMarkupToTier(plan.slug, tierIndex, bulkMarkup)}
              className="h-9 px-3 rounded-full bg-[#0B1F3A] text-xs font-semibold text-white hover:bg-[#1EA7FF] transition-colors"
            >
              Apply to all
            </button>
            <button
              type="button"
              onClick={() => resetTierOverrides(plan.slug, tierIndex)}
              className="h-9 px-3 rounded-full text-xs font-semibold text-red-500 hover:bg-red-50 transition-colors"
            >
              Reset
            </button>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs uppercase tracking-wider text-slate-400">
                <th className="px-3 py-3 text-left">Coverage / Add-on</th>
                {tier.terms.map((t) => (
                  <th key={t.label} className="px-3 py-3 text-left font-semibold text-slate-700">
                    {t.label.replace(' Mo / ', ' Months / ')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Mileage band base pricing rows */}
              {tier.mileageBands && tier.mileageBands.length > 0 && (
                <>
                  <tr className="bg-slate-50/60">
                    <td colSpan={tier.terms.length + 1} className="px-3 py-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Base Price (by mileage)</span>
                    </td>
                  </tr>
                  {tier.mileageBands.map((band) => (
                    <tr key={band.label} className="border-b border-slate-100">
                      <td className="px-3 py-4">
                        <span className="mr-2 text-[10px] font-bold uppercase bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">Base</span>
                        <span className="font-semibold text-slate-900">{band.label}</span>
                      </td>
                      {band.values.map((v, termIdx) => (
                        <td key={termIdx} className="px-3 py-4 align-top">
                          <PriceCell
                            plan={plan}
                            tierIndex={tierIndex}
                            termIndex={termIdx}
                            rowLabel={band.label}
                            rawValue={v}
                            markupPct={cfg.warrantyMarkupPct}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                  {tier.rows.length > 0 && (
                    <tr className="bg-slate-50/60">
                      <td colSpan={tier.terms.length + 1} className="px-3 py-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Add-ons</span>
                      </td>
                    </tr>
                  )}
                </>
              )}
              {/* Add-on rows — split Base Price from add-ons if no mileageBands */}
              {(() => {
                const baseRows = tier.rows.filter(r => r.label === 'Base Price')
                const addonRows = tier.rows.filter(r => r.label !== 'Base Price')
                const hasMileageBands = tier.mileageBands && tier.mileageBands.length > 0
                // If mileageBands already rendered base pricing, skip baseRows here
                const rowsToRender = hasMileageBands ? tier.rows : tier.rows
                const showSections = !hasMileageBands && baseRows.length > 0 && addonRows.length > 0

                return (
                  <>
                    {showSections && (
                      <tr className="bg-slate-50/60">
                        <td colSpan={tier.terms.length + 1} className="px-3 py-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Base Price</span>
                        </td>
                      </tr>
                    )}
                    {(showSections ? baseRows : []).map((row) => (
                      <tr key={row.label} className="border-b border-slate-100">
                        <td className="px-3 py-4">
                          <span className="mr-2 text-[10px] font-bold uppercase bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">Base</span>
                          <span className="font-semibold text-slate-900">{row.label}</span>
                        </td>
                        {row.values.map((v, termIdx) => (
                          <td key={termIdx} className="px-3 py-4 align-top">
                            <PriceCell
                              plan={plan}
                              tierIndex={tierIndex}
                              termIndex={termIdx}
                              rowLabel={row.label}
                              rawValue={v}
                              markupPct={cfg.warrantyMarkupPct}
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                    {showSections && addonRows.length > 0 && (
                      <tr className="bg-slate-50/60">
                        <td colSpan={tier.terms.length + 1} className="px-3 py-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Add-ons</span>
                        </td>
                      </tr>
                    )}
                    {(showSections ? addonRows : rowsToRender).map((row) => {
                      const isBase = row.label === 'Base Price'
                      const isPremium = row.label === 'Premium Vehicle Fee'
                      return (
                        <tr key={row.label} className="border-b border-slate-100 last:border-b-0">
                          <td className="px-3 py-4">
                            {isBase && !showSections && (
                              <span className="mr-2 text-[10px] font-bold uppercase bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">Base</span>
                            )}
                            {isPremium && (
                              <span className="mr-2 text-[10px] font-bold uppercase bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">Fee</span>
                            )}
                            <span className="font-semibold text-slate-900">{row.label}</span>
                          </td>
                          {row.values.map((v, termIdx) => (
                            <td key={termIdx} className="px-3 py-4 align-top">
                              <PriceCell
                                plan={plan}
                                tierIndex={tierIndex}
                                termIndex={termIdx}
                                rowLabel={row.label}
                                rawValue={v}
                                markupPct={cfg.warrantyMarkupPct}
                              />
                            </td>
                          ))}
                        </tr>
                      )
                    })}
                  </>
                )
              })()}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-slate-400">
          Click the pencil on any cell to set a custom retail price. Grey italic values show suggested retail (cost × default markup) — customers only see your saved price.
        </p>
      </div>
    </div>
  )
}

function PriceCell({
  plan, tierIndex, termIndex, rowLabel, rawValue, markupPct,
}: {
  plan: WarrantyPlan
  tierIndex: number
  termIndex: number
  rowLabel: string
  rawValue: number | string | null
  markupPct: number
}) {
  const cfg = useDealerConfig()
  const [editingField, setEditingField] = useState<'cost' | 'retail' | null>(null)
  const [draft, setDraft] = useState('')

  // Check overrides first, before any early returns
  const costOverride = cfg.warranty[plan.slug]?.tiers?.[tierIndex]?.rows?.[rowLabel]?.[termIndex]?.cost
  const retailOverride = cfg.warranty[plan.slug]?.tiers?.[tierIndex]?.rows?.[rowLabel]?.[termIndex]?.retail

  if (rawValue === 'Included') {
    return (
      <div className="text-xs text-slate-400">
        <span className="rounded-full bg-green-50 text-green-700 px-2 py-0.5 font-medium">Included</span>
      </div>
    )
  }

  // Blank cell with no override — show — with a + button to add pricing
  if (typeof rawValue !== 'number' && costOverride == null) {
    if (editingField === 'cost') {
      return (
        <div className="space-y-1">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Set cost</div>
          <div className="flex items-center gap-1">
            <span className="text-xs text-slate-400">$</span>
            <input
              autoFocus
              type="number"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => {
                const n = Number(draft)
                if (!isNaN(n) && n >= 0) setCostCell(plan.slug, tierIndex, termIndex, rowLabel, n)
                setEditingField(null)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const n = Number(draft)
                  if (!isNaN(n) && n >= 0) setCostCell(plan.slug, tierIndex, termIndex, rowLabel, n)
                  setEditingField(null)
                } else if (e.key === 'Escape') setEditingField(null)
              }}
              className="h-8 w-20 rounded-lg border border-slate-200 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1EA7FF]/30"
            />
          </div>
        </div>
      )
    }
    return (
      <div className="flex items-center gap-1 text-xs text-slate-400">
        <span>—</span>
        <button
          type="button"
          title="Add price for this term"
          onClick={() => { setDraft(''); setEditingField('cost') }}
          className="rounded p-0.5 text-slate-300 hover:bg-[#1EA7FF]/10 hover:text-[#1EA7FF] transition-colors"
        >
          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>
    )
  }

  // Full cell: rawValue is a number, or costOverride exists
  const effectiveRaw = typeof rawValue === 'number' ? rawValue : 0
  const cost = costOverride ?? getCost(plan, tierIndex, termIndex, rowLabel) ?? effectiveRaw
  const retail = retailOverride ?? getRetail(cfg, plan.slug, tierIndex, termIndex, rowLabel) ?? Math.round(cost * (1 + markupPct / 100))
  const markupDelta = cost > 0 ? Math.round(((retail - cost) / cost) * 100) : 0

  function commitEdit(field: 'cost' | 'retail') {
    const n = Number(draft)
    if (!isNaN(n) && n >= 0) {
      if (field === 'cost') setCostCell(plan.slug, tierIndex, termIndex, rowLabel, n)
      else setRetailCell(plan.slug, tierIndex, termIndex, rowLabel, n)
    }
    setEditingField(null)
  }

  function startEdit(field: 'cost' | 'retail') {
    setDraft(String(field === 'cost' ? cost : retail))
    setEditingField(field)
  }

  if (editingField) {
    return (
      <div className="space-y-1">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
          {editingField === 'cost' ? 'Edit cost' : 'Edit retail'}
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xs text-slate-400">$</span>
          <input
            autoFocus
            type="number"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => commitEdit(editingField)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitEdit(editingField)
              else if (e.key === 'Escape') setEditingField(null)
            }}
            className="h-8 w-20 rounded-lg border border-slate-200 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1EA7FF]/30"
          />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {/* Cost row */}
      <div className="flex items-center gap-1">
        <span className={`text-[11px] tabular-nums ${costOverride != null ? 'font-semibold text-amber-600' : 'text-slate-400'}`}>
          Cost ${cost.toLocaleString()}
        </span>
        <button
          type="button"
          title="Edit cost"
          onClick={() => startEdit('cost')}
          className="rounded p-0.5 text-slate-300 hover:bg-amber-50 hover:text-amber-500 transition-colors"
        >
          <svg className="h-2.5 w-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        </button>
        {costOverride != null && (
          <button
            type="button"
            title="Reset cost override"
            onClick={() => setCostCell(plan.slug, tierIndex, termIndex, rowLabel, null)}
            className="rounded p-0.5 text-slate-300 hover:bg-red-50 hover:text-red-400 transition-colors"
          >
            <svg className="h-2.5 w-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Retail row */}
      <div className="flex items-center gap-1.5">
        <span className={`font-bold tabular-nums ${retailOverride != null ? 'text-slate-900' : 'italic text-slate-400'}`}>
          ${retail.toLocaleString()}
        </span>
        {markupDelta !== 0 && (retailOverride != null || costOverride != null) && (
          <span className="rounded-full bg-green-50 text-green-700 px-1.5 py-0.5 text-[10px] font-semibold">
            {markupDelta > 0 ? '+' : ''}{markupDelta}%
          </span>
        )}
        <button
          type="button"
          title="Edit retail price"
          onClick={() => startEdit('retail')}
          className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
        >
          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        </button>
        {retailOverride != null && (
          <button
            type="button"
            title="Reset retail override"
            onClick={() => setRetailCell(plan.slug, tierIndex, termIndex, rowLabel, null)}
            className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors"
          >
            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}

// ── Products tab ─────────────────────────────────────────────────

function ProductCatalogTab() {
  const cfg = useDealerConfig()
  const [editing, setEditing] = useState<DealerProductConfig | null>(null)
  const [adding, setAdding] = useState(false)

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-semibold text-slate-900">Add-on products</div>
          <div className="text-xs text-slate-400 mt-0.5">Configure dealer cost, customer-facing retail price, and where each product appears.</div>
        </div>
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="h-9 px-4 rounded-full bg-[#0B1F3A] text-white text-sm font-semibold hover:bg-[#1EA7FF] transition-colors inline-flex items-center gap-1.5"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add product
        </button>
      </div>
      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50/80 text-xs uppercase tracking-wider text-slate-400">
            <tr>
              <th className="px-3 py-3 text-left">Product</th>
              <th className="px-3 py-3 text-left">Group</th>
              <th className="px-3 py-3 text-right">Cost</th>
              <th className="px-3 py-3 text-right">Retail</th>
              <th className="px-3 py-3 text-center">Customer</th>
              <th className="px-3 py-3 text-center">Dealer</th>
              <th className="px-3 py-3 text-center">Taxable</th>
              <th className="px-3 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {cfg.products.map((p) => {
              const margin = p.cost > 0 ? Math.round(((p.price - p.cost) / p.cost) * 100) : 0
              return (
                <tr key={p.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="px-3 py-3">
                    <div className="font-medium text-slate-900">{p.label}</div>
                    <div className="text-xs text-slate-400">{p.description}</div>
                  </td>
                  <td className="px-3 py-3 text-xs text-slate-400 capitalize">{p.group}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-slate-600">${p.cost.toLocaleString()}</td>
                  <td className="px-3 py-3 text-right">
                    <div className="font-semibold tabular-nums text-slate-900">${p.price.toLocaleString()}</div>
                    {margin !== 0 && <div className="text-[10px] font-semibold text-green-600">+{margin}%</div>}
                  </td>
                  <td className="px-3 py-3 text-center">
                    <Toggle checked={p.customerVisible} onChange={(c) => upsertProduct({ ...p, customerVisible: c })} />
                  </td>
                  <td className="px-3 py-3 text-center">
                    <Toggle checked={p.dealerVisible} onChange={(c) => upsertProduct({ ...p, dealerVisible: c })} />
                  </td>
                  <td className="px-3 py-3 text-center">
                    <input
                      type="checkbox"
                      checked={p.taxable}
                      onChange={(e) => upsertProduct({ ...p, taxable: e.target.checked })}
                      className="h-4 w-4 rounded border-slate-300 text-[#1EA7FF] focus:ring-[#1EA7FF]/30"
                    />
                  </td>
                  <td className="px-3 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => setEditing(p)}
                        className="p-1.5 text-slate-400 hover:text-[#1EA7FF] hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => { if (confirm(`Remove "${p.label}"?`)) deleteProduct(p.id) }}
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
            {cfg.products.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-sm text-slate-400">
                  No products yet. Click "Add product" to create your first one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {(editing || adding) && (
        <ProductDialog
          product={editing}
          onClose={() => { setEditing(null); setAdding(false) }}
        />
      )}
    </div>
  )
}

function ProductDialog({ product, onClose }: { product: DealerProductConfig | null; onClose: () => void }) {
  const isNew = !product
  const cfg = useDealerConfig()
  const existingGroups = Array.from(new Set(cfg.products.map(p => p.group)))
  const [draft, setDraft] = useState<DealerProductConfig>(
    product ?? {
      id: `custom-${Date.now()}`,
      group: '',
      label: '',
      description: '',
      price: 0,
      cost: 0,
      taxable: true,
      customerVisible: true,
      dealerVisible: true,
    },
  )
  const [customGroup, setCustomGroup] = useState('')
  const isCustomGroup = draft.group === '__new__'
  const effectiveGroup = isCustomGroup ? customGroup.trim().toLowerCase().replace(/\s+/g, '_') : draft.group

  const save = () => {
    if (!draft.label.trim()) { alert('Label is required'); return }
    if (!effectiveGroup) { alert('Please select or enter a group'); return }
    upsertProduct({ ...draft, group: effectiveGroup })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-800">{isNew ? 'Add product' : 'Edit product'}</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-6 py-4 max-h-[65vh] overflow-y-auto space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Group</label>
            <select
              value={draft.group}
              onChange={(e) => { setDraft({ ...draft, group: e.target.value }); setCustomGroup('') }}
              className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1EA7FF]/30 bg-white"
            >
              <option value="">— Select a group —</option>
              {existingGroups.map(g => (
                <option key={g} value={g}>{g.charAt(0).toUpperCase() + g.slice(1).replace(/_/g, ' ')}</option>
              ))}
              <option value="__new__">+ New group…</option>
            </select>
            {isCustomGroup && (
              <input
                value={customGroup}
                onChange={(e) => setCustomGroup(e.target.value)}
                placeholder="e.g. Tinting, Rust Protection"
                className="mt-2 w-full h-10 px-3 rounded-lg border border-[#1EA7FF] text-sm focus:outline-none focus:ring-2 focus:ring-[#1EA7FF]/30"
                autoFocus
              />
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Label</label>
            <input value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} placeholder="Nitrogen tire fill" className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1EA7FF]/30" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <input value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="Reduces tire pressure loss…" className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1EA7FF]/30" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Cost ($)</label>
              <input type="number" value={draft.cost} onChange={(e) => setDraft({ ...draft, cost: Number(e.target.value) || 0 })} className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1EA7FF]/30" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Retail ($)</label>
              <input type="number" value={draft.price} onChange={(e) => setDraft({ ...draft, price: Number(e.target.value) || 0 })} className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1EA7FF]/30" />
            </div>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-slate-200 p-3">
            <span className="text-sm text-slate-700">Taxable (HST applies)</span>
            <Toggle checked={draft.taxable} onChange={(c) => setDraft({ ...draft, taxable: c })} />
          </div>
          <div className="flex items-center justify-between rounded-xl border border-slate-200 p-3">
            <span className="text-sm text-slate-700">Visible to customers (online checkout)</span>
            <Toggle checked={draft.customerVisible} onChange={(c) => setDraft({ ...draft, customerVisible: c })} />
          </div>
          <div className="flex items-center justify-between rounded-xl border border-slate-200 p-3">
            <span className="text-sm text-slate-700">Available on manual Bills of Sale</span>
            <Toggle checked={draft.dealerVisible} onChange={(c) => setDraft({ ...draft, dealerVisible: c })} />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="h-10 px-4 rounded-full border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors">Cancel</button>
          <button type="button" onClick={save} className="h-10 px-5 rounded-full bg-[#0B1F3A] text-sm font-semibold text-white hover:bg-[#1EA7FF] transition-colors">
            {isNew ? 'Add product' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Defaults tab ─────────────────────────────────────────────────

function boolish(v: unknown): boolean {
  if (typeof v === 'boolean') return v
  const s = String(v ?? '').trim().toLowerCase()
  return s === 'yes' || s === 'true' || s === '1'
}

async function getConfigurationUserId(): Promise<string | null> {
  try {
    if (typeof window !== 'undefined') {
      const raw = window.localStorage.getItem('edc_admin_session')
      if (raw) {
        const parsed = JSON.parse(raw) as { email?: string; user_id?: string }
        const sessionUserId = String(parsed?.user_id ?? '').trim()
        if (sessionUserId) return sessionUserId

        const email = String(parsed?.email ?? '').trim().toLowerCase()
        if (email) {
          const { data } = await supabase
            .from('edc_account_verifications')
            .select('id')
            .eq('email', email)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()
          if ((data as any)?.id) return String((data as any).id)
        }
      }
    }

    const { data: { user } } = await supabase.auth.getUser()
    return user?.id ?? null
  } catch {
    return null
  }
}

function TaxRatesConfigTab() {
  const [rows, setRows] = useState<TaxRateRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<TaxRateRow | null>(null)
  const [draft, setDraft] = useState({
    name: '',
    description: '',
    rate: '',
    defaultTaxRate: false,
    defaultToSales: true,
    defaultToPurchasesOrCosts: false,
  })

  const resetDraft = () => {
    setEditing(null)
    setDraft({
      name: '',
      description: '',
      rate: '',
      defaultTaxRate: false,
      defaultToSales: true,
      defaultToPurchasesOrCosts: false,
    })
    setError(null)
  }

  const loadRows = async () => {
    setLoading(true)
    setError(null)
    try {
      const userId = await getConfigurationUserId()
      if (!userId) {
        setRows([])
        setError('Unable to find the active admin user for tax configuration.')
        return
      }
      const { data, error: loadError } = await supabase
        .from('presets_tax')
        .select('id, user_id, name, description, rate, default_tax_rate, default_to_sales, default_to_purchases_or_costs')
        .eq('user_id', userId)
        .order('name', { ascending: true })

      if (loadError) throw loadError
      setRows(((data as any) || []) as TaxRateRow[])
    } catch (e: any) {
      setRows([])
      setError(e?.message || 'Failed to load tax rates.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadRows()
  }, [])

  const startEdit = (row: TaxRateRow) => {
    setEditing(row)
    setDraft({
      name: String(row.name ?? ''),
      description: String(row.description ?? ''),
      rate: row.rate == null ? '' : String(row.rate),
      defaultTaxRate: Boolean(row.default_tax_rate),
      defaultToSales: boolish(row.default_to_sales),
      defaultToPurchasesOrCosts: boolish(row.default_to_purchases_or_costs),
    })
    setError(null)
  }

  const save = async () => {
    if (saving) return
    setError(null)
    const name = draft.name.trim()
    const rate = Number(draft.rate)
    if (!name) {
      setError('Tax name is required.')
      return
    }
    if (!Number.isFinite(rate) || rate < 0) {
      setError('Tax rate must be a valid percentage.')
      return
    }

    setSaving(true)
    try {
      const userId = await getConfigurationUserId()
      if (!userId) throw new Error('Unable to find the active admin user.')

      const payload = {
        user_id: userId,
        name,
        description: draft.description.trim() || null,
        rate,
        default_tax_rate: draft.defaultTaxRate,
        default_to_sales: draft.defaultTaxRate ? (draft.defaultToSales ? 'Yes' : 'No') : null,
        default_to_purchases_or_costs: draft.defaultTaxRate ? (draft.defaultToPurchasesOrCosts ? 'Yes' : 'No') : null,
      }

      if (editing) {
        const { error: updateError } = await supabase.from('presets_tax').update(payload).eq('id', editing.id)
        if (updateError) throw updateError
      } else {
        const { error: insertError } = await supabase.from('presets_tax').insert(payload)
        if (insertError) {
          const res = await fetch(PRESETS_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              category: 'Tax Rates',
              action: 'create',
              id: null,
              user_id: userId,
              name,
              description: draft.description.trim() || null,
              rate,
              default_tax_rate: draft.defaultTaxRate,
              default_to_sales: draft.defaultTaxRate ? draft.defaultToSales : null,
              default_to_purchases_or_costs: draft.defaultTaxRate ? draft.defaultToPurchasesOrCosts : null,
            }),
          })
          const text = await res.text().catch(() => '')
          if (!res.ok || String(text).trim() !== 'Done') {
            throw new Error(text || insertError.message || 'Failed to create tax rate.')
          }
        }
      }

      resetDraft()
      await loadRows()
    } catch (e: any) {
      setError(e?.message || 'Failed to save tax rate.')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (row: TaxRateRow) => {
    if (!confirm(`Delete tax rate "${row.name || ''}"?`)) return
    setError(null)
    try {
      const { error: deleteError } = await supabase.from('presets_tax').delete().eq('id', row.id)
      if (deleteError) throw deleteError
      if (editing?.id === row.id) resetDraft()
      await loadRows()
    } catch (e: any) {
      setError(e?.message || 'Failed to delete tax rate.')
    }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="font-semibold text-slate-900">Tax rates</div>
            <div className="mt-0.5 text-xs text-slate-400">
              These rates feed the worksheet tax selector and each fee, accessory, warranty, and insurance tax picker.
            </div>
          </div>
          <button type="button" onClick={resetDraft} className="h-9 px-4 rounded-full bg-[#0B1F3A] text-white text-sm font-semibold hover:bg-[#1EA7FF] transition-colors">
            New tax rate
          </button>
        </div>

        {error ? <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}

        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50/80 text-xs uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-3 py-3 text-left">Tax</th>
                <th className="px-3 py-3 text-right">Rate</th>
                <th className="px-3 py-3 text-center">Default</th>
                <th className="px-3 py-3 text-center">Sales</th>
                <th className="px-3 py-3 text-center">Purchases/Costs</th>
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-sm text-slate-400">Loading tax rates...</td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-sm text-slate-400">No tax rates configured.</td>
                </tr>
              ) : rows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="px-3 py-3">
                    <div className="font-medium text-slate-900">{row.name}</div>
                    <div className="text-xs text-slate-400">{row.description}</div>
                  </td>
                  <td className="px-3 py-3 text-right font-semibold tabular-nums text-slate-900">{Number(row.rate ?? 0)}%</td>
                  <td className="px-3 py-3 text-center">
                    {row.default_tax_rate ? <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">Default</span> : <span className="text-xs text-slate-300">-</span>}
                  </td>
                  <td className="px-3 py-3 text-center text-xs text-slate-600">{boolish(row.default_to_sales) ? 'Yes' : '-'}</td>
                  <td className="px-3 py-3 text-center text-xs text-slate-600">{boolish(row.default_to_purchases_or_costs) ? 'Yes' : '-'}</td>
                  <td className="px-3 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <button type="button" onClick={() => startEdit(row)} className="p-1.5 text-slate-400 hover:text-[#1EA7FF] hover:bg-blue-50 rounded-lg transition-colors">
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                      <button type="button" onClick={() => void remove(row)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="font-semibold text-slate-900">{editing ? 'Edit tax rate' : 'New tax rate'}</div>
        <div className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
            <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="HST" className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1EA7FF]/30" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <input value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="Ontario sales tax" className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1EA7FF]/30" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Tax rate amount</label>
            <div className="flex rounded-lg border border-slate-200 overflow-hidden focus-within:ring-2 focus-within:ring-[#1EA7FF]/30">
              <input type="number" min="0" step="0.001" value={draft.rate} onChange={(e) => setDraft({ ...draft, rate: e.target.value })} placeholder="13" className="flex-1 h-10 px-3 text-sm outline-none" />
              <div className="h-10 w-10 border-l border-slate-200 bg-slate-50 text-sm text-slate-500 flex items-center justify-center">%</div>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-xl border border-slate-200 p-3">
              <span className="text-sm text-slate-700">Default tax rate</span>
              <Toggle checked={draft.defaultTaxRate} onChange={(v) => setDraft({ ...draft, defaultTaxRate: v })} />
            </div>
            <div className="flex items-center justify-between rounded-xl border border-slate-200 p-3">
              <span className="text-sm text-slate-700">Default for sales worksheets</span>
              <Toggle checked={draft.defaultToSales} onChange={(v) => setDraft({ ...draft, defaultToSales: v })} />
            </div>
            <div className="flex items-center justify-between rounded-xl border border-slate-200 p-3">
              <span className="text-sm text-slate-700">Default for purchases/costs</span>
              <Toggle checked={draft.defaultToPurchasesOrCosts} onChange={(v) => setDraft({ ...draft, defaultToPurchasesOrCosts: v })} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            {editing ? <button type="button" onClick={resetDraft} className="h-10 px-4 rounded-full border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors">Cancel</button> : null}
            <button type="button" onClick={() => void save()} disabled={saving} className="h-10 px-5 rounded-full bg-[#0B1F3A] text-sm font-semibold text-white hover:bg-[#1EA7FF] disabled:opacity-50 transition-colors">
              {saving ? 'Saving...' : editing ? 'Save changes' : 'Add tax rate'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function DefaultsTab() {
  const cfg = useDealerConfig()
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="font-semibold text-slate-900">Global warranty markup</div>
        <p className="mt-1 text-sm text-slate-400">
          Default markup applied to any warranty cell that doesn't have a custom override. Changing this updates suggested retails everywhere.
        </p>
        <div className="mt-4 flex items-center gap-3">
          <input
            type="number"
            value={cfg.warrantyMarkupPct}
            onChange={(e) => setMarkup(Number(e.target.value) || 0)}
            className="h-10 w-32 rounded-lg border border-slate-200 px-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1EA7FF]/30"
          />
          <span className="text-sm text-slate-400">% markup over cost</span>
        </div>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="font-semibold text-slate-900">Customer pricing visibility</div>
        <p className="mt-1 text-sm text-slate-400">
          When OFF, the public warranty page hides retails and shows "Call for pricing" instead. Useful while you're still building your price book.
        </p>
        <div className="mt-4 flex items-center justify-between rounded-xl border border-slate-200 p-3">
          <span className="text-sm text-slate-700">Show retail prices to customers</span>
          <Toggle checked={cfg.showRetailToCustomers} onChange={setShowRetailToCustomers} />
        </div>
      </div>
    </div>
  )
}

// ── Custom plan creation dialog ───────────────────────────────────

function CustomPlanDialog({ onClose, onSaved }: { onClose: () => void; onSaved: (slug: string, provider: string) => void }) {
  const [provider, setProvider] = useState('')
  const [planName, setPlanName] = useState('')
  const [perClaim, setPerClaim] = useState(5000)
  const [deductible, setDeductible] = useState(100)
  const [terms, setTerms] = useState([
    { months: 12, km: '20,000' },
    { months: 24, km: '40,000' },
  ])
  const [rows, setRows] = useState<{ label: string; values: number[] }[]>([
    { label: 'Base Price', values: [0, 0] },
  ])

  function setTermCount(n: number) {
    const next = terms.slice(0, n)
    while (next.length < n) {
      const months = (next.length + 1) * 12
      next.push({ months, km: `${months * 1667}`.replace(/(\d{3})$/, ',$1') })
    }
    setTerms(next)
    setRows((rs) => rs.map((r) => {
      const v = r.values.slice(0, n)
      while (v.length < n) v.push(0)
      return { ...r, values: v }
    }))
  }

  function updateTerm(i: number, patch: Partial<{ months: number; km: string }>) {
    setTerms((ts) => ts.map((t, idx) => (idx === i ? { ...t, ...patch } : t)))
  }

  function addRow() {
    setRows((rs) => [...rs, { label: 'New coverage row', values: terms.map(() => 0) }])
  }

  function removeRow(i: number) {
    if (rows[i].label === 'Base Price') return
    setRows((rs) => rs.filter((_, idx) => idx !== i))
  }

  function updateRow(i: number, patch: Partial<{ label: string }>) {
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  }

  function updateCell(rowI: number, colI: number, val: number) {
    setRows((rs) => rs.map((r, idx) =>
      idx === rowI ? { ...r, values: r.values.map((v, ci) => (ci === colI ? val : v)) } : r,
    ))
  }

  function save() {
    if (!provider.trim() || !planName.trim()) { alert('Provider and plan name are required'); return }
    const plan = blankCustomPlan(provider.trim(), planName.trim())
    plan.pricingTiers = [{
      ...blankTier(),
      perClaimAmount: perClaim,
      deductible,
      terms: terms.map((t) => ({ label: `${t.months} mo / ${t.km} km`, months: t.months, km: t.km })),
      rows: rows.map((r) => ({ label: r.label, values: r.values })),
    }]
    upsertCustomPlan(plan)
    onSaved(plan.slug, plan.provider)
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-800">Add custom plan</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-4 space-y-5">
          {/* Provider + plan name */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Provider</label>
              <input value={provider} onChange={(e) => setProvider(e.target.value)} placeholder="e.g. A-Protect" className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1EA7FF]/30" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Plan name</label>
              <input value={planName} onChange={(e) => setPlanName(e.target.value)} placeholder="e.g. Gold Plus" className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1EA7FF]/30" />
            </div>
          </div>

          {/* Tier settings */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Per-claim amount ($)</label>
              <input type="number" value={perClaim} onChange={(e) => setPerClaim(Number(e.target.value) || 0)} className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1EA7FF]/30" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Deductible ($)</label>
              <input type="number" value={deductible} onChange={(e) => setDeductible(Number(e.target.value) || 0)} className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1EA7FF]/30" />
            </div>
          </div>

          {/* Terms */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-slate-700">Terms</label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">{terms.length} terms</span>
                <button type="button" onClick={() => setTermCount(terms.length + 1)} className="text-xs text-[#1EA7FF] hover:underline">+ Add term</button>
                {terms.length > 1 && (
                  <button type="button" onClick={() => setTermCount(terms.length - 1)} className="text-xs text-red-400 hover:underline">− Remove</button>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {terms.map((t, i) => (
                <div key={i} className="flex items-center gap-2 rounded-lg border border-slate-200 p-2">
                  <input type="number" value={t.months} onChange={(e) => updateTerm(i, { months: Number(e.target.value) || 12 })} className="w-16 h-8 px-2 rounded border border-slate-200 text-xs focus:outline-none" />
                  <span className="text-xs text-slate-400">mo /</span>
                  <input value={t.km} onChange={(e) => updateTerm(i, { km: e.target.value })} className="flex-1 h-8 px-2 rounded border border-slate-200 text-xs focus:outline-none" />
                  <span className="text-xs text-slate-400">km</span>
                </div>
              ))}
            </div>
          </div>

          {/* Coverage rows */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-slate-700">Coverage rows & costs</label>
              <button type="button" onClick={addRow} className="text-xs text-[#1EA7FF] hover:underline">+ Add row</button>
            </div>
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-slate-400 uppercase tracking-wider">
                  <tr>
                    <th className="px-3 py-2 text-left">Row label</th>
                    {terms.map((t, i) => (
                      <th key={i} className="px-3 py-2 text-left">{t.months}mo cost ($)</th>
                    ))}
                    <th className="w-8 px-2 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((r, ri) => (
                    <tr key={ri}>
                      <td className="px-3 py-2">
                        <input value={r.label} onChange={(e) => updateRow(ri, { label: e.target.value })} readOnly={r.label === 'Base Price'} className="w-full h-8 px-2 rounded border border-slate-200 text-xs focus:outline-none disabled:bg-slate-50" />
                      </td>
                      {r.values.map((v, ci) => (
                        <td key={ci} className="px-3 py-2">
                          <input type="number" value={v} onChange={(e) => updateCell(ri, ci, Number(e.target.value) || 0)} className="w-full h-8 px-2 rounded border border-slate-200 text-xs focus:outline-none" />
                        </td>
                      ))}
                      <td className="px-2 py-2">
                        {r.label !== 'Base Price' && (
                          <button type="button" onClick={() => removeRow(ri)} className="text-red-400 hover:text-red-600">
                            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="h-10 px-4 rounded-full border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors">Cancel</button>
          <button type="button" onClick={save} className="h-10 px-5 rounded-full bg-[#0B1F3A] text-sm font-semibold text-white hover:bg-[#1EA7FF] transition-colors">Create plan</button>
        </div>
      </div>
    </div>
  )
}

// ── 30-Day Guarantee tab ─────────────────────────────────────────

function GuaranteeTab() {
  const stored = useGuarantee()
  const [draft, setDraft] = useState(() => JSON.parse(JSON.stringify(stored)) as typeof stored)
  const [saved, setSaved] = useState(false)

  function updateSection(i: number, patch: Partial<GuaranteeSection>) {
    setDraft(d => {
      const sections = d.sections.map((s, idx) => idx === i ? { ...s, ...patch } : s)
      return { ...d, sections }
    })
    setSaved(false)
  }

  function addSection() {
    setDraft(d => ({
      ...d,
      sections: [...d.sections, { title: `${d.sections.length + 1}. New Section`, body: '' }],
    }))
    setSaved(false)
  }

  function removeSection(i: number) {
    setDraft(d => ({ ...d, sections: d.sections.filter((_, idx) => idx !== i) }))
    setSaved(false)
  }

  function moveSection(i: number, dir: -1 | 1) {
    setDraft(d => {
      const sections = [...d.sections]
      const j = i + dir
      if (j < 0 || j >= sections.length) return d;
      [sections[i], sections[j]] = [sections[j], sections[i]]
      return { ...d, sections }
    })
    setSaved(false)
  }

  function handleSave() {
    saveGuarantee(draft)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  function handleReset() {
    const fresh = JSON.parse(JSON.stringify(DEFAULT_GUARANTEE))
    setDraft(fresh)
    setSaved(false)
  }

  return (
    <div className="max-w-3xl space-y-6">
      {/* Header card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="font-semibold text-slate-900">30-Day Dealer Guarantee</div>
            <div className="text-xs text-slate-400 mt-0.5">This text is shown to customers during checkout and must be signed before purchase.</div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleReset}
              className="h-9 px-4 rounded-full border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors whitespace-nowrap"
            >
              Reset to default
            </button>
            <button
              type="button"
              onClick={handleSave}
              className={`h-9 px-5 rounded-full text-sm font-semibold transition-colors whitespace-nowrap ${saved ? 'bg-green-600 text-white' : 'bg-[#0B1F3A] text-white hover:bg-[#1EA7FF]'}`}
            >
              {saved ? '✓ Saved' : 'Save changes'}
            </button>
          </div>
        </div>

        {/* Heading */}
        <div className="space-y-1">
          <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider">Document heading</label>
          <input
            value={draft.heading}
            onChange={e => { setDraft(d => ({ ...d, heading: e.target.value })); setSaved(false) }}
            className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1EA7FF]/30"
          />
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-3">
        {draft.sections.map((section, i) => (
          <div key={i} className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Section {i + 1}</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => moveSection(i, -1)}
                  disabled={i === 0}
                  className="h-7 w-7 flex items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:bg-slate-50 disabled:opacity-30 transition"
                  title="Move up"
                >
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                </button>
                <button
                  type="button"
                  onClick={() => moveSection(i, 1)}
                  disabled={i === draft.sections.length - 1}
                  className="h-7 w-7 flex items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:bg-slate-50 disabled:opacity-30 transition"
                  title="Move down"
                >
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </button>
                <button
                  type="button"
                  onClick={() => removeSection(i)}
                  className="h-7 w-7 flex items-center justify-center rounded-lg border border-red-100 text-red-400 hover:bg-red-50 transition ml-1"
                  title="Remove section"
                >
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Section title</label>
                <input
                  value={section.title}
                  onChange={e => updateSection(i, { title: e.target.value })}
                  className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1EA7FF]/30"
                  placeholder="e.g. 1. Vehicle Accuracy Guarantee"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Body text</label>
                <textarea
                  value={section.body}
                  onChange={e => updateSection(i, { body: e.target.value })}
                  rows={4}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1EA7FF]/30 resize-y"
                  placeholder="Describe this guarantee clause…"
                />
              </div>
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={addSection}
          className="w-full h-11 rounded-2xl border-2 border-dashed border-slate-200 text-sm text-slate-400 hover:border-[#1EA7FF] hover:text-[#1EA7FF] transition-colors flex items-center justify-center gap-2"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Add section
        </button>
      </div>

      {/* Footer note */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Footer / legal note</label>
        <textarea
          value={draft.footer}
          onChange={e => { setDraft(d => ({ ...d, footer: e.target.value })); setSaved(false) }}
          rows={3}
          className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1EA7FF]/30 resize-y"
          placeholder="Small print shown at the bottom of the guarantee…"
        />
      </div>

      {/* Save bar */}
      <div className="flex justify-end pb-8">
        <button
          type="button"
          onClick={handleSave}
          className={`h-10 px-6 rounded-full text-sm font-semibold transition-colors ${saved ? 'bg-green-600 text-white' : 'bg-[#0B1F3A] text-white hover:bg-[#1EA7FF]'}`}
        >
          {saved ? '✓ Saved' : 'Save changes'}
        </button>
      </div>
    </div>
  )
}
