'use client'

import { useMemo, useState } from 'react'

export default function SettingsBillingPage() {
  return (
    <BillingPage />
  )
}

type BillingSection = 'Products & Services' | 'Transactions' | 'Payment Methods'

function BillingPage() {
  const [section, setSection] = useState<BillingSection>('Products & Services')

  const stripePaymentLink = String(process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK || '').trim()

  const [buying, setBuying] = useState<string>('')

  const products = useMemo(
    () => [
      { key: 'small', planName: 'Small Dealer Package', amount: '$99.00' },
      { key: 'full', planName: 'Full Dealer Package', amount: '$199.00' },
    ],
    []
  )

  const startCheckout = async (plan: string) => {
    if (buying) return
    setBuying(plan)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      })

      const json = await res.json().catch(() => null)
      const url = String(json?.url || '').trim()
      if (!res.ok || !url) {
        const msg = String(json?.error || 'Unable to start Stripe checkout')
        throw new Error(msg)
      }

      window.location.href = url
    } catch (e: any) {
      if (stripePaymentLink) {
        window.location.href = stripePaymentLink
        return
      }
      window.alert(String(e?.message || 'Unable to start Stripe checkout'))
    } finally {
      setBuying('')
    }
  }

  return (
    <div>
      <div className="text-[11px] text-slate-600">Account &amp; Billing</div>
      <div className="mt-2 border-t border-slate-200/60" />

      <div className="mt-3 grid grid-cols-[240px_1fr] gap-10">
        <div>
          <div className="border border-slate-200/60 bg-white">
            {(['Products & Services', 'Transactions', 'Payment Methods'] as BillingSection[]).map((s) => {
              const isActive = s === section
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSection(s)}
                  className={
                    isActive
                      ? 'w-full h-8 px-3 flex items-center text-xs bg-navy-900 text-white'
                      : 'w-full h-8 px-3 flex items-center text-xs text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                  }
                >
                  {s}
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <div className="text-[11px] font-semibold text-slate-600">{section}</div>

          {section === 'Products & Services' ? (
            <div className="mt-3 space-y-4">
              <div className="border border-slate-200/60 bg-white">
                <div className="grid grid-cols-[1.8fr_1fr_1fr] border-b border-slate-200/60">
                  <div className="h-8 flex items-center justify-center text-[11px] font-semibold text-slate-600">
                    PLAN NAME
                  </div>
                  <div className="h-8 flex items-center justify-center text-[11px] font-semibold text-slate-600">
                    AMOUNT
                  </div>
                  <div className="h-8 flex items-center justify-center text-[11px] font-semibold text-slate-600">
                    SUBSCRIPTION
                  </div>
                </div>
                {products.map((p) => (
                  <div key={p.planName} className="grid grid-cols-[1.8fr_1fr_1fr] border-b border-slate-100">
                    <div className="h-10 flex items-center justify-center text-xs text-slate-700">{p.planName}</div>
                    <div className="h-10 flex items-center justify-center text-xs text-slate-700">{p.amount}</div>
                    <div className="h-10 flex items-center justify-center">
                      <button
                        type="button"
                        disabled={!!buying}
                        className={
                          !!buying
                            ? 'edc-btn-primary h-7 px-4 text-[11px] opacity-60 cursor-not-allowed'
                            : 'edc-btn-primary h-7 px-4 text-[11px]'
                        }
                        onClick={() => {
                          startCheckout(String((p as any)?.key || 'small'))
                        }}
                      >
                        {buying === String((p as any)?.key || '') ? 'Loading…' : 'BUY'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-3 text-xs text-slate-400">No data.</div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between pt-8">
        <button type="button" className="h-8 px-3 bg-slate-600 text-white text-xs font-semibold">
          <span className="inline-flex items-center gap-2">
            <span className="text-sm leading-none">×</span>
            Cancel
          </span>
        </button>
        <button type="button" className="edc-btn-primary h-8 px-4 text-xs">
          <span className="inline-flex items-center gap-2">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
              <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M17 21v-8H7v8" />
              <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M7 3v5h8" />
            </svg>
            Save
          </span>
        </button>
      </div>
    </div>
  )
}
