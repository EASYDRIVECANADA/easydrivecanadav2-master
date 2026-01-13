'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      const res = await fetch(`${API_URL}/api/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          source: 'contact_form',
        }),
      })

      if (res.ok) {
        setSubmitted(true)
      }
    } catch (_error) {
      console.error('Error submitting form:', _error)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen">
      {/* Hero Header */}
      <section className="relative overflow-hidden py-16 lg:py-20">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900"></div>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-[#118df0]/20 via-transparent to-transparent"></div>
        <div className="absolute top-10 right-10 w-72 h-72 bg-[#118df0]/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-10 left-10 w-48 h-48 bg-purple-500/10 rounded-full blur-2xl"></div>
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <span className="badge mb-4 bg-white/10 border-white/20 text-white/90">
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              We&apos;re Here to Help
            </span>
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4">
              Get in <span className="gradient-text">Touch</span>
            </h1>
            <p className="text-slate-300 text-lg max-w-2xl mx-auto">
              Have questions? We&apos;d love to hear from you. Send us a message and we&apos;ll respond as soon as possible.
            </p>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Contact Info Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            {/* Quick Contact Cards */}
            <div className="glass-card-hover rounded-2xl p-6 group">
              <div className="flex items-start gap-4">
                <div className="icon-container group-hover:scale-110 transition-transform">
                  <svg className="w-6 h-6 text-[#118df0]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">Visit Our Showroom</h3>
                  <p className="text-gray-600">
                    123 Auto Drive<br />
                    Toronto, ON M1A 1A1
                  </p>
                  <a 
                    href="https://maps.google.com" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-[#118df0] text-sm font-medium mt-2 inline-flex items-center hover:underline"
                  >
                    Get Directions
                    <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </div>
              </div>
            </div>

            <div className="glass-card-hover rounded-2xl p-6 group">
              <div className="flex items-start gap-4">
                <div className="icon-container group-hover:scale-110 transition-transform">
                  <svg className="w-6 h-6 text-[#118df0]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">Call Us</h3>
                  <a 
                    href="tel:+16137772395" 
                    className="text-gray-600 hover:text-[#118df0] transition-colors text-lg font-medium"
                  >
                    (613) 777-2395
                  </a>
                  <p className="text-gray-500 text-sm mt-1">Mon-Fri 11am-5pm</p>
                </div>
              </div>
            </div>

            <div className="glass-card-hover rounded-2xl p-6 group">
              <div className="flex items-start gap-4">
                <div className="icon-container group-hover:scale-110 transition-transform">
                  <svg className="w-6 h-6 text-[#118df0]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">Email Us</h3>
                  <a 
                    href="mailto:info@easydrivecanada.com" 
                    className="text-gray-600 hover:text-[#118df0] transition-colors"
                  >
                    info@easydrivecanada.com
                  </a>
                  <p className="text-gray-500 text-sm mt-1">We reply within 24 hours</p>
                </div>
              </div>
            </div>

            {/* Business Hours */}
            <div className="glass-card rounded-2xl p-6">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-[#118df0]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Business Hours
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Monday - Friday</span>
                  <span className="font-medium text-gray-900">11:00 AM - 5:00 PM</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Saturday</span>
                  <span className="font-medium text-gray-900">12:00 PM - 4:00 PM</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Sunday</span>
                  <span className="font-medium text-red-500">Closed</span>
                </div>
              </div>
            </div>

            {/* Quick Links */}
            <div className="glass-card rounded-2xl p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Quick Links</h3>
              <div className="space-y-2">
                <Link href="/inventory" className="flex items-center text-gray-600 hover:text-[#118df0] transition-colors py-2">
                  <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  Browse Our Inventory
                </Link>
                <Link href="/financing" className="flex items-center text-gray-600 hover:text-[#118df0] transition-colors py-2">
                  <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Apply for Financing
                </Link>
              </div>
            </div>
          </div>

          {/* Contact Form */}
          <div className="lg:col-span-2">
            {submitted ? (
              <div className="glass-card rounded-2xl p-12 text-center">
                <div className="w-20 h-20 bg-gradient-to-br from-green-400 to-green-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-green-500/25">
                  <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="text-3xl font-bold text-gray-900 mb-4">Message Sent!</h2>
                <p className="text-gray-600 mb-8 max-w-md mx-auto">
                  Thank you for reaching out. We&apos;ll get back to you as soon as possible, typically within <span className="font-semibold text-[#118df0]">24 hours</span>.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Link href="/inventory" className="btn-primary">
                    Browse Vehicles
                  </Link>
                  <button 
                    onClick={() => {
                      setSubmitted(false)
                      setFormData({ name: '', email: '', phone: '', subject: '', message: '' })
                    }}
                    className="btn-outline"
                  >
                    Send Another Message
                  </button>
                </div>
              </div>
            ) : (
              <div className="glass-card rounded-2xl p-8">
                <div className="flex items-center gap-3 mb-6">
                  <span className="w-1 h-8 bg-gradient-to-b from-[#118df0] to-[#0a6bc4] rounded-full"></span>
                  <h2 className="text-xl font-bold text-gray-900">Send Us a Message</h2>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Full Name *</label>
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
                      <label className="block text-sm font-medium text-gray-700 mb-2">Email Address *</label>
                      <input
                        type="email"
                        required
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="input-field"
                        placeholder="john@example.com"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="input-field"
                        placeholder="(416) 555-0123"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Subject</label>
                      <select
                        value={formData.subject}
                        onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                        className="select-field"
                      >
                        <option value="">Select a subject</option>
                        <option value="general">General Inquiry</option>
                        <option value="vehicle">Vehicle Question</option>
                        <option value="financing">Financing Question</option>
                        <option value="test-drive">Schedule Test Drive</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Message *</label>
                      <textarea
                        rows={6}
                        required
                        value={formData.message}
                        onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                        placeholder="How can we help you today?"
                        className="input-field resize-none"
                      ></textarea>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-gray-200/60">
                    <p className="text-sm text-gray-500 flex items-center gap-2">
                      <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                    Your information is secure and won&apos;t be shared
                    </p>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="btn-primary flex items-center gap-2 disabled:opacity-50 w-full sm:w-auto"
                    >
                      {submitting ? (
                        <>
                          <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Sending...
                        </>
                      ) : (
                        <>
                          Send Message
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                          </svg>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* FAQ Section */}

          </div>
        </div>
      </div>
    </div>
  )
}
