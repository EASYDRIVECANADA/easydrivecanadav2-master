'use client'

import { useMemo, useState } from 'react'
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
  const [tab, setTab] = useState<'warranty' | 'products' | 'defaults'>('warranty')

  const tabs: { key: typeof tab; label: string }[] = [
    { key: 'warranty', label: 'Warranty plans' },
    { key: 'products', label: 'Add-on products' },
    { key: 'defaults', label: 'Defaults' },
  ]

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="px-6 lg:px-8 pt-8 pb-4 border-b border-slate-100">
        <h1 className="text-2xl font-bold text-slate-900">Configuration</h1>
        <p className="text-sm text-slate-400 mt-0.5">Set retail pricing for warranty plans and dealer-managed add-on products.</p>
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
            <div className="font-semibold text-slate-900">Dealer Pricing Configuration</div>
            <div className="text-sm text-slate-500 mt-0.5">
              Mark up dealer cost to your retail price for every base term and add-on. Customers only see your retail prices — never your costs.
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-full border border-slate-200 bg-white px-4 py-2">
          <span className="text-sm font-medium text-slate-700">Show Retail to Customers</span>
          <Toggle checked={cfg.showRetailToCustomers} onChange={setShowRetailToCustomers} />
        </div>
      </div>

      {/* Tabs */}
      <div className="px-6 lg:px-8 mt-6 flex items-center gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
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
        {tab === 'warranty' && <WarrantyConfigTab />}
        {tab === 'products' && <ProductCatalogTab />}
        {tab === 'defaults' && <DefaultsTab />}
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
      <PlanEditor plan={plan} onBack={() => setPlanSlug(null)} />
    </div>
  )
}

function PlansList({ provider, onPick }: { provider: string; onPick: (slug: string) => void }) {
  const plans = getAllPlansByProvider(provider)
  const cfg = useDealerConfig()
  const [q, setQ] = useState('')
  const filtered = useMemo(
    () => plans.filter((p) => p.name.toLowerCase().includes(q.toLowerCase())),
    [plans, q],
  )

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
        {filtered.map((p) => {
          const enabled = isPlanEnabled(cfg, p.slug)
          return (
            <div key={p.slug} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4">
              <button type="button" onClick={() => onPick(p.slug)} className="flex flex-1 items-start gap-3 text-left">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-[#1EA7FF]">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-slate-900">{p.name}</div>
                  <div className="text-xs text-slate-400">Vehicle Service Contract</div>
                  {p.pricingTiers.length > 0 && (
                    <span className="mt-1 inline-block text-[10px] font-semibold bg-slate-100 text-slate-500 px-2 py-0.5 rounded">
                      {p.pricingTiers.length} tier{p.pricingTiers.length === 1 ? '' : 's'}
                    </span>
                  )}
                </div>
                <svg className="mt-2 h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
              <div className="ml-3 flex items-center gap-2">
                <Toggle checked={enabled} onChange={(c) => setPlanEnabled(p.slug, c)} />
                {p.slug.startsWith('custom-') && (
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`Delete custom plan "${p.name}"?`)) {
                        deleteCustomPlan(p.slug)
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

function PlanEditor({ plan, onBack }: { plan: WarrantyPlan; onBack: () => void }) {
  const cfg = useDealerConfig()
  const [tierIndex, setTierIndex] = useState(0)
  const [bulkMarkup, setBulkMarkup] = useState<number>(cfg.warrantyMarkupPct)

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
            <div className="text-sm text-slate-400">Vehicle Service Contract • {plan.provider}</div>
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
              {tier.rows.map((row) => {
                const isBase = row.label === 'Base Price'
                const isPremium = row.label === 'Premium Vehicle Fee'
                return (
                  <tr key={row.label} className="border-b border-slate-100 last:border-b-0">
                    <td className="px-3 py-4">
                      {isBase && (
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

  if (typeof rawValue !== 'number') {
    return (
      <div className="text-xs text-slate-400">
        {rawValue === 'Included' ? (
          <span className="rounded-full bg-green-50 text-green-700 px-2 py-0.5 font-medium">Included</span>
        ) : (
          <span>—</span>
        )}
      </div>
    )
  }

  const costOverride = cfg.warranty[plan.slug]?.tiers?.[tierIndex]?.rows?.[rowLabel]?.[termIndex]?.cost
  const cost = costOverride ?? getCost(plan, tierIndex, termIndex, rowLabel) ?? rawValue
  const retailOverride = cfg.warranty[plan.slug]?.tiers?.[tierIndex]?.rows?.[rowLabel]?.[termIndex]?.retail
  const retail = retailOverride ?? Math.round(cost * (1 + markupPct / 100))
  const markupDelta = cost > 0 ? Math.round(((retail - cost) / cost) * 100) : 0

  function commitEdit(field: 'cost' | 'retail') {
    const n = Number(draft)
    if (!isNaN(n) && n > 0) {
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
  const [draft, setDraft] = useState<DealerProductConfig>(
    product ?? {
      id: `custom-${Date.now()}`,
      group: 'ceramic',
      label: '',
      description: '',
      price: 0,
      cost: 0,
      taxable: true,
      customerVisible: true,
      dealerVisible: true,
    },
  )

  const save = () => {
    if (!draft.label.trim()) { alert('Label is required'); return }
    upsertProduct(draft)
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
