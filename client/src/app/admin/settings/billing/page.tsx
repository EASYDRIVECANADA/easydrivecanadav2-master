
'use client'

import { useEffect, useMemo, useState } from 'react'

export default function SettingsBillingPage() {
  return (
    <BillingPage />
  )
}

type BillingSection = 'Products & Services' | 'Transactions' | 'Payment Methods'

type Transaction = {
  id: string
  date: string
  description: string
  amount: string
  status: 'completed' | 'pending' | 'failed'
  invoice_url?: string
}

type PaymentMethod = {
  id: string
  type: 'card' | 'bank'
  brand?: string
  last4: string
  exp_month?: number
  exp_year?: number
  is_default: boolean
}

type PlanKey = 'starter' | 'small' | 'full'

type PlanStatus = {
  active: boolean
  validUntilIso: string | null
}

function BillingPage() {
  const [section, setSection] = useState<BillingSection>('Products & Services')

  const stripePaymentLink = String(process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK || '').trim()

  const [buying, setBuying] = useState<string>('')
  const [buyingEsign, setBuyingEsign] = useState<string>('')
  const [topUpModalOpen, setTopUpModalOpen] = useState(false)
  const [loadingTransactions, setLoadingTransactions] = useState(false)
  const [loadingPaymentMethods, setLoadingPaymentMethods] = useState(false)

  const [balance, setBalance] = useState<number>(0)

  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])

  const [planStatus, setPlanStatus] = useState<Record<PlanKey, PlanStatus>>({
    starter: { active: false, validUntilIso: null },
    small: { active: false, validUntilIso: null },
    full: { active: false, validUntilIso: null },
  })

  const products = useMemo(
    () => [
      {
        key: 'starter',
        planName: 'Private Seller',
        amount: 'Free',
        period: '',
        description: 'Default account for private sellers — pay only when you post or promote',
        features: [
          '1st tier Free',
          '1 Seller (single-user)',
          'Basic listings & inquiries',
          'Manual posting / pay-per-use publishing',
          '$3 paid per use only',
          'Standard support',
        ],
        purchasable: false,
      },
      {
        key: 'small',
        planName: 'Dealership',
        amount: '$99.00',
        period: '/month',
        description: 'Unlimited inventory for dealership operations with multi-user access',
        features: [
          'Unlimited cars',
          '6 month Free Trial',
          'Up to 5 Users',
          'Advanced inventory management',
          'Lead tracking & customer management',
          'Priority support',
        ],
        popular: true,
        purchasable: true,
      },
    ],
    []
  )

  useEffect(() => {
    if (typeof window === 'undefined') return

    const readEmail = () => {
      try {
        const raw = window.localStorage.getItem('edc_admin_session')
        if (!raw) return ''
        const parsed = JSON.parse(raw) as { email?: string }
        return String(parsed?.email || '').trim().toLowerCase()
      } catch {
        return ''
      }
    }

    const email = readEmail()
    if (!email) return

    const fetchPaymentMethods = async () => {
      setLoadingPaymentMethods(true)
      try {
        const res = await fetch('/api/stripe/payment-methods', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        })
        const json = await res.json().catch(() => null)
        if (res.ok && json?.paymentMethods) {
          setPaymentMethods(json.paymentMethods)
        }
      } catch {
        // ignore
      } finally {
        setLoadingPaymentMethods(false)
      }
    }

    const fetchBalance = async () => {
      try {
        const res = await fetch('/api/users/balance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        })
        const json = await res.json().catch(() => null)
        if (!res.ok) return
        const nextBalance = Number(json?.balance ?? 0)
        setBalance(Number.isFinite(nextBalance) ? nextBalance : 0)
      } catch {
        // ignore
      }
    }

    const fetchSubscriptionStatus = async () => {
      try {
        const res = await fetch('/api/stripe/subscription-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        })
        const json = await res.json().catch(() => null)
        const plans = (json?.plans || {}) as any
        if (!res.ok) return

        const next: Record<PlanKey, PlanStatus> = {
          starter: {
            active: Boolean(plans?.starter?.active),
            validUntilIso: typeof plans?.starter?.validUntilIso === 'string' ? plans.starter.validUntilIso : null,
          },
          small: {
            active: Boolean(plans?.small?.active),
            validUntilIso: typeof plans?.small?.validUntilIso === 'string' ? plans.small.validUntilIso : null,
          },
          full: {
            active: Boolean(plans?.full?.active),
            validUntilIso: typeof plans?.full?.validUntilIso === 'string' ? plans.full.validUntilIso : null,
          },
        }
        setPlanStatus(next)
      } catch {
        // ignore
      }
    }

    const fetchTransactions = async () => {
      setLoadingTransactions(true)
      try {
        const res = await fetch('/api/stripe/invoices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        })
        const json = await res.json().catch(() => null)
        if (res.ok && json?.invoices) {
          setTransactions(json.invoices)
        }
      } catch {
        // ignore
      } finally {
        setLoadingTransactions(false)
      }
    }

    void fetchSubscriptionStatus()
    void fetchTransactions()
    void fetchPaymentMethods()
    void fetchBalance()

    try {
      const params = new URLSearchParams(window.location.search)
      if (params.get('topup_success') === '1') {
        const sessionId = String(params.get('session_id') || '').trim()
        const confirm = async () => {
          if (!sessionId) return
          try {
            await fetch('/api/stripe/topup-confirm', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ session_id: sessionId }),
            })
          } catch {
            // ignore
          }
        }

        setTimeout(() => {
          void confirm().finally(() => {
            void fetchBalance()
          })
        }, 600)

        try {
          params.delete('topup_success')
          params.delete('session_id')
          const next = params.toString()
          const nextUrl = next ? `${window.location.pathname}?${next}` : window.location.pathname
          window.history.replaceState({}, '', nextUrl)
        } catch {
          // ignore
        }
      }

      if (params.get('pm_setup_success') === '1') {
        setTimeout(() => {
          void fetchPaymentMethods()
        }, 800)

        try {
          params.delete('pm_setup_success')
          params.delete('session_id')
          const next = params.toString()
          const nextUrl = next ? `${window.location.pathname}?${next}` : window.location.pathname
          window.history.replaceState({}, '', nextUrl)
        } catch {
          // ignore
        }
      }
    } catch {
      // ignore
    }
  }, [])

  const startSetupPaymentMethod = async () => {
    if (buyingEsign) return
    setBuyingEsign('pm_setup')
    try {
      let email = ''
      try {
        if (typeof window !== 'undefined') {
          const raw = window.localStorage.getItem('edc_admin_session')
          if (raw) {
            const parsed = JSON.parse(raw) as { email?: string }
            email = String(parsed?.email || '').trim().toLowerCase()
          }
        }
      } catch {
        email = ''
      }

      const res = await fetch('/api/stripe/setup-payment-method', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const json = await res.json().catch(() => null)
      const url = String(json?.url || '').trim()
      if (!res.ok || !url) {
        const msg = String(json?.error || 'Unable to start payment method setup')
        throw new Error(msg)
      }

      window.location.href = url
    } catch (e: any) {
      window.alert(String(e?.message || 'Unable to start payment method setup'))
    } finally {
      setBuyingEsign('')
    }
  }

  const fmtMoney = (v: number) => {
    const n = Number(v)
    if (!Number.isFinite(n)) return '$0.00'
    return '$' + n.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  const formatValidUntil = (iso: string | null) => {
    if (!iso) return 'Active'
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return 'Active'
    return `Valid until ${d.toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' })}`
  }

  const startCheckout = async (plan: string) => {
    if (buying) return
    setBuying(plan)
    try {
      let email = ''
      try {
        if (typeof window !== 'undefined') {
          const raw = window.localStorage.getItem('edc_admin_session')
          if (raw) {
            const parsed = JSON.parse(raw) as { email?: string }
            email = String(parsed?.email || '').trim().toLowerCase()
          }
        }
      } catch {
        email = ''
      }

      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, email }),
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

  const startEsignCheckout = async (tier: string) => {
    if (buyingEsign) return
    setBuyingEsign(tier)
    try {
      let email = ''
      try {
        if (typeof window !== 'undefined') {
          const raw = window.localStorage.getItem('edc_admin_session')
          if (raw) {
            const parsed = JSON.parse(raw) as { email?: string }
            email = String(parsed?.email || '').trim().toLowerCase()
          }
        }
      } catch {
        email = ''
      }

      const res = await fetch('/api/stripe/esignature-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier, email }),
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
      setBuyingEsign('')
    }
  }

  const topUpOptions = useMemo(
    () => [
      { label: '10', priceId: 'price_1T6YsuEMrH8YRtBa9x0Rk8Zp' },
      { label: '20', priceId: 'price_1T6YtREMrH8YRtBa133BorNY' },
      { label: '50', priceId: 'price_1T6YtfEMrH8YRtBabBs788gn' },
      { label: '100', priceId: 'price_1T6YtsEMrH8YRtBaNwhyjg6p' },
    ],
    []
  )

  const startTopUpCheckout = async (priceId: string, label: string) => {
    if (buyingEsign) return

    if (!priceId) {
      window.alert('Missing top up price')
      return
    }

    setBuyingEsign(`topup_${label}`)
    try {
      let email = ''
      try {
        if (typeof window !== 'undefined') {
          const raw = window.localStorage.getItem('edc_admin_session')
          if (raw) {
            const parsed = JSON.parse(raw) as { email?: string }
            email = String(parsed?.email || '').trim().toLowerCase()
          }
        }
      } catch {
        email = ''
      }

      const res = await fetch('/api/stripe/topup-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ price_id: priceId, email }),
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
      setBuyingEsign('')
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 relative overflow-hidden">
      {/* Background Image with Overlay */}
      <div className="absolute inset-0 z-0">
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: 'url(/images/BillingBG.png)' }}
        />
        {/* Gradient Overlays for readability */}
        <div className="absolute inset-0 bg-gradient-to-r from-slate-900/95 via-slate-900/85 to-slate-900/95" />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-900/90 via-transparent to-slate-900/95" />
        {/* Subtle pattern overlay */}
        <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '32px 32px' }} />
      </div>

      <div className="flex relative z-10">
        <div className="absolute right-6 top-6 z-[60] hidden md:block">
          <div className="bg-white/10 backdrop-blur-xl rounded-xl shadow-lg border border-white/20 px-5 py-4 w-[320px]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-300">Load Balance</div>
                <div className="text-2xl font-bold text-white mt-1">{fmtMoney(balance)}</div>
                <div className="text-xs text-slate-300 mt-1">Use balance for pay‑per‑use e‑signature requests</div>
              </div>
            </div>

            <div className="mt-4">
              <button
                type="button"
                disabled={!!buyingEsign}
                onClick={() => setTopUpModalOpen(true)}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-600 to-green-500 text-white text-xs font-semibold rounded-lg shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50 transform hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none"
              >
                Top Up
              </button>
            </div>
          </div>
        </div>

        {/* Sidebar Navigation */}
        <div className="w-56 min-h-screen border-r border-white/10 bg-slate-900/60 backdrop-blur-xl">
          <div className="p-4">
            <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 mb-3">Account Billing</div>
            <div className="space-y-1">
              {(['Products & Services', 'Transactions', 'Payment Methods'] as BillingSection[]).map((s) => {
                const isActive = s === section
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSection(s)}
                    className={
                      isActive
                        ? 'w-full px-3 py-2.5 flex items-center text-xs font-medium bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-lg shadow-lg shadow-blue-500/30 transition-all duration-200'
                        : 'w-full px-3 py-2.5 flex items-center text-xs font-medium text-slate-300 hover:bg-white/10 hover:text-white rounded-lg transition-all duration-200 hover:translate-x-1'
                    }
                  >
                    {s}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1">
          {topUpModalOpen && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center">
              <button
                type="button"
                aria-label="Close"
                className="edc-overlay z-[9998]"
                onClick={() => setTopUpModalOpen(false)}
              />
              <div className="edc-modal relative z-[9999] w-[92vw] max-w-md pointer-events-auto">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-4">
                  <h3 className="text-base font-semibold text-slate-900">Top Up Balance</h3>
                  <button
                    type="button"
                    className="p-2 rounded-lg hover:bg-slate-100"
                    onClick={() => setTopUpModalOpen(false)}
                    aria-label="Close"
                  >
                    <svg className="w-4 h-4 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="px-5 py-4">
                  <div className="text-xs text-slate-600">Select an amount to top up:</div>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    {topUpOptions.map((opt) => {
                      const loading = buyingEsign === `topup_${opt.label}`
                      return (
                        <button
                          key={opt.label}
                          type="button"
                          disabled={!!buyingEsign}
                          onClick={() => startTopUpCheckout(opt.priceId, opt.label)}
                          className="inline-flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-emerald-600 to-green-500 text-white text-sm font-semibold rounded-xl shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50 transform hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none"
                        >
                          {loading ? 'Processing...' : `$${opt.label}`}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {section === 'Products & Services' ? (
            <div className="max-w-7xl mx-auto px-8 py-12">
              {/* Hero Section */}
              <div className="relative mb-16">
                <div className="text-center">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-gradient-to-r from-blue-500/20 to-blue-600/20 border border-blue-400/30 rounded-full mb-4 backdrop-blur-sm">
                  <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse shadow-lg shadow-blue-400/50" />
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-blue-300">Subscription Plans</span>
                </div>
                <h1 className="text-5xl font-bold text-white mb-4 drop-shadow-2xl">
                  Choose Your Perfect Plan
                </h1>
                <p className="text-slate-300 text-lg max-w-2xl mx-auto drop-shadow-lg">
                  Unlock powerful dealership management tools with flexible pricing designed to scale with your business
                </p>
                </div>
              </div>

              {/* Pricing Cards */}
              <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
                {products.map((plan) => {
                  const isActive = planStatus[plan.key as PlanKey]?.active
                  const isPurchasing = buying === plan.key
                  const isPopular = (plan as any).popular
                  const isPurchasable = (plan as any).purchasable !== false

                  return (
                    <div
                      key={plan.key}
                      className={
                        isPopular
                          ? 'relative bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl shadow-blue-500/20 border-2 border-blue-500 transform scale-105 z-10 transition-all duration-300 hover:shadow-blue-500/40 hover:scale-110'
                          : 'relative bg-white/90 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 hover:shadow-2xl transition-all duration-300 hover:scale-105 hover:border-blue-400/40'
                      }
                    >
                      {isPopular && (
                        <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                          <div className="px-4 py-1 bg-gradient-to-r from-navy-900 to-navy-800 text-white text-[10px] uppercase tracking-wider font-bold rounded-full shadow-lg">
                            Most Popular
                          </div>
                        </div>
                      )}

                      <div className="p-8">
                        <div className="grid grid-cols-1 md:grid-cols-[1fr,1.2fr] gap-8 items-start">
                          <div>
                            {/* Plan Header */}
                            <div className="text-center md:text-left mb-6">
                              <h3 className="text-xl font-bold text-slate-900 mb-2">{plan.planName}</h3>
                              <p className="text-xs text-slate-500 mb-4">{plan.description}</p>
                              <div className="flex items-baseline justify-center md:justify-start gap-1">
                                <span className="text-4xl font-bold text-slate-900">{plan.amount}</span>
                                <span className="text-sm text-slate-500">{plan.period}</span>
                              </div>
                            </div>

                            {/* CTA Button */}
                            <div>
                              {!isPurchasable ? (
                                <div className="text-center md:text-left">
                                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-slate-50 to-slate-100 rounded-lg border border-slate-200">
                                    <div className="w-2 h-2 bg-slate-500 rounded-full" />
                                    <span className="text-xs font-semibold text-slate-700">Default Account</span>
                                  </div>
                                </div>
                              ) : isActive ? (
                                <div className="text-center md:text-left">
                                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200">
                                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                                    <span className="text-xs font-semibold text-green-700">Active Plan</span>
                                  </div>
                                  <div className="mt-3 text-xs text-slate-500">
                                    {formatValidUntil(planStatus[plan.key as PlanKey]?.validUntilIso || null)}
                                  </div>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  disabled={!!buying}
                                  onClick={() => startCheckout(plan.key)}
                                  className={
                                    isPopular
                                      ? 'w-full py-3 px-6 bg-gradient-to-r from-navy-900 to-navy-800 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-1 hover:scale-105 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none'
                                      : 'w-full py-3 px-6 bg-slate-900 text-white font-semibold rounded-xl hover:bg-slate-800 shadow-md hover:shadow-lg transform hover:-translate-y-1 hover:scale-105 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none'
                                  }
                                >
                                  {isPurchasing ? (
                                    <span className="inline-flex items-center gap-2">
                                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                      </svg>
                                      Processing...
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center justify-center gap-2">
                                      Upgrade to Dealership
                                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                      </svg>
                                    </span>
                                  )}
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Features List */}
                          <div className="space-y-3 md:mb-0 mb-8">
                            {plan.features.map((feature, idx) => (
                              <div key={idx} className="flex items-start gap-3">
                                <div className="flex-shrink-0 w-5 h-5 rounded-full bg-gradient-to-br from-navy-900 to-navy-800 flex items-center justify-center mt-0.5">
                                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                  </svg>
                                </div>
                                <span className="text-sm text-slate-700 leading-relaxed">{feature}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="mt-14">
                <div className="text-center mb-6">
                  <h2 className="text-2xl font-bold text-white drop-shadow-lg">E‑Signature Add‑Ons</h2>
                  <p className="text-sm text-slate-300">Choose the best option for e‑signature requests</p>
                </div>

                <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200">
                          <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Plan</th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Includes</th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Price</th>
                          <th className="px-6 py-4 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Buy</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {[
                          {
                            tier: 'pay_per_use',
                            name: 'Pay per Use',
                            includes: 'E‑Signature requests billed per use',
                            price: '$3.00',
                          },
                          {
                            tier: 'upto_5',
                            name: 'Up to 5 E‑Signatures',
                            includes: 'Bundle of up to 5 e‑signature requests',
                            price: '$14.99',
                          },
                          {
                            tier: 'unlimited',
                            name: 'Unlimited Requests',
                            includes: 'Unlimited e‑signature requests',
                            price: '$27.99',
                          },
                        ].map((row) => {
                          const isPurchasing = buyingEsign === row.tier
                          return (
                            <tr key={row.tier} className="hover:bg-slate-50 transition-colors duration-150">
                              <td className="px-6 py-4 text-sm font-semibold text-slate-900">{row.name}</td>
                              <td className="px-6 py-4 text-sm text-slate-700">{row.includes}</td>
                              <td className="px-6 py-4 text-sm font-semibold text-slate-900">{row.price}</td>
                              <td className="px-6 py-4 text-right">
                                <button
                                  type="button"
                                  disabled={!!buyingEsign}
                                  onClick={() => startEsignCheckout(row.tier)}
                                  className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-500 text-white text-xs font-semibold rounded-lg shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 transform hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none"
                                >
                                  {isPurchasing ? (
                                    <span className="inline-flex items-center gap-2">
                                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                      </svg>
                                      Processing...
                                    </span>
                                  ) : (
                                    'BUY'
                                  )}
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Trust Badges */}
              <div className="text-center mt-10">
                <div className="inline-flex items-center gap-8 px-8 py-4 bg-white/10 backdrop-blur-xl rounded-xl shadow-lg border border-white/20">
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2L3 7v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5z" />
                    </svg>
                    <span className="text-xs font-medium text-white">Secure Payment</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-blue-400" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                    </svg>
                    <span className="text-xs font-medium text-white">Cancel Anytime</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-purple-400" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H4V8l8 5 8-5v10zm-8-7L4 6h16l-8 5z" />
                    </svg>
                    <span className="text-xs font-medium text-white">24/7 Support</span>
                  </div>
                </div>
              </div>
            </div>
          ) : section === 'Transactions' ? (
            <div className="max-w-7xl mx-auto px-8 py-12">
              {/* Transactions Header */}
              <div className="mb-8">
                <h2 className="text-3xl font-bold text-white mb-2 drop-shadow-lg">Transaction History</h2>
                <p className="text-sm text-slate-300">View and download your billing history</p>
              </div>

              {/* Transactions Table */}
              <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200">
                        <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Date</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Description</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Amount</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-4 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Invoice</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {loadingTransactions ? (
                        <tr>
                          <td colSpan={5} className="px-6 py-12 text-center">
                            <div className="flex items-center justify-center gap-3">
                              <svg className="animate-spin h-5 w-5 text-navy-900" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                              </svg>
                              <span className="text-sm text-slate-600">Loading transactions...</span>
                            </div>
                          </td>
                        </tr>
                      ) : transactions.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-6 py-12 text-center text-sm text-slate-500">
                            No transactions found
                          </td>
                        </tr>
                      ) : (
                        transactions.map((txn, idx) => (
                          <tr key={txn.id} className="hover:bg-slate-50 transition-colors duration-150 group">
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">
                              {new Date(txn.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-900">{txn.description}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-slate-900">{txn.amount}</td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span
                                className={
                                  txn.status === 'completed'
                                    ? 'inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-50 text-green-700 text-xs font-medium rounded-full'
                                    : txn.status === 'pending'
                                    ? 'inline-flex items-center gap-1.5 px-2.5 py-1 bg-yellow-50 text-yellow-700 text-xs font-medium rounded-full'
                                    : 'inline-flex items-center gap-1.5 px-2.5 py-1 bg-red-50 text-red-700 text-xs font-medium rounded-full'
                                }
                              >
                                <div
                                  className={
                                    txn.status === 'completed'
                                      ? 'w-1.5 h-1.5 bg-green-500 rounded-full'
                                      : txn.status === 'pending'
                                      ? 'w-1.5 h-1.5 bg-yellow-500 rounded-full animate-pulse'
                                      : 'w-1.5 h-1.5 bg-red-500 rounded-full'
                                  }
                                />
                                {txn.status.charAt(0).toUpperCase() + txn.status.slice(1)}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right">
                              {txn.invoice_url && (
                                <button
                                  type="button"
                                  className="inline-flex items-center gap-1.5 text-xs font-medium text-navy-900 hover:text-navy-700 transition-colors duration-150 group-hover:translate-x-1 transform transition-transform"
                                  onClick={() => window.open(txn.invoice_url, '_blank')}
                                >
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                  </svg>
                                  Download
                                </button>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : section === 'Payment Methods' ? (
            <div className="max-w-7xl mx-auto px-8 py-12">
              {/* Payment Methods Header */}
              <div className="mb-8 flex items-center justify-between">
                <div>
                  <h2 className="text-3xl font-bold text-white mb-2 drop-shadow-lg">Payment Methods</h2>
                  <p className="text-sm text-slate-300">Manage your payment methods and billing information</p>
                </div>
                <button
                  type="button"
                  onClick={startSetupPaymentMethod}
                  disabled={!!buyingEsign}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-blue-500 text-white text-sm font-semibold rounded-lg shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 transform hover:-translate-y-0.5 transition-all duration-200"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Payment Method
                </button>
              </div>

              {/* Payment Methods Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {loadingPaymentMethods ? (
                  <div className="col-span-2 flex items-center justify-center py-12">
                    <div className="flex items-center gap-3">
                      <svg className="animate-spin h-5 w-5 text-navy-900" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span className="text-sm text-slate-600">Loading payment methods...</span>
                    </div>
                  </div>
                ) : paymentMethods.length === 0 ? (
                  <div className="col-span-2 text-center py-12">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-100 rounded-full mb-4">
                      <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">No payment methods</h3>
                    <p className="text-sm text-slate-500">Add a payment method to get started</p>
                  </div>
                ) : (
                  paymentMethods.map((pm) => (
                    <div
                      key={pm.id}
                      className="relative bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-6 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 group overflow-hidden"
                    >
                      {/* Card Background Pattern */}
                      <div className="absolute inset-0 opacity-10">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white rounded-full -translate-y-16 translate-x-16" />
                        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white rounded-full translate-y-12 -translate-x-12" />
                      </div>

                      <div className="relative">
                        {/* Card Header */}
                        <div className="flex items-start justify-between mb-8">
                          <div className="flex items-center gap-3">
                            {pm.type === 'card' && (
                              <div className="w-12 h-8 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded flex items-center justify-center">
                                <svg className="w-6 h-6 text-yellow-900" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M4 4h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2zm0 2v3h16V6H4zm0 5v7h16v-7H4z" />
                                </svg>
                              </div>
                            )}
                            <div>
                              <div className="text-xs text-slate-400 uppercase tracking-wider">Payment Method</div>
                              <div className="text-sm font-semibold text-white">{pm.brand || 'Card'}</div>
                            </div>
                          </div>
                          {pm.is_default && (
                            <span className="px-2.5 py-1 bg-green-500/20 text-green-300 text-[10px] font-bold uppercase tracking-wider rounded-full">
                              Default
                            </span>
                          )}
                        </div>

                        {/* Card Number */}
                        <div className="mb-6">
                          <div className="text-xl font-mono text-white tracking-wider">
                            •••• •••• •••• {pm.last4}
                          </div>
                        </div>

                        {/* Card Footer */}
                        <div className="flex items-end justify-between">
                          {pm.exp_month && pm.exp_year && (
                            <div>
                              <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Expires</div>
                              <div className="text-sm font-semibold text-white">
                                {String(pm.exp_month).padStart(2, '0')}/{pm.exp_year}
                              </div>
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              className="p-2 hover:bg-white/10 rounded-lg transition-colors duration-150"
                              title="Edit"
                            >
                              <svg className="w-4 h-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            {!pm.is_default && (
                              <button
                                type="button"
                                className="p-2 hover:bg-red-500/20 rounded-lg transition-colors duration-150"
                                title="Remove"
                              >
                                <svg className="w-4 h-4 text-red-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
