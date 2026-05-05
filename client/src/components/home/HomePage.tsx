'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Gauge, Settings2, Fuel } from 'lucide-react'

interface Vehicle {
  id: string
  make: string
  model: string
  year: number
  price: number
  odometer?: number
  fuelType?: string | null
  transmission?: string | null
  imageUrl?: string
  category?: string | null
  status?: string
}

function formatPrice(p: number) {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(p)
}

const categoryChip: Record<string, string> = {
  premier: 'bg-[#118df0] text-white',
  dealership: 'bg-indigo-500 text-white',
  fleet: 'bg-slate-600 text-white',
  private: 'bg-amber-500 text-white',
}
const categoryLabel: Record<string, string> = {
  premier: 'EDC Premier',
  dealership: 'Dealer Select',
  fleet: 'Fleet Select',
  private: 'Private Seller',
}

export default function HomePage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  useEffect(() => {
    const loadVehicles = async () => {
      const { data, error } = await supabase
        .from('edc_vehicles')
        .select('id, make, model, year, price, odometer, fuel_type, transmission, categories, status')
        .order('created_at', { ascending: false })
        .limit(8)

      if (error || !data) return

      const withImages = await Promise.all(
        data.map(async (v: any) => {
          const id = String(v.id || '').trim()
          let imageUrl = ''
          try {
            const { data: files } = await supabase.storage
              .from('vehicle-photos')
              .list(id, { limit: 1, sortBy: { column: 'name', order: 'asc' } })
            if (files && files.length > 0 && files[0].name) {
              const pub = supabase.storage.from('vehicle-photos').getPublicUrl(`${id}/${files[0].name}`)
              imageUrl = pub?.data?.publicUrl || ''
            }
          } catch { /* no image */ }
          return {
            id,
            make: v.make,
            model: v.model,
            year: v.year,
            price: Number(v.price || 0),
            odometer: Number(v.odometer || 0),
            fuelType: v.fuel_type || null,
            transmission: v.transmission || null,
            category: v.categories || null,
            status: v.status,
            imageUrl,
          }
        })
      )
      setVehicles(withImages)
    }
    loadVehicles()
  }, [])

  return (
    <div className="flex flex-col bg-white">

      {/* ── HERO ─────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-[#1a2f4a] text-white">
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: 'url(https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=2000&q=80)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#1a2f4a]/70 via-[#1a2f4a]/85 to-[#1a2f4a]" />
        <div className="relative mx-auto grid max-w-7xl gap-10 px-4 pt-8 pb-3 sm:px-6 md:pt-28 md:pb-16 lg:grid-cols-2 lg:px-8">
          <div className="space-y-5 text-center md:text-left">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium">
              <svg className="h-3.5 w-3.5 text-[#118df0]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3l14 9-14 9V3z" />
              </svg>
              Canada&apos;s stress-free way to drive
            </span>
            <h1 className="text-2xl font-bold leading-tight tracking-tight text-white sm:text-4xl md:text-6xl md:leading-[1.05]">
              Drive home a car you&apos;ll{' '}
              <span className="text-[#118df0]">love</span>,<br />
              without the dealer drama.
            </h1>
            <p className="text-sm text-white/80 md:max-w-xl md:text-lg">
              Get pre-approved in minutes. Browse hand-picked, certified vehicles.
              Drive away the same day — all backed by The EasyDrive Promise.
            </p>
            {/* Mobile: stacked full-width buttons. Desktop: side-by-side */}
            <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:gap-3">
              <Link
                href="/financing"
                className="flex items-center justify-center gap-1.5 rounded-full bg-[#118df0] px-6 py-3 text-sm font-semibold text-white hover:bg-[#0a7dd4] transition-colors"
              >
                Get Pre-Approved
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
              <Link
                href="/inventory"
                className="flex items-center justify-center rounded-full border border-white/30 bg-transparent px-6 py-3 text-sm font-semibold text-white hover:bg-white/10 transition-colors"
              >
                Browse Inventory
              </Link>
            </div>
            <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 pt-1 text-xs text-white/70 md:justify-start md:gap-x-6 md:text-sm">
              {['No impact on credit', '5-min application', 'All credit accepted'].map((t) => (
                <span key={t} className="inline-flex items-center gap-1.5">
                  <svg className="h-3.5 w-3.5 text-[#118df0] md:h-4 md:w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {t}
                </span>
              ))}
            </div>
          </div>
          <div className="hidden items-center justify-center lg:flex">
            <div className="relative aspect-[4/3] w-full max-w-lg overflow-hidden rounded-3xl border border-white/10 shadow-2xl">
              <img
                src="https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?auto=format&fit=crop&w=1200&q=80"
                alt="Featured vehicle"
                className="h-full w-full object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── TRUST BADGES (bridge card — centered on hero/content boundary) ──── */}
      <div className="relative">
        {/* Top half: hero dark; bottom half: white — card sits perfectly centered */}
        <div className="absolute inset-x-0 top-0 h-1/2 bg-[#1a2f4a]" />
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-white" />
        <div className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8 lg:py-12">
          <div className="rounded-2xl border border-gray-100 bg-white shadow-xl">
            <div className="grid grid-cols-2 gap-x-3 gap-y-4 px-5 py-5 md:grid-cols-4 md:gap-8 md:px-8 md:py-7">
              {[
                { label: 'CARFAX Verified', sub: 'Every vehicle', icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' },
                { label: 'Free Delivery', sub: 'Across Ontario', icon: 'M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4' },
                { label: 'Secure Financing', sub: 'Bank-grade rates', icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z' },
                { label: '5-Star Rated', sub: '1,200+ reviews', icon: 'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z' },
              ].map((t) => (
                <div key={t.label} className="flex items-center gap-3 md:gap-4">
                  <div className="flex h-9 w-9 md:h-14 md:w-14 shrink-0 items-center justify-center rounded-xl bg-[#118df0]/10 text-[#118df0]">
                    <svg className="h-4 w-4 md:h-7 md:w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={t.icon} />
                    </svg>
                  </div>
                  <div>
                    <div className="text-xs font-semibold leading-tight text-gray-900 md:text-base">{t.label}</div>
                    <div className="text-[10px] text-gray-500 md:text-sm">{t.sub}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── LISTING TYPES ────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 pt-6 pb-8 sm:pb-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-block rounded-full bg-[#118df0]/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-[#118df0]">Trust &amp; Transparency</span>
          <h2 className="mt-3 text-2xl font-bold tracking-tight text-gray-900 md:text-4xl">Every listing is labeled.</h2>
          <p className="mt-3 text-gray-500">
            You always know who you&apos;re buying from — a verified Private Seller,
            an EDC-vetted dealer, or a fleet operator.
          </p>
        </div>
        <div className="mt-10 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 lg:gap-5">
          {[
            { label: 'EDC Premier', chip: 'bg-[#118df0] text-white', glow: '[box-shadow:0_8px_24px_rgba(17,141,240,0.22)]', desc: 'Top-tier dealers. Documentation & dealer admin fees waived at checkout.' },
            { label: 'Dealer Select', chip: 'bg-indigo-500 text-white', glow: '[box-shadow:0_8px_24px_rgba(99,102,241,0.22)]', desc: 'EDC-vetted independent dealers across Ontario. Standard dealer fees apply.' },
            { label: 'Fleet Select', chip: 'bg-slate-600 text-white', glow: '[box-shadow:0_8px_24px_rgba(71,85,105,0.18)]', desc: 'Off-lease, rental & corporate fleet vehicles with detailed service history.' },
            { label: 'Private Seller', chip: 'bg-amber-500 text-white', glow: '[box-shadow:0_8px_24px_rgba(245,158,11,0.22)]', desc: 'One vehicle per seller. ID, ownership, insurance & CARFAX verified before listing.' },
          ].map((t) => (
            <div key={t.label} className={`rounded-2xl border border-gray-100 bg-white p-3 sm:p-5 ${t.glow}`}>
              <span className={`rounded-full px-2.5 py-1 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider ${t.chip}`}>{t.label}</span>
              <p className="mt-2.5 text-[11px] leading-relaxed text-gray-700 sm:mt-3 sm:text-sm">{t.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── FEATURED VEHICLES ────────────────────────────────── */}
      <section className="bg-white pt-8 pb-16 sm:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-6 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold tracking-tight text-gray-900 sm:text-2xl md:text-3xl">Featured Vehicles</h2>
              <p className="mt-0.5 text-xs text-gray-500 sm:mt-1.5 sm:text-sm">Hand-picked, certified, ready to drive.</p>
            </div>
            <Link href="/inventory" className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-[#118df0]/10 px-3 py-1.5 text-xs font-bold text-[#118df0] transition hover:bg-[#118df0]/20">
              View all
              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </Link>
          </div>

          {vehicles.length > 0 ? (
            <>
              {/* ── DESKTOP: 4-col tier-colored border cards ── */}
              <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {vehicles.map((v) => {
                  const cat = (v.category || '').toLowerCase()
                  const borderClass = cat === 'premier' ? 'border-[#118df0]/40 [box-shadow:0_6px_20px_rgba(17,141,240,0.14)]'
                    : cat === 'dealership' ? 'border-indigo-400/40 [box-shadow:0_6px_20px_rgba(99,102,241,0.14)]'
                    : cat === 'fleet' ? 'border-slate-400/35 [box-shadow:0_6px_20px_rgba(71,85,105,0.12)]'
                    : cat === 'private' ? 'border-amber-400/40 [box-shadow:0_6px_20px_rgba(245,158,11,0.12)]'
                    : 'border-gray-200 shadow-md'
                  return (
                    <Link key={v.id} href={`/inventory/${v.id}`} className={`group overflow-hidden rounded-2xl border-[1.5px] bg-white transition hover:scale-[1.01] ${borderClass}`}>
                      <div className="relative aspect-[4/3] overflow-hidden bg-gray-100">
                        {v.imageUrl ? (
                          <img src={v.imageUrl} alt={`${v.year} ${v.make} ${v.model}`} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                        ) : (
                          <div className="flex h-full items-center justify-center">
                            <svg className="h-12 w-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </div>
                        )}
                        {cat && categoryLabel[cat] && (
                          <span className={`absolute left-2.5 top-2.5 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider shadow ${categoryChip[cat] || 'bg-gray-700 text-white'}`}>
                            {categoryLabel[cat]}
                          </span>
                        )}
                      </div>
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-sm font-semibold leading-tight text-gray-900">{v.year} {v.make} {v.model}</h3>
                          <span className="shrink-0 text-sm font-bold text-[#118df0]">{formatPrice(v.price)}</span>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-gray-400">
                          <span className="inline-flex items-center gap-1"><Gauge className="h-3 w-3" /> {(v.odometer ?? 0).toLocaleString('en-CA')} km</span>
                          {v.transmission && <span className="inline-flex items-center gap-1"><Settings2 className="h-3 w-3" /> {v.transmission}</span>}
                          {v.fuelType && <span className="inline-flex items-center gap-1"><Fuel className="h-3 w-3" /> {v.fuelType}</span>}
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>

              {/* ── MOBILE: 2-col grid cards ── */}
              <div className="grid grid-cols-2 gap-3 sm:hidden">
                {vehicles.slice(0, 6).map((v) => {
                  const cat = (v.category || '').toLowerCase()
                  const borderClass = cat === 'premier' ? 'border-[#118df0]/40 [box-shadow:0_4px_12px_rgba(17,141,240,0.12)]'
                    : cat === 'dealership' ? 'border-indigo-400/40 [box-shadow:0_4px_12px_rgba(99,102,241,0.12)]'
                    : cat === 'fleet' ? 'border-slate-400/35 [box-shadow:0_4px_12px_rgba(71,85,105,0.1)]'
                    : cat === 'private' ? 'border-amber-400/40 [box-shadow:0_4px_12px_rgba(245,158,11,0.1)]'
                    : 'border-gray-200 shadow-sm'
                  return (
                    <Link key={v.id} href={`/inventory/${v.id}`} className={`group overflow-hidden rounded-xl border-[1.5px] bg-white ${borderClass}`}>
                      <div className="relative aspect-[4/3] overflow-hidden bg-gray-100">
                        {v.imageUrl ? (
                          <img src={v.imageUrl} alt={`${v.year} ${v.make} ${v.model}`} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                        ) : (
                          <div className="flex h-full items-center justify-center">
                            <svg className="h-8 w-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </div>
                        )}
                        {cat && categoryLabel[cat] && (
                          <span className={`absolute left-1.5 top-1.5 rounded-full px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider shadow ${categoryChip[cat] || 'bg-gray-700 text-white'}`}>
                            {categoryLabel[cat]}
                          </span>
                        )}
                      </div>
                      <div className="p-2.5">
                        <h3 className="text-xs font-semibold leading-tight text-gray-900 line-clamp-2">{v.year} {v.make} {v.model}</h3>
                        <div className="mt-1 text-[10px] text-gray-400">{(v.odometer ?? 0).toLocaleString('en-CA')} km</div>
                        <div className="mt-1 text-xs font-bold text-[#118df0]">{formatPrice(v.price)}</div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </>
          ) : (
            <>
              <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="rounded-2xl border border-gray-100 bg-gray-100 aspect-[4/3] animate-pulse" />
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3 sm:hidden">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="overflow-hidden rounded-xl border border-gray-100 bg-gray-100 aspect-[4/3] animate-pulse" />
                ))}
              </div>

            </>
          )}
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────────── */}
      <section style={{ background: 'linear-gradient(135deg, #e8f4fe 0%, #f0f7ff 60%, #eef4fc 100%)', borderTop: '2px solid rgba(17,141,240,0.45)', borderBottom: '2px solid rgba(17,141,240,0.45)' }} className="py-10 sm:py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <span className="inline-block rounded-full bg-[#118df0]/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-[#118df0]">Simple Process</span>
            <h2 className="mt-3 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl md:text-4xl">How it works</h2>
            <p className="mt-2 text-sm text-gray-500">Four simple steps from pre-approval to keys in hand.</p>
          </div>

          {/* DESKTOP: 4-col grid */}
          <div className="mt-10 hidden gap-5 sm:grid sm:grid-cols-2 lg:grid-cols-4">
            {[
              { n: '01', title: 'Apply', text: '5-minute online form. No credit impact.', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
              { n: '02', title: 'Get Approved', text: 'Personalized rate within hours.', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
              { n: '03', title: 'Choose Your Car', text: 'Browse certified inventory that fits your budget.', icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' },
              { n: '04', title: 'Drive Home', text: 'Free delivery anywhere in Ontario.', icon: 'M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z' },
            ].map((s) => (
              <div key={s.n} className="relative overflow-hidden rounded-2xl border border-[#118df0]/15 bg-white p-6 [box-shadow:0_4px_20px_rgba(17,141,240,0.10)]">
                <div className="pointer-events-none absolute right-4 top-3 select-none text-[52px] font-black leading-none text-[#118df0] opacity-[0.12]">{s.n}</div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#118df0] text-white">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={s.icon} />
                  </svg>
                </div>
                <h3 className="mt-4 text-base font-bold text-gray-900">{s.title}</h3>
                <p className="mt-1 text-xs text-gray-500 leading-relaxed">{s.text}</p>
              </div>
            ))}
          </div>

          {/* MOBILE: stacked list */}
          <div className="mt-8 flex flex-col gap-3 sm:hidden">
            {[
              { n: '01', title: 'Apply', text: '5-minute form. No credit impact.', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
              { n: '02', title: 'Get Approved', text: 'Personalized rate within hours.', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
              { n: '03', title: 'Choose Your Car', text: 'Certified inventory for your budget.', icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' },
              { n: '04', title: 'Drive Home', text: 'Free delivery anywhere in Ontario.', icon: 'M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z' },
            ].map((s) => (
              <div key={s.n} className="relative flex items-center gap-4 overflow-hidden rounded-xl border border-[#118df0]/15 bg-white px-4 py-4 [box-shadow:0_3px_12px_rgba(17,141,240,0.09)]">
                <div className="pointer-events-none absolute right-3 top-1 select-none text-[38px] font-black leading-none text-[#118df0] opacity-[0.10]">{s.n}</div>
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-[#118df0] text-white">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={s.icon} />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">{s.title}</h3>
                  <p className="text-xs text-gray-500">{s.text}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 text-center">
            <Link href="/financing" className="inline-flex items-center gap-2 rounded-full bg-[#118df0] px-6 py-2.5 text-sm font-bold text-white transition hover:bg-[#0d7fd4]">
              Get Pre-Approved — It&apos;s Free
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </Link>
          </div>
        </div>

      </section>

      {/* ── EASYDRIVE PROMISE ─────────────────────────────────── */}
      <section className="bg-white py-10 sm:py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <span className="inline-block rounded-full bg-[#118df0]/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-[#118df0]">The EasyDrive Promise</span>
              <h2 className="mt-3 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl md:text-4xl">
                Save thousands. Skip the showroom.
              </h2>
              <p className="mt-3 text-sm text-gray-500 sm:mt-4 sm:text-base">
                We cut the dealer markup, the pressure, and the paperwork.
                On average, our customers save{' '}
                <span className="font-semibold text-gray-900">$3,200</span>{' '}
                compared to traditional dealerships.
              </p>
              {/* Mobile: 2-col grid with short labels */}
              <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2.5 text-xs sm:hidden">
                {[
                  'No-haggle pricing',
                  '150-point inspection',
                  '7-day money-back',
                  '30-day warranty',
                ].map((p) => (
                  <li key={p} className="flex items-start gap-1.5">
                    <svg className="mt-0.5 h-4 w-4 shrink-0 text-[#118df0]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-gray-700">{p}</span>
                  </li>
                ))}
              </ul>
              {/* Desktop: stacked list with full labels */}
              <ul className="mt-6 hidden space-y-3 text-sm sm:block">
                {[
                  'Transparent, no-haggle pricing',
                  '150-point certified inspection',
                  '7-day money-back guarantee',
                  '30-day powertrain warranty included',
                ].map((p) => (
                  <li key={p} className="flex items-start gap-2">
                    <svg className="mt-0.5 h-5 w-5 shrink-0 text-[#118df0]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-gray-700">{p}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-[#118df0]/18 bg-white p-4 sm:rounded-3xl sm:p-8 [box-shadow:0_8px_32px_rgba(17,141,240,0.13),0_0_0_1px_rgba(17,141,240,0.06)]">
              <div className="flex items-center gap-2 sm:gap-3">
                <svg className="h-5 w-5 text-[#118df0] sm:h-6 sm:w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                </svg>
                <h3 className="text-sm font-semibold text-gray-900 sm:text-lg">Average savings</h3>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:mt-4 sm:gap-4">
                <div className="rounded-xl bg-gray-50 p-3 text-center sm:rounded-2xl sm:p-5">
                  <div className="text-[10px] text-gray-400 sm:text-xs">Traditional dealer</div>
                  <div className="mt-0.5 text-lg font-bold text-gray-400 line-through sm:mt-1 sm:text-2xl">$32,500</div>
                </div>
                <div className="rounded-xl bg-[#118df0]/10 p-3 text-center text-[#118df0] sm:rounded-2xl sm:p-5">
                  <div className="text-[10px] sm:text-xs">EasyDrive</div>
                  <div className="mt-0.5 text-lg font-bold sm:mt-1 sm:text-2xl">$29,300</div>
                </div>
              </div>
              <div className="mt-3 rounded-xl bg-gradient-to-r from-[#118df0] to-[#0d6fc7] py-2.5 text-center text-xs font-bold text-white sm:mt-4 sm:rounded-xl sm:py-3 sm:text-sm">
                You save $3,200 on average
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ───────────────────────────────────────────────── */}
      <section className="bg-white pb-10 pt-6 sm:pb-14 sm:pt-8">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="mb-6 text-center sm:mb-8">
            <span className="inline-block rounded-full bg-[#118df0]/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-[#118df0]">FAQs</span>
            <h2 className="mt-3 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl md:text-4xl">
              Frequently asked questions
            </h2>
          </div>
          <div className="divide-y divide-gray-100 rounded-2xl border border-gray-200 bg-white shadow-sm">
            {[
              { q: 'Will applying hurt my credit?', a: 'No. Our pre-approval is a soft credit check and won\'t affect your score.' },
              { q: 'What if I have bad credit?', a: 'We work with all credit profiles, including new credit, bankruptcy, and consumer proposals.' },
              { q: 'Do you deliver?', a: 'Yes — free delivery anywhere in Ontario. Outside ON, fees may apply.' },
              { q: 'Are vehicles inspected?', a: 'Every vehicle passes a 150-point inspection and comes with a CARFAX report.' },
              { q: 'Can I return the car?', a: 'Yes — we offer a 7-day, no-questions-asked money-back guarantee.' },
            ].map((item, i) => (
              <div key={i}>
                <button
                  className={`flex w-full items-center justify-between gap-4 px-5 py-4 text-left sm:px-6 sm:py-5 ${openFaq === i ? 'bg-gray-50' : ''}`}
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                >
                  <span className={`text-sm font-semibold sm:text-base ${openFaq === i ? 'text-[#118df0]' : 'text-gray-900'}`}>{item.q}</span>
                  <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full sm:h-6 sm:w-6 ${openFaq === i ? 'bg-[#118df0]' : 'bg-gray-200'}`}>
                    {openFaq === i ? (
                      <svg className="h-2.5 w-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20 12H4" />
                      </svg>
                    ) : (
                      <svg className="h-2.5 w-2.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                      </svg>
                    )}
                  </span>
                </button>
                {openFaq === i && (
                  <p className="px-5 pb-4 text-sm leading-relaxed text-gray-500 sm:px-6 sm:pb-5">{item.a}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ─────────────────────────────────────────── */}
      <section className="bg-white px-4 pb-10 sm:px-6 sm:pb-14 lg:px-8">
        <div className="mx-auto max-w-5xl rounded-3xl bg-[#0f1e2e] px-8 py-8 text-center sm:px-16 sm:py-10 [border:1px_solid_rgba(17,141,240,0.35)] [box-shadow:0_0_0_1px_rgba(17,141,240,0.10),0_8px_40px_rgba(17,141,240,0.18),inset_0_1px_0_rgba(17,141,240,0.20)]">
          <span className="inline-block rounded-full bg-[#118df0]/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-[#5cb8ff]">Get Started Today</span>
          <h2 className="mx-auto mt-3 max-w-xl text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
            Ready to drive? Get pre-approved in 5 minutes.
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-[#94a3b8]">
            No impact on your credit score. No obligation.
          </p>
          <div className="mt-5">
            <Link
              href="/financing"
              className="inline-flex items-center gap-1.5 rounded-full bg-[#118df0] px-8 py-3 text-sm font-semibold text-white shadow-[0_4px_20px_rgba(17,141,240,0.40)] transition-colors hover:bg-[#0a7dd4]"
            >
              Start your application
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

    </div>
  )
}
