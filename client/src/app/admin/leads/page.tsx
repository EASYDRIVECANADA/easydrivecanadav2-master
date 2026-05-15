'use client'

import { useEffect, useMemo, useState, type HTMLAttributes, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import {
  BadgeCheck,
  Car,
  CheckCircle2,
  Clock3,
  Eye,
  FileSpreadsheet,
  Inbox,
  Mail,
  MessageSquare,
  Phone,
  Plus,
  Search,
  Trash2,
  UploadCloud,
  UserRound,
  Users,
  X,
} from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { usePermissions } from '@/lib/permissions'

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
  adminNotes: string | null
  managerStatus: LeadManagerStatus | null
  userId: string | null
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
  admin_notes?: string | null
  manager_status?: string | null
  user_id?: string | null
  ghl_synced: boolean | null
  created_at: string
}

type FilterKey = 'finance' | 'insurance' | 'synced'
type SourceKey = 'finance' | 'insurance' | 'contact' | 'unknown'
type LeadDraftSource = SourceKey
type LeadManagerStatus = 'AWAITING DECISION' | 'DECLINED' | 'PENDING' | 'PENDING (BHPH)'

type LeadDraft = {
  firstName: string
  lastName: string
  email: string
  phone: string
  source: LeadDraftSource
  vehicleInterest: string
  employmentStatus: string
  monthlyIncome: string
  downPayment: string
  creditScore: string
  message: string
  adminNotes: string
  createdAt: string
}

const FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: 'finance', label: 'Credit Application' },
  { key: 'insurance', label: 'Insurance Application' },
  { key: 'synced', label: 'Handled' },
]

const BASE_LEAD_SELECT = 'id, first_name, last_name, email, phone, vehicle_interest, message, employment_status, monthly_income, down_payment, credit_score, ghl_synced, created_at'
const LEAD_SELECT_WITH_NOTES = `${BASE_LEAD_SELECT}, admin_notes`
const LEAD_SELECT_FULL = `${LEAD_SELECT_WITH_NOTES}, manager_status, user_id`
const MANAGER_STATUSES: LeadManagerStatus[] = ['AWAITING DECISION', 'PENDING', 'PENDING (BHPH)', 'DECLINED']

const clean = (value: unknown) => String(value ?? '').trim()

const emptyLeadDraft: LeadDraft = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  source: 'contact',
  vehicleInterest: '',
  employmentStatus: '',
  monthlyIncome: '',
  downPayment: '',
  creditScore: '',
  message: '',
  adminNotes: '',
  createdAt: '',
}

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
  const labels = rows.map((row) => row.label.toLowerCase())

  if (source.includes('insurance') || message.includes('license number')) return 'insurance'
  if (source.includes('finance') || source.includes('financing') || source.includes('easydrivefinance')) return 'finance'
  if (source.includes('contact')) return 'contact'
  if (labels.includes('subject') || labels.includes('message')) return 'contact'
  if (lead.message && !lead.vehicleInterest && !lead.employmentStatus && !lead.monthlyIncome && !lead.downPayment && !lead.creditScore) return 'contact'
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

const sourceMessageValue = (source: LeadDraftSource) => {
  if (source === 'finance') return 'Manual Finance'
  if (source === 'insurance') return 'Manual Insurance'
  if (source === 'contact') return 'Manual Contact'
  return 'Manual Entry'
}

const buildMessage = (rows: Array<[string, unknown]>) =>
  rows
    .map(([label, value]) => {
      const cleaned = clean(value)
      return cleaned ? `${label}: ${cleaned}` : ''
    })
    .filter(Boolean)
    .join('\n')

const toNumberOrNull = (value: unknown) => {
  const cleaned = clean(value).replace(/[$,\s]/g, '')
  if (!cleaned) return null
  const number = Number(cleaned)
  return Number.isFinite(number) ? number : null
}

const toDateIsoOrNull = (value: unknown) => {
  const cleaned = clean(value)
  if (!cleaned) return null
  const numeric = Number(cleaned)
  if (Number.isFinite(numeric) && numeric > 20000 && numeric < 80000) {
    return new Date(Math.round((numeric - 25569) * 86400 * 1000)).toISOString()
  }
  const date = new Date(cleaned)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

const normalizeHeader = (value: unknown) => clean(value).toLowerCase().replace(/[^a-z0-9]/g, '')

const pickImportValue = (row: Record<string, unknown>, aliases: string[]) => {
  const normalizedAliases = aliases.map(normalizeHeader)
  const entry = Object.entries(row).find(([key]) => normalizedAliases.includes(normalizeHeader(key)))
  return clean(entry?.[1])
}

const splitFullName = (fullName: string) => {
  const parts = clean(fullName).split(/\s+/).filter(Boolean)
  return {
    firstName: parts[0] || '',
    lastName: parts.slice(1).join(' '),
  }
}

const normalizeImportSource = (value: unknown): LeadDraftSource => {
  const source = clean(value).toLowerCase()
  if (source.includes('finance') || source.includes('financing')) return 'finance'
  if (source.includes('insurance')) return 'insurance'
  if (source.includes('contact')) return 'contact'
  return 'unknown'
}

const normalizeManagerStatus = (value: unknown): LeadManagerStatus | null => {
  const status = clean(value).toUpperCase()
  return MANAGER_STATUSES.includes(status as LeadManagerStatus) ? status as LeadManagerStatus : null
}

const mapLeadRow = (l: LeadRow): Lead => ({
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
  adminNotes: l.admin_notes ?? null,
  managerStatus: normalizeManagerStatus(l.manager_status),
  userId: l.user_id ?? null,
  ghlSynced: !!l.ghl_synced,
  createdAt: l.created_at,
})

const rowToLeadInsert = (draft: LeadDraft, notesEnabled: boolean, createdAt = new Date().toISOString(), userId?: string) => {
  const insert: Record<string, unknown> = {
    first_name: clean(draft.firstName) || null,
    last_name: clean(draft.lastName) || null,
    email: clean(draft.email).toLowerCase() || null,
    phone: clean(draft.phone) || null,
    vehicle_interest: clean(draft.vehicleInterest) || null,
    employment_status: clean(draft.employmentStatus) || null,
    monthly_income: toNumberOrNull(draft.monthlyIncome),
    down_payment: toNumberOrNull(draft.downPayment),
    credit_score: clean(draft.creditScore) || null,
    ghl_synced: false,
    created_at: toDateIsoOrNull(draft.createdAt) || createdAt,
    message: buildMessage([
      ['Source', sourceMessageValue(draft.source)],
      ['Message', draft.message],
    ]) || null,
  }

  if (userId) {
    insert.user_id = userId
  }

  if (notesEnabled) {
    insert.admin_notes = clean(draft.adminNotes) || null
  }

  return insert
}

export default function AdminLeadsPage() {
  const permissions = usePermissions()
  const canDeleteLeads = permissions.canDelete('customers')
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [notesDraft, setNotesDraft] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)
  const [notesEnabled, setNotesEnabled] = useState(true)
  const [notesSaveError, setNotesSaveError] = useState('')
  const [notesModalLead, setNotesModalLead] = useState<Lead | null>(null)
  const [tableNotesDraft, setTableNotesDraft] = useState('')
  const [savingTableNotes, setSavingTableNotes] = useState(false)
  const [tableNotesError, setTableNotesError] = useState('')
  const [statusModalLead, setStatusModalLead] = useState<Lead | null>(null)
  const [savingStatus, setSavingStatus] = useState(false)
  const [statusEnabled, setStatusEnabled] = useState(true)
  const [statusSaveError, setStatusSaveError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState<FilterKey>('finance')
  const [currentPage, setCurrentPage] = useState(1)
  const [newLeadOpen, setNewLeadOpen] = useState(false)
  const [leadDraft, setLeadDraft] = useState<LeadDraft>(emptyLeadDraft)
  const [savingLead, setSavingLead] = useState(false)
  const [leadFormError, setLeadFormError] = useState('')
  const [importOpen, setImportOpen] = useState(false)
  const [importRows, setImportRows] = useState<LeadDraft[]>([])
  const [importFileName, setImportFileName] = useState('')
  const [importError, setImportError] = useState('')
  const [importing, setImporting] = useState(false)
  const itemsPerPage = 20
  const router = useRouter()

  useEffect(() => {
    const sessionStr = localStorage.getItem('edc_admin_session')
    if (!sessionStr) {
      router.push('/admin')
      return
    }
    if (!permissions.loading) void fetchLeads()
  }, [permissions.loading, permissions.userId, permissions.permissions.access_all_leads_customers, router])

  const fetchLeads = async () => {
    try {
      const scopedUserId = permissions.userId
      const canViewAllLeadRows = permissions.canViewAll('leadsCustomers')
      if (!canViewAllLeadRows && !scopedUserId) {
        setLeads([])
        return
      }
      let query = supabase
        .from('edc_leads')
        .select(LEAD_SELECT_FULL)
        .order('created_at', { ascending: false })
      if (!canViewAllLeadRows && scopedUserId) {
        query = query.eq('user_id', scopedUserId)
      }
      let result = await query

      if (result.error && /manager_status|column|schema cache/i.test(result.error.message || '')) {
        setStatusEnabled(false)
        let fallbackQuery = supabase
          .from('edc_leads')
          .select(LEAD_SELECT_WITH_NOTES)
          .order('created_at', { ascending: false })
        if (!canViewAllLeadRows && scopedUserId) {
          fallbackQuery = fallbackQuery.eq('user_id', scopedUserId)
        }
        result = await fallbackQuery
      } else {
        setStatusEnabled(true)
      }

      if (result.error && /admin_notes|column|schema cache/i.test(result.error.message || '')) {
        setNotesEnabled(false)
        let baseQuery = supabase
          .from('edc_leads')
          .select(BASE_LEAD_SELECT)
          .order('created_at', { ascending: false })
        if (!canViewAllLeadRows && scopedUserId) {
          baseQuery = baseQuery.eq('user_id', scopedUserId)
        }
        result = await baseQuery
      } else if (!result.error) {
        setNotesEnabled(true)
      }

      const { data, error } = result
      if (error) throw error

      const mapped: Lead[] = ((data || []) as LeadRow[]).map(mapLeadRow)

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
        (activeFilter === 'synced' && lead.ghlSynced) ||
        (activeFilter === 'finance' && source === 'finance' && !lead.ghlSynced) ||
        (activeFilter === 'insurance' && source === 'insurance' && !lead.ghlSynced)

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
        lead.adminNotes,
        lead.managerStatus,
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

  useEffect(() => {
    setNotesDraft(selectedLead?.adminNotes || '')
    setNotesSaveError('')
  }, [selectedLead?.id, selectedLead?.adminNotes])

  useEffect(() => {
    setTableNotesDraft(notesModalLead?.adminNotes || '')
    setTableNotesError('')
  }, [notesModalLead?.id, notesModalLead?.adminNotes])

  const paginatedLeads = filteredLeads.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )
  const totalPages = Math.max(1, Math.ceil(filteredLeads.length / itemsPerPage))

  const handleDelete = async (lead: Lead) => {
    if (!canDeleteLeads) {
      alert('You do not have permission to delete leads.')
      return
    }
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

  const handleSaveNotes = async (lead: Lead) => {
    if (!notesEnabled) {
      setNotesSaveError('Apply the admin_notes database column before saving notes.')
      return
    }

    setSavingNotes(true)
    setNotesSaveError('')

    const nextNotes = notesDraft.trim() || null

    try {
      const { error } = await supabase
        .from('edc_leads')
        .update({ admin_notes: nextNotes })
        .eq('id', lead.id)

      if (error) throw error

      setLeads((rows) => rows.map((row) => (row.id === lead.id ? { ...row, adminNotes: nextNotes } : row)))
      setSelectedLead((current) => (current?.id === lead.id ? { ...current, adminNotes: nextNotes } : current))
    } catch (error) {
      console.error('Error saving lead notes:', error)
      setNotesSaveError('Unable to save notes. Check that admin_notes exists on edc_leads.')
    } finally {
      setSavingNotes(false)
    }
  }

  const handleSaveTableNotes = async (lead: Lead) => {
    if (!notesEnabled) {
      setTableNotesError('Apply the admin_notes database column before saving notes.')
      return
    }

    setSavingTableNotes(true)
    setTableNotesError('')

    const nextNotes = tableNotesDraft.trim() || null

    try {
      const { error } = await supabase
        .from('edc_leads')
        .update({ admin_notes: nextNotes })
        .eq('id', lead.id)

      if (error) throw error

      setLeads((rows) => rows.map((row) => (row.id === lead.id ? { ...row, adminNotes: nextNotes } : row)))
      setSelectedLead((current) => (current?.id === lead.id ? { ...current, adminNotes: nextNotes } : current))
      setNotesModalLead((current) => (current?.id === lead.id ? { ...current, adminNotes: nextNotes } : current))
    } catch (error) {
      console.error('Error saving lead notes:', error)
      setTableNotesError('Unable to save notes. Check that admin_notes exists on edc_leads.')
    } finally {
      setSavingTableNotes(false)
    }
  }

  const handleSaveStatus = async (lead: Lead, status: LeadManagerStatus | null) => {
    if (!statusEnabled) {
      setStatusSaveError('Apply the manager_status database column before updating lead status.')
      return
    }

    setSavingStatus(true)
    setStatusSaveError('')

    try {
      const { error } = await supabase
        .from('edc_leads')
        .update({ manager_status: status })
        .eq('id', lead.id)

      if (error) throw error

      setLeads((rows) => rows.map((row) => (row.id === lead.id ? { ...row, managerStatus: status } : row)))
      setSelectedLead((current) => (current?.id === lead.id ? { ...current, managerStatus: status } : current))
      setNotesModalLead((current) => (current?.id === lead.id ? { ...current, managerStatus: status } : current))
      setStatusModalLead((current) => (current?.id === lead.id ? { ...current, managerStatus: status } : current))
    } catch (error) {
      console.error('Error saving lead status:', error)
      setStatusSaveError('Unable to update status. Check that manager_status exists on edc_leads.')
    } finally {
      setSavingStatus(false)
    }
  }

  const resetLeadForm = () => {
    setLeadDraft(emptyLeadDraft)
    setLeadFormError('')
  }

  const handleCreateLead = async () => {
    if (!clean(leadDraft.firstName) && !clean(leadDraft.lastName) && !clean(leadDraft.email) && !clean(leadDraft.phone)) {
      setLeadFormError('Add at least a name, email, or phone number.')
      return
    }

    setSavingLead(true)
    setLeadFormError('')

    try {
      const insert = rowToLeadInsert(leadDraft, notesEnabled, new Date().toISOString(), permissions.userId)
      const { data, error } = await supabase
        .from('edc_leads')
        .insert(insert)
        .select(notesEnabled ? LEAD_SELECT_WITH_NOTES : BASE_LEAD_SELECT)
        .single()

      if (error) throw error

      const created = mapLeadRow(data as LeadRow)
      setLeads((rows) => [created, ...rows])
      setSelectedLead(created)
      setNewLeadOpen(false)
      resetLeadForm()
    } catch (error) {
      console.error('Error creating lead:', error)
      setLeadFormError('Unable to create lead. Check the lead fields and try again.')
    } finally {
      setSavingLead(false)
    }
  }

  const parseLeadImportFile = async (file: File) => {
    setImportFileName(file.name)
    setImportRows([])
    setImportError('')

    try {
      const XLSX = await import('xlsx-js-style')
      const extension = file.name.split('.').pop()?.toLowerCase()
      const workbook = extension === 'csv' || extension === 'tsv' || extension === 'txt'
        ? XLSX.read(await file.text(), { type: 'string' })
        : XLSX.read(await file.arrayBuffer(), { type: 'array' })
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })

      const drafts = rows
        .map((row) => {
          const fullName = pickImportValue(row, ['name', 'full name', 'customer', 'lead'])
          const splitName = splitFullName(fullName)
          const source = normalizeImportSource(pickImportValue(row, ['source', 'lead source', 'type', 'category']))
          const monthlyIncome = pickImportValue(row, ['monthly income', 'income monthly', 'monthly_income']) ||
            (() => {
              const annualIncome = toNumberOrNull(pickImportValue(row, ['annual income', 'gross annual income', 'income']))
              return annualIncome === null ? '' : String(Math.round(annualIncome / 12))
            })()

          return {
            firstName: pickImportValue(row, ['first name', 'firstname', 'first_name']) || splitName.firstName,
            lastName: pickImportValue(row, ['last name', 'lastname', 'last_name']) || splitName.lastName,
            email: pickImportValue(row, ['email', 'email address', 'e-mail']),
            phone: pickImportValue(row, ['phone', 'phone number', 'mobile', 'cell', 'telephone']),
            source,
            vehicleInterest: pickImportValue(row, ['vehicle interest', 'vehicle', 'car', 'vehicle_interest', 'interest']),
            employmentStatus: pickImportValue(row, ['employment', 'employment status', 'job status']),
            monthlyIncome,
            downPayment: pickImportValue(row, ['down payment', 'downpayment', 'desired down payment']),
            creditScore: pickImportValue(row, ['credit', 'credit score', 'credit profile']),
            message: pickImportValue(row, ['message', 'comments', 'comment', 'inquiry', 'details']),
            adminNotes: pickImportValue(row, ['notes', 'admin notes', 'internal notes', 'follow up notes']),
            createdAt: pickImportValue(row, ['date', 'created at', 'created_at', 'received', 'submitted', 'submitted at']),
          } satisfies LeadDraft
        })
        .filter((row) => clean(row.firstName) || clean(row.lastName) || clean(row.email) || clean(row.phone) || clean(row.message))

      if (drafts.length === 0) {
        setImportError('No usable lead rows found. Include at least name, email, phone, or message columns.')
        return
      }

      setImportRows(drafts)
    } catch (error) {
      console.error('Error parsing lead import:', error)
      setImportError('Unable to read this file. Try an .xlsx, .xls, .csv, .tsv, or .txt file.')
    }
  }

  const handleImportLeads = async () => {
    if (importRows.length === 0) {
      setImportError('Choose a file with lead rows before importing.')
      return
    }

    setImporting(true)
    setImportError('')

    try {
      const inserts = importRows.map((row) => rowToLeadInsert(row, notesEnabled, new Date().toISOString(), permissions.userId))
      const { data, error } = await supabase
        .from('edc_leads')
        .insert(inserts)
        .select(notesEnabled ? LEAD_SELECT_WITH_NOTES : BASE_LEAD_SELECT)

      if (error) throw error

      const imported = ((data || []) as LeadRow[]).map(mapLeadRow)
      setLeads((rows) => [...imported, ...rows])
      setImportOpen(false)
      setImportRows([])
      setImportFileName('')
      setActiveFilter('finance')
      setCurrentPage(1)
    } catch (error) {
      console.error('Error importing leads:', error)
      setImportError('Unable to import leads. Check the file columns and try again.')
    } finally {
      setImporting(false)
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
              <StatCard icon={CheckCircle2} label="Handled" value={stats.synced} tone="emerald" />
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

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setImportOpen(true)}
                className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50"
              >
                <UploadCloud className="h-4 w-4" />
                Import
              </button>
              <button
                type="button"
                onClick={() => {
                  resetLeadForm()
                  setNewLeadOpen(true)
                }}
                className="inline-flex h-9 items-center gap-2 rounded-xl bg-[#0B1F3A] px-3 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-[#12345d]"
              >
                <Plus className="h-4 w-4" />
                New lead
              </button>
              <div className="h-6 w-px bg-slate-200" />
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

        <div className="min-w-0">
          {loading ? (
            <LoadingTable />
          ) : leads.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title="No leads yet"
              body="New credit and insurance applications will appear here when they arrive."
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
                  <table className="edc-table min-w-[1120px]">
                    <thead>
                      <tr>
                        <th>Status</th>
                        <th>Received</th>
                        <th>Contact Name</th>
                        <th>Intent</th>
                        <th>Notes</th>
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
                          canDelete={canDeleteLeads}
                          onEditNotes={setNotesModalLead}
                          onEditStatus={setStatusModalLead}
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
                    canDelete={canDeleteLeads}
                    onEditNotes={setNotesModalLead}
                    onEditStatus={setStatusModalLead}
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
      </div>

      {selectedLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
          <button
            type="button"
            aria-label="Close lead details"
            onClick={() => setSelectedLead(null)}
            className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm"
          />
          <div className="relative z-10 max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-premium">
            <LeadDetailPanel
              lead={selectedLead}
              fields={selectedLeadFields}
              onClose={() => setSelectedLead(null)}
              onDelete={handleDelete}
              canDelete={canDeleteLeads}
              notesDraft={notesDraft}
              onNotesChange={setNotesDraft}
              onSaveNotes={handleSaveNotes}
              savingNotes={savingNotes}
              notesEnabled={notesEnabled}
              notesSaveError={notesSaveError}
            />
          </div>
        </div>
      )}

      {notesModalLead && (
        <LeadNotesModal
          lead={notesModalLead}
          value={tableNotesDraft}
          savedValue={notesModalLead.adminNotes || ''}
          onChange={setTableNotesDraft}
          onClose={() => setNotesModalLead(null)}
          onSave={() => handleSaveTableNotes(notesModalLead)}
          saving={savingTableNotes}
          enabled={notesEnabled}
          error={tableNotesError}
        />
      )}

      {statusModalLead && (
        <LeadStatusModal
          lead={statusModalLead}
          onClose={() => {
            setStatusModalLead(null)
            setStatusSaveError('')
          }}
          onSave={(status) => handleSaveStatus(statusModalLead, status)}
          saving={savingStatus}
          enabled={statusEnabled}
          error={statusSaveError}
        />
      )}

      {newLeadOpen && (
        <LeadFormModal
          draft={leadDraft}
          onChange={setLeadDraft}
          onClose={() => setNewLeadOpen(false)}
          onSubmit={handleCreateLead}
          submitting={savingLead}
          error={leadFormError}
          notesEnabled={notesEnabled}
        />
      )}

      {importOpen && (
        <LeadImportModal
          rows={importRows}
          fileName={importFileName}
          error={importError}
          importing={importing}
          onFile={parseLeadImportFile}
          onClose={() => setImportOpen(false)}
          onImport={handleImportLeads}
        />
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
  canDelete,
  onEditNotes,
  onEditStatus,
}: {
  lead: Lead
  selected: boolean
  onSelect: (lead: Lead) => void
  onDelete: (lead: Lead) => void
  canDelete: boolean
  onEditNotes: (lead: Lead) => void
  onEditStatus: (lead: Lead) => void
}) {
  const source = sourceFromLead(lead)

  return (
    <tr className={selected ? 'bg-[#1EA7FF]/5' : ''}>
      <td>
        <StatusBadge lead={lead} onClick={() => onEditStatus(lead)} />
      </td>
      <td>
        <div className="text-sm text-slate-600">{formatDate(lead.createdAt)}</div>
      </td>
      <td>
        <button type="button" onClick={() => onSelect(lead)} className="group flex min-w-0 items-center gap-3 text-left">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0B1F3A] text-xs font-bold text-white">
            {leadInitials(lead)}
          </span>
          <span className="min-w-0">
            <span className="block truncate font-semibold text-slate-900 group-hover:text-[#0877bd]">{leadName(lead)}</span>
            <span className="mt-1 block truncate text-xs text-slate-500">{lead.email || lead.phone || 'No contact info'}</span>
            <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${sourcePillClass(source)}`}>
              {sourceLabel(source)}
            </span>
          </span>
        </button>
      </td>
      <td>
        <div className="max-w-[280px]">
          <div className="truncate text-sm font-medium text-slate-800">{lead.vehicleInterest || intentFallback(lead)}</div>
          <div className="mt-1 truncate text-xs text-slate-500">{messagePreview(lead)}</div>
        </div>
      </td>
      <td>
        <NotesPreviewButton lead={lead} onClick={() => onEditNotes(lead)} />
      </td>
      <td>
        <div className="flex justify-end gap-1.5">
          <IconButton label="View details" onClick={() => onSelect(lead)} icon={Eye} />
          {lead.email ? <IconLink label="Email lead" href={`mailto:${lead.email}`} icon={Mail} /> : null}
          {lead.phone ? <IconLink label="Call lead" href={`tel:${lead.phone}`} icon={Phone} /> : null}
          {canDelete ? <IconButton label="Delete lead" onClick={() => onDelete(lead)} icon={Trash2} danger /> : null}
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
  canDelete,
  onEditNotes,
  onEditStatus,
}: {
  lead: Lead
  selected: boolean
  onSelect: (lead: Lead) => void
  onDelete: (lead: Lead) => void
  canDelete: boolean
  onEditNotes: (lead: Lead) => void
  onEditStatus: (lead: Lead) => void
}) {
  const source = sourceFromLead(lead)

  return (
    <div className={`rounded-2xl border bg-white p-4 shadow-card ${selected ? 'border-[#1EA7FF]' : 'border-slate-200'}`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <StatusBadge lead={lead} onClick={() => onEditStatus(lead)} />
        <div className="text-right text-[11px] font-medium text-slate-400">{formatDate(lead.createdAt)}</div>
      </div>
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
              </div>
            </div>
          </div>

          <div className="mt-3 space-y-1 text-sm">
            {lead.email ? <a className="block truncate text-slate-800" href={`mailto:${lead.email}`}>{lead.email}</a> : null}
            {lead.phone ? <a className="block text-slate-500" href={`tel:${lead.phone}`}>{lead.phone}</a> : null}
            <div className="truncate text-slate-600">{lead.vehicleInterest || intentFallback(lead)}</div>
          </div>
          <div className="mt-3">
            <NotesPreviewButton lead={lead} onClick={() => onEditNotes(lead)} />
          </div>
        </div>
      </div>

      <div className={`mt-4 grid ${canDelete ? 'grid-cols-4' : 'grid-cols-3'} overflow-hidden rounded-xl border border-slate-200`}>
        <ActionCell label="View" onClick={() => onSelect(lead)} icon={Eye} />
        <ActionCell label="Email" href={lead.email ? `mailto:${lead.email}` : undefined} icon={Mail} disabled={!lead.email} />
        <ActionCell label="Call" href={lead.phone ? `tel:${lead.phone}` : undefined} icon={Phone} disabled={!lead.phone} />
        {canDelete ? <ActionCell label="Delete" onClick={() => onDelete(lead)} icon={Trash2} danger /> : null}
      </div>
    </div>
  )
}

function NotesPreviewButton({ lead, onClick }: { lead: Lead; onClick: () => void }) {
  const hasNotes = !!clean(lead.adminNotes)

  return (
    <button
      type="button"
      onClick={onClick}
      title="Notes"
      className={`group flex w-full max-w-[260px] items-start gap-2 rounded-xl border px-3 py-2 text-left transition-colors ${
        hasNotes
          ? 'border-amber-200 bg-amber-50/70 hover:border-amber-300 hover:bg-amber-50'
          : 'border-dashed border-slate-200 bg-slate-50/70 hover:border-[#1EA7FF]/50 hover:bg-[#1EA7FF]/5'
      }`}
    >
      <MessageSquare className={`mt-0.5 h-4 w-4 shrink-0 ${hasNotes ? 'text-amber-600' : 'text-slate-400 group-hover:text-[#0877bd]'}`} />
      <span className="min-w-0">
        <span className={`block truncate text-xs font-medium ${hasNotes ? 'text-amber-800' : 'text-slate-400 group-hover:text-[#0877bd]'}`}>
          {hasNotes ? lead.adminNotes : 'No notes yet'}
        </span>
      </span>
    </button>
  )
}

function LeadFormModal({
  draft,
  onChange,
  onClose,
  onSubmit,
  submitting,
  error,
  notesEnabled,
}: {
  draft: LeadDraft
  onChange: (draft: LeadDraft) => void
  onClose: () => void
  onSubmit: () => void
  submitting: boolean
  error: string
  notesEnabled: boolean
}) {
  const setField = (field: keyof LeadDraft, value: string) => onChange({ ...draft, [field]: value })

  return (
    <ModalFrame maxWidth="max-w-4xl" onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          onSubmit()
        }}
        className="max-h-[92vh] overflow-y-auto"
      >
        <div className="border-b border-slate-200 bg-slate-50/70 p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-[#1EA7FF]/10 px-3 py-1 text-xs font-semibold text-[#0877bd] ring-1 ring-inset ring-[#1EA7FF]/20">
                <Plus className="h-3.5 w-3.5" />
                Manual entry
              </div>
              <h2 className="mt-3 text-xl font-bold text-slate-950">New lead</h2>
              <p className="mt-1 text-sm text-slate-500">Add a lead that came in by phone, walk-in, email, or an older list.</p>
            </div>
            <button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-white hover:text-slate-700" aria-label="Close new lead">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-2">
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <LeadInput label="First name" value={draft.firstName} onChange={(value) => setField('firstName', value)} />
              <LeadInput label="Last name" value={draft.lastName} onChange={(value) => setField('lastName', value)} />
              <LeadInput label="Email" value={draft.email} type="email" onChange={(value) => setField('email', value)} />
              <LeadInput label="Phone" value={draft.phone} type="tel" onChange={(value) => setField('phone', value)} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs font-semibold text-slate-600">Source</span>
                <select value={draft.source} onChange={(event) => setField('source', event.target.value)} className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-[#1EA7FF]/50 focus:ring-2 focus:ring-[#1EA7FF]/20">
                  <option value="contact">Contact</option>
                  <option value="finance">Finance</option>
                  <option value="insurance">Insurance</option>
                  <option value="unknown">Other</option>
                </select>
              </label>
              <LeadInput label="Received date" value={draft.createdAt} type="date" onChange={(value) => setField('createdAt', value)} />
            </div>

            <LeadInput label="Vehicle interest" value={draft.vehicleInterest} onChange={(value) => setField('vehicleInterest', value)} />

            <label className="block">
              <span className="text-xs font-semibold text-slate-600">Message</span>
              <textarea
                value={draft.message}
                onChange={(event) => setField('message', event.target.value)}
                rows={5}
                placeholder="What did the lead ask about?"
                className="mt-1 min-h-[120px] w-full resize-y rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-sm text-slate-800 outline-none focus:border-[#1EA7FF]/50 focus:bg-white focus:ring-2 focus:ring-[#1EA7FF]/20"
              />
            </label>
          </div>

          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <LeadInput label="Employment" value={draft.employmentStatus} onChange={(value) => setField('employmentStatus', value)} />
              <LeadInput label="Credit profile" value={draft.creditScore} onChange={(value) => setField('creditScore', value)} />
              <LeadInput label="Monthly income" value={draft.monthlyIncome} inputMode="decimal" onChange={(value) => setField('monthlyIncome', value)} />
              <LeadInput label="Down payment" value={draft.downPayment} inputMode="decimal" onChange={(value) => setField('downPayment', value)} />
            </div>

            <label className="block">
              <span className="text-xs font-semibold text-slate-600">Internal notes</span>
              <textarea
                value={draft.adminNotes}
                onChange={(event) => setField('adminNotes', event.target.value)}
                disabled={!notesEnabled}
                rows={6}
                placeholder={notesEnabled ? 'Follow-up notes for the team...' : 'Apply admin_notes SQL to enable notes.'}
                className="mt-1 min-h-[148px] w-full resize-y rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-sm text-slate-800 outline-none focus:border-[#1EA7FF]/50 focus:bg-white focus:ring-2 focus:ring-[#1EA7FF]/20 disabled:bg-slate-100 disabled:text-slate-400"
              />
            </label>

            {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-white p-4 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className="edc-btn-ghost h-10 px-4 text-xs">Cancel</button>
          <button type="submit" disabled={submitting} className="edc-btn-primary h-10 px-4 text-xs disabled:cursor-not-allowed disabled:opacity-50">
            {submitting ? 'Creating...' : 'Create lead'}
          </button>
        </div>
      </form>
    </ModalFrame>
  )
}

function LeadImportModal({
  rows,
  fileName,
  error,
  importing,
  onFile,
  onClose,
  onImport,
}: {
  rows: LeadDraft[]
  fileName: string
  error: string
  importing: boolean
  onFile: (file: File) => void
  onClose: () => void
  onImport: () => void
}) {
  return (
    <ModalFrame maxWidth="max-w-4xl" onClose={onClose}>
      <div className="max-h-[92vh] overflow-y-auto">
        <div className="border-b border-slate-200 bg-slate-50/70 p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-[#1EA7FF]/10 px-3 py-1 text-xs font-semibold text-[#0877bd] ring-1 ring-inset ring-[#1EA7FF]/20">
                <FileSpreadsheet className="h-3.5 w-3.5" />
                Lead import
              </div>
              <h2 className="mt-3 text-xl font-bold text-slate-950">Import old leads</h2>
              <p className="mt-1 text-sm text-slate-500">Upload Excel, CSV, TSV, or text files. Common columns are mapped automatically.</p>
            </div>
            <button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-white hover:text-slate-700" aria-label="Close import">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="space-y-5 p-5 sm:p-6">
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 px-6 py-8 text-center transition-colors hover:border-[#1EA7FF]/60 hover:bg-[#1EA7FF]/5">
            <UploadCloud className="h-8 w-8 text-[#0877bd]" />
            <span className="mt-3 text-sm font-semibold text-slate-900">{fileName || 'Choose an Excel or CSV file'}</span>
            <span className="mt-1 text-xs text-slate-500">Supported: .xlsx, .xls, .csv, .tsv, .txt</span>
            <input
              type="file"
              accept=".xlsx,.xls,.csv,.tsv,.txt"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) void onFile(file)
              }}
            />
          </label>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-sm font-semibold text-slate-900">Recognized columns</div>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Name, first name, last name, email, phone, source, vehicle, message, notes, employment, monthly income, annual income, down payment, credit, and date.
            </p>
          </div>

          {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}

          {rows.length > 0 && (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                <div className="text-sm font-semibold text-slate-900">{rows.length} leads ready to import</div>
                <div className="text-xs text-slate-500">Previewing first 5</div>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-bold uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Name</th>
                      <th className="px-4 py-3">Contact</th>
                      <th className="px-4 py-3">Source</th>
                      <th className="px-4 py-3">Intent</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.slice(0, 5).map((row, index) => (
                      <tr key={`${row.email}-${row.phone}-${index}`}>
                        <td className="px-4 py-3 font-medium text-slate-900">{[row.firstName, row.lastName].map(clean).filter(Boolean).join(' ') || 'Unnamed lead'}</td>
                        <td className="px-4 py-3 text-slate-600">
                          <div>{row.email || 'No email'}</div>
                          <div className="text-xs text-slate-400">{row.phone || 'No phone'}</div>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{sourceLabel(row.source)}</td>
                        <td className="px-4 py-3 text-slate-600">{row.vehicleInterest || row.message || 'No details'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-white p-4 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className="edc-btn-ghost h-10 px-4 text-xs">Cancel</button>
          <button type="button" onClick={onImport} disabled={rows.length === 0 || importing} className="edc-btn-primary h-10 px-4 text-xs disabled:cursor-not-allowed disabled:opacity-50">
            {importing ? 'Importing...' : `Import ${rows.length || ''} leads`}
          </button>
        </div>
      </div>
    </ModalFrame>
  )
}

function LeadNotesModal({
  lead,
  value,
  savedValue,
  onChange,
  onClose,
  onSave,
  saving,
  enabled,
  error,
}: {
  lead: Lead
  value: string
  savedValue: string
  onChange: (value: string) => void
  onClose: () => void
  onSave: () => void
  saving: boolean
  enabled: boolean
  error: string
}) {
  const isDirty = value.trim() !== savedValue.trim()

  return (
    <ModalFrame maxWidth="max-w-2xl" onClose={onClose}>
      <div className="max-h-[92vh] overflow-y-auto">
        <div className="border-b border-slate-200 bg-slate-50/70 p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-200">
                <MessageSquare className="h-3.5 w-3.5" />
                Lead notes
              </div>
              <h2 className="mt-3 truncate text-xl font-bold text-slate-950">{leadName(lead)}</h2>
              <p className="mt-1 text-sm text-slate-500">Quickly capture follow-up details for this lead.</p>
            </div>
            <button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-white hover:text-slate-700" aria-label="Close notes">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="space-y-4 p-5 sm:p-6">
          <textarea
            value={value}
            onChange={(event) => onChange(event.target.value)}
            disabled={!enabled}
            autoFocus
            rows={9}
            placeholder={enabled ? 'Add notes, next steps, call outcome, or reminders...' : 'Apply the admin_notes database column to enable lead notes.'}
            className="min-h-[220px] w-full resize-y rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-3 text-sm text-slate-800 outline-none transition focus:border-[#1EA7FF]/50 focus:bg-white focus:ring-2 focus:ring-[#1EA7FF]/20 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
          />
          <div className="flex items-center justify-between gap-3 text-xs">
            <span className={error ? 'text-red-600' : 'text-slate-400'}>
              {error || (isDirty ? 'Unsaved changes' : value.trim() ? 'Notes saved' : 'No notes yet')}
            </span>
            <span className="shrink-0 text-slate-400">{value.length} chars</span>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-white p-4 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className="edc-btn-ghost h-10 px-4 text-xs">Cancel</button>
          <button
            type="button"
            onClick={onSave}
            disabled={!enabled || !isDirty || saving}
            className="edc-btn-primary h-10 px-4 text-xs disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save notes'}
          </button>
        </div>
      </div>
    </ModalFrame>
  )
}

function LeadStatusModal({
  lead,
  onClose,
  onSave,
  saving,
  enabled,
  error,
}: {
  lead: Lead
  onClose: () => void
  onSave: (status: LeadManagerStatus | null) => void
  saving: boolean
  enabled: boolean
  error: string
}) {
  const [selectedStatus, setSelectedStatus] = useState<LeadManagerStatus | null>(lead.managerStatus)

  return (
    <ModalFrame maxWidth="max-w-md" onClose={onClose}>
      <div className="max-h-[92vh] overflow-y-auto">
        <div className="border-b border-slate-200 bg-slate-50/70 p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-xs font-semibold text-slate-500">Lead status</div>
              <h2 className="mt-1 truncate text-lg font-bold text-slate-950">{leadName(lead)}</h2>
            </div>
            <button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-white hover:text-slate-700" aria-label="Close status">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="space-y-3 p-5">
          {MANAGER_STATUSES.map((status) => {
            const checked = selectedStatus === status
            return (
              <label key={status} className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50">
                <span className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => setSelectedStatus(checked ? null : status)}
                    className="h-4 w-4 accent-[#0B1F3A]"
                  />
                  {status}
                </span>
                <span className={`h-2.5 w-2.5 rounded-full ${managerStatusClass(status).split(' ')[0]}`} />
              </label>
            )
          })}

          <button
            type="button"
            onClick={() => setSelectedStatus(null)}
            className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50"
          >
            Clear status
          </button>

          {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
          {!enabled ? <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">Apply the manager_status database column to enable status updates.</div> : null}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 bg-white p-4">
          <button type="button" onClick={onClose} className="edc-btn-ghost h-10 px-4 text-xs">Cancel</button>
          <button
            type="button"
            onClick={() => onSave(selectedStatus)}
            disabled={!enabled || saving}
            className="edc-btn-primary h-10 px-4 text-xs disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Apply'}
          </button>
        </div>
      </div>
    </ModalFrame>
  )
}

function LeadInput({
  label,
  value,
  onChange,
  type = 'text',
  inputMode,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  inputMode?: HTMLAttributes<HTMLInputElement>['inputMode']
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-slate-600">{label}</span>
      <input
        type={type}
        inputMode={inputMode}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 text-sm text-slate-800 outline-none transition focus:border-[#1EA7FF]/50 focus:bg-white focus:ring-2 focus:ring-[#1EA7FF]/20"
      />
    </label>
  )
}

function ModalFrame({ children, maxWidth, onClose }: { children: ReactNode; maxWidth: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
      <button
        type="button"
        aria-label="Close modal"
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm"
      />
      <div className={`relative z-10 max-h-[92vh] w-full ${maxWidth} overflow-hidden rounded-2xl bg-white shadow-premium`}>
        {children}
      </div>
    </div>
  )
}

function LeadDetailPanel({
  lead,
  fields,
  onClose,
  onDelete,
  canDelete,
  notesDraft,
  onNotesChange,
  onSaveNotes,
  savingNotes,
  notesEnabled,
  notesSaveError,
}: {
  lead: Lead
  fields: { rows: Array<{ label: string; value: string }>; notes: string[] }
  onClose: () => void
  onDelete: (lead: Lead) => void
  canDelete: boolean
  notesDraft: string
  onNotesChange: (value: string) => void
  onSaveNotes: (lead: Lead) => void
  savingNotes: boolean
  notesEnabled: boolean
  notesSaveError: string
}) {
  const source = sourceFromLead(lead)
  const sourceRows = fields.rows.filter((row) => row.label.toLowerCase() !== 'source')
  const primaryIntent = lead.vehicleInterest || intentFallback(lead)

  return (
    <div className="max-h-[92vh] overflow-y-auto">
      <div className="border-b border-slate-200 bg-slate-50/70 p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#0B1F3A] text-sm font-bold text-white shadow-sm">
              {leadInitials(lead)}
            </div>
            <div className="min-w-0 pt-0.5">
              <h2 className="break-words text-lg font-bold leading-tight text-slate-950">{leadName(lead)}</h2>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${sourcePillClass(source)}`}>
                  {sourceLabel(source)}
                </span>
                <ManagerStatusPill lead={lead} />
              </div>
            </div>
          </div>
          <button type="button" onClick={onClose} className="shrink-0 rounded-xl p-2 text-slate-400 transition-colors hover:bg-white hover:text-slate-700" aria-label="Close lead details">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <div className="text-[11px] font-semibold uppercase text-slate-400">Intent</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">{primaryIntent}</div>
            <div className="mt-1 text-xs text-slate-500">Received {formatDate(lead.createdAt)}</div>
          </div>
          <div className="grid grid-cols-2 gap-2 lg:w-[280px]">
            <a href={lead.email ? `mailto:${lead.email}` : undefined} className={`edc-btn-primary h-10 text-xs ${lead.email ? '' : 'pointer-events-none opacity-50'}`}>
            <Mail className="h-4 w-4" />
            Email lead
            </a>
            <a href={lead.phone ? `tel:${lead.phone}` : undefined} className={`edc-btn-ghost h-10 bg-white text-xs ${lead.phone ? '' : 'pointer-events-none opacity-50'}`}>
              <Phone className="h-4 w-4" />
              Call
            </a>
          </div>
        </div>
      </div>

      <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)]">
        <div className="space-y-5">
          <div className="grid gap-5 md:grid-cols-2">
            <DetailSection title="Contact" icon={UserRound}>
              <DetailRow label="Email" value={lead.email} href={lead.email ? `mailto:${lead.email}` : undefined} />
              <DetailRow label="Phone" value={lead.phone} href={lead.phone ? `tel:${lead.phone}` : undefined} />
              <DetailRow label="Received" value={formatDate(lead.createdAt)} />
            </DetailSection>

            <DetailSection title="Intent" icon={Car}>
              <DetailRow label="Vehicle" value={primaryIntent} />
              <DetailRow label="Employment" value={lead.employmentStatus} />
              <DetailRow label="Income" value={formatMoney(lead.monthlyIncome)} />
              <DetailRow label="Down payment" value={formatMoney(lead.downPayment)} />
              <DetailRow label="Credit" value={lead.creditScore} />
            </DetailSection>
          </div>

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

        <div className="space-y-5">
          <LeadNotesSection
            value={notesDraft}
            savedValue={lead.adminNotes || ''}
            onChange={onNotesChange}
            onSave={() => onSaveNotes(lead)}
            saving={savingNotes}
            enabled={notesEnabled}
            error={notesSaveError}
          />

          <DetailSection title="Quick actions" icon={Eye}>
            <div className="grid gap-2 p-3">
              <a href={lead.email ? `mailto:${lead.email}` : undefined} className={`edc-btn-primary h-10 text-xs ${lead.email ? '' : 'pointer-events-none opacity-50'}`}>
                <Mail className="h-4 w-4" />
                Email lead
              </a>
              <a href={lead.phone ? `tel:${lead.phone}` : undefined} className={`edc-btn-ghost h-10 text-xs ${lead.phone ? '' : 'pointer-events-none opacity-50'}`}>
                <Phone className="h-4 w-4" />
                Call lead
              </a>
              {canDelete ? (
                <button type="button" onClick={() => onDelete(lead)} className="edc-btn-danger h-10 w-full text-xs">
                  <Trash2 className="h-4 w-4" />
                  Delete lead
                </button>
              ) : null}
            </div>
          </DetailSection>
        </div>
      </div>
    </div>
  )
}

function LeadNotesSection({
  value,
  savedValue,
  onChange,
  onSave,
  saving,
  enabled,
  error,
}: {
  value: string
  savedValue: string
  onChange: (value: string) => void
  onSave: () => void
  saving: boolean
  enabled: boolean
  error: string
}) {
  const isDirty = value.trim() !== savedValue.trim()

  return (
    <section>
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[11px] font-bold uppercase text-slate-500">
          <MessageSquare className="h-4 w-4 text-[#1EA7FF]" />
          Notes
        </div>
        <button
          type="button"
          onClick={onSave}
          disabled={!enabled || !isDirty || saving}
          className="h-8 rounded-lg bg-[#0B1F3A] px-3 text-xs font-semibold text-white transition-colors hover:bg-[#12345d] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-3">
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={!enabled}
          rows={5}
          placeholder={enabled ? 'Add internal notes for this lead...' : 'Apply the admin_notes database column to enable lead notes.'}
          className="min-h-[112px] w-full resize-y rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-[#1EA7FF]/50 focus:bg-white focus:ring-2 focus:ring-[#1EA7FF]/20 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
        />
        <div className="mt-2 flex items-center justify-between gap-3 text-xs">
          <span className={error ? 'text-red-600' : 'text-slate-400'}>
            {error || (isDirty ? 'Unsaved changes' : value.trim() ? 'Notes saved' : 'No notes yet')}
          </span>
          <span className="shrink-0 text-slate-400">{value.length} chars</span>
        </div>
      </div>
    </section>
  )
}

function DetailSection({ title, icon: Icon, children }: { title: string; icon: typeof UserRound; children: ReactNode }) {
  return (
    <section>
      <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase text-slate-500">
        <Icon className="h-4 w-4 text-[#1EA7FF]" />
        {title}
      </div>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {children}
      </div>
    </section>
  )
}

function DetailRow({ label, value, href }: { label: string; value?: string | null; href?: string }) {
  const display = clean(value) || 'Not provided'
  return (
    <div className="grid grid-cols-[112px_1fr] gap-3 border-b border-slate-100 px-3 py-3 text-sm last:border-b-0">
      <div className="text-xs font-medium leading-5 text-slate-500">{label}</div>
      {href && clean(value) ? (
        <a href={href} className="min-w-0 break-words font-medium text-[#0877bd] hover:underline">{display}</a>
      ) : (
        <div className={`min-w-0 break-words leading-5 ${clean(value) ? 'font-medium text-slate-800' : 'text-slate-400'}`}>{display}</div>
      )}
    </div>
  )
}

const managerStatusClass = (status: LeadManagerStatus | null) => {
  if (status === 'DECLINED') return 'bg-red-500 text-white ring-red-400'
  if (status === 'PENDING') return 'bg-amber-400 text-slate-950 ring-amber-300'
  if (status === 'PENDING (BHPH)') return 'bg-orange-500 text-white ring-orange-400'
  if (status === 'AWAITING DECISION') return 'bg-sky-500 text-white ring-sky-400'
  return 'bg-emerald-500 text-white ring-emerald-400'
}

function ManagerStatusPill({ lead }: { lead: Lead }) {
  const label = lead.managerStatus || (lead.ghlSynced ? 'Handled' : 'New')
  const className = lead.managerStatus
    ? managerStatusClass(lead.managerStatus)
    : lead.ghlSynced
      ? 'bg-slate-100 text-slate-600 ring-slate-200'
      : managerStatusClass(null)

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold shadow-sm ring-1 ring-inset ${className}`}>
      {label}
    </span>
  )
}

function StatusBadge({ lead, onClick }: { lead: Lead; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="text-left" title="Update lead status">
      <ManagerStatusPill lead={lead} />
    </button>
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
