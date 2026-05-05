
'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function SettingsBillingPage() {
  return <BillingPage />
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

type PlanKey = 'starter' | 'small' | 'medium' | 'large'

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
    medium: { active: false, validUntilIso: null },
    large: { active: false, validUntilIso: null },
  })
  const [isOwner, setIsOwner] = useState<boolean | null>(null)

  const products = useMemo(
    () => [
      {
        key: 'starter',
        planName: 'Private Seller',
        amount: 'Free',
        period: '',
        description: 'Default account for private sellers — pay only when you post or promote',
        features: [
          '1 user only',
          'Under 1 vehicles in inventory',
          'Basic listings & inquiries',
          'Manual posting / pay-per-use publishing',
          'Standard support',
        ],
        purchasable: false,
        icon: 'user',
      },
      {
        key: 'small',
        planName: 'Small Dealership',
        amount: '$79',
        period: '/mo',
        billedNote: 'Billed Monthly',
        description: 'Plan made for small sized car dealerships',
        features: [
          '1-3 users',
          'Under 50 vehicles in inventory',
          'Under 50 deals per month',
          '1 hour of online training included',
        ],
        purchasable: true,
        icon: 'gauge-small',
        cancelNote: '30 day cancellation notice required',
      },
      {
        key: 'medium',
        planName: 'Medium Dealership',
        amount: '$129',
        period: '/mo',
        billedNote: 'Billed Monthly',
        description: 'Plan made for medium sized car dealerships',
        features: [
          'Up to 5 included users',
          'Under 100 vehicles',
          'Under 100 deals per month',
          '1.5 hours of online training included',
        ],
        popular: true,
        purchasable: true,
        icon: 'gauge-medium',
        cancelNote: '30 day cancellation notice required',
      },
      {
        key: 'large',
        planName: 'Large Dealership',
        amount: '$169',
        period: '/mo',
        billedNote: 'Billed Monthly',
        description: 'Plan made for large sized car dealerships',
        features: [
          'Up to 10 included users',
          'Under 300 vehicles',
          'Under 300 deals per month',
          '2 hours of online training included',
        ],
        purchasable: true,
        icon: 'gauge-large',
        cancelNote: '30 day cancellation notice required',
      },
    ],
    []
  )

  useEffect(() => {
    if (section !== 'Products & Services' && topUpModalOpen) {
      setTopUpModalOpen(false)
    }
  }, [section, topUpModalOpen])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const readSession = () => {
      try {
        const raw = window.localStorage.getItem('edc_admin_session')
        if (!raw) return { email: '', userId: '' }
        const parsed = JSON.parse(raw) as { email?: string; user_id?: string }
        return {
          email: String(parsed?.email || '').trim().toLowerCase(),
          userId: String(parsed?.user_id || '').trim(),
        }
      } catch {
        return { email: '', userId: '' }
      }
    }

    const resolveOwnerEmail = async (): Promise<string> => {
      const { email, userId } = readSession()
      if (!userId) return email
      try {
        // Look up the owner row (the row with a role set) sharing this user_id
        const { data } = await supabase
          .from('users')
          .select('email')
          .eq('user_id', userId)
          .not('role', 'is', null)
          .limit(1)
        const ownerEmail = String((Array.isArray(data) ? data[0] : data)?.email || '').trim().toLowerCase()
        return ownerEmail || email
      } catch {
        return email
      }
    }

    const placeholder = readSession().email
    if (!placeholder) return

    let email = placeholder

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
        const { userId: sessionUserId } = readSession()
        const res = await fetch('/api/stripe/subscription-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, userId: sessionUserId }),
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
          medium: {
            active: Boolean(plans?.medium?.active),
            validUntilIso: typeof plans?.medium?.validUntilIso === 'string' ? plans.medium.validUntilIso : null,
          },
          large: {
            active: Boolean(plans?.large?.active),
            validUntilIso: typeof plans?.large?.validUntilIso === 'string' ? plans.large.validUntilIso : null,
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

    void (async () => {
      const ownerEmail = await resolveOwnerEmail()
      if (!ownerEmail) return

      // Check if logged-in user is the Owner
      const { email: sessionEmail } = readSession()
      if (sessionEmail) {
        try {
          const { data: userRow } = await supabase
            .from('users')
            .select('title')
            .ilike('email', sessionEmail)
            .limit(1)
            .maybeSingle()
          const title = String((userRow as any)?.title || '').trim().toLowerCase()
          setIsOwner(title === 'owner')
        } catch {
          setIsOwner(false)
        }
      } else {
        setIsOwner(false)
      }

      // Use owner email for subscription/payment methods (shared at account level)
      email = ownerEmail
      void fetchSubscriptionStatus()
      void fetchTransactions()
      void fetchPaymentMethods()

      // Use logged-in user's own email for balance (personal to each user)
      const userEmail = readSession().email
      if (userEmail) {
        const res = await fetch('/api/users/balance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: userEmail }),
        })
        const json = await res.json().catch(() => null)
        if (res.ok) {
          const nextBalance = Number(json?.balance ?? 0)
          setBalance(Number.isFinite(nextBalance) ? nextBalance : 0)
        }
      }
    })()

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
            // Webhook updates Supabase asynchronously; poll a few times to ensure UI sync.
            void fetchBalance()
            setTimeout(() => { void fetchBalance() }, 1500)
            setTimeout(() => { void fetchBalance() }, 3500)
            setTimeout(() => { void fetchBalance() }, 6500)
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

  const buyEsignUnlimitedWithBalance = async () => {
    if (buyingEsign) return
    setBuyingEsign('unlimited_balance')
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

      console.log('[billing] Buying unlimited esign for email:', email)

      const res = await fetch('/api/esign/unlimited/buy-with-balance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      
      console.log('[billing] Unlimited API response:', { ok: res.ok, status: res.status })
      
      const json = await res.json().catch(() => null)
      console.log('[billing] Unlimited API JSON:', json)
      
      if (!res.ok) {
        const msg = String(json?.error || 'Unable to buy Unlimited with balance')
        console.error('[billing] Unlimited purchase failed:', msg)
        throw new Error(msg)
      }

      const nextBalance = Number(json?.balance ?? balance)
      if (Number.isFinite(nextBalance)) setBalance(nextBalance)
      console.log('[billing] Unlimited purchase successful, new balance:', nextBalance)
      window.alert('Unlimited E‑Signature activated for 30 days.')
    } catch (e: any) {
      console.error('[billing] Unlimited purchase error:', e)
      window.alert(String(e?.message || 'Unable to buy Unlimited with balance'))
    } finally {
      setBuyingEsign('')
    }
  }

  const buyEsignBundleWithBalance = async () => {
    if (buyingEsign) return
    setBuyingEsign('upto_5_balance')
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

      console.log('[billing] Buying esign bundle for email:', email)

      const res = await fetch('/api/esign/buy-with-balance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier: 'upto_5', email }),
      })
      
      console.log('[billing] API response:', { ok: res.ok, status: res.status })
      
      const json = await res.json().catch(() => null)
      console.log('[billing] API JSON:', json)
      
      if (!res.ok) {
        const msg = String(json?.error || 'Unable to buy bundle with balance')
        console.error('[billing] Purchase failed:', msg)
        throw new Error(msg)
      }

      const nextBalance = Number(json?.balance ?? balance)
      if (Number.isFinite(nextBalance)) setBalance(nextBalance)
      console.log('[billing] Purchase successful, new balance:', nextBalance)
      window.alert('Bundle purchased. 5 E‑Signature credits added.')
    } catch (e: any) {
      console.error('[billing] Purchase error:', e)
      window.alert(String(e?.message || 'Unable to buy bundle with balance'))
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
    if (!iso) return null
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return null
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
      window.alert(String(e?.message || 'Unable to start Stripe checkout'))
    } finally {
      setBuyingEsign('')
    }
  }

  const topUpOptions = useMemo(
    () => [
      { label: '10', priceId: 'price_1T6YsuEMrH8YRtBa9x0Rk8Zp' },
      { label: '25', priceId: 'price_1T6YtREMrH8YRtBa133BorNY' },
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
      window.alert(String(e?.message || 'Unable to start Stripe checkout'))
    } finally {
      setBuyingEsign('')
    }
  }

  // ── derive active plan for the "Current Plan" card ──────────────────────────
  const activePlan = products.find((p) => planStatus[p.key as PlanKey]?.active) ?? products[0]
  const activePlanIsActive = planStatus[activePlan.key as PlanKey]?.active ?? false

  return (
    <div className="min-h-screen bg-white">
      {/* ── Top-up modal (unchanged) ─────────────────────────────────────────── */}
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
                      className="inline-flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-emerald-600 to-green-500 text-white text-sm font-semibold rounded-xl shadow-lg disabled:opacity-60 disabled:cursor-not-allowed"
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

      {/* ── Header ───────────────────────────────────────────────────────────── */}
      <div className="px-6 lg:px-8 pt-8 pb-4 border-b border-slate-100">
        <h1 className="text-2xl font-bold text-slate-900">Billing</h1>
        <p className="text-sm text-slate-500 mt-0.5">Manage your subscription and invoices</p>
      </div>

      {/* ── Main grid ────────────────────────────────────────────────────────── */}
      <div className="p-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">

        {/* Current Plan card */}
        <div className="rounded-2xl border border-slate-200 p-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs font-bold uppercase tracking-widest text-[#1EA7FF]">Current Plan</div>
              <h2 className="mt-2 text-3xl font-bold text-slate-900">{activePlan.planName}</h2>
              <p className="mt-1 text-sm text-slate-500">
                {activePlan.amount}{activePlan.period}
                {(activePlan as any).billedNote ? ` · ${(activePlan as any).billedNote}` : ''}
              </p>
            </div>
            {activePlanIsActive && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-200">
                Active
              </span>
            )}
          </div>

          <ul className="mt-6 grid gap-2 text-sm sm:grid-cols-2">
            {activePlan.features.map((f) => (
              <li key={f} className="flex items-center gap-2">
                <svg className="w-4 h-4 text-[#1EA7FF] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {f}
              </li>
            ))}
          </ul>

          {isOwner !== false && (
            <div className="mt-6 flex gap-2 flex-wrap">
              {products.filter((p) => p.key !== activePlan.key && (p as any).purchasable).map((p) => (
                <button
                  key={p.key}
                  type="button"
                  disabled={!!buying}
                  onClick={() => startCheckout(p.key)}
                  className="h-9 px-5 rounded-full border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-60"
                >
                  {buying === p.key ? 'Redirecting…' : `Switch to ${p.planName}`}
                </button>
              ))}
              <button
                type="button"
                className="h-9 px-4 rounded-full text-sm font-medium text-red-500 hover:bg-red-50 transition-colors"
              >
                Cancel subscription
              </button>
            </div>
          )}
          {isOwner === false && (
            <p className="mt-4 text-xs text-slate-500">Only the Owner can manage subscriptions.</p>
          )}
        </div>

        {/* Payment Method card */}
        <div className="rounded-2xl border border-slate-200 p-6">
          <h3 className="font-semibold text-slate-900">Payment method</h3>
          {loadingPaymentMethods ? (
            <div className="mt-4 flex items-center gap-2 text-sm text-slate-500">
              <div className="animate-spin h-4 w-4 border-2 border-[#1EA7FF] border-t-transparent rounded-full" />
              Loading…
            </div>
          ) : paymentMethods.length === 0 ? (
            <div className="mt-4">
              <p className="text-sm text-slate-500 mb-3">No payment methods on file.</p>
              <button
                type="button"
                onClick={startSetupPaymentMethod}
                disabled={!!buyingEsign}
                className="h-9 px-5 rounded-full border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-60"
              >
                {buyingEsign === 'pm_setup' ? 'Redirecting…' : 'Add payment method'}
              </button>
            </div>
          ) : (
            paymentMethods.slice(0, 1).map((pm) => (
              <div key={pm.id} className="mt-4 rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-slate-900">
                      {pm.brand ? pm.brand.charAt(0).toUpperCase() + pm.brand.slice(1) : 'Card'} •••• {pm.last4}
                    </div>
                    {pm.exp_month && pm.exp_year && (
                      <div className="text-xs text-slate-500 mt-0.5">
                        Expires {String(pm.exp_month).padStart(2, '0')}/{pm.exp_year}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={startSetupPaymentMethod}
                    disabled={!!buyingEsign}
                    className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors disabled:opacity-60"
                  >
                    {buyingEsign === 'pm_setup' ? 'Redirecting…' : 'Update'}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Invoices — full width */}
        <div className="lg:col-span-2 rounded-2xl border border-slate-200 overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-4">
            <h3 className="font-semibold text-slate-900">Invoices</h3>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-5 py-3 text-left">Invoice</th>
                <th className="px-5 py-3 text-left">Date</th>
                <th className="px-5 py-3 text-right">Amount</th>
                <th className="px-5 py-3 text-left">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loadingTransactions ? (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-sm text-slate-500">
                    <div className="inline-flex items-center gap-2">
                      <div className="animate-spin h-4 w-4 border-2 border-[#1EA7FF] border-t-transparent rounded-full" />
                      Loading…
                    </div>
                  </td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-sm text-slate-500">No invoices found</td>
                </tr>
              ) : (
                transactions.map((txn) => (
                  <tr key={txn.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-5 py-3 font-medium text-slate-900">{txn.id}</td>
                    <td className="px-5 py-3 text-slate-500">
                      {new Date(txn.date).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' })}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums text-slate-900">{txn.amount}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                        txn.status === 'completed' ? 'bg-green-50 text-green-700 border-green-200' :
                        txn.status === 'pending'   ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                                     'bg-red-50 text-red-700 border-red-200'
                      }`}>
                        {txn.status.charAt(0).toUpperCase() + txn.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      {txn.invoice_url && (
                        <button
                          type="button"
                          onClick={() => window.open(txn.invoice_url, '_blank')}
                          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                          title="Download invoice"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
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
  )
}

