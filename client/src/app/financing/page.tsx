'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function FinancingPage() {
  const [formData, setFormData] = useState({
    // Personal Info (Clutch-style)
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    dateOfBirth: '',
    // Financial
    annualIncome: '',
    monthlyRent: '',
    // Address
    streetAddress: '',
    suiteUnit: '',
    city: '',
    province: '',
    postalCode: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target
    
    // Auto-uppercase postal code
    if (name === 'postalCode') {
      setFormData({
        ...formData,
        [name]: value.toUpperCase(),
      })
      return
    }
    
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    })
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
      const res = await fetch(`${API_URL}/api/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          phone: formData.phone,
          dateOfBirth: formData.dateOfBirth,
          annualIncome: formData.annualIncome ? parseFloat(formData.annualIncome) : null,
          monthlyRent: formData.monthlyRent ? parseFloat(formData.monthlyRent) : null,
          streetAddress: formData.streetAddress,
          suiteUnit: formData.suiteUnit,
          city: formData.city,
          province: formData.province,
          postalCode: formData.postalCode,
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
        <div className="glass-card rounded-2xl p-12 text-center max-w-lg">
          <div className="w-20 h-20 bg-gradient-to-br from-green-400 to-green-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-green-500/25">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Application Submitted!</h2>
          <p className="text-gray-600 mb-8 leading-relaxed">
            Thank you for your financing application. One of our finance specialists will review your information and contact you within <span className="font-semibold text-[#118df0]">24 hours</span>.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/inventory" className="btn-primary">
              Browse Vehicles
            </Link>
            <Link href="/" className="btn-outline">
              Return Home
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      {/* Hero Header */}
      <section className="relative overflow-hidden py-16 lg:py-20">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900"></div>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-[#118df0]/20 via-transparent to-transparent"></div>
        <div className="absolute top-10 right-10 w-72 h-72 bg-[#118df0]/10 rounded-full blur-3xl"></div>
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <span className="badge mb-4 bg-white/10 border-white/20 text-white/90">
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              Secure Application
            </span>
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4">
              Get <span className="gradient-text">Pre-Approved</span> Today
            </h1>
            <p className="text-slate-300 text-lg max-w-2xl mx-auto">
              All credit situations welcome! Fill out our secure application and get a response within 24 hours.
            </p>
          </div>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Benefits */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="glass-card rounded-xl p-6 text-center group hover:shadow-lg transition-shadow">
            <div className="icon-container mx-auto mb-4 group-hover:scale-110 transition-transform">
              <svg className="w-6 h-6 text-[#118df0]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Quick Response</h3>
            <p className="text-gray-500 text-sm">Get a decision within 24 hours</p>
          </div>
          <div className="glass-card rounded-xl p-6 text-center group hover:shadow-lg transition-shadow">
            <div className="icon-container mx-auto mb-4 group-hover:scale-110 transition-transform">
              <svg className="w-6 h-6 text-[#118df0]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Secure Application</h3>
            <p className="text-gray-500 text-sm">Your information is protected</p>
          </div>
          <div className="glass-card rounded-xl p-6 text-center group hover:shadow-lg transition-shadow">
            <div className="icon-container mx-auto mb-4 group-hover:scale-110 transition-transform">
              <svg className="w-6 h-6 text-[#118df0]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
              </svg>
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">All Credit Welcome</h3>
            <p className="text-gray-500 text-sm">We work with all credit types</p>
          </div>
        </div>

        {/* Application Form */}
        <form onSubmit={handleSubmit} className="glass-card rounded-2xl p-8">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-center gap-3">
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </div>
          )}

          {/* Section 1: Personal Information */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 rounded-full bg-[#118df0] text-white flex items-center justify-center text-sm font-semibold">1</div>
              <h2 className="text-lg font-semibold text-gray-900">Personal Information</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">First Name *</label>
                <input
                  type="text"
                  name="firstName"
                  required
                  value={formData.firstName}
                  onChange={handleChange}
                  className="input-field"
                  placeholder="John"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Last Name *</label>
                <input
                  type="text"
                  name="lastName"
                  required
                  value={formData.lastName}
                  onChange={handleChange}
                  className="input-field"
                  placeholder="Smith"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email *</label>
                <input
                  type="email"
                  name="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  className="input-field"
                  placeholder="john@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Phone *</label>
                <input
                  type="tel"
                  name="phone"
                  required
                  value={formData.phone}
                  onChange={handleChange}
                  className="input-field"
                  placeholder="(416) 555-0123"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Date of Birth *</label>
                <input
                  type="date"
                  name="dateOfBirth"
                  required
                  value={formData.dateOfBirth}
                  onChange={handleChange}
                  className="input-field"
                />
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-200 my-8"></div>

          {/* Section 2: Financial Information */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 rounded-full bg-[#118df0] text-white flex items-center justify-center text-sm font-semibold">2</div>
              <h2 className="text-lg font-semibold text-gray-900">Financial Information</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Total Gross Annual Income (before tax) *</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-medium z-10 pointer-events-none">$</span>
                  <input
                    type="number"
                    name="annualIncome"
                    required
                    min="0"
                    step="1"
                    value={formData.annualIncome}
                    onChange={handleChange}
                    onKeyDown={handleMoneyKeyDown}
                    placeholder="50000"
                    className="input-field !pl-8"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Monthly Rent/Mortgage *</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-medium z-10 pointer-events-none">$</span>
                  <input
                    type="number"
                    name="monthlyRent"
                    required
                    min="0"
                    step="1"
                    value={formData.monthlyRent}
                    onChange={handleChange}
                    onKeyDown={handleMoneyKeyDown}
                    placeholder="1500"
                    className="input-field !pl-8"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-200 my-8"></div>

          {/* Section 3: Address Information */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 rounded-full bg-[#118df0] text-white flex items-center justify-center text-sm font-semibold">3</div>
              <h2 className="text-lg font-semibold text-gray-900">Address Information</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Street Address *</label>
                <input
                  type="text"
                  name="streetAddress"
                  required
                  value={formData.streetAddress}
                  onChange={handleChange}
                  className="input-field"
                  placeholder="123 Main Street"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Suite/Unit (optional)</label>
                <input
                  type="text"
                  name="suiteUnit"
                  value={formData.suiteUnit}
                  onChange={handleChange}
                  className="input-field"
                  placeholder="Unit 4B"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">City *</label>
                <input
                  type="text"
                  name="city"
                  required
                  value={formData.city}
                  onChange={handleChange}
                  className="input-field"
                  placeholder="Toronto"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Province *</label>
                <select
                  name="province"
                  required
                  value={formData.province}
                  onChange={handleChange}
                  className="select-field"
                >
                  <option value="">Select Province</option>
                  <option value="AB">Alberta</option>
                  <option value="BC">British Columbia</option>
                  <option value="MB">Manitoba</option>
                  <option value="NB">New Brunswick</option>
                  <option value="NL">Newfoundland and Labrador</option>
                  <option value="NS">Nova Scotia</option>
                  <option value="ON">Ontario</option>
                  <option value="PE">Prince Edward Island</option>
                  <option value="QC">Quebec</option>
                  <option value="SK">Saskatchewan</option>
                  <option value="NT">Northwest Territories</option>
                  <option value="NU">Nunavut</option>
                  <option value="YT">Yukon</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Postal Code *</label>
                <input
                  type="text"
                  name="postalCode"
                  required
                  value={formData.postalCode}
                  onChange={handleChange}
                  className="input-field"
                  placeholder="M5V 2T6"
                  pattern="[A-Za-z][0-9][A-Za-z] ?[0-9][A-Za-z][0-9]"
                />
              </div>
            </div>
          </div>

          {/* Privacy Notice */}
          <div className="bg-[#118df0]/5 border border-[#118df0]/20 rounded-xl p-4 mb-6 mt-8">
            <p className="text-sm text-gray-600 flex items-start gap-2">
              <svg className="w-5 h-5 text-[#118df0] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              By submitting this application, you agree to be contacted by Easy Drive Canada regarding financing options. Your information will be kept confidential.
            </p>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end pt-6 border-t border-gray-200/60">
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary flex items-center gap-2 disabled:opacity-50 w-full md:w-auto justify-center"
            >
              {submitting ? (
                <>
                  <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Submitting...
                </>
              ) : (
                <>
                  Submit Application
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
