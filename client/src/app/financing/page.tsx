'use client'

import { useState } from 'react'
import Link from 'next/link'

const WHO_ITS_FOR = [
  'Have fair or challenged credit',
  'Are rebuilding credit',
  'Are self-employed or independent contractors',
  'Are new to Canada',
  'Want realistic monthly payments',
  'Prefer everything handled online',
]

const TESTIMONIALS = [
  {
    name: 'Nathaniel Brooks',
    quote:
      'EasyDrive was very helpful with my auto financing. The process was smooth, quick, and easy to understand.',
  },
  {
    name: 'Olivia Fraser',
    quote:
      'Super easy to deal with and made getting my car sorted a breeze. Highly recommended.',
  },
  {
    name: 'Grace Campbell',
    quote:
      'Really happy with the help I got. They explained everything clearly and made financing way less stressful than I expected.',
  },
]

const FINANCING_FAQS = [
  {
    q: "Will I get approved for a car loan?",
    a: "Approval depends on several factors, including your credit profile, income, employment status, residency, down payment (if applicable), application details, and the vehicle being financed. We work with licensed lenders who review your application and help you explore the best available options for your situation.",
  },
  {
    q: "How does submitting an application work?",
    a: "Applying is simple and fully online. You complete a secure pre-qualification application that asks for basic information about you and your financing goals. Once submitted, your application is reviewed by our finance team and shared with licensed lenders who can assess your options. There's no obligation.",
  },
  {
    q: "How do I know what my interest rate will be?",
    a: "Your interest rate depends on your credit profile, income, residency status, and the vehicle being financed. Applying gives you a clearer picture of what options may be available before you move forward.",
  },
  {
    q: "Does submitting a financing application impact my credit score?",
    a: "Our pre-approval tool uses a soft check — no impact to your score. We may submit your information to lenders, which could result in a hard check when you proceed.",
  },
  {
    q: "What is gross income?",
    a: 'Gross income is your total monthly or yearly income before any taxes are deducted. This amount is higher than your "net pay" or "take-home pay."',
  },
  {
    q: "Can I pay off my loan at any time?",
    a: "Yes. Auto loans are open-ended loans that can be paid off before the end of term without penalty, subject to any terms imposed by your lender.",
  },
  {
    q: "What do I need when applying for financing?",
    a: "You'll need a valid piece of Canadian ID. If you have a co-applicant, they must also provide Canadian ID such as a driver's licence, passport, citizenship card, or permanent resident card.",
  },
  {
    q: "How does financing work if I don't have established credit or a fixed income?",
    a: "For newcomers, certain lenders offer programs that may qualify you for financing (conditions apply). If you don't have a fixed income, we recommend applying with a qualified co-applicant.",
  },
]

export default function FinancingPage() {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    annualIncome: '',
    employmentStatus: '',
    residencyStatus: '',
    creditProfile: '',
    downPayment: '',
    coApplicant: '',
  })
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData({ ...formData, [name]: value })
  }

  // Block non-numeric keys for money fields (prevent 'e', '+', '-')
  const handleMoneyKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (['e', 'E', '+', '-'].includes(e.key)) {
      e.preventDefault()
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')

    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          phone: formData.phone,
          annualIncome: formData.annualIncome ? parseFloat(formData.annualIncome) : null,
          employmentStatus: formData.employmentStatus || null,
          residencyStatus: formData.residencyStatus || null,
          creditProfile: formData.creditProfile || null,
          downPayment: formData.downPayment ? parseFloat(formData.downPayment) : null,
          coApplicant: formData.coApplicant || null,
          source: 'financing_application',
        }),
      })

      if (res.ok) {
        setSubmitted(true)
      } else {
        setError('Something went wrong. Please try again.')
      }
    } catch {
      setError('Unable to submit application. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center py-12 px-4">
        <div className="glass-card rounded-3xl p-12 text-center max-w-lg w-full">
          <div className="w-20 h-20 bg-gradient-to-br from-green-400 to-green-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-green-500/25 animate-success-check">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-3xl font-extrabold text-slate-900 mb-4 tracking-tight">Application Submitted!</h2>
          <p className="text-slate-500 mb-8 leading-relaxed">
            Thank you for your financing application. One of our finance specialists will review your information and contact you within{' '}
            <span className="font-semibold" style={{ color: '#1aa6ff' }}>24 hours</span>.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/inventory"
              className="inline-flex items-center justify-center gap-2 text-white px-7 py-3.5 rounded-full font-semibold transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 hover:opacity-90"
              style={{ backgroundColor: '#1aa6ff' }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Browse Vehicles
            </Link>
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 bg-transparent px-7 py-3.5 rounded-full font-semibold border-2 transition-all hover:text-white"
              style={{ color: '#1aa6ff', borderColor: '#1aa6ff' }}
              onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.backgroundColor = '#1aa6ff'; (e.currentTarget as HTMLAnchorElement).style.color = 'white'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.backgroundColor = 'transparent'; (e.currentTarget as HTMLAnchorElement).style.color = '#1aa6ff'; }}
            >
              Return Home
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">

      {/* ── Hero ── */}
      <section className="relative overflow-hidden py-16 lg:py-20">
        <div className="absolute inset-0" style={{ backgroundColor: '#0d182b' }} />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-white/90 mb-4">
            <svg className="w-3.5 h-3.5" style={{ color: '#1aa6ff' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            All credit profiles welcome
          </div>
          <h1 className="mt-2 max-w-2xl text-4xl font-extrabold tracking-tight text-white md:text-5xl">
            Get pre-qualified for auto financing in{' '}
            <span style={{ color: '#1aa6ff' }}>5 minutes</span>.
          </h1>
          <p className="mt-3 max-w-xl text-slate-300">
            One secure application. No obligation. Built for all credit profiles. Connect with licensed lenders who understand your situation.
          </p>
          <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/80">
            {[
              'One secure application',
              'No obligation',
              'Soft credit check first',
            ].map((item) => (
              <li key={item} className="flex items-center gap-1.5">
                <svg className="h-4 w-4" style={{ color: '#1aa6ff' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── Form + Aside ── */}
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_340px] lg:px-8">

        {/* Form */}
        <form onSubmit={handleSubmit} className="rounded-3xl border border-slate-200 bg-card p-8 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Tell us about you</h2>
          <p className="mt-1 text-sm text-slate-500">
            We'll review your profile and share it with licensed lenders who can explain your options.
          </p>

          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-center gap-3 text-sm">
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </div>
          )}

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">First name</label>
              <input type="text" name="firstName" required value={formData.firstName} onChange={handleChange} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Last name</label>
              <input type="text" name="lastName" required value={formData.lastName} onChange={handleChange} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
              <input type="email" name="email" required value={formData.email} onChange={handleChange} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Phone</label>
              <input type="tel" name="phone" required value={formData.phone} onChange={handleChange} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Gross annual income (CAD)</label>
              <input
                type="number" name="annualIncome" required min="0" step="1"
                value={formData.annualIncome} onChange={handleChange} onKeyDown={handleMoneyKeyDown}
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Employment status</label>
              <select name="employmentStatus" value={formData.employmentStatus} onChange={handleChange} className="select-field">
                <option value="">Choose...</option>
                <option value="ft">Full-time</option>
                <option value="pt">Part-time</option>
                <option value="self">Self-employed</option>
                <option value="contract">Contract / Gig</option>
                <option value="retired">Retired</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Residency status</label>
              <select name="residencyStatus" value={formData.residencyStatus} onChange={handleChange} className="select-field">
                <option value="">Choose...</option>
                <option value="citizen">Canadian citizen</option>
                <option value="pr">Permanent resident</option>
                <option value="work">Work permit</option>
                <option value="study">Study permit</option>
                <option value="newcomer">New to Canada</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Credit profile</label>
              <select name="creditProfile" value={formData.creditProfile} onChange={handleChange} className="select-field">
                <option value="">Choose...</option>
                <option value="excellent">Excellent (750+)</option>
                <option value="good">Good (700–749)</option>
                <option value="fair">Fair (600–699)</option>
                <option value="poor">Poor / Building</option>
                <option value="new">New to credit</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Desired down payment (CAD)</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium pointer-events-none z-10">$</span>
                <input
                  type="number" name="downPayment" min="0" step="1"
                  value={formData.downPayment} onChange={handleChange} onKeyDown={handleMoneyKeyDown}
                  className="input-field !pl-8"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Co-applicant?</label>
              <select name="coApplicant" value={formData.coApplicant} onChange={handleChange} className="select-field">
                <option value="">Choose...</option>
                <option value="no">Just me</option>
                <option value="yes">Yes — adding co-applicant</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="mt-8 w-full rounded-full py-4 font-semibold text-white text-base shadow-lg transition-all duration-300 hover:opacity-90 hover:shadow-xl hover:-translate-y-0.5 disabled:opacity-50 disabled:pointer-events-none"
            style={{ backgroundColor: '#1aa6ff' }}
          >
            {submitting ? (
              <span className="inline-flex items-center justify-center gap-2">
                <div className="loading-ring" style={{ width: '20px', height: '20px', borderWidth: '2px' }} />
                Submitting securely…
              </span>
            ) : (
              'Get my pre-qualification'
            )}
          </button>
          <p className="mt-3 text-center text-xs text-slate-400">
            By submitting, you agree to our terms. Soft credit check only — no impact on your score.
          </p>
        </form>

        {/* Aside — benefits */}
        <aside className="space-y-4 lg:pt-2">
          {[
            {
              icon: (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              ),
              title: 'No credit impact',
              sub: 'Soft check only — no surprises',
            },
            {
              icon: (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              ),
              title: 'Fast decisions',
              sub: 'Most approvals within 24 hours',
            },
            {
              icon: (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              ),
              title: 'All credit accepted',
              sub: 'Build, rebuild, or excellent — all welcome',
            },
            {
              icon: (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              ),
              title: 'Best available rates',
              sub: 'From 5.99% APR OAC',
            },
            {
              icon: (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              ),
              title: 'Co-applicants supported',
              sub: 'Add a co-applicant to strengthen approval',
            },
          ].map((b) => (
            <div key={b.title} className="flex items-start gap-3 rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl flex-shrink-0" style={{ backgroundColor: '#1aa6ff1a', color: '#1aa6ff' }}>
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">{b.icon}</svg>
              </div>
              <div>
                <div className="font-semibold text-slate-900 text-sm">{b.title}</div>
                <div className="text-xs text-slate-500 mt-0.5">{b.sub}</div>
              </div>
            </div>
          ))}
        </aside>
      </div>

      {/* ── What we believe / How we do it / Who it's for ── */}
      <section className="border-t border-slate-200 bg-slate-100/60">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-3 lg:px-8">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#1aa6ff' }}>What we believe</div>
            <h2 className="mt-2 text-2xl font-bold text-slate-900">Car financing shouldn't be confusing or intimidating.</h2>
            <p className="mt-3 text-sm text-slate-500 leading-relaxed">
              Traditional auto financing hasn't changed in decades. People are still expected to jump through hoops before they understand their options. We believe there's a better way — one secure online application, then real options explained in plain language.
            </p>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#1aa6ff' }}>How we do it</div>
            <h2 className="mt-2 text-2xl font-bold text-slate-900">One application. Multiple lender options.</h2>
            <p className="mt-3 text-sm text-slate-500 leading-relaxed">
              Complete one online application. Your information is reviewed by our finance team and shared with licensed lenders that specialize in approvals like yours. No dealership hopping. No repeated explanations. No pressure before clarity.
            </p>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#1aa6ff' }}>Who it's for</div>
            <h2 className="mt-2 text-2xl font-bold text-slate-900">Built for people who want clarity before commitment.</h2>
            <ul className="mt-3 space-y-2 text-sm text-slate-500">
              {WHO_ITS_FOR.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <svg className="mt-0.5 h-4 w-4 shrink-0" style={{ color: '#1aa6ff' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-slate-900">What our customers say</h2>
          <p className="mt-2 text-slate-500">Real people. Real approvals. Real cars in the driveway.</p>
        </div>
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <figure key={t.name} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <svg className="h-6 w-6" style={{ color: '#1aa6ff' }} fill="currentColor" viewBox="0 0 24 24">
                <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
              </svg>
              <blockquote className="mt-3 text-sm leading-relaxed text-slate-600">&ldquo;{t.quote}&rdquo;</blockquote>
              <figcaption className="mt-4 text-sm font-semibold text-slate-900">— {t.name}</figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="border-t border-slate-200 bg-slate-100/60">
        <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider" style={{ color: '#1aa6ff' }}>
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Frequently asked
            </div>
            <h2 className="mt-2 text-3xl font-bold text-slate-900">Everything you need to know about financing</h2>
            <p className="mt-2 text-slate-500">Honest answers about applications, rates, credit, and approvals.</p>
          </div>

          <div className="mt-8 rounded-3xl border border-slate-200 bg-white overflow-hidden">
            {FINANCING_FAQS.map((faq, i) => (
              <div key={i} className="border-b border-slate-100 last:border-b-0">
                <button
                  type="button"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between px-6 py-4 text-left text-sm font-semibold text-slate-900 hover:bg-slate-50 transition-colors"
                >
                  <span>{faq.q}</span>
                  <svg
                    className={`h-4 w-4 text-slate-400 flex-shrink-0 ml-4 transition-transform duration-200 ${openFaq === i ? 'rotate-180' : ''}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-5 text-sm text-slate-500 leading-relaxed">{faq.a}</div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-8 text-center">
            <p className="text-sm text-slate-500">Still have questions? Our finance team is one click away.</p>
            <Link
              href="/contact"
              className="mt-3 inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-6 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 hover:border-slate-300 transition-all"
            >
              Contact our finance team
            </Link>
          </div>
        </div>
      </section>

    </div>
  )
}
