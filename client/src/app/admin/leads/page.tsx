'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  BadgeCheck,
  Car,
  CheckCircle2,
  Clock3,
  Eye,
  Inbox,
  Mail,
  MessageSquare,
  Phone,
  Search,
  Trash2,
  UserRound,
  Users,
  X,
} from 'lucide-react'
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

type LeadRow = {
  id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
  vehicle_interest: string | null
  message: string | null
  employment_status: string | null
  monthly_income: number | null
  down_payment: number | null
  credit_score: string | null
  ghl_synced: boolean | null
  created_at: string
}

type FilterKey = 'all' | 'new' | 'synced' | 'finance' | 'insurance' | 'contact'
type SourceKey = 'finance' | 'insurance' | 'contact' | 'unknown'

const FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'new', label: 'New' },
  { key: 'synced', label: 'GHL Synced' },
  { key: 'finance', label: 'Finance' },
  { key: 'insurance', label: 'Insurance' },
  { key: 'contact', label: 'Contact' },
]

const clean = (value: unknown) => String(value ?? '').trim()

const parseMessageFields = (message: string | null) => {
  const rows: Array<{ label: string; value: string }> = []
  const notes: string[] = []

  clean(message)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      const match = line.match(/^([^:]+):\s*(.*)$/)
      if (!match) {
        notes.push(line)
        return
      }

      const label = clean(match[1])
      const value = clean(match[2])
      if (!label || !value || value === '-') return
      rows.push({ label, value })
    })

  return { rows, notes }
}

const sourceFromLead = (lead: Lead): SourceKey => {
  const { rows } = parseMessageFields(lead.message)
  const source = clean(rows.find((row) => row.label.toLowerCase() === 'source')?.value).toLowerCase()
  const message = clean(lead.message).toLowerCase()

  if (source.includes('insurance') || message.includes('license number')) return 'insurance'
  if (source.includes('finance') || source.includes('financing') || source.includes('easydrivefinance')) return 'finance'
  if (source.includes('contact')) return 'contact'
  return 'unknown'
}

const sourceLabel = (source: SourceKey) => {
  if (source === 'finance') return 'Finance'
  if (source === 'insurance') return 'Insurance'
  if (source === 'contact') return 'Contact'
  return 'Unknown'
}

const sourcePillClass = (source: SourceKey) => {
  if (source === 'finance') return 'bg-blue-50 text-blue-700 ring-blue-200'
  if (source === 'insurance') return 'bg-emerald-50 text-emerald-700 ring-emerald-200'
  if (source === 'contact') return 'bg-amber-50 text-amber-700 ring-amber-200'
  return 'bg-slate-100 text-slate-600 ring-slate-200'
}

const leadName = (lead: Lead) => [lead.firstName, lead.lastName].map(clean).filter(Boolean).join(' ') || 'Unnamed lead'

const leadInitials = (lead: Lead) => {
  const name = leadName(lead)
  const parts = name.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  return (parts[0]?.slice(0, 2) || 'LD').toUpperCase()
}

const formatDate = (dateStr: string) =>
  new Date(dateStr).toLocaleDateString('en-CA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

const isToday = (dateStr: string) => {
  const date = new Date(dateStr)
  const today = new Date()
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  )
}

const formatMoney = (value: number | null) => {
  if (value === null || !Number.isFinite(Number(value))) return ''
  return `$${Number(value).toLocaleString()}`
}

export default function AdminLeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 20
  const router = useRouter()

  useEffect(() => {
    const sessionStr = localStorage.getItem('edc_admin_session')
    if (!sessionStr) {
      router.push('/admin')
      return
    }
    void fetchLeads()
  }, [router])

  const fetchLeads = async () => {
    try {
      const { data, error } = await supabase
        .from('edc_leads')
        .select('id, first_name, last_name, email, phone, vehicle_interest, message, employment_status, monthly_income, down_payment, credit_score, ghl_synced, created_at')
        .order('created_at', { ascending: false })

      if (error) throw error

      const mapped: Lead[] = ((data || []) as LeadRow[]).map((l) => ({
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
    } catch (error) {
      console.error('Error fetching leads:', error)
      setLeads([])
    } finally {
      setLoading(false)
    }
  }

  const stats = useMemo(() => {
    const total = leads.length
    const synced = leads.filter((lead) => lead.ghlSynced).length
    const today = leads.filter((lead) => isToday(lead.createdAt)).length
    return {
      total,
      new: total - synced,
      synced,
      today,
    }
  }, [leads])

  const filteredLeads = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()

    return leads.filter((lead) => {
      const source = sourceFromLead(lead)
      const matchesFilter =
        activeFilter === 'all' ||
        (activeFilter === 'new' && !lead.ghlSynced) ||
        (activeFilter === 'synced' && lead.ghlSynced) ||
        activeFilter === source

      if (!matchesFilter) return false
      if (!query) return true

      const haystack = [
        lead.firstName,
        lead.lastName,
        leadName(lead),
        lead.email,
        lead.phone,
        lead.vehicleInterest,
        lead.message,
        sourceLabel(source),
        lead.employmentStatus,
        lead.creditScore,
      ]
        .map(clean)
        .join(' ')
        .toLowerCase()

      return haystack.includes(query)
    })
  }, [activeFilter, leads, searchQuery])

  useEffect(() => {
    setCurrentPage(1)
  }, [activeFilter, searchQuery])

  const paginatedLeads = filteredLeads.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )
  const totalPages = Math.max(1, Math.ceil(filteredLeads.length / itemsPerPage))

  const handleDelete = async (lead: Lead) => {
    if (!confirm(`Delete ${leadName(lead)}? This cannot be undone.`)) return

    try {
      const { error } = await supabase.from('edc_leads').delete().eq('id', lead.id)
      if (error) throw error
      setLeads((rows) => rows.filter((row) => row.id !== lead.id))
      setSelectedLead((current) => (current?.id === lead.id ? null : current))
    } catch (error) {
      console.error('Error deleting lead:', error)
    }
  }

  const selectedLeadFields = selectedLead ? parseMessageFields(selectedLead.message) : { rows: [], notes: [] }

  return (
    <div className="min-h-screen bg-slate-50/70">
      <div className="border-b border-slate-200 bg-white">
        <div className="px-6 py-6 lg:px-8">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-[#1EA7FF]/10 px-3 py-1 text-xs font-semibold text-[#0877bd] ring-1 ring-inset ring-[#1EA7FF]/20">
                <Inbox className="h-3.5 w-3.5" />
                Lead inbox
              </div>
              <h1 className="mt-3 text-2xl font-bold text-[#0B1F3A]">Leads & Inquiries</h1>
              <p className="mt-1 text-sm text-slate-500">Scan new submissions, identify source, and contact leads quickly.</p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:min-w-[520px]">
              <StatCard icon={Users} label="Total" value={stats.total} tone="slate" />
              <StatCard icon={Clock3} label="New" value={stats.new} tone="blue" />
              <StatCard icon={CheckCircle2} label="Synced" value={stats.synced} tone="emerald" />
              <StatCard icon={BadgeCheck} label="Today" value={stats.today} tone="amber" />
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 py-6 lg:px-8">
        <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="relative max-w-xl flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search name, email, phone, vehicle, source..."
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/70 pl-10 pr-4 text-sm text-slate-800 placeholder-slate-400 transition-all focus:border-[#1EA7FF]/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1EA7FF]/20"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {FILTERS.map((filter) => {
                const active = activeFilter === filter.key
                return (
                  <button
                    key={filter.key}
                    type="button"
                    onClick={() => setActiveFilter(filter.key)}
                    className={
                      active
                        ? 'h-9 rounded-xl bg-[#0B1F3A] px-3 text-xs font-semibold text-white shadow-sm'
                        : 'h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50'
                    }
                  >
                    {filter.label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <div className="flex gap-6">
          <div className="min-w-0 flex-1">
            {loading ? (
              <LoadingTable />
            ) : leads.length === 0 ? (
              <EmptyState
                icon={Inbox}
                title="No leads yet"
                body="Finance, insurance, and contact submissions will appear here when they arrive."
              />
            ) : filteredLeads.length === 0 ? (
              <EmptyState
                icon={Search}
                title="No matching leads"
                body="Try a different search term or clear the current filter."
              />
            ) : (
              <>
                <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card lg:block">
                  <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                    <div className="text-sm font-semibold text-slate-900">Showing {paginatedLeads.length} of {filteredLeads.length} leads</div>
                    <div className="text-xs text-slate-500">Sorted by newest first</div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="edc-table min-w-[980px]">
                      <thead>
                        <tr>
                          <th>Lead</th>
                          <th>Contact</th>
                          <th>Intent</th>
                          <th>Received</th>
                          <th>Status</th>
                          <th className="text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedLeads.map((lead) => (
                          <LeadRow
                            key={lead.id}
                            lead={lead}
                            selected={selectedLead?.id === lead.id}
                            onSelect={setSelectedLead}
                            onDelete={handleDelete}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="space-y-3 lg:hidden">
                  <div className="text-sm font-medium text-slate-500">Showing {paginatedLeads.length} of {filteredLeads.length} leads</div>
                  {paginatedLeads.map((lead) => (
                    <MobileLeadCard
                      key={lead.id}
                      lead={lead}
                      selected={selectedLead?.id === lead.id}
                      onSelect={setSelectedLead}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>

                {totalPages > 1 && (
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={setCurrentPage}
                  />
                )}
              </>
            )}
          </div>

          {selectedLead && (
            <aside className="hidden w-[400px] shrink-0 xl:block">
              <LeadDetailPanel
                lead={selectedLead}
                fields={selectedLeadFields}
                onClose={() => setSelectedLead(null)}
                onDelete={handleDelete}
              />
            </aside>
          )}
        </div>
      </div>

      {selectedLead && (
        <div className="fixed inset-0 z-50 flex items-end justify-center xl:hidden">
          <button
            type="button"
            aria-label="Close lead details"
            onClick={() => setSelectedLead(null)}
            className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm"
          />
          <div className="relative z-10 max-h-[90vh] w-full overflow-y-auto rounded-t-2xl bg-white shadow-premium sm:max-w-xl sm:rounded-2xl sm:mb-6">
            <LeadDetailPanel
              lead={selectedLead}
              fields={selectedLeadFields}
              onClose={() => setSelectedLead(null)}
              onDelete={handleDelete}
              compact
            />
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Users
  label: string
  value: number
  tone: 'slate' | 'blue' | 'emerald' | 'amber'
}) {
  const toneClass =
    tone === 'blue'
      ? 'bg-blue-50 text-blue-700'
      : tone === 'emerald'
        ? 'bg-emerald-50 text-emerald-700'
        : tone === 'amber'
          ? 'bg-amber-50 text-amber-700'
          : 'bg-slate-100 text-slate-700'

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-medium text-slate-500">{label}</div>
          <div className="mt-1 text-2xl font-bold text-slate-950">{value}</div>
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${toneClass}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  )
}

function LeadRow({
  lead,
  selected,
  onSelect,
  onDelete,
}: {
  lead: Lead
  selected: boolean
  onSelect: (lead: Lead) => void
  onDelete: (lead: Lead) => void
}) {
  const source = sourceFromLead(lead)

  return (
    <tr className={selected ? 'bg-[#1EA7FF]/5' : ''}>
      <td>
        <button type="button" onClick={() => onSelect(lead)} className="group flex min-w-0 items-center gap-3 text-left">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0B1F3A] text-xs font-bold text-white">
            {leadInitials(lead)}
          </span>
          <span className="min-w-0">
            <span className="block truncate font-semibold text-slate-900 group-hover:text-[#0877bd]">{leadName(lead)}</span>
            <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${sourcePillClass(source)}`}>
              {sourceLabel(source)}
            </span>
          </span>
        </button>
      </td>
      <td>
        <div className="space-y-1">
          {lead.email ? (
            <a href={`mailto:${lead.email}`} className="block truncate text-sm font-medium text-slate-800 hover:text-[#0877bd]">
              {lead.email}
            </a>
          ) : (
            <span className="text-sm text-slate-400">No email</span>
          )}
          {lead.phone ? (
            <a href={`tel:${lead.phone}`} className="block text-xs text-slate-500 hover:text-slate-800">
              {lead.phone}
            </a>
          ) : (
            <span className="block text-xs text-slate-400">No phone</span>
          )}
        </div>
      </td>
      <td>
        <div className="max-w-[280px]">
          <div className="truncate text-sm font-medium text-slate-800">{lead.vehicleInterest || intentFallback(lead)}</div>
          <div className="mt-1 truncate text-xs text-slate-500">{messagePreview(lead)}</div>
        </div>
      </td>
      <td>
        <div className="text-sm text-slate-600">{formatDate(lead.createdAt)}</div>
      </td>
      <td>
        <StatusBadge synced={lead.ghlSynced} />
      </td>
      <td>
        <div className="flex justify-end gap-1.5">
          <IconButton label="View details" onClick={() => onSelect(lead)} icon={Eye} />
          {lead.email ? <IconLink label="Email lead" href={`mailto:${lead.email}`} icon={Mail} /> : null}
          {lead.phone ? <IconLink label="Call lead" href={`tel:${lead.phone}`} icon={Phone} /> : null}
          <IconButton label="Delete lead" onClick={() => onDelete(lead)} icon={Trash2} danger />
        </div>
      </td>
    </tr>
  )
}

function MobileLeadCard({
  lead,
  selected,
  onSelect,
  onDelete,
}: {
  lead: Lead
  selected: boolean
  onSelect: (lead: Lead) => void
  onDelete: (lead: Lead) => void
}) {
  const source = sourceFromLead(lead)

  return (
    <div className={`rounded-2xl border bg-white p-4 shadow-card ${selected ? 'border-[#1EA7FF]' : 'border-slate-200'}`}>
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0B1F3A] text-xs font-bold text-white">
          {leadInitials(lead)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold text-slate-950">{leadName(lead)}</h3>
              <div className="mt-1 flex flex-wrap gap-1.5">
                <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${sourcePillClass(source)}`}>
                  {sourceLabel(source)}
                </span>
                <StatusBadge synced={lead.ghlSynced} />
              </div>
            </div>
            <div className="text-right text-[11px] text-slate-400">{formatDate(lead.createdAt)}</div>
          </div>

          <div className="mt-3 space-y-1 text-sm">
            {lead.email ? <a className="block truncate text-slate-800" href={`mailto:${lead.email}`}>{lead.email}</a> : null}
            {lead.phone ? <a className="block text-slate-500" href={`tel:${lead.phone}`}>{lead.phone}</a> : null}
            <div className="truncate text-slate-600">{lead.vehicleInterest || intentFallback(lead)}</div>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-4 overflow-hidden rounded-xl border border-slate-200">
        <ActionCell label="View" onClick={() => onSelect(lead)} icon={Eye} />
        <ActionCell label="Email" href={lead.email ? `mailto:${lead.email}` : undefined} icon={Mail} disabled={!lead.email} />
        <ActionCell label="Call" href={lead.phone ? `tel:${lead.phone}` : undefined} icon={Phone} disabled={!lead.phone} />
        <ActionCell label="Delete" onClick={() => onDelete(lead)} icon={Trash2} danger />
      </div>
    </div>
  )
}

function LeadDetailPanel({
  lead,
  fields,
  onClose,
  onDelete,
  compact = false,
}: {
  lead: Lead
  fields: { rows: Array<{ label: string; value: string }>; notes: string[] }
  onClose: () => void
  onDelete: (lead: Lead) => void
  compact?: boolean
}) {
  const source = sourceFromLead(lead)
  const sourceRows = fields.rows.filter((row) => row.label.toLowerCase() !== 'source')

  return (
    <div className={compact ? 'p-5' : 'sticky top-20 rounded-2xl border border-slate-200 bg-white p-5 shadow-card'}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#0B1F3A] text-sm font-bold text-white">
              {leadInitials(lead)}
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-base font-bold text-slate-950">{leadName(lead)}</h2>
              <div className="mt-1 flex flex-wrap gap-1.5">
                <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${sourcePillClass(source)}`}>
                  {sourceLabel(source)}
                </span>
                <StatusBadge synced={lead.ghlSynced} />
              </div>
            </div>
          </div>
        </div>
        <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close lead details">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2">
        <a href={lead.email ? `mailto:${lead.email}` : undefined} className={`edc-btn-primary h-10 text-xs ${lead.email ? '' : 'pointer-events-none opacity-50'}`}>
          <Mail className="h-4 w-4" />
          Email
        </a>
        <a href={lead.phone ? `tel:${lead.phone}` : undefined} className={`edc-btn-ghost h-10 text-xs ${lead.phone ? '' : 'pointer-events-none opacity-50'}`}>
          <Phone className="h-4 w-4" />
          Call
        </a>
      </div>

      <div className="mt-5 space-y-5">
        <DetailSection title="Contact" icon={UserRound}>
          <DetailRow label="Email" value={lead.email} href={lead.email ? `mailto:${lead.email}` : undefined} />
          <DetailRow label="Phone" value={lead.phone} href={lead.phone ? `tel:${lead.phone}` : undefined} />
          <DetailRow label="Received" value={formatDate(lead.createdAt)} />
        </DetailSection>

        <DetailSection title="Intent" icon={Car}>
          <DetailRow label="Vehicle interest" value={lead.vehicleInterest || intentFallback(lead)} />
          <DetailRow label="Employment" value={lead.employmentStatus} />
          <DetailRow label="Monthly income" value={formatMoney(lead.monthlyIncome)} />
          <DetailRow label="Down payment" value={formatMoney(lead.downPayment)} />
          <DetailRow label="Credit score" value={lead.creditScore} />
        </DetailSection>

        {(sourceRows.length > 0 || fields.notes.length > 0) && (
          <DetailSection title="Submitted details" icon={MessageSquare}>
            {sourceRows.map((row) => (
              <DetailRow key={`${row.label}-${row.value}`} label={row.label} value={row.value} />
            ))}
            {fields.notes.map((note, index) => (
              <DetailRow key={`${note}-${index}`} label={index === 0 ? 'Note' : `Note ${index + 1}`} value={note} />
            ))}
          </DetailSection>
        )}
      </div>

      <button type="button" onClick={() => onDelete(lead)} className="edc-btn-danger mt-6 h-10 w-full text-xs">
        <Trash2 className="h-4 w-4" />
        Delete lead
      </button>
    </div>
  )
}

function DetailSection({ title, icon: Icon, children }: { title: string; icon: typeof UserRound; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
        <Icon className="h-4 w-4 text-[#1EA7FF]" />
        {title}
      </div>
      <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-slate-50/50">
        {children}
      </div>
    </section>
  )
}

function DetailRow({ label, value, href }: { label: string; value?: string | null; href?: string }) {
  const display = clean(value) || 'Not provided'
  return (
    <div className="grid grid-cols-[120px_1fr] gap-3 px-3 py-2.5 text-sm">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      {href && clean(value) ? (
        <a href={href} className="min-w-0 break-words font-medium text-[#0877bd] hover:underline">{display}</a>
      ) : (
        <div className={`min-w-0 break-words ${clean(value) ? 'font-medium text-slate-800' : 'text-slate-400'}`}>{display}</div>
      )}
    </div>
  )
}

function StatusBadge({ synced }: { synced: boolean }) {
  return synced ? (
    <span className="edc-badge-success">GHL Synced</span>
  ) : (
    <span className="edc-badge-neutral">New</span>
  )
}

function IconButton({
  label,
  onClick,
  icon: Icon,
  danger = false,
}: {
  label: string
  onClick: () => void
  icon: typeof Eye
  danger?: boolean
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
        danger ? 'text-red-500 hover:bg-red-50 hover:text-red-600' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
      }`}
    >
      <Icon className="h-4 w-4" />
    </button>
  )
}

function IconLink({ label, href, icon: Icon }: { label: string; href: string; icon: typeof Eye }) {
  return (
    <a
      title={label}
      aria-label={label}
      href={href}
      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
    >
      <Icon className="h-4 w-4" />
    </a>
  )
}

function ActionCell({
  label,
  icon: Icon,
  href,
  onClick,
  disabled = false,
  danger = false,
}: {
  label: string
  icon: typeof Eye
  href?: string
  onClick?: () => void
  disabled?: boolean
  danger?: boolean
}) {
  const className = `flex min-h-[48px] flex-col items-center justify-center gap-1 text-[11px] font-semibold transition-colors ${
    disabled
      ? 'cursor-not-allowed text-slate-300'
      : danger
        ? 'text-red-600 hover:bg-red-50'
        : 'text-slate-600 hover:bg-slate-50'
  }`
  const content = (
    <>
      <Icon className="h-4 w-4" />
      <span>{label}</span>
    </>
  )

  if (href && !disabled) {
    return <a href={href} className={className}>{content}</a>
  }

  return (
    <button type="button" onClick={onClick} disabled={disabled} className={className}>
      {content}
    </button>
  )
}

function Pagination({
  currentPage,
  totalPages,
  onPageChange,
}: {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
}) {
  return (
    <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-card sm:flex-row sm:items-center sm:justify-between">
      <div className="text-slate-500">Page {currentPage} of {totalPages}</div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => onPageChange(1)} disabled={currentPage === 1} className="edc-btn-ghost h-9 px-3 text-xs">First</button>
        <button type="button" onClick={() => onPageChange(Math.max(1, currentPage - 1))} disabled={currentPage === 1} className="edc-btn-ghost h-9 px-3 text-xs">Previous</button>
        <button type="button" onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages} className="edc-btn-ghost h-9 px-3 text-xs">Next</button>
        <button type="button" onClick={() => onPageChange(totalPages)} disabled={currentPage === totalPages} className="edc-btn-ghost h-9 px-3 text-xs">Last</button>
      </div>
    </div>
  )
}

function LoadingTable() {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
      <div className="border-b border-slate-100 px-4 py-3">
        <div className="h-4 w-40 rounded bg-slate-100 shimmer" />
      </div>
      <div className="divide-y divide-slate-100">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="grid grid-cols-[1.3fr_1.2fr_1.2fr_.8fr_.6fr] gap-4 px-4 py-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-slate-100 shimmer" />
              <div className="space-y-2">
                <div className="h-3 w-32 rounded bg-slate-100 shimmer" />
                <div className="h-3 w-16 rounded bg-slate-100 shimmer" />
              </div>
            </div>
            <div className="space-y-2">
              <div className="h-3 w-40 rounded bg-slate-100 shimmer" />
              <div className="h-3 w-24 rounded bg-slate-100 shimmer" />
            </div>
            <div className="h-3 w-44 rounded bg-slate-100 shimmer" />
            <div className="h-3 w-28 rounded bg-slate-100 shimmer" />
            <div className="h-6 w-16 rounded-full bg-slate-100 shimmer" />
          </div>
        ))}
      </div>
    </div>
  )
}

function EmptyState({ icon: Icon, title, body }: { icon: typeof Inbox; title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center shadow-card">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#1EA7FF]/10 text-[#0877bd]">
        <Icon className="h-7 w-7" />
      </div>
      <h3 className="mt-4 text-lg font-bold text-slate-950">{title}</h3>
      <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">{body}</p>
    </div>
  )
}

function intentFallback(lead: Lead) {
  const source = sourceFromLead(lead)
  if (source === 'finance') return 'Finance application'
  if (source === 'insurance') return 'Insurance quote'
  if (source === 'contact') return 'General inquiry'
  return 'No vehicle interest'
}

function messagePreview(lead: Lead) {
  const { rows, notes } = parseMessageFields(lead.message)
  const firstDetail = rows.find((row) => row.label.toLowerCase() !== 'source')
  return firstDetail ? `${firstDetail.label}: ${firstDetail.value}` : notes[0] || 'No submitted details'
}
