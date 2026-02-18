'use client'

import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

type NewVendorFormState = {
  companyName: string
  firstName: string
  lastName: string
  salespersonRegistration: string
  companyMvda: string
  taxNumber: string
  rin: string
  streetAddress: string
  suiteApt: string
  city: string
  province: string
  postalCode: string
  country: string
  phone: string
  fax: string
  mobile: string
  email: string
}

function AdminVendorsNewPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const vendorId = String(searchParams?.get('id') ?? '').trim() || null
  const [saving, setSaving] = useState(false)
  const [resultOpen, setResultOpen] = useState(false)
  const [resultOk, setResultOk] = useState<boolean>(false)
  const [resultTitle, setResultTitle] = useState('')
  const [resultMessage, setResultMessage] = useState('')
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [loadingVendor, setLoadingVendor] = useState(false)
  const [form, setForm] = useState<NewVendorFormState>({
    companyName: '',
    firstName: '',
    lastName: '',
    salespersonRegistration: '',
    companyMvda: '',
    taxNumber: '',
    rin: '',
    streetAddress: '',
    suiteApt: '',
    city: '',
    province: 'ON',
    postalCode: '',
    country: 'CA',
    phone: '',
    fax: '',
    mobile: '',
    email: '',
  })

  const canSave = useMemo(() => true, [])

  useEffect(() => {
    return () => {
      if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current)
    }
  }, [])

  useEffect(() => {
    const loadVendor = async () => {
      if (!vendorId) return
      setLoadingVendor(true)
      try {
        const { data, error } = await supabase
          .from('edc_vendors')
          .select(
            'id, company_name, vendor_name, contact_first_name, contact_last_name, street_address, suite_apt, city, province, postal_code, country, phone, fax, mobile, email, salesperson_registration, company_mvda, tax_number, rin'
          )
          .eq('id', vendorId)
          .maybeSingle()

        if (error) throw error
        if (!data) return

        setForm((prev) => ({
          ...prev,
          companyName: String((data as any).company_name ?? ''),
          firstName: String((data as any).contact_first_name ?? ''),
          lastName: String((data as any).contact_last_name ?? ''),
          salespersonRegistration: String((data as any).salesperson_registration ?? ''),
          companyMvda: String((data as any).company_mvda ?? ''),
          taxNumber: String((data as any).tax_number ?? ''),
          rin: String((data as any).rin ?? ''),
          streetAddress: String((data as any).street_address ?? ''),
          suiteApt: String((data as any).suite_apt ?? ''),
          city: String((data as any).city ?? ''),
          province: String((data as any).province ?? (prev.province || 'ON')),
          postalCode: String((data as any).postal_code ?? ''),
          country: String((data as any).country ?? (prev.country || 'CA')),
          phone: String((data as any).phone ?? ''),
          fax: String((data as any).fax ?? ''),
          mobile: String((data as any).mobile ?? ''),
          email: String((data as any).email ?? ''),
        }))
      } catch (e: any) {
        setResultOk(false)
        setResultTitle('Unsuccessful')
        setResultMessage(e?.message || 'Failed to load vendor')
        setResultOpen(true)
      } finally {
        setLoadingVendor(false)
      }
    }

    void loadVendor()
  }, [vendorId])

  const setField = <K extends keyof NewVendorFormState>(key: K, value: NewVendorFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

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

  const onSave = async () => {
    if (saving || !canSave) return
    setSaving(true)
    try {
      const userId = await getLoggedInAdminDbUserId()
      const fullName = `${form.firstName} ${form.lastName}`.replace(/\s+/g, ' ').trim()
      const vendorName = fullName || form.companyName.trim()
      const category = vendorId ? 'edit' : 'create'

      const payload = {
        companyName: form.companyName.trim() || null,
        contactFirstName: form.firstName.trim() || null,
        contactLastName: form.lastName.trim() || null,
        salespersonRegistration: form.salespersonRegistration.trim() || null,
        companyMvda: form.companyMvda.trim() || null,
        taxNumber: form.taxNumber.trim() || null,
        rin: form.rin.trim() || null,
        streetAddress: form.streetAddress.trim() || null,
        suiteApt: form.suiteApt.trim() || null,
        city: form.city.trim() || null,
        province: form.province.trim() || null,
        postalCode: form.postalCode.trim() || null,
        country: form.country.trim() || null,
        phone: form.phone.trim() || null,
        fax: form.fax.trim() || null,
        mobile: form.mobile.trim() || null,
        email: form.email.trim() || null,
        vendorName,
        category,
        user_id: userId,
        vendor_id: vendorId,
      }

      const res = await fetch('/api/addvendor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const rawText = await res.text().catch(() => '')
      let serverMessage = ''
      try {
        const maybeJson = rawText ? JSON.parse(rawText) : null
        if (maybeJson && typeof maybeJson === 'object') {
          const msg = (maybeJson as any).message
          if (typeof msg === 'string') serverMessage = msg
        }
      } catch {
        serverMessage = ''
      }

      if (res.ok) {
        setResultOk(true)
        setResultTitle('Saved Successfully')
        setResultMessage(serverMessage || 'Vendor saved.')
      } else {
        setResultOk(false)
        setResultTitle('Unsuccessful')
        setResultMessage(serverMessage || rawText || `Webhook responded with ${res.status}`)
      }
      setResultOpen(true)

      if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current)
      redirectTimerRef.current = setTimeout(() => {
        router.push('/admin/vendors')
        router.refresh()
      }, 1200)
    } catch (e: any) {
      setResultOk(false)
      setResultTitle('Unsuccessful')
      setResultMessage(e?.message || 'Failed to save vendor')
      setResultOpen(true)

      if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current)
      redirectTimerRef.current = setTimeout(() => {
        router.push('/admin/vendors')
        router.refresh()
      }, 1200)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="w-full px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-900">{vendorId ? 'Edit Vendor' : 'New Vendor'}</h1>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 pb-20">
          {loadingVendor ? <div className="text-sm text-gray-600">Loading…</div> : null}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Input label="company name" value={form.companyName} onChange={(v) => setField('companyName', v)} />
            <Input label="first name" value={form.firstName} onChange={(v) => setField('firstName', v)} />
            <Input label="last name" value={form.lastName} onChange={(v) => setField('lastName', v)} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Input
              label="Salesperson Registration #"
              value={form.salespersonRegistration}
              onChange={(v) => setField('salespersonRegistration', v)}
            />
            <Input label="Company MVDA #" value={form.companyMvda} onChange={(v) => setField('companyMvda', v)} />
            <Input label="tax number" value={form.taxNumber} onChange={(v) => setField('taxNumber', v)} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Input label="RIN" value={form.rin} onChange={(v) => setField('rin', v)} />
          </div>

          <div>
            <div className="text-sm font-semibold text-gray-900">Street Address</div>
            <div className="mt-2 grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Input
                label="Enter a location"
                value={form.streetAddress}
                onChange={(v) => setField('streetAddress', v)}
              />
              <Input label="apt/suite #" value={form.suiteApt} onChange={(v) => setField('suiteApt', v)} />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            <Input label="city" value={form.city} onChange={(v) => setField('city', v)} />
            <Select
              label="Province"
              value={form.province}
              onChange={(v) => setField('province', v)}
              options={['ON', 'QC', 'BC', 'AB', 'MB', 'SK', 'NS', 'NB', 'NL', 'PE', 'NT', 'NU', 'YT']}
            />
            <Input label="Postal Code" value={form.postalCode} onChange={(v) => setField('postalCode', v)} />
            <Select label="Country" value={form.country} onChange={(v) => setField('country', v)} options={['CA', 'US']} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            <Input label="Phone" value={form.phone} onChange={(v) => setField('phone', v)} />
            <Input label="Fax" value={form.fax} onChange={(v) => setField('fax', v)} />
            <Input label="mobile" value={form.mobile} onChange={(v) => setField('mobile', v)} />
            <Input label="Email" value={form.email} onChange={(v) => setField('email', v)} />
          </div>
        </div>

        <div className="fixed bottom-6 right-6 z-10">
          <button
            type="button"
            onClick={() => void onSave()}
            disabled={saving || loadingVendor}
            className="rounded bg-[#118df0] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0d6ebd] disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {resultOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white shadow-lg">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="text-sm font-semibold text-gray-900">{resultTitle}</div>
            </div>
            <div className="px-6 py-5 text-sm text-gray-700">
              <div className={resultOk ? 'text-green-700 font-semibold' : 'text-red-700 font-semibold'}>
                {resultOk ? 'Success' : 'Failed'}
              </div>
              <div className="mt-2 whitespace-pre-line">{resultMessage}</div>
              <div className="mt-3 text-xs text-gray-500">Redirecting to vendors list…</div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end">
              <button
                type="button"
                onClick={() => {
                  setResultOpen(false)
                  router.push('/admin/vendors')
                  router.refresh()
                }}
                className="h-10 px-4 rounded bg-[#118df0] text-white text-sm font-semibold hover:bg-[#0d6ebd]"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default function AdminVendorsNewPage() {
  return (
    <Suspense fallback={null}>
      <AdminVendorsNewPageInner />
    </Suspense>
  )
}

function Input({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 h-10 w-full rounded border border-gray-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-[#118df0]/40"
      />
    </div>
  )
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: string[]
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 h-10 w-full rounded border border-gray-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-[#118df0]/40"
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  )
}
