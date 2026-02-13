'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

import CreditAppTab from './CreditAppTab'
import CustomerInformationTab from './CustomerInformationTab'
import HistoryTab from './HistoryTab'
import jsPDF from 'jspdf'
import { renderCreditConsentPdf } from './creditConsentPdf'
import type { CreditForm, CustomerForm, CustomerRow } from './types'
import { supabase } from '@/lib/supabaseClient'

export default function AdminCostumerPage() {
  const [query, setQuery] = useState('')
  const [pageSize, setPageSize] = useState(5)
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [checkedAll, setCheckedAll] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveSuccessOpen, setSaveSuccessOpen] = useState(false)
  const [saveSuccessMessage, setSaveSuccessMessage] = useState('Saved successfully')
  const [saveErrorOpen, setSaveErrorOpen] = useState(false)
  const [saveErrorMessage, setSaveErrorMessage] = useState<string | null>(null)
  const [lastSavedTab, setLastSavedTab] = useState<'customer' | 'credit' | null>(null)
  const [rows, setRows] = useState<CustomerRow[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isCreate, setIsCreate] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'customer' | 'credit' | 'history'>('customer')
  const [printDropdownOpen, setPrintDropdownOpen] = useState(false)
  const [creditConsent, setCreditConsent] = useState(false)

  // Print system (PDF preview) - similar to admin/sales/deals/new
  const [showDocPreview, setShowDocPreview] = useState(false)
  const [pdfDataUri, setPdfDataUri] = useState<string | null>(null)
  const [pdfLoading, setPdfLoading] = useState(false)
  const printMenuRef = useRef<HTMLDivElement>(null)

  const getLoggedInAdminDbUserId = async (): Promise<string | null> => {
    try {
      if (typeof window === 'undefined') return null
      const raw = window.localStorage.getItem('edc_admin_session')
      if (!raw) return null
      const parsed = JSON.parse(raw) as { email?: string; user_id?: string }
      const sessionUserId = String(parsed?.user_id ?? '').trim()
      if (sessionUserId) return sessionUserId
      const email = String(parsed?.email ?? '').trim().toLowerCase()
      if (!email) return null

      const { data, error } = await supabase
        .from('edc_account_verifications')
        .select('id')
        .eq('email', email)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error) return null
      return (data as any)?.id ?? null
    } catch {
      return null
    }
  }

  const getWebhookUserId = async () => {
    const dbUserId = await getLoggedInAdminDbUserId()
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()
      if (userError) return dbUserId ?? null
      return dbUserId ?? user?.id ?? null
    } catch {
      return dbUserId ?? null
    }
  }

  const getDefaultForm = (): CustomerForm => ({
    customerType: 'IND',
    idType: 'RIN',
    firstName: '',
    middleName: '',
    lastName: '',
    rin: '',
    driversLicense: '',
    dlExpiry: '',
    dateOfBirth: '',
    legalName: '',
    companyName: '',
    mvda: '',
    yearEnd: '',
    taxNumber: '',
    contactFirstName: '',
    contactLastName: '',
    salespersonReg: '',
    fax: '',
    streetAddress: '',
    suiteApt: '',
    city: '',
    province: 'ON',
    postalCode: '',
    country: 'CA',
    phone: '',
    mobile: '',
    email: '',
    salesperson: 'Nawshad Syed',
    visibility: 'Private',
    notes: '',
  })

  const getDefaultCredit = (): CreditForm => ({
    salutation: '',
    gender: '',
    maritalStatus: '',
    residenceOwnership: 'Own',
    marketValue: '0',
    mortgageAmount: '0',
    monthlyPayment: '0',
    bank: '',
    yearsAtPresentAddress: '',
    employments: [
      {
        employmentType: 'Full Time',
        position: '',
        occupation: '',
        employerName: '',
        employerPhone: '',
        yearsEmployed: '',
        streetAddress: '',
        suiteApt: '',
        city: '',
        province: 'ON',
        postalCode: '',
        country: 'CA',
      },
    ],
    incomes: [
      {
        incomeType: 'Employment',
        rateHr: '0',
        hrsWeek: '0',
        monthlyGross: '0',
        annualGross: '0',
        incomeNotes: '',
      },
    ],
    declaredBankruptcy: false,
    hasCollections: false,
    financialInstitution: '',
    desiredMonthlyPayment: '0',
  })

  const [form, setForm] = useState<CustomerForm>(getDefaultForm)

  const [credit, setCredit] = useState<CreditForm>(getDefaultCredit)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const user_id = await getWebhookUserId().catch(() => null)
      if (!user_id) return
      const { data, error } = await supabase
        .from('edc_customer')
        .select('id, first_name, last_name, phone, mobile, email, drivers_license, rin, date_of_birth')
        .eq('user_id', user_id)
        .order('created_at', { ascending: false })
        .limit(100)
      if (error) {
        // Fail silently for now; keep empty list
        return
      }
      if (cancelled || !data) return
      const mapped: CustomerRow[] = data.map((r: any) => ({
        id: r.id,
        name: [r.first_name, r.last_name].filter(Boolean).join(' ').trim(),
        phone: r.phone || '',
        mobile: r.mobile || '',
        email: r.email || '',
        dl: r.drivers_license || '',
        rin: r.rin || '',
        dob: r.date_of_birth || '',
      }))
      setRows(mapped)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (printDropdownOpen) {
        const target = event.target as Element
        if (!target.closest('.print-dropdown')) {
          setPrintDropdownOpen(false)
        }
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [printDropdownOpen])

  // Close documents preview modal on ESC
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowDocPreview(false)
    }
    if (showDocPreview) document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [showDocPreview])

  const handleDownloadPdf = () => {
    if (!pdfDataUri) return
    const byteString = atob(pdfDataUri.split(',')[1])
    const mimeString = pdfDataUri.split(',')[0].split(':')[1].split(';')[0]
    const ab = new ArrayBuffer(byteString.length)
    const ia = new Uint8Array(ab)
    for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i)
    const blob = new Blob([ab], { type: mimeString })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Credit_Consent_${editingId ?? 'customer'}.pdf`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handlePrintCreditConsent = async () => {
    if (!editingId) return
    setPrintDropdownOpen(false)
    setPdfLoading(true)
    try {
      const user_id = await getWebhookUserId().catch(() => null)
      if (!user_id) throw new Error('Missing user')

      const { data: cust } = await supabase
        .from('edc_customer')
        .select('*')
        .eq('id', editingId)
        .eq('user_id', user_id)
        .maybeSingle()

      const { data: credit } = await supabase
        .from('edc_creditapp')
        .select('*')
        .eq('customer_id', editingId)
        .eq('user_id', user_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      const c: any = cust ?? {}
      const cr: any = credit ?? {}

      const emp = Array.isArray(cr.employments) ? cr.employments?.[0] : null
      const inc = Array.isArray(cr.incomes) ? cr.incomes?.[0] : null

      const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' })
      renderCreditConsentPdf(doc, {
        dateLabel: new Date().toLocaleDateString(),

        companyName: 'EASYDRIVE CANADA',
        companyStreet: '4856 Bank St Unit A',
        companyCityLine: 'Ottawa ON K1X 1G6 CA',
        companyPhone: '6138798355',

        applicantName: [c.first_name ?? c.firstName ?? '', c.last_name ?? c.lastName ?? ''].filter(Boolean).join(' ').trim(),
        applicantStreet: c.street_address ?? c.streetAddress ?? '',
        applicantCityLine: [c.city ?? '', c.province ?? '', c.postal_code ?? c.postalCode ?? '', c.country ?? ''].filter(Boolean).join(' ').trim(),
        applicantPhone: c.phone ?? '',
        applicantDob: c.date_of_birth ?? c.dateOfBirth ?? '',
        applicantGender: cr.gender ?? '',

        rentOwn: cr.residence_ownership ?? cr.residenceOwnership ?? '',
        marketValue: String(cr.market_value ?? cr.marketValue ?? ''),
        mortgageAmount: String(cr.mortgage_amount ?? cr.mortgageAmount ?? ''),
        monthlyPayment: String(cr.monthly_payment ?? cr.monthlyPayment ?? ''),

        employmentType: emp?.employment_type ?? emp?.employmentType ?? '',
        position: emp?.position ?? '',
        occupation: emp?.occupation ?? '',
        yearsEmployed: String(emp?.years_employed ?? emp?.yearsEmployed ?? ''),

        incomeSource: inc?.income_type ?? inc?.incomeType ?? '',
        monthlyGross: String(inc?.monthly_gross ?? inc?.monthlyGross ?? ''),
        annualGross: String(inc?.annual_gross ?? inc?.annualGross ?? ''),

        consentText: 'EASYDRIVE CANADA consent to do a background check with %dealership%.',
        authorizedBy: 'Authorized By: Syed Islam - Owner',
      })

      const dataUri = doc.output('datauristring')
      setPdfDataUri(dataUri)
      setShowDocPreview(true)
    } catch (e) {
      console.error('[Print Credit Consent] Error generating PDF:', e)
    } finally {
      setPdfLoading(false)
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) => {
      return (
        r.name.toLowerCase().includes(q) ||
        r.phone.toLowerCase().includes(q) ||
        r.mobile.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q) ||
        r.dl.toLowerCase().includes(q) ||
        r.dob.toLowerCase().includes(q)
      )
    })
  }, [query, rows])

  const pageRows = filtered.slice(0, pageSize)

  const toggleAll = (next: boolean) => {
    setCheckedAll(next)
    if (!next) {
      setChecked({})
      return
    }
    const nextChecked: Record<string, boolean> = {}
    for (const r of pageRows) nextChecked[r.id] = true
    setChecked(nextChecked)
  }

  const rangeLabel = useMemo(() => {
    const start = filtered.length === 0 ? 0 : 1
    const end = Math.min(filtered.length, pageSize)
    return `${start} to ${end}`
  }, [filtered.length, pageSize])

  const handleOpenCreate = () => {
    setActiveTab('customer')
    setEditingId(null)
    setIsCreate(true)
    setForm(getDefaultForm())
    setCredit(getDefaultCredit())
    setShowCreate(true)
  }

  const handleEdit = async (id: string) => {
    setActiveTab('customer')
    setEditingId(id)
    setIsCreate(false)
    setForm(getDefaultForm())
    setCredit(getDefaultCredit())
    setShowCreate(true)
    try {
      const user_id = await getWebhookUserId().catch(() => null)
      if (!user_id) return
      const { data, error } = await supabase.from('edc_customer').select('*').eq('id', id).eq('user_id', user_id).single()
      if (error || !data) return

      const r: any = data

      setForm((prev) => ({
        ...prev,
        customerType: (r.customer_type || r.customerType || prev.customerType) as any,
        idType: (r.id_type || r.idType || prev.idType) as any,
        firstName: r.first_name ?? r.firstName ?? prev.firstName,
        middleName: r.middle_name ?? r.middleName ?? prev.middleName,
        lastName: r.last_name ?? r.lastName ?? prev.lastName,
        rin: r.rin ?? prev.rin,
        driversLicense: r.drivers_license ?? r.driversLicense ?? prev.driversLicense,
        dlExpiry: r.dl_expiry ?? r.dlExpiry ?? prev.dlExpiry,
        dateOfBirth: r.date_of_birth ?? r.dateOfBirth ?? prev.dateOfBirth,
        legalName: r.legal_name ?? r.legalName ?? prev.legalName,
        companyName: r.company_name ?? r.companyName ?? prev.companyName,
        mvda: r.mvda ?? prev.mvda,
        yearEnd: r.year_end ?? r.yearEnd ?? prev.yearEnd,
        taxNumber: r.tax_number ?? r.taxNumber ?? prev.taxNumber,
        contactFirstName: r.contact_first_name ?? r.contactFirstName ?? prev.contactFirstName,
        contactLastName: r.contact_last_name ?? r.contactLastName ?? prev.contactLastName,
        salespersonReg: r.salesperson_reg ?? r.salespersonReg ?? prev.salespersonReg,
        fax: r.fax ?? prev.fax,
        streetAddress: r.street_address ?? r.streetAddress ?? prev.streetAddress,
        suiteApt: r.suite_apt ?? r.suiteApt ?? prev.suiteApt,
        city: r.city ?? prev.city,
        province: r.province ?? prev.province,
        postalCode: r.postal_code ?? r.postalCode ?? prev.postalCode,
        country: r.country ?? prev.country,
        phone: r.phone ?? prev.phone,
        mobile: r.mobile ?? prev.mobile,
        email: r.email ?? prev.email,
        salesperson: r.salesperson ?? prev.salesperson,
        visibility: r.visibility ?? prev.visibility,
        notes: r.notes ?? prev.notes,
      }))

      const toArray = (raw: any) => {
        if (!raw) return null
        if (Array.isArray(raw)) return raw
        if (typeof raw === 'string') {
          const s = raw.trim()
          if (!s) return null
          try {
            const parsed = JSON.parse(s)
            if (Array.isArray(parsed)) return parsed
          } catch {
            return null
          }
        }
        return null
      }

      const emp = toArray(r.employments) as any[] | null
      const inc = toArray(r.incomes) as any[] | null

      const { data: creditData, error: creditError } = await supabase
        .from('edc_creditapp')
        .select('*')
        .eq('customer_id', id)
        .eq('user_id', user_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (!creditError && creditData) {
        const c: any = creditData
        const creditEmp = toArray(c.employments) as any[] | null
        const creditInc = toArray(c.incomes) as any[] | null

        setCredit((prev) => ({
          ...prev,
          salutation: c.salutation ?? prev.salutation,
          gender: c.gender ?? prev.gender,
          maritalStatus: c.marital_status ?? c.maritalStatus ?? prev.maritalStatus,
          residenceOwnership: c.residence_ownership ?? c.residenceOwnership ?? prev.residenceOwnership,
          marketValue: String(c.market_value ?? c.marketValue ?? prev.marketValue ?? '0'),
          mortgageAmount: String(c.mortgage_amount ?? c.mortgageAmount ?? prev.mortgageAmount ?? '0'),
          monthlyPayment: String(c.monthly_payment ?? c.monthlyPayment ?? prev.monthlyPayment ?? '0'),
          bank: c.bank ?? prev.bank,
          yearsAtPresentAddress: c.years_at_present_address ?? c.yearsAtPresentAddress ?? prev.yearsAtPresentAddress,
          employments: creditEmp
            ? creditEmp.map((e: any) => ({
                employmentType: e.employment_type ?? e.employmentType ?? 'Full Time',
                position: e.position ?? '',
                occupation: e.occupation ?? '',
                employerName: e.employer_name ?? e.employerName ?? '',
                employerPhone: e.employer_phone ?? e.employerPhone ?? '',
                yearsEmployed: e.years_employed ?? e.yearsEmployed ?? '',
                streetAddress: e.street_address ?? e.streetAddress ?? '',
                suiteApt: e.suite_apt ?? e.suiteApt ?? '',
                city: e.city ?? '',
                province: e.province ?? 'ON',
                postalCode: e.postal_code ?? e.postalCode ?? '',
                country: e.country ?? 'CA',
              }))
            : prev.employments,
          incomes: creditInc
            ? creditInc.map((i: any) => ({
                incomeType: i.income_type ?? i.incomeType ?? 'Employment',
                rateHr: String(i.rate_hr ?? i.rateHr ?? '0'),
                hrsWeek: String(i.hrs_week ?? i.hrsWeek ?? '0'),
                monthlyGross: String(i.monthly_gross ?? i.monthlyGross ?? '0'),
                annualGross: String(i.annual_gross ?? i.annualGross ?? '0'),
                incomeNotes: i.income_notes ?? i.incomeNotes ?? '',
              }))
            : prev.incomes,
          declaredBankruptcy: Boolean(c.declared_bankruptcy ?? c.declaredBankruptcy ?? prev.declaredBankruptcy),
          bankruptcyDuration: c.bankruptcy_duration ?? c.bankruptcyDuration ?? prev.bankruptcyDuration,
          hasCollections: Boolean(c.has_collections ?? c.hasCollections ?? prev.hasCollections),
          collectionNotes: c.collection_notes ?? c.collectionNotes ?? prev.collectionNotes,
          financialInstitution: c.financial_institution ?? c.financialInstitution ?? prev.financialInstitution,
          desiredMonthlyPayment: String(c.desired_monthly_payment ?? c.desiredMonthlyPayment ?? prev.desiredMonthlyPayment ?? '0'),
        }))
      } else {
        setCredit((prev) => ({
          ...prev,
          employments: emp
            ? emp.map((e: any) => ({
                employmentType: e.employment_type ?? e.employmentType ?? 'Full Time',
                position: e.position ?? '',
                occupation: e.occupation ?? '',
                employerName: e.employer_name ?? e.employerName ?? '',
                employerPhone: e.employer_phone ?? e.employerPhone ?? '',
                yearsEmployed: e.years_employed ?? e.yearsEmployed ?? '',
                streetAddress: e.street_address ?? e.streetAddress ?? '',
                suiteApt: e.suite_apt ?? e.suiteApt ?? '',
                city: e.city ?? '',
                province: e.province ?? 'ON',
                postalCode: e.postal_code ?? e.postalCode ?? '',
                country: e.country ?? 'CA',
              }))
            : prev.employments,
          incomes: inc
            ? inc.map((i: any) => ({
                incomeType: i.income_type ?? i.incomeType ?? 'Employment',
                rateHr: String(i.rate_hr ?? i.rateHr ?? '0'),
                hrsWeek: String(i.hrs_week ?? i.hrsWeek ?? '0'),
                monthlyGross: String(i.monthly_gross ?? i.monthlyGross ?? '0'),
                annualGross: String(i.annual_gross ?? i.annualGross ?? '0'),
                incomeNotes: i.income_notes ?? i.incomeNotes ?? '',
              }))
            : prev.incomes,
        }))
      }
    } catch {
      // ignore
    }
  }

  const handleBackToList = () => {
    setShowCreate(false)
  }

  const closeSuccessModal = () => {
    setSaveSuccessOpen(false)
    if (lastSavedTab === 'credit') {
      setShowCreate(false)
    }
    setLastSavedTab(null)
  }

  const handleDelete = async (id: string) => {
    if (deletingId) return
    const ok = confirm('Delete this customer?')
    if (!ok) return
    setDeletingId(id)
    try {
      const user_id = await getWebhookUserId().catch(() => null)
      if (!user_id) return
      const { error } = await supabase.from('edc_customer').delete().eq('id', id).eq('user_id', user_id)
      if (error) throw error
      setRows((prev) => prev.filter((r) => r.id !== id))
      setChecked((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })
      if (editingId === id) {
        setShowCreate(false)
        setEditingId(null)
      }
    } catch (err) {
      setSaveErrorMessage(`Failed to delete: ${err instanceof Error ? err.message : String(err)}`)
      setSaveErrorOpen(true)
    } finally {
      setDeletingId(null)
    }
  }

  const saveCustomerInfo = async (): Promise<string | null> => {
    if (saving) return null
    setSaveSuccessOpen(false)
    setSaveErrorOpen(false)
    setSaveErrorMessage(null)
    setSaving(true)
    try {
      const operation = isCreate ? 'create' : 'edit'

      const user_id = await getWebhookUserId().catch(() => null)
      if (!user_id) throw new Error('Missing user')

      const toNulls = (obj: Record<string, unknown>) => {
        const out: Record<string, unknown> = {}
        for (const [k, v] of Object.entries(obj)) {
          if (v === '') out[k] = null
          else out[k] = v
        }
        return out
      }

      const payload = {
        ...toNulls(form as unknown as Record<string, unknown>),
        user_id,
        operation,
        customerId: editingId ?? null,
      }

      const res = await fetch('/api/proxy/info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      // Try to extract an ID from the webhook response first
      let createdId: string | null = null
      let rawText = ''
      try {
        const json = await res.clone().json()
        if (json && typeof json.id === 'string') createdId = json.id
      } catch {
        // ignore
      }
      if (!createdId) {
        rawText = await res.text().catch(() => '')
      }
      if (!res.ok) {
        throw new Error(rawText || `HTTP ${res.status}`)
      }
      if (!createdId && rawText.trim() !== 'Done') {
        // If text isn't the sentinel Done, treat it as an ID when it looks like one (uuid-ish)
        const maybeId = rawText.trim()
        if (maybeId && maybeId.length >= 8) createdId = maybeId
      }

      // If still no id, try to locate the record in Supabase using strongest identifiers
      if (!createdId) {
        const tryFind = async (): Promise<string | null> => {
          // 1) drivers_license match
          if (form.driversLicense) {
            const { data } = await supabase
              .from('edc_customer')
              .select('id')
              .eq('drivers_license', form.driversLicense)
              .eq('user_id', user_id)
              .order('created_at', { ascending: false })
              .limit(1)
            if (data && data[0]?.id) return data[0].id as string
          }
          // 2) email match
          if (form.email) {
            const { data } = await supabase
              .from('edc_customer')
              .select('id')
              .eq('email', form.email)
              .eq('user_id', user_id)
              .order('created_at', { ascending: false })
              .limit(1)
            if (data && data[0]?.id) return data[0].id as string
          }
          // 3) name + DOB
          if (form.firstName || form.lastName || form.dateOfBirth) {
            let query = supabase
              .from('edc_customer')
              .select('id')
              .eq('user_id', user_id)
              .order('created_at', { ascending: false })
              .limit(1)
            if (form.firstName) query = query.eq('first_name', form.firstName)
            if (form.lastName) query = query.eq('last_name', form.lastName)
            if (form.dateOfBirth) query = query.eq('date_of_birth', form.dateOfBirth)
            const { data } = await query
            if (data && data[0]?.id) return data[0].id as string
          }
          return null
        }
        createdId = await tryFind()
      }

      if (createdId && !editingId) setEditingId(createdId)

      setSaveSuccessMessage('Customer information saved successfully')
      setSaveSuccessOpen(true)
      setLastSavedTab('customer')
      return createdId ?? editingId ?? null
    } catch (err) {
      setSaveErrorMessage(err instanceof Error ? err.message : String(err))
      setSaveErrorOpen(true)
      return null
    } finally {
      setSaving(false)
    }
  }

  const saveCreditApp = async (): Promise<void> => {
    if (saving) return
    setSaveSuccessOpen(false)
    setSaveErrorOpen(false)
    setSaveErrorMessage(null)
    setSaving(true)
    try {
      const operation = isCreate ? 'create' : 'edit'
      const user_id = await getWebhookUserId().catch(() => null)
      if (!user_id) throw new Error('Missing user')

      const customerId = editingId
      if (!customerId) {
        throw new Error('Please save Customer Information first')
      }

      const toNulls = (obj: Record<string, unknown>) => {
        const out: Record<string, unknown> = {}
        for (const [k, v] of Object.entries(obj)) {
          if (v === '') out[k] = null
          else out[k] = v
        }
        return out
      }

      const creditToNulls = toNulls(credit as unknown as Record<string, unknown>)
      const creditPayload = {
        user_id,
        customerId,
        ...creditToNulls,
        operation,
        bankruptcy_duration: (credit as any).bankruptcyDuration ?? null,
        collection_notes: (credit as any).collectionNotes ?? null,
      }

      const resCredit = await fetch('/api/proxy/creditApp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(creditPayload),
      })

      const creditText = await resCredit.text().catch(() => '')
      if (!resCredit.ok) {
        throw new Error(creditText || `Credit HTTP ${resCredit.status}`)
      }

      setSaveSuccessMessage('Credit app saved successfully')
      setSaveSuccessOpen(true)
      setLastSavedTab('credit')
    } catch (err) {
      setSaveErrorMessage(err instanceof Error ? err.message : String(err))
      setSaveErrorOpen(true)
    } finally {
      setSaving(false)
    }
  }

  const handleSave = async () => {
    if (activeTab === 'credit') {
      await saveCreditApp()
      return
    }
    await saveCustomerInfo()
  }

  return (
    <div className="w-full">
      {saveSuccessOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/50" onMouseDown={closeSuccessModal} />
          <div className="relative w-[360px] bg-white shadow-lg">
            <div className="h-11 px-4 border-b border-gray-200 flex items-center justify-between">
              <div className="text-sm font-semibold text-gray-800">Success</div>
              <button type="button" className="h-8 w-8 flex items-center justify-center" onClick={closeSuccessModal}>
                <span className="text-xl leading-none text-gray-500">×</span>
              </button>
            </div>
            <div className="p-4 text-xs text-gray-700">{saveSuccessMessage}</div>
            <div className="h-12 px-4 border-t border-gray-200 flex items-center justify-end">
              <button type="button" className="h-8 px-4 bg-[#118df0] text-white text-xs font-semibold" onClick={closeSuccessModal}>
                OK
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {saveErrorOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/50" onMouseDown={() => setSaveErrorOpen(false)} />
          <div className="relative w-[360px] bg-white shadow-lg">
            <div className="h-11 px-4 border-b border-gray-200 flex items-center justify-between">
              <div className="text-sm font-semibold text-gray-800">Error</div>
              <button type="button" className="h-8 w-8 flex items-center justify-center" onClick={() => setSaveErrorOpen(false)}>
                <span className="text-xl leading-none text-gray-500">×</span>
              </button>
            </div>
            <div className="p-4 text-xs text-gray-700">{saveErrorMessage || 'Something went wrong'}</div>
            <div className="h-12 px-4 border-t border-gray-200 flex items-center justify-end">
              <button type="button" className="h-8 px-4 bg-gray-600 text-white text-xs font-semibold" onClick={() => setSaveErrorOpen(false)}>
                OK
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showCreate ? (
        <div className="w-full px-4 sm:px-6 lg:px-8 py-6">
          <div className="bg-white rounded-xl shadow overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className={
                      activeTab === 'customer'
                        ? 'h-9 px-4 rounded-t-md bg-[#118df0] text-white text-sm font-semibold'
                        : 'h-9 px-4 rounded-t-md bg-gray-100 text-gray-700 text-sm font-semibold hover:bg-gray-200'
                    }
                    onClick={() => setActiveTab('customer')}
                  >
                    Customer Information
                  </button>
                  <button
                    type="button"
                    className={
                      activeTab === 'credit'
                        ? 'h-9 px-4 rounded-t-md bg-[#118df0] text-white text-sm font-semibold'
                        : 'h-9 px-4 rounded-t-md bg-gray-100 text-gray-700 text-sm font-semibold hover:bg-gray-200'
                    }
                    onClick={() => setActiveTab('credit')}
                  >
                    Credit App.
                  </button>
                  <button
                    type="button"
                    className={
                      activeTab === 'history'
                        ? 'h-9 px-4 rounded-t-md bg-[#118df0] text-white text-sm font-semibold'
                        : 'h-9 px-4 rounded-t-md bg-gray-100 text-gray-700 text-sm font-semibold hover:bg-gray-200'
                    }
                    onClick={() => setActiveTab('history')}
                  >
                    History
                  </button>
                </div>
              </div>

              <div className="flex items-center ml-auto">
                {/* Print dropdown */}
                <div className="relative print-dropdown" ref={printMenuRef}>
                  <div className="inline-flex shadow-sm">
                    <button
                      type="button"
                      className="h-10 px-4 rounded-l-md bg-[#118df0] text-white text-sm font-bold hover:bg-[#0d6ebd] flex items-center gap-2"
                      onClick={() => {
                        if (!creditConsent) {
                          setPrintDropdownOpen(true)
                          return
                        }
                        setPrintDropdownOpen(false)
                        handlePrintCreditConsent()
                      }}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
                        />
                      </svg>
                      Print
                    </button>
                    <button
                      type="button"
                      className="h-10 w-10 rounded-r-md bg-[#118df0] text-white hover:bg-[#0d6ebd] flex items-center justify-center border-l border-white/20"
                      aria-label="Print options"
                      onClick={() => setPrintDropdownOpen((o) => !o)}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>
                  {printDropdownOpen && (
                    <div className="absolute right-0 mt-1 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                      <div className="p-3">
                        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={creditConsent}
                            onChange={(e) => setCreditConsent(e.target.checked)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          Credit Consent
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto bg-white">
              {activeTab === 'customer' ? (
                <CustomerInformationTab form={form} setForm={setForm} />
              ) : activeTab === 'credit' ? (
                <CreditAppTab credit={credit} setCredit={setCredit} isCreate={isCreate} />
              ) : (
                <HistoryTab customerId={editingId ?? ''} />
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className={`h-10 px-6 rounded text-white text-sm font-semibold ${saving ? 'bg-[#73baf2] cursor-not-allowed' : 'bg-[#118df0] hover:bg-[#0d6ebd]'}`}
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="w-full px-4 sm:px-6 lg:px-8 py-6">
          <div className="bg-white rounded-xl shadow overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-3">
              <div className="flex-1">
                <div className="relative">
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder=""
                    className="w-full border border-gray-200 rounded-lg pl-10 pr-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
                  />
                  <svg
                    className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35m1.35-5.65a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </div>

              <button
                type="button"
                onClick={handleOpenCreate}
                className="w-10 h-10 rounded-lg bg-[#118df0] text-white flex items-center justify-center hover:bg-[#0d6ebd]"
                aria-label="Add new costumer"
                title="Add new costumer"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>

              <div className="w-20">
                <select
                  value={pageSize}
                  onChange={(e) => {
                    const v = Number(e.target.value)
                    setPageSize(Number.isFinite(v) ? v : 5)
                    setChecked({})
                    setCheckedAll(false)
                  }}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-white">
                  <tr className="border-b border-gray-200">
                    <th className="px-3 py-3 w-10"></th>
                    <th className="px-3 py-3 w-10">
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={checkedAll && pageRows.length > 0}
                        onChange={(e) => toggleAll(e.target.checked)}
                        aria-label="Select all"
                      />
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Phone</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Mobile</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Email</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">DL</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">DOB</th>
                    <th className="px-3 py-3 w-10"></th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">
                  {pageRows.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-3 py-3">
                        <button type="button" className="text-gray-400 hover:text-gray-600" aria-label="Edit" onClick={() => handleEdit(r.id)}>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"
                            />
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"
                            />
                          </svg>
                        </button>
                      </td>
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          className="h-4 w-4"
                          checked={!!checked[r.id]}
                          onChange={(e) => {
                            const next = e.target.checked
                            setChecked((prev) => ({ ...prev, [r.id]: next }))
                          }}
                          aria-label={`Select ${r.name}`}
                        />
                      </td>
                      <td className="px-6 py-3 text-sm text-[#118df0] whitespace-nowrap">{r.name}</td>
                      <td className="px-6 py-3 text-sm text-[#118df0] whitespace-nowrap">{r.phone}</td>
                      <td className="px-6 py-3 text-sm text-gray-700 whitespace-nowrap">{r.mobile}</td>
                      <td className="px-6 py-3 text-sm text-[#118df0] whitespace-nowrap">{r.email}</td>
                      <td className="px-6 py-3 text-sm text-gray-700 whitespace-nowrap">{r.dl || r.rin || '—'}</td>
                      <td className="px-6 py-3 text-sm text-gray-700 whitespace-nowrap">{r.dob}</td>
                      <td className="px-3 py-3 text-right">
                        <button
                          type="button"
                          className={
                            deletingId === r.id
                              ? 'text-gray-300 cursor-not-allowed'
                              : 'text-gray-400 hover:text-red-600'
                          }
                          aria-label="Delete"
                          disabled={deletingId === r.id}
                          onClick={() => handleDelete(r.id)}
                          title="Delete"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 11v6m4-6v6" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m2 0H7m2 0V5a2 2 0 012-2h2a2 2 0 012 2v2" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))}

                  {pageRows.length === 0 ? (
                    <tr>
                      <td className="px-6 py-10 text-center text-sm text-gray-500" colSpan={9}>
                        No results.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            <div className="px-4 py-3 flex items-center gap-3">
              <button type="button" className="text-[#118df0]" aria-label="Previous">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div className="text-sm text-gray-600">{rangeLabel}</div>
              <button type="button" className="text-[#118df0]" aria-label="Next">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Documents Preview Modal (PDF) */}
      {showDocPreview && pdfDataUri ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowDocPreview(false)} />
          <div className="relative w-full max-w-3xl h-[90vh] rounded-xl bg-white shadow-xl border border-gray-200 flex flex-col overflow-hidden">
            <div className="h-12 px-4 border-b border-gray-200 flex items-center justify-between">
              <div className="text-sm font-semibold text-gray-800">Credit Consent</div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={handleDownloadPdf} className="h-9 px-3 rounded bg-gray-100 text-gray-700 text-sm font-semibold hover:bg-gray-200">
                  Download
                </button>
                <button type="button" onClick={() => setShowDocPreview(false)} className="h-9 w-9 rounded bg-gray-100 text-gray-700 hover:bg-gray-200 flex items-center justify-center" aria-label="Close">
                  <span className="text-xl leading-none">×</span>
                </button>
              </div>
            </div>
            <div className="flex-1 bg-gray-100 p-3">
              <iframe title="Credit Consent PDF" src={pdfDataUri} className="w-full h-full bg-white rounded" />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
