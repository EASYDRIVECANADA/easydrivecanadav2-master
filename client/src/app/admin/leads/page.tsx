'use client'

import { useEffect, useMemo, useState, type HTMLAttributes, type MouseEvent, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import {
  BadgeCheck,
  Car,
  ChevronDown,
  CheckCircle2,
  Clock3,
  Eye,
  FileSpreadsheet,
  Inbox,
  MessageSquare,
  Plus,
  Search,
  Trash2,
  UploadCloud,
  UserRound,
  Users,
  X,
} from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import {
  appendLeadTranscriptNote,
  appendLeadUpdateTranscriptNote,
  canManuallyAssignLeadFinanceManagers,
  displayLeadTranscriptAuthor,
  LEAD_MANAGER_STATUSES,
  normalizeLeadFinanceManagerTarget,
  normalizeLeadManagerStatus,
  parseLeadTranscriptEntries,
  resolveLeadFinanceManager,
  shouldOpenLeadDetailsFromRowClick,
} from '@/lib/leadWorkflow.mjs'

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
  financeManager: string | null
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
  finance_manager?: string | null
  ghl_synced: boolean | null
  created_at: string
}

type LeadQueryResult = {
  data: LeadRow[] | null
  error: { message?: string } | null
}

type FilterKey = 'finance' | 'insurance' | 'synced'
type SourceKey = 'finance' | 'insurance' | 'contact' | 'unknown'
type LeadDraftSource = SourceKey
type ImportSourceMode = 'auto' | 'finance' | 'insurance'
type LeadManagerStatus = string
type AssignmentUser = {
  email: string
  label: string
}

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
  managerStatus: LeadManagerStatus | ''
  financeManager: string
  createdAt: string
}

type CsvMessageField = {
  label: string
  aliases: string[]
}

const FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: 'finance', label: 'Credit Application' },
  { key: 'insurance', label: 'Insurance Application' },
  { key: 'synced', label: 'Handled' },
]

const BASE_LEAD_SELECT = 'id, first_name, last_name, email, phone, vehicle_interest, message, employment_status, monthly_income, down_payment, credit_score, ghl_synced, created_at'
const LEAD_SELECT_WITH_NOTES = `${BASE_LEAD_SELECT}, admin_notes`
const LEAD_SELECT_WITH_STATUS = `${LEAD_SELECT_WITH_NOTES}, manager_status`
const LEAD_SELECT_FULL = `${LEAD_SELECT_WITH_STATUS}, finance_manager`
const MANAGER_STATUSES = LEAD_MANAGER_STATUSES as LeadManagerStatus[]
const LEAD_DELETE_ALLOWED_EMAIL = 'info@easydrivecanada.com'

const leadSelectForCapabilities = (notesEnabled: boolean, statusEnabled: boolean, financeManagerEnabled: boolean) => {
  const columns = [BASE_LEAD_SELECT]
  if (notesEnabled) columns.push('admin_notes')
  if (statusEnabled) columns.push('manager_status')
  if (financeManagerEnabled) columns.push('finance_manager')
  return columns.join(', ')
}

const clean = (value: unknown) => String(value ?? '').trim()

const readAdminSessionEmail = () => {
  if (typeof window === 'undefined') return ''
  try {
    const raw = window.localStorage.getItem('edc_admin_session')
    if (!raw) return ''
    const parsed = JSON.parse(raw) as { email?: string }
    return clean(parsed.email).toLowerCase()
  } catch {
    return ''
  }
}

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
  managerStatus: '',
  financeManager: '',
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

const financeManagerLabel = (value: string | null) => {
  const manager = clean(value)
  if (!manager) return 'Unassigned'
  const emailMatch = manager.match(/^([^@]+)@(.+)$/)
  if (!emailMatch) return manager
  return emailMatch[1]
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ') || manager
}

const assignmentUserLabel = (row: { first_name?: string | null; last_name?: string | null; title?: string | null; email?: string | null }) => {
  const name = [row.first_name, row.last_name].map(clean).filter(Boolean).join(' ')
  const title = clean(row.title)
  const email = clean(row.email).toLowerCase()
  if (name && title) return `${name} · ${title}`
  return name || title || financeManagerLabel(email)
}

const buildAssignmentUsers = (rows: Array<Record<string, unknown>> = []): AssignmentUser[] => {
  const users = new Map<string, AssignmentUser>()

  for (const row of rows) {
    const email = clean(row.email).toLowerCase()
    if (!email) continue

    const role = clean(row.role).toLowerCase()
    const title = clean(row.title).toLowerCase()
    const canWorkLeads =
      Boolean(row.access_all_leads_customers || row.customers || row.administrator) ||
      role === 'admin' ||
      title.includes('finance') ||
      title.includes('manager') ||
      title.includes('sales')

    if (!canWorkLeads && email !== LEAD_DELETE_ALLOWED_EMAIL) continue

    users.set(email, {
      email,
      label: assignmentUserLabel(row),
    })
  }

  return Array.from(users.values()).sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }))
}

const latestLeadNotePreview = (notes: string | null) => {
  const entries = clean(notes).split(/\n{2,}/).map(clean).filter(Boolean)
  return entries.at(-1) || ''
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

const normalizeFieldLabel = (label: string) => clean(label).toLowerCase().replace(/[^a-z0-9]/g, '')

const findSubmittedValue = (
  rows: Array<{ label: string; value: string }>,
  labels: string[],
  usedLabels?: Set<string>
) => {
  for (const label of labels) {
    const row = rows.find((item) => normalizeFieldLabel(item.label) === normalizeFieldLabel(label))
    if (row) {
      usedLabels?.add(normalizeFieldLabel(row.label))
      return row.value
    }
  }
  return ''
}

const buildApplicationRows = (lead: Lead, fields: { rows: Array<{ label: string; value: string }>; notes: string[] }) => {
  const source = sourceFromLead(lead)
  const usedLabels = new Set<string>()
  const sourceValue = findSubmittedValue(fields.rows, ['Source'], usedLabels) || sourceLabel(source)
  const row = (label: string, value: unknown) => ({ label, value: clean(value) })
  const submittedFirstName = findSubmittedValue(fields.rows, ['First name', 'First'], usedLabels)
  const submittedLastName = findSubmittedValue(fields.rows, ['Last name', 'Last'], usedLabels)
  const submittedPhone = findSubmittedValue(fields.rows, ['Phone', 'Phone number', 'Mobile'], usedLabels)
  const submittedEmail = findSubmittedValue(fields.rows, ['Email', 'Email address'], usedLabels)
  const submittedEmployment = findSubmittedValue(fields.rows, ['Employment', 'Employment status'], usedLabels)
  const submittedMonthlyIncome = findSubmittedValue(fields.rows, ['Monthly income', 'Income'], usedLabels)
  const submittedDownPayment = findSubmittedValue(fields.rows, ['Down payment'], usedLabels)
  const submittedCredit = findSubmittedValue(fields.rows, ['Credit situation', 'Credit profile', 'Credit'], usedLabels)

  const baseRows = [
    row('Submitted at', formatDate(lead.createdAt)),
    row('Source', sourceValue),
    row('First name', submittedFirstName || lead.firstName),
    row('Last name', submittedLastName || lead.lastName),
    row('Phone', submittedPhone || lead.phone),
    row('Email', submittedEmail || lead.email),
  ]

  const financeRows = [
    row('Date of birth', findSubmittedValue(fields.rows, ['Date of birth', 'DOB', 'Birth date'], usedLabels)),
    row('Street address', findSubmittedValue(fields.rows, ['Street address', 'Full address', 'Address'], usedLabels)),
    row('Unit / apartment', findSubmittedValue(fields.rows, ['Unit / apartment', 'Unit', 'Apartment', 'Unit apartment'], usedLabels)),
    row('City', findSubmittedValue(fields.rows, ['City'], usedLabels)),
    row('Province / territory', findSubmittedValue(fields.rows, ['Province / territory', 'Province', 'Address province'], usedLabels)),
    row('Postal code', findSubmittedValue(fields.rows, ['Postal code', 'Address postal code'], usedLabels)),
    row('Canadian resident', findSubmittedValue(fields.rows, ['Canadian resident', 'Canadian resident address'], usedLabels)),
    row('Time at address', findSubmittedValue(fields.rows, ['Time at address', 'Address duration'], usedLabels)),
    row('Employment', submittedEmployment || lead.employmentStatus),
    row('Company name', findSubmittedValue(fields.rows, ['Company name', 'Employer', 'Employer name'], usedLabels)),
    row('Time employed at company', findSubmittedValue(fields.rows, ['Time employed at company', 'Time employed', 'Employer duration'], usedLabels)),
    row('Monthly income', submittedMonthlyIncome || formatMoney(lead.monthlyIncome)),
    row('Housing', findSubmittedValue(fields.rows, ['Housing'], usedLabels)),
    row('Credit situation', submittedCredit || lead.creditScore),
    row('Down payment', submittedDownPayment || formatMoney(lead.downPayment)),
    row('Referrer', findSubmittedValue(fields.rows, ['Referrer'], usedLabels)),
  ]

  const insuranceRows = [
    row('License number', findSubmittedValue(fields.rows, ['License number'], usedLabels)),
    row('Street address', findSubmittedValue(fields.rows, ['Street address', 'Full address', 'Address'], usedLabels)),
    row('Unit / apartment', findSubmittedValue(fields.rows, ['Unit / apartment', 'Unit', 'Apartment', 'Unit apartment'], usedLabels)),
    row('City', findSubmittedValue(fields.rows, ['City'], usedLabels)),
    row('Province / territory', findSubmittedValue(fields.rows, ['Province / territory', 'Province'], usedLabels)),
    row('Postal code', findSubmittedValue(fields.rows, ['Postal code'], usedLabels)),
    row('Vehicle interest', lead.vehicleInterest || findSubmittedValue(fields.rows, ['Vehicle interest', 'Vehicle'], usedLabels)),
    row('VIN', findSubmittedValue(fields.rows, ['VIN'], usedLabels)),
    row('Canadian resident address', findSubmittedValue(fields.rows, ['Canadian resident address'], usedLabels)),
    row('Consent to contact', findSubmittedValue(fields.rows, ['Consent to contact'], usedLabels)),
    row('Consent accurate', findSubmittedValue(fields.rows, ['Consent accurate'], usedLabels)),
    row('Referrer', findSubmittedValue(fields.rows, ['Referrer'], usedLabels)),
  ]

  const templateRows = source === 'insurance' ? insuranceRows : source === 'finance' ? financeRows : []
  const extraRows = fields.rows
    .filter((item) => !usedLabels.has(normalizeFieldLabel(item.label)))
    .filter((item) => clean(item.value))
    .map((item) => row(item.label, item.value))

  const noteRows = fields.notes.map((note, index) => row(index === 0 ? 'Note' : `Note ${index + 1}`, note))

  if (source === 'finance' || source === 'insurance') {
    return [...baseRows, ...templateRows, ...extraRows, ...noteRows]
  }

  return [...baseRows, ...extraRows, ...noteRows]
}

const leadLocationDetails = (lead: Lead) => {
  const { rows } = parseMessageFields(lead.message)
  const city = findSubmittedValue(rows, ['City', 'Address city'])
  const province = findSubmittedValue(rows, ['Province / territory', 'Province', 'Address province'])
  const postalCode = findSubmittedValue(rows, ['Postal code', 'Address postal code'])
  const address = findSubmittedValue(rows, ['Street address', 'Full address', 'Address'])
  const unit = findSubmittedValue(rows, ['Unit / apartment', 'Unit', 'Apartment', 'Unit apartment'])
  const inferredCity = inferCityFromAddress(address)

  return {
    city: [city || inferredCity, province].filter(Boolean).join(', ') || 'City not provided',
    address: [address, unit, postalCode].filter(Boolean).join(' | ') || 'Address not provided',
  }
}

const hasLeadLocation = (lead: Lead) => {
  const location = leadLocationDetails(lead)
  return location.city !== 'City not provided' || location.address !== 'Address not provided'
}

const inferCityFromAddress = (address: string) => {
  const parts = clean(address).split(',').map(clean).filter(Boolean)
  if (parts.length < 3) return ''

  const provinceIndex = parts.findIndex((part) => /^[A-Z]{2}$/i.test(part) || /\b(ON|QC|NS|NB|MB|BC|PE|SK|AB|NL|NT|YT|NU)\b/i.test(part))
  if (provinceIndex > 0) return parts[provinceIndex - 1]

  return ''
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

const FINANCE_IMPORT_MESSAGE_FIELDS: CsvMessageField[] = [
  { label: 'Date of birth', aliases: ['date of birth', 'dob', 'birth date'] },
  { label: 'Street address', aliases: ['street address', 'full address', 'address'] },
  { label: 'Unit / apartment', aliases: ['unit / apartment', 'unit', 'apartment', 'suite', 'apt'] },
  { label: 'City', aliases: ['city'] },
  { label: 'Province / territory', aliases: ['province / territory', 'province', 'territory'] },
  { label: 'Postal code', aliases: ['postal code', 'postal', 'zip'] },
  { label: 'Canadian resident', aliases: ['canadian resident'] },
  { label: 'Time at address', aliases: ['time at address', 'address duration'] },
  { label: 'Employment', aliases: ['employment', 'employment status', 'job status'] },
  { label: 'Company name', aliases: ['company name', 'employer', 'employer name'] },
  { label: 'Time employed at company', aliases: ['time employed at company', 'time employed', 'employer duration'] },
  { label: 'Monthly income', aliases: ['monthly income', 'income monthly', 'monthly_income'] },
  { label: 'Housing', aliases: ['housing', 'housing status'] },
  { label: 'Credit situation', aliases: ['credit', 'credit situation', 'credit score', 'credit profile'] },
  { label: 'Down payment', aliases: ['down payment', 'downpayment', 'desired down payment'] },
  { label: 'Referrer', aliases: ['referrer', 'referer', 'referral'] },
  { label: 'Finance manager', aliases: ['finance manager'] },
  { label: 'Submitted status', aliases: ['status'] },
]

const buildImportMessage = (row: Record<string, unknown>, fallbackMessage: string) => {
  const detailRows = FINANCE_IMPORT_MESSAGE_FIELDS
    .map((field) => [field.label, pickImportValue(row, field.aliases)] as [string, unknown])
    .filter(([, value]) => clean(value))

  return buildMessage([
    ...detailRows,
    ['Message', fallbackMessage],
  ])
}

const draftMessageForInsert = (draft: LeadDraft) => {
  const sourceLine = `Source: ${sourceMessageValue(draft.source)}`
  const body = clean(draft.message)
  if (!body) return sourceLine
  if (body.toLowerCase().startsWith('source:')) return body
  if (body.includes('\n') || /^([^:]+):\s*(.*)$/.test(body)) return `${sourceLine}\n${body}`
  return buildMessage([
    ['Source', sourceMessageValue(draft.source)],
    ['Message', body],
  ])
}

const leadFromDraftPreview = (draft: LeadDraft, index: number): Lead => {
  const message = draftMessageForInsert(draft)
  return {
    id: `import-preview-${index}`,
    firstName: draft.firstName,
    lastName: draft.lastName,
    email: draft.email,
    phone: draft.phone,
    vehicleInterest: clean(draft.vehicleInterest) || null,
    message,
    employmentStatus: clean(draft.employmentStatus) || null,
    monthlyIncome: toNumberOrNull(draft.monthlyIncome),
    downPayment: toNumberOrNull(draft.downPayment),
    creditScore: clean(draft.creditScore) || null,
    adminNotes: clean(draft.adminNotes) || null,
    managerStatus: clean(draft.managerStatus) || normalizeLeadManagerStatus(findSubmittedValue(parseMessageFields(message).rows, ['Submitted status', 'Status'])),
    financeManager: normalizeLeadFinanceManagerTarget(draft.financeManager),
    ghlSynced: false,
    createdAt: toDateIsoOrNull(draft.createdAt) || new Date().toISOString(),
  }
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

const inferImportSourceFromFileName = (fileName: string): ImportSourceMode => {
  const normalized = clean(fileName).toLowerCase()
  if (normalized.includes('insurance')) return 'insurance'
  if (normalized.includes('finance') || normalized.includes('financing')) return 'finance'
  return 'auto'
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
  managerStatus: normalizeLeadManagerStatus(l.manager_status),
  financeManager: clean(l.finance_manager) || null,
  ghlSynced: !!l.ghl_synced,
  createdAt: l.created_at,
})

const rowToLeadInsert = (
  draft: LeadDraft,
  notesEnabled: boolean,
  createdAt = new Date().toISOString(),
  options: { statusEnabled?: boolean; financeManagerEnabled?: boolean } = {}
) => {
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
    message: draftMessageForInsert(draft) || null,
  }

  if (notesEnabled) {
    insert.admin_notes = appendLeadTranscriptNote(null, draft.adminNotes)
  }

  if (options.statusEnabled) {
    insert.manager_status = clean(draft.managerStatus) || null
  }

  if (options.financeManagerEnabled) {
    const manager = normalizeLeadFinanceManagerTarget(draft.financeManager)
    insert.finance_manager = manager === 'Unassigned' ? null : manager
  }

  return insert
}

export default function AdminLeadsPage() {
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
  const [financeManagerEnabled, setFinanceManagerEnabled] = useState(true)
  const [savingFinanceManagerId, setSavingFinanceManagerId] = useState('')
  const [financeManagerSaveError, setFinanceManagerSaveError] = useState('')
  const [assignmentUsers, setAssignmentUsers] = useState<AssignmentUser[]>([])
  const [assignmentUsersLoading, setAssignmentUsersLoading] = useState(false)
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
  const [importSourceMode, setImportSourceMode] = useState<ImportSourceMode>('auto')
  const [importError, setImportError] = useState('')
  const [importing, setImporting] = useState(false)
  const [adminEmail, setAdminEmail] = useState('')
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(() => new Set())
  const itemsPerPage = 20
  const router = useRouter()
  const canDeleteLeads = adminEmail === LEAD_DELETE_ALLOWED_EMAIL
  const canManageLeadAssignments = canManuallyAssignLeadFinanceManagers(adminEmail)

  useEffect(() => {
    const sessionStr = localStorage.getItem('edc_admin_session')
    if (!sessionStr) {
      router.push('/admin')
      return
    }
    setAdminEmail(readAdminSessionEmail())
    void fetchLeads()
  }, [router])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const syncEmail = () => setAdminEmail(readAdminSessionEmail())
    const onStorage = (event: StorageEvent) => {
      if (event.key === 'edc_admin_session') syncEmail()
    }

    window.addEventListener('storage', onStorage)
    window.addEventListener('edc_admin_session_changed', syncEmail)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('edc_admin_session_changed', syncEmail)
    }
  }, [])

  useEffect(() => {
    if (!canManageLeadAssignments) {
      setAssignmentUsers([])
      setAssignmentUsersLoading(false)
      return
    }

    let cancelled = false

    const fetchAssignmentUsers = async () => {
      setAssignmentUsersLoading(true)
      try {
        const { data, error } = await supabase
          .from('users')
          .select('email, first_name, last_name, title, role, access_all_leads_customers, customers, administrator, status')
          .order('first_name', { ascending: true })

        if (error) throw error
        if (!cancelled) setAssignmentUsers(buildAssignmentUsers((data || []) as Array<Record<string, unknown>>))
      } catch (error) {
        console.error('Error fetching assignable lead users:', error)
        if (!cancelled) setAssignmentUsers([])
      } finally {
        if (!cancelled) setAssignmentUsersLoading(false)
      }
    }

    void fetchAssignmentUsers()

    return () => {
      cancelled = true
    }
  }, [canManageLeadAssignments])

  const fetchLeads = async () => {
    try {
      let result = await supabase
        .from('edc_leads')
        .select(LEAD_SELECT_FULL)
        .order('created_at', { ascending: false }) as unknown as LeadQueryResult

      if (result.error && /finance_manager|column|schema cache/i.test(result.error.message || '')) {
        setFinanceManagerEnabled(false)
        result = await supabase
          .from('edc_leads')
          .select(LEAD_SELECT_WITH_STATUS)
          .order('created_at', { ascending: false }) as unknown as LeadQueryResult
      } else {
        setFinanceManagerEnabled(true)
      }

      if (result.error && /manager_status|column|schema cache/i.test(result.error.message || '')) {
        setStatusEnabled(false)
        result = await supabase
          .from('edc_leads')
          .select(`${LEAD_SELECT_WITH_NOTES}, finance_manager`)
          .order('created_at', { ascending: false }) as unknown as LeadQueryResult

        if (result.error && /finance_manager|column|schema cache/i.test(result.error.message || '')) {
          setFinanceManagerEnabled(false)
          result = await supabase
            .from('edc_leads')
            .select(LEAD_SELECT_WITH_NOTES)
            .order('created_at', { ascending: false }) as unknown as LeadQueryResult
        }
      } else {
        setStatusEnabled(true)
      }

      if (result.error && /admin_notes|column|schema cache/i.test(result.error.message || '')) {
        setNotesEnabled(false)
        result = await supabase
          .from('edc_leads')
          .select(BASE_LEAD_SELECT)
          .order('created_at', { ascending: false }) as unknown as LeadQueryResult
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
        lead.financeManager,
        financeManagerLabel(lead.financeManager),
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
    setNotesDraft('')
    setNotesSaveError('')
    setFinanceManagerSaveError('')
  }, [selectedLead?.id, selectedLead?.adminNotes])

  useEffect(() => {
    setTableNotesDraft('')
    setTableNotesError('')
  }, [notesModalLead?.id, notesModalLead?.adminNotes])

  const paginatedLeads = filteredLeads.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )
  const totalPages = Math.max(1, Math.ceil(filteredLeads.length / itemsPerPage))
  const visibleLeadIds = paginatedLeads.map((lead) => lead.id)
  const selectedCount = selectedLeadIds.size
  const allVisibleSelected = visibleLeadIds.length > 0 && visibleLeadIds.every((id) => selectedLeadIds.has(id))

  useEffect(() => {
    const existingIds = new Set(leads.map((lead) => lead.id))
    setSelectedLeadIds((current) => {
      const next = new Set(Array.from(current).filter((id) => existingIds.has(id)))
      return next.size === current.size ? current : next
    })
  }, [leads])

  const toggleLeadSelected = (leadId: string, checked: boolean) => {
    setSelectedLeadIds((current) => {
      const next = new Set(current)
      if (checked) next.add(leadId)
      else next.delete(leadId)
      return next
    })
  }

  const toggleVisibleLeadsSelected = (checked: boolean) => {
    setSelectedLeadIds((current) => {
      const next = new Set(current)
      visibleLeadIds.forEach((id) => {
        if (checked) next.add(id)
        else next.delete(id)
      })
      return next
    })
  }

  const handleDelete = async (lead: Lead) => {
    if (!canDeleteLeads) {
      alert('Only info@easydrivecanada.com can delete leads.')
      return
    }

    if (!confirm(`Delete ${leadName(lead)}? This cannot be undone.`)) return

    try {
      const response = await fetch('/api/leads', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: adminEmail, ids: [lead.id] }),
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(clean(payload?.error) || 'Unable to delete lead.')
      }
      setLeads((rows) => rows.filter((row) => row.id !== lead.id))
      setSelectedLeadIds((current) => {
        const next = new Set(current)
        next.delete(lead.id)
        return next
      })
      setSelectedLead((current) => (current?.id === lead.id ? null : current))
      setNotesModalLead((current) => (current?.id === lead.id ? null : current))
      setStatusModalLead((current) => (current?.id === lead.id ? null : current))
    } catch (error) {
      console.error('Error deleting lead:', error)
      alert(error instanceof Error ? error.message : 'Unable to delete this lead. Try again.')
    }
  }

  const handleBulkDelete = async () => {
    if (!canDeleteLeads) {
      alert('Only info@easydrivecanada.com can delete leads.')
      return
    }

    const ids = Array.from(selectedLeadIds)
    if (ids.length === 0) return
    if (!confirm(`Delete ${ids.length} selected lead${ids.length === 1 ? '' : 's'}? This cannot be undone.`)) return

    try {
      const response = await fetch('/api/leads', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: adminEmail, ids }),
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(clean(payload?.error) || 'Unable to delete selected leads.')
      }
      const idSet = new Set(ids)
      setLeads((rows) => rows.filter((row) => !idSet.has(row.id)))
      setSelectedLeadIds(new Set())
      setSelectedLead((current) => (current && idSet.has(current.id) ? null : current))
      setNotesModalLead((current) => (current && idSet.has(current.id) ? null : current))
      setStatusModalLead((current) => (current && idSet.has(current.id) ? null : current))
    } catch (error) {
      console.error('Error bulk deleting leads:', error)
      alert('Unable to delete the selected leads. Try again.')
    }
  }

  const handleSaveNotes = async (lead: Lead) => {
    if (!notesEnabled) {
      setNotesSaveError('Apply the admin_notes database column before saving notes.')
      return
    }

    setSavingNotes(true)
    setNotesSaveError('')

    const actorEmail = readAdminSessionEmail() || adminEmail
    const nextNotes = appendLeadTranscriptNote(lead.adminNotes, notesDraft, undefined, actorEmail)
    const autoClaimActor = canManuallyAssignLeadFinanceManagers(actorEmail) ? '' : actorEmail
    const nextFinanceManager = resolveLeadFinanceManager(lead.financeManager, autoClaimActor)
    const updatePayload: Record<string, string | null> = { admin_notes: nextNotes }
    if (financeManagerEnabled) updatePayload.finance_manager = nextFinanceManager

    try {
      const { error } = await supabase
        .from('edc_leads')
        .update(updatePayload)
        .eq('id', lead.id)

      if (error) throw error

      const localUpdate = { adminNotes: nextNotes, financeManager: nextFinanceManager }
      setLeads((rows) => rows.map((row) => (row.id === lead.id ? { ...row, ...localUpdate } : row)))
      setSelectedLead((current) => (current?.id === lead.id ? { ...current, ...localUpdate } : current))
      setNotesDraft('')
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

    const actorEmail = readAdminSessionEmail() || adminEmail
    const nextNotes = appendLeadTranscriptNote(lead.adminNotes, tableNotesDraft, undefined, actorEmail)
    const autoClaimActor = canManuallyAssignLeadFinanceManagers(actorEmail) ? '' : actorEmail
    const nextFinanceManager = resolveLeadFinanceManager(lead.financeManager, autoClaimActor)
    const updatePayload: Record<string, string | null> = { admin_notes: nextNotes }
    if (financeManagerEnabled) updatePayload.finance_manager = nextFinanceManager

    try {
      const { error } = await supabase
        .from('edc_leads')
        .update(updatePayload)
        .eq('id', lead.id)

      if (error) throw error

      const localUpdate = { adminNotes: nextNotes, financeManager: nextFinanceManager }
      setLeads((rows) => rows.map((row) => (row.id === lead.id ? { ...row, ...localUpdate } : row)))
      setSelectedLead((current) => (current?.id === lead.id ? { ...current, ...localUpdate } : current))
      setNotesModalLead((current) => (current?.id === lead.id ? { ...current, ...localUpdate } : current))
      setTableNotesDraft('')
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
    const actorEmail = readAdminSessionEmail() || adminEmail
    const statusAuditNotes = notesEnabled
      ? appendLeadUpdateTranscriptNote(lead.adminNotes, { field: 'Status', from: lead.managerStatus, to: status, actor: actorEmail })
      : lead.adminNotes
    const autoClaimActor = canManuallyAssignLeadFinanceManagers(actorEmail) ? '' : actorEmail
    const nextFinanceManager = resolveLeadFinanceManager(lead.financeManager, autoClaimActor)
    const updatePayload: Record<string, string | null> = { manager_status: status }
    if (notesEnabled) updatePayload.admin_notes = statusAuditNotes
    if (financeManagerEnabled) updatePayload.finance_manager = nextFinanceManager

    try {
      const { error } = await supabase
        .from('edc_leads')
        .update(updatePayload)
        .eq('id', lead.id)

      if (error) throw error

      const localUpdate = { managerStatus: status, adminNotes: statusAuditNotes, financeManager: nextFinanceManager }
      setLeads((rows) => rows.map((row) => (row.id === lead.id ? { ...row, ...localUpdate } : row)))
      setSelectedLead((current) => (current?.id === lead.id ? { ...current, ...localUpdate } : current))
      setNotesModalLead((current) => (current?.id === lead.id ? { ...current, ...localUpdate } : current))
      setStatusModalLead((current) => (current?.id === lead.id ? { ...current, ...localUpdate } : current))
    } catch (error) {
      console.error('Error saving lead status:', error)
      setStatusSaveError('Unable to update status. Check that manager_status exists on edc_leads.')
    } finally {
      setSavingStatus(false)
    }
  }

  const handleAssignFinanceManager = async (lead: Lead, managerTarget?: string | null) => {
    if (!financeManagerEnabled) {
      setFinanceManagerSaveError('Apply the finance_manager database column before assigning leads.')
      return
    }

    const manualAssignment = managerTarget !== undefined
    if (manualAssignment && !canManageLeadAssignments) {
      setFinanceManagerSaveError('Only info@easydrivecanada.com can manually assign finance managers.')
      return
    }

    const normalizedTarget = normalizeLeadFinanceManagerTarget(manualAssignment ? managerTarget : adminEmail)
    const nextFinanceManager = normalizedTarget === 'Unassigned' ? null : normalizedTarget

    if (!nextFinanceManager && !manualAssignment) {
      setFinanceManagerSaveError('Sign in again before assigning a finance manager.')
      return
    }

    setSavingFinanceManagerId(lead.id)
    setFinanceManagerSaveError('')

    try {
      const { error } = await supabase
        .from('edc_leads')
        .update({ finance_manager: nextFinanceManager })
        .eq('id', lead.id)

      if (error) throw error

      const localUpdate = { financeManager: nextFinanceManager }
      setLeads((rows) => rows.map((row) => (row.id === lead.id ? { ...row, ...localUpdate } : row)))
      setSelectedLead((current) => (current?.id === lead.id ? { ...current, ...localUpdate } : current))
      setNotesModalLead((current) => (current?.id === lead.id ? { ...current, ...localUpdate } : current))
      setStatusModalLead((current) => (current?.id === lead.id ? { ...current, ...localUpdate } : current))
    } catch (error) {
      console.error('Error assigning finance manager:', error)
      setFinanceManagerSaveError('Unable to assign finance manager. Check that finance_manager exists on edc_leads.')
    } finally {
      setSavingFinanceManagerId('')
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
      const insert = rowToLeadInsert(leadDraft, notesEnabled, undefined, {
        statusEnabled: statusEnabled && canManageLeadAssignments,
        financeManagerEnabled: financeManagerEnabled && canManageLeadAssignments,
      })
      const { data, error } = await supabase
        .from('edc_leads')
        .insert(insert)
        .select(leadSelectForCapabilities(notesEnabled, statusEnabled, financeManagerEnabled))
        .single()

      if (error) throw error

      const created = mapLeadRow(data as unknown as LeadRow)
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
    setImportSourceMode(inferImportSourceFromFileName(file.name))

    try {
      const XLSX = await import('xlsx-js-style')
      const extension = file.name.split('.').pop()?.toLowerCase()
      const workbook = extension === 'csv' || extension === 'tsv' || extension === 'txt'
        ? XLSX.read(await file.text(), { type: 'string' })
        : XLSX.read(await file.arrayBuffer(), { type: 'array' })
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' }) as Array<Record<string, unknown>>

      const drafts = rows
        .map((row) => {
          const fullName = pickImportValue(row, ['name', 'full name', 'customer', 'lead'])
          const splitName = splitFullName(fullName)
          const source = normalizeImportSource(pickImportValue(row, ['source', 'lead source', 'type', 'category']))
          const resolvedSource = source === 'unknown' ? inferImportSourceFromFileName(file.name) : source
          const monthlyIncome = pickImportValue(row, ['monthly income', 'income monthly', 'monthly_income']) ||
            (() => {
              const annualIncome = toNumberOrNull(pickImportValue(row, ['annual income', 'gross annual income', 'income']))
              return annualIncome === null ? '' : String(Math.round(annualIncome / 12))
            })()
          const fallbackMessage = pickImportValue(row, ['message', 'comments', 'comment', 'inquiry', 'details'])

          return {
            firstName: pickImportValue(row, ['first name', 'firstname', 'first_name']) || splitName.firstName,
            lastName: pickImportValue(row, ['last name', 'lastname', 'last_name']) || splitName.lastName,
            email: pickImportValue(row, ['email', 'email address', 'e-mail']),
            phone: pickImportValue(row, ['phone', 'phone number', 'mobile', 'cell', 'telephone']),
            source: resolvedSource === 'auto' ? 'unknown' : resolvedSource,
            vehicleInterest: pickImportValue(row, ['vehicle interest', 'vehicle', 'car', 'vehicle_interest', 'interest']),
            employmentStatus: pickImportValue(row, ['employment', 'employment status', 'job status']),
            monthlyIncome,
            downPayment: pickImportValue(row, ['down payment', 'downpayment', 'desired down payment']),
            creditScore: pickImportValue(row, ['credit', 'credit score', 'credit profile']),
            message: buildImportMessage(row, fallbackMessage),
            adminNotes: pickImportValue(row, ['notes', 'admin notes', 'internal notes', 'follow up notes']),
            managerStatus: canManageLeadAssignments
              ? normalizeLeadManagerStatus(pickImportValue(row, ['status', 'manager status', 'lead status'])) || ''
              : '',
            financeManager: canManageLeadAssignments
              ? normalizeLeadFinanceManagerTarget(pickImportValue(row, ['finance manager', 'assigned to', 'manager', 'owner'])) || ''
              : '',
            createdAt: pickImportValue(row, ['timestamp', 'date', 'created at', 'created_at', 'received', 'submitted', 'submitted at']),
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
      const rowsToImport = importRows.map((row) => (
        importSourceMode === 'auto' ? row : { ...row, source: importSourceMode }
      ))
      const inserts = rowsToImport.map((row) => rowToLeadInsert(row, notesEnabled, undefined, {
        statusEnabled: statusEnabled && canManageLeadAssignments,
        financeManagerEnabled: financeManagerEnabled && canManageLeadAssignments,
      }))
      const { data, error } = await supabase
        .from('edc_leads')
        .insert(inserts)
        .select(leadSelectForCapabilities(notesEnabled, statusEnabled, financeManagerEnabled))

      if (error) throw error

      const imported = ((data || []) as unknown as LeadRow[]).map(mapLeadRow)
      setLeads((rows) => [...imported, ...rows])
      setImportOpen(false)
      setImportRows([])
      setImportFileName('')
      setImportSourceMode('auto')
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
              {canDeleteLeads ? (
                <button
                  type="button"
                  onClick={handleBulkDelete}
                  disabled={selectedCount === 0}
                  className="inline-flex h-9 items-center gap-2 rounded-xl border border-red-200 bg-white px-3 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300 disabled:hover:bg-white"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete selected{selectedCount > 0 ? ` (${selectedCount})` : ''}
                </button>
              ) : null}
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
                  <table className="edc-table min-w-[1240px]">
                    <thead>
                      <tr>
                        {canDeleteLeads ? (
                          <th className="w-12">
                            <input
                              type="checkbox"
                              checked={allVisibleSelected}
                              onChange={(event) => toggleVisibleLeadsSelected(event.target.checked)}
                              aria-label="Select all leads on this page"
                              className="h-4 w-4 rounded border-slate-300 text-[#0B1F3A] focus:ring-[#1EA7FF]"
                            />
                          </th>
                        ) : null}
                        <th>Status</th>
                        <th>Received</th>
                        <th>Contact Name</th>
                        <th>City / Address</th>
                        <th>Finance Manager</th>
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
                          canDelete={canDeleteLeads}
                          bulkSelected={selectedLeadIds.has(lead.id)}
                          onSelect={setSelectedLead}
                          onDelete={handleDelete}
                          onToggleBulkSelect={toggleLeadSelected}
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
                    canDelete={canDeleteLeads}
                    bulkSelected={selectedLeadIds.has(lead.id)}
                    onSelect={setSelectedLead}
                    onDelete={handleDelete}
                    onToggleBulkSelect={toggleLeadSelected}
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
          <div className="relative z-10 max-h-[94vh] w-full max-w-[1400px] overflow-hidden rounded-2xl bg-white shadow-premium">
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
              adminEmail={adminEmail}
              canManageAssignments={canManageLeadAssignments}
              assignmentUsers={assignmentUsers}
              assignmentUsersLoading={assignmentUsersLoading}
              financeManagerEnabled={financeManagerEnabled}
              savingFinanceManager={savingFinanceManagerId === selectedLead.id}
              financeManagerSaveError={financeManagerSaveError}
              onAssignFinanceManager={handleAssignFinanceManager}
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
          statusEnabled={statusEnabled}
          financeManagerEnabled={financeManagerEnabled}
          canManageAssignments={canManageLeadAssignments}
          assignmentUsers={assignmentUsers}
          assignmentUsersLoading={assignmentUsersLoading}
        />
      )}

      {importOpen && (
        <LeadImportModal
          rows={importRows.map((row) => (importSourceMode === 'auto' ? row : { ...row, source: importSourceMode }))}
          fileName={importFileName}
          sourceMode={importSourceMode}
          onSourceModeChange={setImportSourceMode}
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
  canDelete,
  bulkSelected,
  onSelect,
  onDelete,
  onToggleBulkSelect,
  onEditNotes,
  onEditStatus,
}: {
  lead: Lead
  selected: boolean
  canDelete: boolean
  bulkSelected: boolean
  onSelect: (lead: Lead) => void
  onDelete: (lead: Lead) => void
  onToggleBulkSelect: (leadId: string, checked: boolean) => void
  onEditNotes: (lead: Lead) => void
  onEditStatus: (lead: Lead) => void
}) {
  const source = sourceFromLead(lead)
  const location = leadLocationDetails(lead)
  const handleRowClick = (event: MouseEvent<HTMLTableRowElement>) => {
    if (shouldOpenLeadDetailsFromRowClick(event.target)) onSelect(lead)
  }

  return (
    <tr onClick={handleRowClick} className={`cursor-pointer ${selected ? 'bg-[#1EA7FF]/5' : 'hover:bg-slate-50/70'}`}>
      {canDelete ? (
        <td data-lead-row-action>
          <input
            type="checkbox"
            checked={bulkSelected}
            onChange={(event) => onToggleBulkSelect(lead.id, event.target.checked)}
            aria-label={`Select ${leadName(lead)} for bulk delete`}
            className="h-4 w-4 rounded border-slate-300 text-[#0B1F3A] focus:ring-[#1EA7FF]"
          />
        </td>
      ) : null}
      <td data-lead-row-action>
        <StatusBadge lead={lead} onClick={() => onEditStatus(lead)} />
      </td>
      <td>
        <div className="text-sm text-slate-600">{formatDate(lead.createdAt)}</div>
      </td>
      <td>
        <div className="group flex min-w-0 items-center gap-3 text-left">
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
        </div>
      </td>
      <td>
        <div className="max-w-[280px]">
          <div className="truncate text-sm font-medium text-slate-800">{location.city}</div>
          <div className="mt-1 truncate text-xs text-slate-500">{location.address}</div>
        </div>
      </td>
      <td>
        <FinanceManagerPill lead={lead} />
      </td>
      <td data-lead-row-action>
        <NotesPreviewButton lead={lead} onClick={() => onEditNotes(lead)} />
      </td>
      <td data-lead-row-action>
        <div className="flex justify-end gap-1.5">
          <IconButton label="View details" onClick={() => onSelect(lead)} icon={Eye} />
          {canDelete ? <IconButton label="Delete lead" onClick={() => onDelete(lead)} icon={Trash2} danger /> : null}
        </div>
      </td>
    </tr>
  )
}

function MobileLeadCard({
  lead,
  selected,
  canDelete,
  bulkSelected,
  onSelect,
  onDelete,
  onToggleBulkSelect,
  onEditNotes,
  onEditStatus,
}: {
  lead: Lead
  selected: boolean
  canDelete: boolean
  bulkSelected: boolean
  onSelect: (lead: Lead) => void
  onDelete: (lead: Lead) => void
  onToggleBulkSelect: (leadId: string, checked: boolean) => void
  onEditNotes: (lead: Lead) => void
  onEditStatus: (lead: Lead) => void
}) {
  const source = sourceFromLead(lead)
  const location = leadLocationDetails(lead)
  const handleCardClick = (event: MouseEvent<HTMLDivElement>) => {
    if (shouldOpenLeadDetailsFromRowClick(event.target)) onSelect(lead)
  }

  return (
    <div onClick={handleCardClick} className={`cursor-pointer rounded-2xl border bg-white p-4 shadow-card ${selected ? 'border-[#1EA7FF]' : 'border-slate-200 hover:border-slate-300'}`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div data-lead-row-action>
          <StatusBadge lead={lead} onClick={() => onEditStatus(lead)} />
        </div>
        <div className="flex items-center gap-3">
          {canDelete ? (
            <label data-lead-row-action className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-500">
              <input
                type="checkbox"
                checked={bulkSelected}
                onChange={(event) => onToggleBulkSelect(lead.id, event.target.checked)}
                className="h-3.5 w-3.5 rounded border-slate-300 text-[#0B1F3A] focus:ring-[#1EA7FF]"
              />
              Select
            </label>
          ) : null}
          <div className="text-right text-[11px] font-medium text-slate-400">{formatDate(lead.createdAt)}</div>
        </div>
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
            {lead.email ? <a data-lead-row-action className="block truncate text-slate-800" href={`mailto:${lead.email}`}>{lead.email}</a> : null}
            {lead.phone ? <a data-lead-row-action className="block text-slate-500" href={`tel:${lead.phone}`}>{lead.phone}</a> : null}
            <div className="truncate font-medium text-slate-700">{location.city}</div>
            <div className="truncate text-slate-500">{location.address}</div>
          </div>
          <div className="mt-3">
            <FinanceManagerPill lead={lead} />
          </div>
          <div data-lead-row-action className="mt-3">
            <NotesPreviewButton lead={lead} onClick={() => onEditNotes(lead)} />
          </div>
        </div>
      </div>

      <div data-lead-row-action className={`mt-4 grid overflow-hidden rounded-xl border border-slate-200 ${canDelete ? 'grid-cols-2' : 'grid-cols-1'}`}>
        <ActionCell label="View" onClick={() => onSelect(lead)} icon={Eye} />
        {canDelete ? <ActionCell label="Delete" onClick={() => onDelete(lead)} icon={Trash2} danger /> : null}
      </div>
    </div>
  )
}

function LeadImportPreviewRow({ lead }: { lead: Lead }) {
  const source = sourceFromLead(lead)
  const location = leadLocationDetails(lead)

  return (
    <tr>
      <td>
        <ManagerStatusPill lead={lead} />
      </td>
      <td>
        <div className="text-sm text-slate-600">{formatDate(lead.createdAt)}</div>
      </td>
      <td>
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0B1F3A] text-xs font-bold text-white">
            {leadInitials(lead)}
          </span>
          <span className="min-w-0">
            <span className="block truncate font-semibold text-slate-900">{leadName(lead)}</span>
            <span className="mt-1 block truncate text-xs text-slate-500">{lead.email || lead.phone || 'No contact info'}</span>
            <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${sourcePillClass(source)}`}>
              {sourceLabel(source)}
            </span>
          </span>
        </div>
      </td>
      <td>
        <div className="max-w-[280px]">
          <div className="truncate text-sm font-medium text-slate-800">{location.city}</div>
          <div className="mt-1 truncate text-xs text-slate-500">{location.address}</div>
        </div>
      </td>
      <td>
        <NotesPreviewStatic notes={lead.adminNotes} />
      </td>
    </tr>
  )
}

function FinanceManagerPill({ lead }: { lead: Lead }) {
  const assigned = !!clean(lead.financeManager)
  const label = financeManagerLabel(lead.financeManager)

  return (
    <div
      title={assigned ? lead.financeManager || label : 'Unassigned'}
      className={`inline-flex max-w-[220px] items-center gap-2 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${
        assigned
          ? 'bg-indigo-50 text-indigo-700 ring-indigo-200'
          : 'bg-slate-50 text-slate-500 ring-slate-200'
      }`}
    >
      <Users className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{label}</span>
    </div>
  )
}

function NotesPreviewButton({ lead, onClick }: { lead: Lead; onClick: () => void }) {
  const hasNotes = !!clean(lead.adminNotes)
  const preview = latestLeadNotePreview(lead.adminNotes)

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
          {hasNotes ? preview : 'No notes yet'}
        </span>
      </span>
    </button>
  )
}

function NotesPreviewStatic({ notes }: { notes: string | null }) {
  const hasNotes = !!clean(notes)
  const preview = latestLeadNotePreview(notes)

  return (
    <div className={`flex w-full max-w-[260px] items-start gap-2 rounded-xl border px-3 py-2 text-left ${
      hasNotes
        ? 'border-amber-200 bg-amber-50/70'
        : 'border-dashed border-slate-200 bg-slate-50/70'
    }`}>
      <MessageSquare className={`mt-0.5 h-4 w-4 shrink-0 ${hasNotes ? 'text-amber-600' : 'text-slate-400'}`} />
      <span className="min-w-0">
        <span className={`block truncate text-xs font-medium ${hasNotes ? 'text-amber-800' : 'text-slate-400'}`}>
          {hasNotes ? preview : 'No notes yet'}
        </span>
      </span>
    </div>
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
  statusEnabled,
  financeManagerEnabled,
  canManageAssignments,
  assignmentUsers,
  assignmentUsersLoading,
}: {
  draft: LeadDraft
  onChange: (draft: LeadDraft) => void
  onClose: () => void
  onSubmit: () => void
  submitting: boolean
  error: string
  notesEnabled: boolean
  statusEnabled: boolean
  financeManagerEnabled: boolean
  canManageAssignments: boolean
  assignmentUsers: AssignmentUser[]
  assignmentUsersLoading: boolean
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

            {canManageAssignments ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-semibold text-slate-600">Finance manager</span>
                  <select
                    value={draft.financeManager}
                    onChange={(event) => setField('financeManager', event.target.value)}
                    disabled={!financeManagerEnabled}
                    className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-[#1EA7FF]/50 focus:ring-2 focus:ring-[#1EA7FF]/20 disabled:bg-slate-100 disabled:text-slate-400"
                  >
                    <option value="">Unassigned</option>
                    {assignmentUsersLoading ? <option value="">Loading users...</option> : null}
                    {assignmentUsers.map((user) => (
                      <option key={user.email} value={user.email}>
                        {user.label} ({user.email})
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-slate-600">Lead status</span>
                  <select
                    value={draft.managerStatus}
                    onChange={(event) => setField('managerStatus', event.target.value)}
                    disabled={!statusEnabled}
                    className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-[#1EA7FF]/50 focus:ring-2 focus:ring-[#1EA7FF]/20 disabled:bg-slate-100 disabled:text-slate-400"
                  >
                    <option value="">No status</option>
                    {MANAGER_STATUSES.map((status) => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                </label>
              </div>
            ) : null}

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
  sourceMode,
  onSourceModeChange,
  error,
  importing,
  onFile,
  onClose,
  onImport,
}: {
  rows: LeadDraft[]
  fileName: string
  sourceMode: ImportSourceMode
  onSourceModeChange: (mode: ImportSourceMode) => void
  error: string
  importing: boolean
  onFile: (file: File) => void
  onClose: () => void
  onImport: () => void
}) {
  const allPreviewLeads = rows.map(leadFromDraftPreview)
  const locationPreviewLeads = allPreviewLeads.filter(hasLeadLocation)
  const previewLeads = (locationPreviewLeads.length > 0 ? locationPreviewLeads : allPreviewLeads).slice(0, 5)
  const previewLabel = locationPreviewLeads.length > 0 ? 'Showing address examples first' : 'Previewing first 5'

  return (
    <ModalFrame maxWidth="max-w-6xl" onClose={onClose}>
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

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-900">Import source</div>
                <p className="mt-1 text-xs leading-5 text-slate-500">Choose Finance or Insurance when the spreadsheet source is missing or unknown.</p>
              </div>
              <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
                {([
                  ['auto', 'Auto'],
                  ['finance', 'Finance'],
                  ['insurance', 'Insurance'],
                ] as Array<[ImportSourceMode, string]>).map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => onSourceModeChange(mode)}
                    className={
                      sourceMode === mode
                        ? 'h-8 rounded-lg bg-[#0B1F3A] px-3 text-xs font-semibold text-white shadow-sm'
                        : 'h-8 rounded-lg px-3 text-xs font-semibold text-slate-600 transition-colors hover:bg-white'
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}

          {rows.length > 0 && (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                <div className="text-sm font-semibold text-slate-900">{rows.length} leads ready to import</div>
                <div className="text-xs text-slate-500">{previewLabel}</div>
              </div>
              <div className="overflow-x-auto">
                <table className="edc-table min-w-[1040px]">
                  <thead>
                    <tr>
                      <th>Status</th>
                      <th>Received</th>
                      <th>Contact Name</th>
                      <th>City / Address</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewLeads.map((lead) => (
                      <LeadImportPreviewRow key={lead.id} lead={lead} />
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
  const isDirty = !!value.trim()
  const hasTranscript = !!clean(savedValue)

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
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="mb-2 text-xs font-semibold uppercase text-slate-500">Transcript</div>
            <LeadTranscriptDisplay value={savedValue} financeManager={lead.financeManager} emptyClassName="text-sm leading-6" maxHeightClassName="max-h-56" />
          </div>
          <textarea
            value={value}
            onChange={(event) => onChange(event.target.value)}
            disabled={!enabled}
            autoFocus
            rows={5}
            placeholder={enabled ? 'Add the next note. Existing notes stay locked in the transcript above.' : 'Apply the admin_notes database column to enable lead notes.'}
            className="min-h-[140px] w-full resize-y rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-3 text-sm text-slate-800 outline-none transition focus:border-[#1EA7FF]/50 focus:bg-white focus:ring-2 focus:ring-[#1EA7FF]/20 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
          />
          <div className="flex items-center justify-between gap-3 text-xs">
            <span className={error ? 'text-red-600' : 'text-slate-400'}>
              {error || (isDirty ? 'New note ready to add' : hasTranscript ? 'History cannot be edited or deleted' : 'No notes yet')}
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
            {saving ? 'Saving...' : 'Add note'}
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
                  {managerStatusLabel(status)}
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
  adminEmail,
  canManageAssignments,
  assignmentUsers,
  assignmentUsersLoading,
  financeManagerEnabled,
  savingFinanceManager,
  financeManagerSaveError,
  onAssignFinanceManager,
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
  adminEmail: string
  canManageAssignments: boolean
  assignmentUsers: AssignmentUser[]
  assignmentUsersLoading: boolean
  financeManagerEnabled: boolean
  savingFinanceManager: boolean
  financeManagerSaveError: string
  onAssignFinanceManager: (lead: Lead, managerTarget?: string | null) => void
}) {
  const [customManager, setCustomManager] = useState('')
  const source = sourceFromLead(lead)
  const primaryIntent = lead.vehicleInterest || intentFallback(lead)
  const primaryIntentLabel = clean(lead.vehicleInterest) ? 'Vehicle' : 'Application'
  const applicationRows = buildApplicationRows(lead, fields)
  const applicationTitle =
    source === 'finance'
      ? 'Full credit application'
      : source === 'insurance'
        ? 'Full insurance application'
        : 'Submitted details'
  const assignedToCurrentUser = !!clean(adminEmail) && clean(lead.financeManager).toLowerCase() === clean(adminEmail).toLowerCase()
  const currentManager = clean(lead.financeManager)
  const assignmentOptions = currentManager && !assignmentUsers.some((user) => user.email === currentManager.toLowerCase())
    ? [{ email: currentManager.toLowerCase(), label: financeManagerLabel(currentManager) }, ...assignmentUsers]
    : assignmentUsers

  useEffect(() => {
    setCustomManager('')
  }, [lead.id])

  return (
    <div className="max-h-[94vh] overflow-y-auto bg-slate-50/70">
      <div className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-4 py-4 backdrop-blur sm:px-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#0B1F3A] text-sm font-bold text-white shadow-sm">
              {leadInitials(lead)}
            </div>
            <div className="min-w-0">
              <h2 className="break-words text-base font-bold leading-tight text-slate-950 sm:text-lg">{leadName(lead)}</h2>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span>Received {formatDate(lead.createdAt)}</span>
                <span className="hidden h-1 w-1 rounded-full bg-slate-300 sm:inline-block" />
                <span>{sourceLabel(source)} lead</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${sourcePillClass(source)}`}>
                  {sourceLabel(source)}
                </span>
                <ManagerStatusPill lead={lead} />
              </div>
            </div>
          </div>
          <button type="button" onClick={onClose} className="shrink-0 rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700" aria-label="Close lead details">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid gap-5 p-4 sm:p-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-5">
          <div className="grid gap-3 lg:grid-cols-4">
            <LeadSummaryCard
              icon={UserRound}
              label="Contact"
              primary={lead.email}
              secondary={lead.phone}
              href={lead.email ? `mailto:${lead.email}` : undefined}
            />
            <LeadSummaryCard
              icon={Car}
              label="Intent"
              primary={primaryIntent}
              secondary={lead.employmentStatus || sourceLabel(source)}
            />
            <LeadSummaryCard
              icon={BadgeCheck}
              label="Finance"
              primary={formatMoney(lead.monthlyIncome)}
              secondary={lead.creditScore ? `Credit: ${lead.creditScore}` : ''}
              tertiary={formatMoney(lead.downPayment) ? `Down: ${formatMoney(lead.downPayment)}` : ''}
            />
            <LeadSummaryCard
              icon={Users}
              label="Manager"
              primary={financeManagerLabel(lead.financeManager)}
              secondary={clean(lead.financeManager) || (financeManagerEnabled ? 'Not assigned' : 'Column not enabled')}
            />
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <DetailSection title="Contact" icon={UserRound}>
              <div className="grid h-full grid-rows-3 divide-y divide-slate-100">
                <DetailRow label="Email" value={lead.email} href={lead.email ? `mailto:${lead.email}` : undefined} />
                <DetailRow label="Phone" value={lead.phone} href={lead.phone ? `tel:${lead.phone}` : undefined} />
                <DetailRow label="Received" value={formatDate(lead.createdAt)} />
              </div>
            </DetailSection>

            <DetailSection title="Intent" icon={Car}>
              <div className="grid h-full grid-rows-5 divide-y divide-slate-100">
                <DetailRow label={primaryIntentLabel} value={primaryIntent} />
                <DetailRow label="Employment" value={lead.employmentStatus} />
                <DetailRow label="Income" value={formatMoney(lead.monthlyIncome)} />
                <DetailRow label="Down payment" value={formatMoney(lead.downPayment)} />
                <DetailRow label="Credit" value={lead.creditScore} />
              </div>
            </DetailSection>
          </div>

          {applicationRows.length > 0 && (
            <DetailSection title={applicationTitle} icon={FileSpreadsheet}>
              <div className="grid md:grid-cols-2">
                {applicationRows.map((row, index) => (
                  <div key={`${row.label}-${index}`} className="border-b border-slate-100 md:odd:border-r">
                    <DetailRow label={row.label} value={row.value} />
                  </div>
                ))}
              </div>
            </DetailSection>
          )}
        </div>

        <aside className="space-y-5 xl:sticky xl:top-24 xl:self-start">
          <DetailSection title="Finance manager" icon={Users}>
            <div className="space-y-3 p-3">
              <div className="rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2">
                <div className="text-[11px] font-bold uppercase text-slate-500">Assigned to</div>
                <div className={`mt-1 break-words text-sm font-semibold ${clean(lead.financeManager) ? 'text-slate-950' : 'text-slate-400'}`}>
                  {financeManagerLabel(lead.financeManager)}
                </div>
                {clean(lead.financeManager) ? (
                  <div className="mt-1 break-words text-xs text-slate-500">{lead.financeManager}</div>
                ) : null}
              </div>
              {financeManagerSaveError ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{financeManagerSaveError}</div>
              ) : null}
              {canManageAssignments ? (
                <div className="space-y-2">
                  <label className="block">
                    <span className="text-[11px] font-bold uppercase text-slate-500">Manual assignment</span>
                    <select
                      value={currentManager}
                      onChange={(event) => onAssignFinanceManager(lead, event.target.value || null)}
                      disabled={!financeManagerEnabled || savingFinanceManager}
                      className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-800 outline-none focus:border-[#1EA7FF]/50 focus:ring-2 focus:ring-[#1EA7FF]/20 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                    >
                      <option value="">Unassigned</option>
                      {assignmentUsersLoading ? <option value={currentManager || ''}>Loading users...</option> : null}
                      {assignmentOptions.map((user) => (
                        <option key={user.email} value={user.email}>
                          {user.label} ({user.email})
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="flex gap-2">
                    <input
                      value={customManager}
                      onChange={(event) => setCustomManager(event.target.value)}
                      placeholder="manager@example.com"
                      className="h-10 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-800 outline-none focus:border-[#1EA7FF]/50 focus:ring-2 focus:ring-[#1EA7FF]/20"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        onAssignFinanceManager(lead, customManager)
                        setCustomManager('')
                      }}
                      disabled={!financeManagerEnabled || savingFinanceManager || !clean(customManager)}
                      className="edc-btn-secondary h-10 px-3 text-xs disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Set
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => onAssignFinanceManager(lead)}
                  disabled={!financeManagerEnabled || !clean(adminEmail) || savingFinanceManager || assignedToCurrentUser}
                  className="edc-btn-primary h-10 w-full text-xs disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Users className="h-4 w-4" />
                  {savingFinanceManager
                    ? 'Assigning...'
                    : assignedToCurrentUser
                      ? 'Assigned to you'
                      : clean(lead.financeManager)
                        ? 'Reassign to me'
                        : 'Assign to me'}
                </button>
              )}
            </div>
          </DetailSection>

          <LeadNotesSection
            value={notesDraft}
            savedValue={lead.adminNotes || ''}
            financeManager={lead.financeManager}
            onChange={onNotesChange}
            onSave={() => onSaveNotes(lead)}
            saving={savingNotes}
            enabled={notesEnabled}
            error={notesSaveError}
          />

          {canDelete ? (
            <DetailSection title="Actions" icon={Eye}>
              <div className="grid gap-2 p-3">
                <button type="button" onClick={() => onDelete(lead)} className="edc-btn-danger h-10 w-full text-xs">
                  <Trash2 className="h-4 w-4" />
                  Delete lead
                </button>
              </div>
            </DetailSection>
          ) : null}
        </aside>
      </div>
    </div>
  )
}

function LeadSummaryCard({
  icon: Icon,
  label,
  primary,
  secondary,
  tertiary,
  href,
}: {
  icon: typeof UserRound
  label: string
  primary?: string | null
  secondary?: string | null
  tertiary?: string | null
  href?: string
}) {
  const primaryDisplay = clean(primary) || 'Not provided'
  const secondaryDisplay = clean(secondary)
  const tertiaryDisplay = clean(tertiary)

  return (
    <div className="min-w-0 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="flex items-center gap-2 text-[11px] font-bold uppercase text-slate-500">
        <Icon className="h-4 w-4 text-[#1EA7FF]" />
        {label}
      </div>
      {href && clean(primary) ? (
        <a href={href} className="mt-2 block min-w-0 truncate text-sm font-bold text-[#0877bd] hover:underline">
          {primaryDisplay}
        </a>
      ) : (
        <div className={`mt-2 min-w-0 truncate text-sm font-bold ${clean(primary) ? 'text-slate-950' : 'text-slate-400'}`}>
          {primaryDisplay}
        </div>
      )}
      {secondaryDisplay ? <div className="mt-1 truncate text-xs text-slate-500">{secondaryDisplay}</div> : null}
      {tertiaryDisplay ? <div className="mt-1 truncate text-xs text-slate-500">{tertiaryDisplay}</div> : null}
    </div>
  )
}

function LeadNotesSection({
  value,
  savedValue,
  financeManager,
  onChange,
  onSave,
  saving,
  enabled,
  error,
}: {
  value: string
  savedValue: string
  financeManager?: string | null
  onChange: (value: string) => void
  onSave: () => void
  saving: boolean
  enabled: boolean
  error: string
}) {
  const isDirty = !!value.trim()
  const hasTranscript = !!clean(savedValue)

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
          {saving ? 'Saving...' : 'Add note'}
        </button>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="mb-3 rounded-lg border border-slate-200 bg-slate-50/70 p-3">
          <div className="mb-2 text-[11px] font-semibold uppercase text-slate-500">Transcript</div>
          <LeadTranscriptDisplay value={savedValue} financeManager={financeManager} emptyClassName="text-sm leading-6" maxHeightClassName="max-h-44" />
        </div>
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={!enabled}
          rows={5}
          placeholder={enabled ? 'Add the next internal note...' : 'Apply the admin_notes database column to enable lead notes.'}
          className="min-h-[132px] w-full resize-y rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-[#1EA7FF]/50 focus:bg-white focus:ring-2 focus:ring-[#1EA7FF]/20 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
        />
        <div className="mt-2 flex items-center justify-between gap-3 text-xs">
          <span className={error ? 'text-red-600' : 'text-slate-400'}>
            {error || (isDirty ? 'New note ready to add' : hasTranscript ? 'History cannot be edited or deleted' : 'No notes yet')}
          </span>
          <span className="shrink-0 text-slate-400">{value.length} chars</span>
        </div>
      </div>
    </section>
  )
}

function LeadTranscriptDisplay({
  value,
  financeManager,
  maxHeightClassName,
  emptyClassName = '',
}: {
  value: string
  financeManager?: string | null
  maxHeightClassName: string
  emptyClassName?: string
}) {
  const entries = parseLeadTranscriptEntries(value)

  if (entries.length === 0) {
    return <div className={`${emptyClassName} text-slate-400`}>No notes yet</div>
  }

  return (
    <div className={`${maxHeightClassName} space-y-2 overflow-y-auto pr-1`}>
      {entries.map((entry, index) => {
        const kindLabel = entry.kind === 'status'
          ? 'Status update'
          : entry.kind === 'legacy'
            ? 'Legacy note'
            : 'Internal note'
        const kindClass = entry.kind === 'status'
          ? 'bg-sky-50 text-sky-700 ring-sky-100'
          : entry.kind === 'legacy'
            ? 'bg-amber-50 text-amber-700 ring-amber-100'
            : 'bg-slate-100 text-slate-700 ring-slate-200'
        const author = displayLeadTranscriptAuthor(entry.actor, financeManager || '')

        return (
          <div key={`${entry.timestamp}-${index}`} className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 shadow-sm">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ring-inset ${kindClass}`}>
                {kindLabel}
              </span>
              <span className="text-[11px] font-semibold text-slate-500">{entry.timestamp}</span>
            </div>
            <div className="mb-1 text-[11px] text-slate-500">
              By <span className="font-semibold text-slate-700">{author}</span>
            </div>
            <div className="whitespace-pre-wrap rounded-md bg-slate-50/70 px-2.5 py-2 text-sm leading-6 text-slate-800">{entry.body}</div>
          </div>
        )
      })}
    </div>
  )
}

function DetailSection({ title, icon: Icon, children }: { title: string; icon: typeof UserRound; children: ReactNode }) {
  return (
    <section className="flex h-full flex-col">
      <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase text-slate-500">
        <Icon className="h-4 w-4 text-[#1EA7FF]" />
        {title}
      </div>
      <div className="flex-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {children}
      </div>
    </section>
  )
}

function DetailRow({ label, value, href }: { label: string; value?: string | null; href?: string }) {
  const display = clean(value) || 'Not provided'
  return (
    <div className="grid items-center gap-1 px-3 py-2.5 text-sm sm:grid-cols-[minmax(104px,0.38fr)_minmax(0,1fr)] sm:gap-3">
      <div className="text-[11px] font-semibold uppercase leading-5 text-slate-500">{label}</div>
      {href && clean(value) ? (
        <a href={href} className="min-w-0 break-words font-medium leading-5 text-[#0877bd] hover:underline">{display}</a>
      ) : (
        <div className={`min-w-0 break-words leading-5 ${clean(value) ? 'font-medium text-slate-800' : 'text-slate-400'}`}>{display}</div>
      )}
    </div>
  )
}

const managerStatusClass = (status: LeadManagerStatus | null) => {
  if (status === 'Not Qualified') return 'bg-red-500 text-white ring-red-400'
  if (status === 'Booked') return 'bg-slate-950 text-white ring-slate-800'
  if (status === 'Conditional Approval') return 'bg-emerald-500 text-white ring-emerald-400'
  if (status === 'App Submitted') return 'bg-sky-500 text-white ring-sky-400'
  if (status === 'In Talks') return 'bg-orange-500 text-white ring-orange-400'
  if (status === 'Need More Information') return 'bg-amber-400 text-slate-950 ring-amber-300'
  if (status === 'No Contact') return 'bg-slate-500 text-white ring-slate-400'
  return 'bg-emerald-500 text-white ring-emerald-400'
}

const managerStatusLabel = (status: LeadManagerStatus) => status

const defaultLeadStatusLabel = (lead: Lead) => {
  if (lead.managerStatus) return managerStatusLabel(lead.managerStatus)
  if (lead.ghlSynced) return 'Handled'

  const source = sourceFromLead(lead)
  if (source === 'finance') return 'New Credit App'
  if (source === 'insurance') return 'New Insurance Application'
  if (source === 'contact') return 'New Contact Lead'
  return 'New Lead'
}

function ManagerStatusPill({ lead, interactive = false }: { lead: Lead; interactive?: boolean }) {
  const label = defaultLeadStatusLabel(lead)
  const className = lead.managerStatus
    ? managerStatusClass(lead.managerStatus)
    : lead.ghlSynced
      ? 'bg-slate-100 text-slate-600 ring-slate-200'
      : managerStatusClass(null)

  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold shadow-sm ring-1 ring-inset transition ${interactive ? 'group-hover:shadow-md' : ''} ${className}`}>
      {label}
      {interactive ? <ChevronDown className="h-3 w-3" aria-hidden="true" /> : null}
    </span>
  )
}

function StatusBadge({ lead, onClick }: { lead: Lead; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group inline-flex flex-col items-start gap-1 text-left"
      title="Click to update lead status"
      aria-label={`Update status for ${leadName(lead)}`}
    >
      <ManagerStatusPill lead={lead} interactive />
      <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400 transition-colors group-hover:text-[#0877bd]">
        Click to update
      </span>
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
