'use client'

import { useState } from 'react'
import Link from 'next/link'
import { MapPin, Phone, Mail, Clock, MessageSquare } from 'lucide-react'

const BRAND = '#1aa6ff'
const BRAND_BG = '#1aa6ff1a'
const BRAND_BORDER = '#1aa6ff40'

const INFO_CARDS = [
  { icon: MapPin, title: 'Visit us',   detail: '1247 Lakeshore Blvd, Toronto, ON' },
  { icon: Phone,  title: 'Call us',    detail: '(613) 777-2395' },
  { icon: Mail,   title: 'Email us',   detail: 'info@easydrivecanada.com' },
  { icon: Clock,  title: 'Hours',      detail: 'Mon–Fri 11am–5pm · Sat 12–4pm' },
]

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, source: 'contact_form' }),
      })

      if (res.ok) {
        setSubmitted(true)
      } else {
        setError('Something went wrong. Please try again.')
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
      <section className="relative overflow-hidden" style={{ background: '#0d182b' }}>
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
            <div
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium mb-6 border"
              style={{ background: BRAND_BG, borderColor: BRAND_BORDER, color: BRAND }}
            >
              <MessageSquare size={15} />
              We&apos;re Here to Help
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white leading-tight mb-4">
              Get in <span style={{ color: BRAND }}>Touch</span>
            </h1>
            <p className="text-slate-300 text-base sm:text-lg leading-relaxed">
              Have questions about a vehicle, financing, or delivery? We&apos;d love to
              hear from you — send us a message and we&apos;ll respond as soon as possible.
            </p>
          </div>
        </div>
      </section>

      {/* ── Content ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <div className="grid lg:grid-cols-[1fr_340px] gap-8 lg:gap-12">

          {/* Form */}
          <div className="bg-white border border-gray-100 shadow-sm rounded-2xl p-6 sm:p-8">
            {submitted ? (
              <div className="flex flex-col items-center text-center py-10">
                <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4 bg-green-100">
                  <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="text-2xl font-extrabold text-gray-900 mb-2">Message Sent!</h2>
                <p className="text-gray-500 max-w-sm mb-8">
                  Thank you for reaching out. We&apos;ll get back to you typically within{' '}
                  <span className="font-semibold" style={{ color: BRAND }}>24 hours</span>.
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Link
                    href="/inventory"
                    className="inline-flex items-center justify-center gap-2 text-white px-6 py-3 rounded-full font-semibold hover:opacity-90 transition-opacity"
                    style={{ background: BRAND }}
                  >
                    Browse Vehicles
                  </Link>
                  <button
                    onClick={() => {
                      setSubmitted(false)
                      setFormData({ name: '', email: '', subject: '', message: '' })
                    }}
                    className="inline-flex items-center justify-center gap-2 bg-transparent px-6 py-3 rounded-full font-semibold border-2 transition-all hover:opacity-80"
                    style={{ color: BRAND, borderColor: BRAND }}
                  >
                    Send Another Message
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Name + Email */}
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Name</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="input-field"
                      placeholder="John Smith"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="input-field"
                      placeholder="john@example.com"
                    />
                  </div>
                </div>

                {/* Subject */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Subject</label>
                  <input
                    type="text"
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    className="input-field"
                    placeholder="How can we help?"
                  />
                </div>

                {/* Message */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Message</label>
                  <textarea
                    rows={6}
                    required
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    placeholder="Tell us more…"
                    className="input-field resize-none"
                  />
                </div>

                {error && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                    <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>{error}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 text-white px-6 py-3 rounded-full font-semibold transition-opacity hover:opacity-90 disabled:opacity-60"
                  style={{ background: BRAND }}
                >
                  {submitting ? (
                    <>
                      <div className="loading-ring" style={{ width: '18px', height: '18px', borderWidth: '2px' }} />
                      Sending&hellip;
                    </>
                  ) : (
                    'Send message'
                  )}
                </button>
              </form>
            )}
          </div>

          {/* Info cards */}
          <div className="space-y-4">
            {INFO_CARDS.map(({ icon: Icon, title, detail }) => (
              <div
                key={title}
                className="flex items-start gap-4 bg-white border border-gray-100 shadow-sm rounded-2xl p-5"
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: BRAND_BG }}
                >
                  <Icon size={20} style={{ color: BRAND }} />
                </div>
                <div>
                  <div className="font-semibold text-gray-900">{title}</div>
                  <div className="text-sm text-gray-500 mt-0.5">{detail}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
