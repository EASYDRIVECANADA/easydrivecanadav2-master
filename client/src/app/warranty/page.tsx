'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Shield, ArrowRight, CheckCircle2, Info, Download, X } from 'lucide-react';
import {
  warrantyPlans,
  getGroupedPlans,
  PLAN_COLUMNS,
  coverageMatrix,
  WAITING_PERIOD,
  COVERAGE_TERRITORY,
  GENERAL_TERMS,
  GENERAL_EXCLUSIONS,
  type WarrantyPlan,
  type CoverageStatus,
} from '@/lib/bridgewarranty';

const BRAND = '#1aa6ff';
const BRAND_BG = '#1aa6ff1a';

// ── Page ─────────────────────────────────────────────────────────
export default function WarrantyPage() {
  return (
    <main>
      <Hero />
      <PlanGrid />
      <CoverageMatrix />
      <TermsBlock />
    </main>
  );
}

// ── Hero ─────────────────────────────────────────────────────────
function Hero() {
  return (
    <section style={{ backgroundColor: '#0d182b' }} className="text-white">
      <div className="mx-auto max-w-7xl px-5 py-10 sm:px-6 sm:py-20 lg:px-8">
        {/* Badge */}
        <div
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-wider mb-4 sm:px-4 sm:py-1.5 sm:text-xs sm:mb-6"
          style={{ backgroundColor: BRAND_BG, color: BRAND, border: `1px solid ${BRAND}40` }}
        >
          <Shield className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
          BridgeWarranty · A-Protect V25
        </div>

        {/* Heading */}
        <h1 className="text-3xl font-bold tracking-tight text-white leading-tight sm:text-5xl">
          Extended warranty,{' '}
          <span style={{ color: BRAND }}>on your terms.</span>
        </h1>

        {/* Subtext — shortened on mobile */}
        <p className="mt-3 text-sm text-slate-400 leading-relaxed sm:mt-4 sm:max-w-2xl sm:text-lg sm:text-slate-300">
          <span className="sm:hidden">Every A-Protect plan, every price. No phone calls, no pressure.</span>
          <span className="hidden sm:inline">
            Browse the full A-Protect Vehicle Service Contract brochure: every plan, every term,
            every price. Get an instant quote for your car and add coverage at checkout — no
            phone calls, no pressure.
          </span>
        </p>

        {/* Buttons — stacked on mobile, inline on desktop */}
        <div className="mt-6 flex flex-col gap-2 sm:mt-8 sm:flex-row sm:flex-wrap sm:gap-3">
          <a
            href="#plans"
            className="inline-flex items-center justify-center gap-2 rounded-full py-3 px-6 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: BRAND }}
          >
            Browse all plans <ArrowRight className="h-4 w-4" />
          </a>
          <a
            href="#matrix"
            className="inline-flex items-center justify-center gap-2 rounded-full border border-white/20 py-3 px-6 text-sm font-semibold text-slate-300 transition-colors hover:bg-white/10"
          >
            <Download className="h-4 w-4" /> Coverage matrix
          </a>
        </div>
      </div>
    </section>
  );
}


// ── Plan grid (actual) ───────────────────────────────────────────
function PlanGrid() {
  const grouped = getGroupedPlans('A-Protect');
  const [openSlug, setOpenSlug] = useState<string | null>(null);
  const open = openSlug ? warrantyPlans.find((p) => p.slug === openSlug) : null;

  return (
    <section id="plans" className="border-b border-slate-200">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">Every A-Protect plan</h2>
        <p className="mt-2 max-w-2xl text-sm text-slate-500">
          Six product families covering everything from powertrain-only protection to comprehensive
          luxury coverage.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {grouped.map((p) => (
            <div key={p.slug} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-semibold text-slate-900">{p.group ? 'Powertrain' : p.name}</div>
                  <div className="text-xs text-slate-500">{p.claimRange}</div>
                </div>
                {p.salesTag && (
                  <span
                    className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
                    style={{ backgroundColor: BRAND_BG, color: BRAND }}
                  >
                    {p.salesTag.label}
                  </span>
                )}
              </div>
              <ul className="mt-3 flex-1 space-y-1.5 text-xs text-slate-500">
                {p.highlights.slice(0, 4).map((h) => (
                  <li key={h} className="flex items-start gap-1.5">
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                    {h}
                  </li>
                ))}
              </ul>
              <div className="mt-3 text-[10px] uppercase tracking-wider text-slate-400">
                {p.eligibility} · Deductible {p.deductible}
              </div>
              <button
                type="button"
                onClick={() => setOpenSlug(p.slug)}
                className="mt-4 w-full rounded-full border border-slate-300 py-2 text-xs font-medium text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-50"
              >
                View full coverage
              </button>
            </div>
          ))}
        </div>
      </div>
      {open && <PlanDetailModal plan={open} onClose={() => setOpenSlug(null)} />}
    </section>
  );
}

function PlanDetailModal({ plan, onClose }: { plan: WarrantyPlan; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">A-Protect plan</div>
            <h3 className="text-2xl font-bold text-slate-900">{plan.name}</h3>
            <p className="text-sm text-slate-500">{plan.eligibility}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          {[
            { label: 'Per-claim', value: plan.claimRange },
            { label: 'Deductible', value: plan.deductible },
            { label: 'Premium fees', value: plan.premiumFees ? 'May apply' : 'None' },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="text-[10px] uppercase tracking-wider text-slate-400">{s.label}</div>
              <div className="text-sm font-semibold text-slate-900">{s.value}</div>
            </div>
          ))}
        </div>

        <div className="mt-5">
          <h4 className="text-sm font-semibold text-slate-900">{"What's covered"}</h4>
          <div className="mt-2 space-y-2">
            {plan.coverageDetails.map((c) => (
              <div key={c.name} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="text-sm font-medium text-slate-900">{c.name}</div>
                <div className="text-xs text-slate-500">{c.parts}</div>
              </div>
            ))}
          </div>
        </div>

        {plan.benefits.length > 0 && (
          <div className="mt-5">
            <h4 className="text-sm font-semibold text-slate-900">Included benefits</h4>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {plan.benefits.map((b) => (
                <div key={b.name} className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="text-sm font-medium text-slate-900">{b.name}</div>
                  <div className="text-xs text-slate-500">{b.description}</div>
                  <div className="mt-1 text-[10px] uppercase tracking-wider font-semibold" style={{ color: BRAND }}>
                    {b.limit}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {plan.importantNotes && plan.importantNotes.length > 0 && (
          <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-slate-600">
            <div className="mb-1 flex items-center gap-1 font-semibold text-amber-600">
              <Info className="h-3.5 w-3.5" /> Important notes
            </div>
            <ul className="list-disc space-y-1 pl-4">
              {plan.importantNotes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Coverage matrix ───────────────────────────────────────────────
function CoverageMatrix() {
  const symbol = (s: CoverageStatus) => {
    if (s === 'included') return <span className="text-emerald-600 font-bold">✓</span>;
    if (s === 'available') return <span className="text-amber-500">●</span>;
    if (s === 'specific') return <span style={{ color: BRAND }}>◉</span>;
    return <span className="text-slate-300">—</span>;
  };

  return (
    <section id="matrix" className="border-b border-slate-200 bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">Coverage comparison</h2>
        <p className="mt-2 max-w-2xl text-sm text-slate-500">
          Side-by-side matrix from the A-Protect V25 brochure.{' '}
          <span className="text-emerald-600 font-semibold">✓</span> Included ·{' '}
          <span className="text-amber-500">●</span> Available add-on ·{' '}
          <span style={{ color: BRAND }}>◉</span> Term-specific
        </p>
        <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="bg-slate-100">
                <th className="sticky left-0 z-10 bg-slate-100 px-4 py-3 text-left text-xs font-semibold text-slate-700">
                  Coverage
                </th>
                {PLAN_COLUMNS.map((c) => (
                  <th key={c.key} className="px-2 py-3 text-center text-xs">
                    <div className="font-semibold text-slate-800">{c.label}</div>
                    <div className="text-[10px] text-slate-400">{c.claimRange}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {coverageMatrix.map((row, i) => (
                <tr key={row.category} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                  <td className="sticky left-0 z-10 bg-inherit px-4 py-2 text-xs font-medium text-slate-700">
                    {row.category}
                  </td>
                  {PLAN_COLUMNS.map((c) => (
                    <td key={c.key} className="px-2 py-2 text-center text-sm">
                      {symbol(row.values[c.key] ?? 'none')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

// ── Terms / fine print ────────────────────────────────────────────
function TermsBlock() {
  return (
    <section className="border-b border-slate-200">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-2">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">The fine print</h2>
            <p className="mt-2 text-sm text-slate-500">
              These terms apply to every A-Protect plan. Read them before adding coverage.
            </p>
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm">
              <div className="mb-1 flex items-center gap-1 font-semibold text-amber-600">
                <Info className="h-4 w-4" /> Waiting period
              </div>
              <p className="text-slate-600 text-xs">{WAITING_PERIOD}</p>
            </div>
            <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-sm">
              <div className="mb-1 font-semibold text-slate-900">Coverage territory</div>
              <p className="text-xs text-slate-500">{COVERAGE_TERRITORY}</p>
            </div>
          </div>
          <div className="space-y-3">
            {GENERAL_TERMS.map((g) => (
              <details key={g.heading} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <summary className="cursor-pointer text-sm font-semibold text-slate-900">{g.heading}</summary>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-slate-500">
                  {g.items.map((it) => (
                    <li key={it}>{it}</li>
                  ))}
                </ul>
              </details>
            ))}
            <details className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <summary className="cursor-pointer text-sm font-semibold text-slate-900">General exclusions</summary>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-slate-500">
                {GENERAL_EXCLUSIONS.map((it) => (
                  <li key={it}>{it}</li>
                ))}
              </ul>
            </details>
          </div>
        </div>

        {/* CTA */}
        <div
          className="mt-12 flex flex-col items-center gap-3 rounded-3xl border p-8 text-center"
          style={{ borderColor: `${BRAND}40`, background: `linear-gradient(135deg, ${BRAND}0d 0%, white 100%)` }}
        >
          <h3 className="text-xl font-bold text-slate-900">Ready to add coverage to your purchase?</h3>
          <p className="max-w-xl text-sm text-slate-500">
            Pick a vehicle from inventory — your selected A-Protect plan will be waiting at the
            warranty step of checkout.
          </p>
          <Link
            href="/inventory"
            className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: BRAND }}
          >
            Browse inventory <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}