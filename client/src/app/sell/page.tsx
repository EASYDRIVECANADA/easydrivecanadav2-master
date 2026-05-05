'use client'

import { useState } from 'react'
import {
  Car,
  CheckCircle,
  ShieldCheck,
  Clock,
  DollarSign,
  Smile,
  AlertCircle,
} from 'lucide-react'

const BRAND = '#1aa6ff'
const BRAND_BG = '#1aa6ff1a'
const BRAND_BORDER = '#1aa6ff40'

const TRUST_BULLETS = [
  { icon: Clock,       text: 'We respond within 24 hours' },
  { icon: DollarSign,  text: 'Fair, market-based offer' },
  { icon: ShieldCheck, text: 'No obligation — walk away any time' },
  { icon: Smile,       text: 'Hassle-free, paperwork handled for you' },
  { icon: CheckCircle, text: 'Trusted by hundreds of Canadian sellers' },
]

export default function SellPage() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    vin: '',
    askingPrice: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setForm(prev => ({
      ...prev,
      [name]: name === 'vin' ? value.toUpperCase() : value,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      const res = await fetch('/api/sell', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Something went wrong. Please try again.')
      } else {
        setSubmitted(true)
      }
    } catch {
      setError('Network error. Please check your connection and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Hero ── */}
      <section
        className="relative overflow-hidden"
        style={{ background: '#0d182b' }}
      >
        {/* Ambient glow */}
        <div
          className="absolute top-0 right-0 w-[480px] h-[480px] rounded-full blur-3xl pointer-events-none"
          style={{ background: `${BRAND}18`, transform: 'translate(30%, -30%)' }}
        />
        <div
          className="absolute bottom-0 left-0 w-64 h-64 rounded-full blur-2xl pointer-events-none"
          style={{ background: `${BRAND}10`, transform: 'translate(-30%, 30%)' }}
        />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          <div className="max-w-2xl">
            {/* Badge */}
            <div
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium mb-6 border"
              style={{ background: BRAND_BG, borderColor: BRAND_BORDER, color: BRAND }}
            >
              <Car size={15} />
              <span>Free · No obligation · Reply within 24 hrs</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white leading-tight mb-4">
              Sell your car on EasyDrive —{' '}
              <span style={{ color: BRAND }}>verified &amp; trusted.</span>
            </h1>

            <p className="text-slate-300 text-base sm:text-lg leading-relaxed">
              Private sellers can list one vehicle at a time. To protect buyers
              and keep our marketplace high-trust, every Private Seller must
              complete document verification before their listing goes live.
            </p>
          </div>
        </div>
      </section>

      {/* ── Form + Sidebar ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <div className="grid lg:grid-cols-3 gap-8 lg:gap-12">

          {/* Form card */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8">
              <h2 className="text-xl font-bold text-gray-900 mb-1">
                Submit your vehicle details
              </h2>
              <p className="text-gray-500 text-sm mb-6">
                All fields are required. We&apos;ll reach out to the email you provide.
              </p>

              {submitted ? (
                /* Success state */
                <div className="flex flex-col items-center text-center py-10">
                  <div
                    className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
                    style={{ background: '#d1fae5' }}
                  >
                    <CheckCircle size={32} color="#059669" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">
                    Inquiry received!
                  </h3>
                  <p className="text-gray-500 max-w-sm">
                    Thanks, <span className="font-medium text-gray-700">{form.name.split(' ')[0]}</span>!
                    Our team will review your vehicle and get back to you within{' '}
                    <span className="font-medium text-gray-700">24 hours</span>.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5" noValidate>
                  {/* Row: Name + Email */}
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                        Full Name
                      </label>
                      <input
                        id="name"
                        name="name"
                        type="text"
                        autoComplete="name"
                        placeholder="Jane Smith"
                        value={form.name}
                        onChange={handleChange}
                        required
                        className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-transparent"
                        style={{ ['--tw-ring-color' as string]: BRAND }}
                      />
                    </div>
                    <div>
                      <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                        Email Address
                      </label>
                      <input
                        id="email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        placeholder="jane@example.com"
                        value={form.email}
                        onChange={handleChange}
                        required
                        className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-transparent"
                        style={{ ['--tw-ring-color' as string]: BRAND }}
                      />
                    </div>
                  </div>

                  {/* Row: Phone */}
                  <div>
                    <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                      Phone Number
                    </label>
                    <input
                      id="phone"
                      name="phone"
                      type="tel"
                      autoComplete="tel"
                      placeholder="(604) 555-0100"
                      value={form.phone}
                      onChange={handleChange}
                      required
                      className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-transparent"
                      style={{ ['--tw-ring-color' as string]: BRAND }}
                    />
                  </div>

                  {/* Row: VIN + Asking Price */}
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="vin" className="block text-sm font-medium text-gray-700 mb-1">
                        VIN
                      </label>
                      <input
                        id="vin"
                        name="vin"
                        type="text"
                        inputMode="text"
                        maxLength={17}
                        placeholder="1HGCM82633A004352"
                        value={form.vin}
                        onChange={handleChange}
                        required
                        className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-transparent font-mono tracking-widest uppercase"
                        style={{ ['--tw-ring-color' as string]: BRAND }}
                      />
                      <p className="mt-1 text-xs text-gray-400">17 characters — found on your dashboard or door frame</p>
                    </div>
                    <div>
                      <label htmlFor="askingPrice" className="block text-sm font-medium text-gray-700 mb-1">
                        Asking Price (CAD)
                      </label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-3 flex items-center text-gray-400 text-sm pointer-events-none">$</span>
                        <input
                          id="askingPrice"
                          name="askingPrice"
                          type="number"
                          inputMode="numeric"
                          min="500"
                          step="100"
                          placeholder="18500"
                          value={form.askingPrice}
                          onChange={handleChange}
                          required
                          className="w-full rounded-lg border border-gray-300 pl-7 pr-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-transparent"
                          style={{ ['--tw-ring-color' as string]: BRAND }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Error */}
                  {error && (
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                      <AlertCircle size={16} className="mt-0.5 shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}

                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-3 rounded-xl text-white font-semibold text-base transition-opacity disabled:opacity-60"
                    style={{ background: BRAND }}
                  >
                    {submitting ? 'Sending…' : 'Send My Inquiry'}
                  </button>

                  <p className="text-xs text-gray-400 text-center">
                    By submitting, you agree to be contacted by EasyDrive Canada regarding your vehicle.
                  </p>
                </form>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Why EasyDrive card */}
            <div
              className="rounded-2xl p-6 border"
              style={{ background: BRAND_BG, borderColor: BRAND_BORDER }}
            >
              <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                <ShieldCheck size={18} style={{ color: BRAND }} />
                Why sell with EasyDrive?
              </h3>
              <ul className="space-y-3">
                {TRUST_BULLETS.map(({ icon: Icon, text }) => (
                  <li key={text} className="flex items-start gap-2.5 text-sm text-gray-700">
                    <Icon size={16} className="mt-0.5 shrink-0" style={{ color: BRAND }} />
                    {text}
                  </li>
                ))}
              </ul>
            </div>

            {/* How it works card */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <h3 className="font-bold text-gray-900 mb-4">How it works</h3>
              <ol className="space-y-4">
                {[
                  { step: '1', title: 'Submit the form', desc: 'Tell us your details and asking price.' },
                  { step: '2', title: 'We review your car', desc: 'Our team checks the VIN and market value.' },
                  { step: '3', title: 'Get an offer', desc: 'Receive a fair cash offer within 24 hours.' },
                  { step: '4', title: 'Close the deal', desc: 'We handle the paperwork — you get paid.' },
                ].map(item => (
                  <li key={item.step} className="flex gap-3">
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 mt-0.5"
                      style={{ background: BRAND }}
                    >
                      {item.step}
                    </div>
                    <div>
                      <div className="font-semibold text-sm text-gray-900">{item.title}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{item.desc}</div>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
