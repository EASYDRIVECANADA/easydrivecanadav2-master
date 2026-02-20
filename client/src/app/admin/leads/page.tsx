'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'

interface Lead {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string
  vehicleInterest: string | null
  message: string | null
  employmentStatus: string | null
  monthlyIncome: number | null
  downPayment: number | null
  creditScore: string | null
  ghlSynced: boolean
  createdAt: string
}

export default function AdminLeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [filteredLeads, setFilteredLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalLeads, setTotalLeads] = useState(0)
  const itemsPerPage = 20
  const router = useRouter()

  useEffect(() => {
    const sessionStr = localStorage.getItem('edc_admin_session')
    if (!sessionStr) {
      router.push('/admin')
      return
    }
    fetchLeads()
  }, [])

  const fetchLeads = async () => {
    try {
      const { data, error } = await supabase
        .from('edc_leads')
        .select('id, first_name, last_name, email, phone, vehicle_interest, message, employment_status, monthly_income, down_payment, credit_score, ghl_synced, created_at')
        .order('created_at', { ascending: false })

      if (error) throw error

      const mapped: Lead[] = (data || []).map((l: any) => ({
        id: l.id,
        firstName: l.first_name || '',
        lastName: l.last_name || '',
        email: l.email || '',
        phone: l.phone || '',
        vehicleInterest: l.vehicle_interest ?? null,
        message: l.message ?? null,
        employmentStatus: l.employment_status ?? null,
        monthlyIncome: l.monthly_income ?? null,
        downPayment: l.down_payment ?? null,
        creditScore: l.credit_score ?? null,
        ghlSynced: !!l.ghl_synced,
        createdAt: l.created_at,
      }))

      setLeads(mapped)
      setFilteredLeads(mapped)
      setTotalLeads(mapped.length)
    } catch (error) {
      console.error('Error fetching leads:', error)
      setLeads([])
      setFilteredLeads([])
      setTotalLeads(0)
    } finally {
      setLoading(false)
    }
  }

  // Search and filter leads
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredLeads(leads)
      setTotalLeads(leads.length)
      setCurrentPage(1)
      return
    }

    const query = searchQuery.toLowerCase()
    const filtered = leads.filter(lead => 
      lead.firstName.toLowerCase().includes(query) ||
      lead.lastName.toLowerCase().includes(query) ||
      lead.email.toLowerCase().includes(query) ||
      lead.phone?.toLowerCase().includes(query) ||
      lead.vehicleInterest?.toLowerCase().includes(query) ||
      `${lead.firstName} ${lead.lastName}`.toLowerCase().includes(query)
    )
    
    setFilteredLeads(filtered)
    setTotalLeads(filtered.length)
    setCurrentPage(1)
  }, [searchQuery, leads])

  // Get paginated leads
  const paginatedLeads = filteredLeads.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )
  
  const totalPages = Math.ceil(totalLeads / itemsPerPage)

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this lead?')) return

    try {
      const { error } = await supabase.from('edc_leads').delete().eq('id', id)
      if (error) throw error
      setLeads(leads.filter((l) => l.id !== id))
      setSelectedLead(null)
    } catch (error) {
      console.error('Error deleting lead:', error)
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-CA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="edc-page-header">
        <h1 className="text-2xl font-bold text-slate-900">Leads & Inquiries</h1>
      </div>

      <div className="px-6 py-6">
        {/* Search and Stats */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex-1 max-w-md">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, email, phone..."
                className="edc-input pl-10"
              />
              <svg 
                className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
          <div className="text-sm text-slate-500">
            Showing {paginatedLeads.length} of {totalLeads} leads
          </div>
        </div>

        <div className="flex gap-8">
          {/* Lead List */}
          <div className="flex-1">
            {loading ? (
              <div className="edc-card p-12 text-center">
                <div className="loading-ring mx-auto" />
                <p className="loading-text">Loading leads...</p>
              </div>
            ) : leads.length === 0 ? (
              <div className="edc-card p-12 text-center">
                <svg className="w-14 h-14 text-slate-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <h3 className="text-lg font-semibold text-slate-700 mb-1">No Leads Yet</h3>
                <p className="text-sm text-slate-500">Leads from the financing form and contact page will appear here.</p>
              </div>
            ) : filteredLeads.length === 0 ? (
              <div className="edc-card p-12 text-center">
                <svg className="w-14 h-14 text-slate-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <h3 className="text-lg font-semibold text-slate-700 mb-1">No Results Found</h3>
                <p className="text-sm text-slate-500">Try adjusting your search query.</p>
              </div>
            ) : (
              <>
                {/* Desktop Table View */}
                <div className="hidden lg:block edc-card overflow-hidden overflow-x-auto">
                  <table className="edc-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Contact</th>
                        <th>Vehicle Interest</th>
                        <th>Date</th>
                        <th>Status</th>
                        <th className="text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedLeads.map((lead) => (
                        <tr 
                          key={lead.id} 
                          className={`${selectedLead?.id === lead.id ? 'bg-cyan-50/50' : ''}`}
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="font-medium text-slate-800">
                              {lead.firstName} {lead.lastName}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-slate-700">{lead.email}</div>
                            <div className="text-sm text-slate-500">{lead.phone}</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-slate-700 max-w-xs truncate">
                              {lead.vehicleInterest || 'N/A'}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                            {formatDate(lead.createdAt)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {lead.ghlSynced ? (
                              <span className="px-2 py-1 text-xs font-medium bg-emerald-500/10 text-emerald-700 rounded-full">
                                GHL Synced
                              </span>
                            ) : (
                              <span className="edc-badge-neutral">
                                New
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <button
                              onClick={() => setSelectedLead(lead)}
                              className="text-cyan-600 hover:text-cyan-700 mr-3 transition-colors"
                            >
                              View
                            </button>
                            <button
                              onClick={() => handleDelete(lead.id)}
                              className="text-danger-500 hover:text-danger-600 transition-colors"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Card View */}
                <div className="lg:hidden space-y-3">
                  {paginatedLeads.map((lead) => (
                    <div 
                      key={lead.id} 
                      className={`bg-white rounded-xl shadow-sm border overflow-hidden ${
                        selectedLead?.id === lead.id ? 'border-blue-500' : 'border-gray-100'
                      }`}
                    >
                      {/* Card Content */}
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex-1">
                            <h3 className="font-semibold text-gray-900 text-base">
                              {lead.firstName} {lead.lastName}
                            </h3>
                            <div className="mt-1 space-y-0.5">
                              <a 
                                href={`mailto:${lead.email}`}
                                className="block text-sm text-cyan-600 hover:underline transition-colors"
                              >
                                {lead.email}
                              </a>
                              <a 
                                href={`tel:${lead.phone}`}
                                className="block text-sm text-gray-600"
                              >
                                {lead.phone}
                              </a>
                            </div>
                          </div>
                          {lead.ghlSynced ? (
                            <span className="flex-shrink-0 px-2 py-0.5 text-xs font-semibold bg-green-100 text-green-700 rounded-full">
                              GHL Synced
                            </span>
                          ) : (
                            <span className="flex-shrink-0 px-2 py-0.5 text-xs font-semibold bg-gray-100 text-gray-700 rounded-full">
                              New
                            </span>
                          )}
                        </div>

                        {lead.vehicleInterest && (
                          <div className="mb-2 text-sm text-gray-600">
                            <span className="font-medium">Interest:</span> {lead.vehicleInterest}
                          </div>
                        )}

                        <div className="text-xs text-gray-500">
                          {formatDate(lead.createdAt)}
                        </div>
                      </div>

                      {/* Action Bar */}
                      <div className="flex border-t border-gray-100 divide-x divide-gray-100">
                        <button
                          onClick={() => setSelectedLead(lead)}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium text-[#118df0] hover:bg-blue-50 active:bg-blue-100 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          View Details
                        </button>
                        <a
                          href={`mailto:${lead.email}`}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium text-gray-600 hover:bg-gray-50 active:bg-gray-100 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                          Email
                        </a>
                        <button
                          onClick={() => handleDelete(lead.id)}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium text-red-600 hover:bg-red-50 active:bg-red-100 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="edc-card px-4 py-3 flex items-center justify-between mt-5">
                    <div className="text-sm text-slate-600">
                      Page {currentPage} of {totalPages}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setCurrentPage(1)}
                        disabled={currentPage === 1}
                        className="px-3 py-1 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        First
                      </button>
                      <button
                        onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                        disabled={currentPage === 1}
                        className="px-3 py-1 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        Previous
                      </button>
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = currentPage - 2 + i;
                        }
                        return (
                          <button
                            key={i}
                            onClick={() => setCurrentPage(pageNum)}
                            className={`px-3 py-1 border rounded-lg text-sm font-medium transition-colors ${
                              currentPage === pageNum
                                ? 'bg-navy-900 text-white border-navy-900'
                                : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                      <button
                        onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                        disabled={currentPage === totalPages}
                        className="px-3 py-1 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        Next
                      </button>
                      <button
                        onClick={() => setCurrentPage(totalPages)}
                        disabled={currentPage === totalPages}
                        className="px-3 py-1 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        Last
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Lead Detail Sidebar */}
          {selectedLead && (
            <div className="hidden lg:block w-96 flex-shrink-0">
              <div className="edc-card p-6 sticky top-24">
                <div className="flex justify-between items-start mb-4">
                  <h2 className="text-lg font-bold text-slate-900">
                    {selectedLead.firstName} {selectedLead.lastName}
                  </h2>
                  <button
                    onClick={() => setSelectedLead(null)}
                    className="text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-gray-500">Email</label>
                    <p className="font-medium">
                      <a href={`mailto:${selectedLead.email}`} className="text-cyan-600 hover:underline transition-colors">
                        {selectedLead.email}
                      </a>
                    </p>
                  </div>

                  <div>
                    <label className="text-sm text-gray-500">Phone</label>
                    <p className="font-medium">
                      <a href={`tel:${selectedLead.phone}`} className="text-cyan-600 hover:underline transition-colors">
                        {selectedLead.phone}
                      </a>
                    </p>
                  </div>

                  {selectedLead.vehicleInterest && (
                    <div>
                      <label className="text-sm text-gray-500">Vehicle Interest</label>
                      <p className="font-medium">{selectedLead.vehicleInterest}</p>
                    </div>
                  )}

                  {selectedLead.employmentStatus && (
                    <div>
                      <label className="text-sm text-gray-500">Employment Status</label>
                      <p className="font-medium capitalize">{selectedLead.employmentStatus}</p>
                    </div>
                  )}

                  {selectedLead.monthlyIncome && (
                    <div>
                      <label className="text-sm text-gray-500">Monthly Income</label>
                      <p className="font-medium">${selectedLead.monthlyIncome.toLocaleString()}</p>
                    </div>
                  )}

                  {selectedLead.downPayment && (
                    <div>
                      <label className="text-sm text-gray-500">Down Payment</label>
                      <p className="font-medium">${selectedLead.downPayment.toLocaleString()}</p>
                    </div>
                  )}

                  {selectedLead.creditScore && (
                    <div>
                      <label className="text-sm text-gray-500">Credit Score</label>
                      <p className="font-medium capitalize">{selectedLead.creditScore}</p>
                    </div>
                  )}

                  {selectedLead.message && (
                    <div>
                      <label className="text-sm text-gray-500">Message</label>
                      <p className="text-gray-700 whitespace-pre-line">{selectedLead.message}</p>
                    </div>
                  )}

                  <div className="pt-4 border-t space-y-2">
                    <a
                      href={`mailto:${selectedLead.email}`}
                      className="edc-btn-primary w-full flex items-center justify-center"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      Send Email
                    </a>
                    <a
                      href={`tel:${selectedLead.phone}`}
                      className="edc-btn-ghost w-full flex items-center justify-center"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      Call
                    </a>
                    <button
                      onClick={() => handleDelete(selectedLead.id)}
                      className="edc-btn-danger w-full"
                    >
                      Delete Lead
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Mobile Lead Detail Modal */}
        {selectedLead && (
          <div className="lg:hidden fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
            <div className="edc-overlay absolute inset-0" onClick={() => setSelectedLead(null)} />
            <div className="relative bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-premium">
              <div className="sticky top-0 bg-white border-b border-slate-100 p-4 flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-900">
                  Lead Details
                </h2>
                <button
                  onClick={() => setSelectedLead(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="p-4 space-y-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    {selectedLead.firstName} {selectedLead.lastName}
                  </h3>
                </div>

                <div>
                  <label className="text-sm text-gray-500">Email</label>
                  <p className="font-medium">
                    <a href={`mailto:${selectedLead.email}`} className="text-cyan-600 hover:underline transition-colors">
                      {selectedLead.email}
                    </a>
                  </p>
                </div>

                <div>
                  <label className="text-sm text-gray-500">Phone</label>
                  <p className="font-medium">
                    <a href={`tel:${selectedLead.phone}`} className="text-cyan-600 hover:underline transition-colors">
                      {selectedLead.phone}
                    </a>
                  </p>
                </div>

                {selectedLead.vehicleInterest && (
                  <div>
                    <label className="text-sm text-gray-500">Vehicle Interest</label>
                    <p className="font-medium">{selectedLead.vehicleInterest}</p>
                  </div>
                )}

                {selectedLead.employmentStatus && (
                  <div>
                    <label className="text-sm text-gray-500">Employment Status</label>
                    <p className="font-medium capitalize">{selectedLead.employmentStatus}</p>
                  </div>
                )}

                {selectedLead.monthlyIncome && (
                  <div>
                    <label className="text-sm text-gray-500">Monthly Income</label>
                    <p className="font-medium">${selectedLead.monthlyIncome.toLocaleString()}</p>
                  </div>
                )}

                {selectedLead.downPayment && (
                  <div>
                    <label className="text-sm text-gray-500">Down Payment</label>
                    <p className="font-medium">${selectedLead.downPayment.toLocaleString()}</p>
                  </div>
                )}

                {selectedLead.creditScore && (
                  <div>
                    <label className="text-sm text-gray-500">Credit Score</label>
                    <p className="font-medium capitalize">{selectedLead.creditScore}</p>
                  </div>
                )}

                {selectedLead.message && (
                  <div>
                    <label className="text-sm text-gray-500">Message</label>
                    <p className="text-gray-700 whitespace-pre-line">{selectedLead.message}</p>
                  </div>
                )}

                <div className="pt-4 border-t space-y-2">
                  <a
                    href={`mailto:${selectedLead.email}`}
                    className="edc-btn-primary w-full flex items-center justify-center"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    Send Email
                  </a>
                  <a
                    href={`tel:${selectedLead.phone}`}
                    className="edc-btn-ghost w-full flex items-center justify-center"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                    Call
                  </a>
                  <button
                    onClick={() => {
                      handleDelete(selectedLead.id)
                      setSelectedLead(null)
                    }}
                    className="edc-btn-danger w-full"
                  >
                    Delete Lead
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
