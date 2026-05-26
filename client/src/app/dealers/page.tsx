'use client'

import { useState } from 'react'
import type { ReactNode } from 'react'
import { Building2, CheckCircle, ShieldCheck, CreditCard, Users, AlertCircle } from 'lucide-react'

const BRAND = '#118df0'

type DealerSubmission = {
  verificationUrl: string
  dealershipWarning?: string | null
}

export default function DealersPage() {
  const [form, setForm] = useState({
    companyName: '',
    contactName: '',
    email: '',
    phone: '',
    province: 'ON',
    inventorySize: '',
    website: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [submission, setSubmission] = useState<DealerSubmission | null>(null)
  const [error, setError] = useState<string | null>(null)

  const setField = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      const res = await fetch('/api/dealers/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        setError(String(json?.error || 'Unable to start dealership onboarding.'))
        return
      }
      setSubmission({
        verificationUrl: String(json?.verificationUrl || '/account/verification?returnUrl=%2Fadmin%2Fbilling'),
        dealershipWarning: typeof json?.dealershipWarning === 'string' ? json.dealershipWarning : null,
      })
    } catch {
      setError('Network error. Please check your connection and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <section className="bg-[#0b1f3a] text-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:px-8 lg:py-20">
          <div className="flex flex-col justify-center">
            <div className="mb-5 inline-flex w-fit items-center gap-2 rounded-full border border-sky-300/30 bg-sky-400/10 px-4 py-1.5 text-sm font-semibold text-sky-200">
              <Building2 className="h-4 w-4" />
              Dealership onboarding
            </div>
            <h1 className="max-w-3xl text-4xl font-bold leading-tight sm:text-5xl">
              Register your dealership with EasyDrive Canada
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300">
              Start your dealer profile, verify the owner account, then choose the Small, Medium, or Large dealership plan in Billing.
            </p>
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {[
                { icon: ShieldCheck, label: 'Owner verification' },
                { icon: CreditCard, label: 'Stripe billing' },
                { icon: Users, label: 'Team access' },
              ].map(({ icon: Icon, label }) => (
                <div key={label} className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <Icon className="h-5 w-5 text-sky-300" />
                  <div className="mt-3 text-sm font-semibold text-white">{label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white p-6 text-slate-900 shadow-2xl sm:p-8">
            {submission ? (
              <div className="flex min-h-[430px] flex-col items-center justify-center text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
                  <CheckCircle className="h-8 w-8 text-emerald-600" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900">Dealer profile started</h2>
                <p className="mt-3 max-w-sm text-sm leading-6 text-slate-500">
                  Complete owner verification next. After that, you will land on Billing to choose a dealership subscription.
                </p>
                {submission.dealershipWarning && (
                  <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                    {submission.dealershipWarning}
                  </div>
                )}
                <a
                  href={submission.verificationUrl}
                  className="mt-6 inline-flex h-11 items-center justify-center rounded-xl px-5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                  style={{ background: BRAND }}
                >
                  Continue to verification
                </a>
              </div>
            ) : (
              <>
                <h2 className="text-xl font-bold text-slate-900">Start dealership registration</h2>
                <p className="mt-1 text-sm text-slate-500">All required fields help us set up the owner account and dealer profile.</p>

                <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                  <Field label="Company name">
                    <input value={form.companyName} onChange={(e) => setField('companyName', e.target.value)} required className="edc-input" placeholder="North York Auto Group" />
                  </Field>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Owner / contact name">
                      <input value={form.contactName} onChange={(e) => setField('contactName', e.target.value)} required className="edc-input" placeholder="Sam Dealer" />
                    </Field>
                    <Field label="Phone">
                      <input value={form.phone} onChange={(e) => setField('phone', e.target.value)} required className="edc-input" placeholder="416-555-0123" />
                    </Field>
                  </div>
                  <Field label="Email">
                    <input value={form.email} onChange={(e) => setField('email', e.target.value)} required type="email" className="edc-input" placeholder="owner@dealership.ca" />
                  </Field>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Province">
                      <select value={form.province} onChange={(e) => setField('province', e.target.value)} className="edc-input">
                        {['ON', 'BC', 'AB', 'SK', 'MB', 'QC', 'NB', 'NS', 'PE', 'NL', 'YT', 'NT', 'NU'].map((province) => (
                          <option key={province} value={province}>{province}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Estimated inventory">
                      <input value={form.inventorySize} onChange={(e) => setField('inventorySize', e.target.value)} required type="number" min="1" className="edc-input" placeholder="42" />
                    </Field>
                  </div>
                  <Field label="Website">
                    <input value={form.website} onChange={(e) => setField('website', e.target.value)} className="edc-input" placeholder="https://dealership.ca" />
                  </Field>

                  {error && (
                    <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                      <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={submitting}
                    className="h-12 w-full rounded-xl text-sm font-semibold text-white transition-opacity disabled:opacity-60"
                    style={{ background: BRAND }}
                  >
                    {submitting ? 'Starting registration...' : 'Start Dealer Registration'}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-4 md:grid-cols-3">
          {[
            ['1', 'Create dealer profile', 'We capture your company and owner details.'],
            ['2', 'Verify owner identity', 'The existing verification flow confirms the account owner.'],
            ['3', 'Choose a plan', 'Billing upgrades the account through the existing Stripe subscription flow.'],
          ].map(([step, title, body]) => (
            <div key={step} className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-50 text-sm font-bold text-sky-600">{step}</div>
              <h3 className="mt-4 font-semibold text-slate-900">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-500">{body}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-slate-700">{label}</span>
      {children}
    </label>
  )
}
