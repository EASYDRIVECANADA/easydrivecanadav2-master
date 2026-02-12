'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function DealershipDetailsSettingsPage() {
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveOk, setSaveOk] = useState<string | null>(null)
  const [successModalOpen, setSuccessModalOpen] = useState(false)
  const [updateModalOpen, setUpdateModalOpen] = useState(false)

  const [scopedUserId, setScopedUserId] = useState<string | null>(null)

  const timezoneOptions = useMemo(() => {
    const getUtcOffsetMinutes = (timeZone: string, at = new Date()) => {
      try {
        const dtf = new Intl.DateTimeFormat('en-US', {
          timeZone,
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
          timeZoneName: 'shortOffset',
        } as any)
        const parts = (dtf as any).formatToParts(at) as Array<{ type: string; value: string }>
        const tzPart = parts?.find((p) => p.type === 'timeZoneName')?.value ?? ''
        const m = String(tzPart).match(/GMT([+-])(\d{1,2})(?::?(\d{2}))?/i)
        if (!m) return 0
        const sign = m[1] === '-' ? -1 : 1
        const hh = Number(m[2] || 0)
        const mm = Number(m[3] || 0)
        if (!Number.isFinite(hh) || !Number.isFinite(mm)) return 0
        return sign * (hh * 60 + mm)
      } catch {
        return 0
      }
    }

    const formatOffset = (mins: number) => {
      const sign = mins < 0 ? '-' : '+'
      const abs = Math.abs(mins)
      const hh = String(Math.floor(abs / 60)).padStart(2, '0')
      const mm = String(abs % 60).padStart(2, '0')
      return `UTC${sign}${hh}:${mm}`
    }

    const sanitizeName = (tz: string) => tz.replace(/_/g, ' ')

    let zones: string[] = []
    try {
      const anyIntl = Intl as any
      zones = typeof anyIntl?.supportedValuesOf === 'function' ? ((anyIntl.supportedValuesOf('timeZone') as string[]) || []) : []
    } catch {
      zones = []
    }

    if (!Array.isArray(zones) || zones.length === 0) {
      zones = [
        'UTC',
        'America/Toronto',
        'America/Vancouver',
        'America/Edmonton',
        'America/Winnipeg',
        'America/Halifax',
        'America/St_Johns',
        'America/New_York',
        'America/Chicago',
        'America/Denver',
        'America/Los_Angeles',
        'Europe/London',
        'Europe/Paris',
        'Asia/Dubai',
        'Asia/Kolkata',
        'Asia/Shanghai',
        'Asia/Tokyo',
        'Australia/Sydney',
      ]
    }

    const now = new Date()
    const enriched = zones.map((tz) => {
      const offsetMinutes = getUtcOffsetMinutes(tz, now)
      return {
        value: tz,
        offsetMinutes,
        label: `(${formatOffset(offsetMinutes)}) ${sanitizeName(tz)}`,
      }
    })

    enriched.sort((a, b) => {
      if (a.offsetMinutes !== b.offsetMinutes) return a.offsetMinutes - b.offsetMinutes
      return a.label.localeCompare(b.label)
    })

    return enriched
  }, [])

  const provinceOptions = useMemo(
    () => [
      { value: 'AB', label: 'AB' },
      { value: 'BC', label: 'BC' },
      { value: 'MB', label: 'MB' },
      { value: 'NB', label: 'NB' },
      { value: 'NL', label: 'NL' },
      { value: 'NS', label: 'NS' },
      { value: 'NT', label: 'NT' },
      { value: 'NU', label: 'NU' },
      { value: 'ON', label: 'ON' },
      { value: 'PE', label: 'PE' },
      { value: 'QC', label: 'QC' },
      { value: 'SK', label: 'SK' },
      { value: 'YT', label: 'YT' },
    ],
    []
  )

  const autoCloseDealOptions = useMemo(
    () => [
      { value: 'Never', label: 'Never' },
      { value: '30 days', label: '30 days' },
      { value: '60 days', label: '60 days' },
      { value: '90 days', label: '90 days' },
    ],
    []
  )

  const getLoggedInAdminDbUserId = async (): Promise<string | null> => {
    try {
      if (typeof window === 'undefined') return null
      const raw = window.localStorage.getItem('edc_admin_session')
      if (!raw) return null
      const parsed = JSON.parse(raw) as { email?: string }
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
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()
    if (userError) throw userError
    const dbUserId = await getLoggedInAdminDbUserId()
    return dbUserId ?? user?.id ?? null
  }

  useEffect(() => {
    const load = async () => {
      try {
        const id = await getWebhookUserId()
        setScopedUserId(id)
      } catch {
        setScopedUserId(null)
      }
    }
    void load()
  }, [])

  const [actionMode, setActionMode] = useState<'save' | 'update'>('save')
  const [dealershipId, setDealershipId] = useState<string | null>(null)

  const persistDealershipId = (id: string | null) => {
    try {
      if (id) localStorage.setItem('edc_dealership_id', id)
      else localStorage.removeItem('edc_dealership_id')
    } catch {
      // ignore
    }
  }

  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null)
  const [logoFileName, setLogoFileName] = useState<string | null>(null)
  const [logoMimeType, setLogoMimeType] = useState<string | null>(null)

  const [companyName, setCompanyName] = useState('')
  const [mvda, setMvda] = useState('')
  const [timezone, setTimezone] = useState('')
  const [website, setWebsite] = useState('')

  const [streetAddress, setStreetAddress] = useState('')
  const [suiteApt, setSuiteApt] = useState('')
  const [city, setCity] = useState('')
  const [province, setProvince] = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [country, setCountry] = useState('')
  const [phone, setPhone] = useState('')
  const [fax, setFax] = useState('')
  const [email, setEmail] = useState('')
  const [mobile, setMobile] = useState('')

  const [taxNumber, setTaxNumber] = useState('')
  const [rin, setRin] = useState('')

  const [licenseTransferFee, setLicenseTransferFee] = useState('')
  const [newPlateFee, setNewPlateFee] = useState('')
  const [renewalFee, setRenewalFee] = useState('')

  const [useSequentialStockNumbers, setUseSequentialStockNumbers] = useState(false)
  const [nextSalesInvoice, setNextSalesInvoice] = useState('')
  const [nextPurchaseInvoice, setNextPurchaseInvoice] = useState('')
  const [nextWorkOrder, setNextWorkOrder] = useState('')
  const [serviceRate, setServiceRate] = useState('')
  const [financeInterestRate, setFinanceInterestRate] = useState('')
  const [autoCloseDealsIn, setAutoCloseDealsIn] = useState('')

  const payload = useMemo(() => {
    const nullIfEmpty = (v: string) => {
      const t = v.trim()
      return t.length ? t : null
    }

    return {
      company_logo: logoDataUrl
        ? {
            file_name: logoFileName,
            mime_type: logoMimeType,
            data_url: logoDataUrl,
          }
        : null,
      company_details: {
        company_name: nullIfEmpty(companyName),
        mvda_number: nullIfEmpty(mvda),
        timezone: nullIfEmpty(timezone),
        website: nullIfEmpty(website),
      },
      primary_address: {
        street_address: nullIfEmpty(streetAddress),
        suite_apt: nullIfEmpty(suiteApt),
        city: nullIfEmpty(city),
        province: nullIfEmpty(province),
        postal_code: nullIfEmpty(postalCode),
        country: nullIfEmpty(country),
        phone: nullIfEmpty(phone),
        fax: nullIfEmpty(fax),
        email: nullIfEmpty(email),
        mobile: nullIfEmpty(mobile),
      },
      tax_registration_numbers: {
        tax_number: nullIfEmpty(taxNumber),
        rin: nullIfEmpty(rin),
      },
      license_fees: {
        license_transfer_fee: nullIfEmpty(licenseTransferFee),
        new_plate_fee: nullIfEmpty(newPlateFee),
        renewal_fee: nullIfEmpty(renewalFee),
      },
      settings: {
        use_sequential_stock_numbers: useSequentialStockNumbers,
        next_sales_invoice_number: nullIfEmpty(nextSalesInvoice),
        next_purchase_invoice_number: nullIfEmpty(nextPurchaseInvoice),
        next_work_order_number: nullIfEmpty(nextWorkOrder),
        service_rate: nullIfEmpty(serviceRate),
        finance_interest_rate: nullIfEmpty(financeInterestRate),
        auto_close_deals_in: nullIfEmpty(autoCloseDealsIn),
      },
    }
  }, [
    autoCloseDealsIn,
    city,
    companyName,
    country,
    email,
    fax,
    financeInterestRate,
    licenseTransferFee,
    mobile,
    mvda,
    newPlateFee,
    nextPurchaseInvoice,
    nextSalesInvoice,
    nextWorkOrder,
    phone,
    postalCode,
    province,
    renewalFee,
    rin,
    serviceRate,
    streetAddress,
    suiteApt,
    taxNumber,
    timezone,
    useSequentialStockNumbers,
    website,
  ])

  useEffect(() => {
    if (!scopedUserId) return

    const load = async () => {
      try {
        const { data, error } = await supabase
          .from('dealership')
          .select(
            'id, company_logo, company_name, mvda_number, timezone, website, street_address, suite_apt, city, province, postal_code, country, phone, fax, email, mobile, tax_number, rin, license_transfer_fee, new_plate_fee, renewal_fee, use_sequential_stock_numbers, next_sales_invoice_number, next_purchase_invoice_number, next_work_order_number, service_rate, finance_interest_rate, auto_close_deals_in'
          )
          .eq('user_id', scopedUserId)
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle()

        if (error) return
        if (!data) return

        const id = (data as any).id ?? null
        setDealershipId(id)
        persistDealershipId(id)
        setLogoDataUrl((data as any).company_logo ?? null)
        setCompanyName((data as any).company_name ?? '')
        setMvda((data as any).mvda_number ?? '')
        setTimezone((data as any).timezone ?? '')
        setWebsite((data as any).website ?? '')
        setStreetAddress((data as any).street_address ?? '')
        setSuiteApt((data as any).suite_apt ?? '')
        setCity((data as any).city ?? '')
        setProvince((data as any).province ?? '')
        setPostalCode((data as any).postal_code ?? '')
        setCountry((data as any).country ?? '')
        setPhone((data as any).phone ?? '')
        setFax((data as any).fax ?? '')
        setEmail((data as any).email ?? '')
        setMobile((data as any).mobile ?? '')
        setTaxNumber((data as any).tax_number ?? '')
        setRin((data as any).rin ?? '')
        setLicenseTransferFee((data as any).license_transfer_fee?.toString?.() ?? '')
        setNewPlateFee((data as any).new_plate_fee?.toString?.() ?? '')
        setRenewalFee((data as any).renewal_fee?.toString?.() ?? '')
        setUseSequentialStockNumbers(!!(data as any).use_sequential_stock_numbers)
        setNextSalesInvoice((data as any).next_sales_invoice_number?.toString?.() ?? '')
        setNextPurchaseInvoice((data as any).next_purchase_invoice_number?.toString?.() ?? '')
        setNextWorkOrder((data as any).next_work_order_number?.toString?.() ?? '')
        setServiceRate((data as any).service_rate?.toString?.() ?? '')
        setFinanceInterestRate((data as any).finance_interest_rate?.toString?.() ?? '')
        setAutoCloseDealsIn((data as any).auto_close_deals_in ?? '')

        setActionMode('update')
      } catch {
        // ignore
      }
    }

    void load()
  }, [scopedUserId])

  const onLogoFileChange = (file: File | null) => {
    if (!file) {
      setLogoDataUrl(null)
      setLogoFileName(null)
      setLogoMimeType(null)
      return
    }

    setLogoFileName(file.name || null)
    setLogoMimeType(file.type || null)

    const reader = new FileReader()
    reader.onload = () => {
      setLogoDataUrl(typeof reader.result === 'string' ? reader.result : null)
    }
    reader.onerror = () => {
      setLogoDataUrl(null)
    }
    reader.readAsDataURL(file)
  }

  const onSave = async () => {
    setSaveError(null)
    setSaveOk(null)
    setSuccessModalOpen(false)
    setUpdateModalOpen(false)
    setSaving(true)
    try {
      const user_id = await getWebhookUserId()

      const res = await fetch('https://primary-production-6722.up.railway.app/webhook/dealership', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, user_id }),
      })

      const text = await res.text().catch(() => '')
      if (!res.ok) throw new Error(text || `Request failed (${res.status})`)
      if (String(text).trim() !== 'Done') throw new Error(text || 'Webhook did not return Done')
      setActionMode('update')
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const onUpdateSupabase = async () => {
    setSaveError(null)
    setSaveOk(null)
    setSuccessModalOpen(false)
    setUpdateModalOpen(false)
    setSaving(true)

    const nullIfEmpty = (v: string) => {
      const t = v.trim()
      return t.length ? t : null
    }

    const numOrNull = (v: string) => {
      const t = v.trim()
      if (!t.length) return null
      const n = Number(t)
      return Number.isFinite(n) ? n : null
    }

    const intOrNull = (v: string) => {
      const t = v.trim()
      if (!t.length) return null
      const n = Number(t)
      return Number.isFinite(n) ? Math.trunc(n) : null
    }

    try {
      const row = {
        user_id: scopedUserId,
        company_logo: logoDataUrl,
        company_name: nullIfEmpty(companyName),
        mvda_number: nullIfEmpty(mvda),
        timezone: nullIfEmpty(timezone),
        website: nullIfEmpty(website),
        street_address: nullIfEmpty(streetAddress),
        suite_apt: nullIfEmpty(suiteApt),
        city: nullIfEmpty(city),
        province: nullIfEmpty(province),
        postal_code: nullIfEmpty(postalCode),
        country: nullIfEmpty(country),
        phone: nullIfEmpty(phone),
        fax: nullIfEmpty(fax),
        email: nullIfEmpty(email),
        mobile: nullIfEmpty(mobile),
        tax_number: nullIfEmpty(taxNumber),
        rin: nullIfEmpty(rin),
        license_transfer_fee: numOrNull(licenseTransferFee),
        new_plate_fee: numOrNull(newPlateFee),
        renewal_fee: numOrNull(renewalFee),
        use_sequential_stock_numbers: useSequentialStockNumbers,
        next_sales_invoice_number: intOrNull(nextSalesInvoice),
        next_purchase_invoice_number: intOrNull(nextPurchaseInvoice),
        next_work_order_number: intOrNull(nextWorkOrder),
        service_rate: numOrNull(serviceRate),
        finance_interest_rate: numOrNull(financeInterestRate),
        auto_close_deals_in: nullIfEmpty(autoCloseDealsIn),
      }

      if (dealershipId) {
        const { error } = await supabase.from('dealership').update(row).eq('id', dealershipId).eq('user_id', scopedUserId)
        if (error) throw error
      } else {
        const { data, error } = await supabase.from('dealership').insert(row).select('id').single()
        if (error) throw error
        const id = (data as any)?.id ?? null
        setDealershipId(id)
        persistDealershipId(id)
      }

      setUpdateModalOpen(true)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Update failed')
    } finally {
      setSaving(false)
    }
  }

  const toggleButton = (
    <button
      type="button"
      onClick={() => setUseSequentialStockNumbers((p) => !p)}
      className={
        useSequentialStockNumbers
          ? 'h-4 w-8 rounded-full bg-[#118df0] relative'
          : 'h-4 w-8 rounded-full bg-white relative border border-gray-300'
      }
      aria-pressed={useSequentialStockNumbers}
    >
      <div
        className={
          useSequentialStockNumbers
            ? 'absolute right-0.5 top-0.5 h-3 w-3 rounded-full bg-white'
            : 'absolute left-0.5 top-0.5 h-3 w-3 rounded-full bg-gray-400'
        }
      />
    </button>
  )

  return (
    <div className="space-y-6">
      {saveError ? <div className="text-xs text-red-600">{saveError}</div> : null}
      {saveOk ? <div className="text-xs text-green-600">{saveOk}</div> : null}

      {successModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/50" onMouseDown={() => setSuccessModalOpen(false)} />
          <div className="relative w-[420px] bg-white rounded shadow-lg">
            <div className="h-12 px-4 border-b border-gray-200 flex items-center justify-between">
              <div className="text-sm font-semibold text-gray-800">Success</div>
              <button
                type="button"
                className="h-8 w-8 flex items-center justify-center"
                onClick={() => setSuccessModalOpen(false)}
              >
                <span className="text-xl leading-none text-gray-500">×</span>
              </button>
            </div>
            <div className="p-4">
              <div className="text-sm text-gray-800">Successfully saved dealership info.</div>
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  className="h-8 px-4 bg-[#118df0] text-white text-xs font-semibold"
                  onClick={() => setSuccessModalOpen(false)}
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {updateModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/50" onMouseDown={() => setUpdateModalOpen(false)} />
          <div className="relative w-[420px] bg-white rounded shadow-lg">
            <div className="h-12 px-4 border-b border-gray-200 flex items-center justify-between">
              <div className="text-sm font-semibold text-gray-800">Updated</div>
              <button
                type="button"
                className="h-8 w-8 flex items-center justify-center"
                onClick={() => setUpdateModalOpen(false)}
              >
                <span className="text-xl leading-none text-gray-500">×</span>
              </button>
            </div>
            <div className="p-4">
              <div className="text-sm text-gray-800">Successfully updated dealership info.</div>
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  className="h-8 px-4 bg-[#118df0] text-white text-xs font-semibold"
                  onClick={() => setUpdateModalOpen(false)}
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div>
        <div className="text-[11px] font-semibold text-gray-600">Company Logo</div>
        <div className="mt-3">
          <div className="h-12 w-28 border border-gray-300 bg-white relative overflow-hidden">
            {logoDataUrl ? (
              <img src={logoDataUrl} alt="Logo" className="absolute inset-0 h-full w-full object-contain" />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"
                  />
                  <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M7 10l5-5 5 5" />
                  <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M12 5v12" />
                </svg>
              </div>
            )}
            <input
              id="companyLogoUpload"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => onLogoFileChange(e.target.files?.[0] ?? null)}
            />
            <label
              htmlFor="companyLogoUpload"
              className="absolute inset-0 cursor-pointer"
              title="Upload logo"
            />
          </div>
        </div>
      </div>

      <div>
        <div className="text-[11px] font-semibold text-gray-600">Company Details</div>
        <div className="mt-2 border-t border-gray-200" />
        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] text-gray-600 mb-1">Company Name</label>
            <input
              className="h-8 w-full border border-gray-300 px-2 text-xs"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-[11px] text-gray-600 mb-1">MVDA #</label>
            <input className="h-8 w-full border border-gray-300 px-2 text-xs" value={mvda} onChange={(e) => setMvda(e.target.value)} />
          </div>
          <div>
            <label className="block text-[11px] text-gray-600 mb-1">Timezone</label>
            <select
              className="h-8 w-full border border-gray-300 px-2 text-xs bg-white"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
            >
              <option value="">-- Timezone --</option>
              {timezoneOptions.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] text-gray-600 mb-1">Website</label>
            <div className="relative">
              <div className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M10 13a5 5 0 007.07 0l1.41-1.41a5 5 0 00-7.07-7.07L10 4" />
                  <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M14 11a5 5 0 01-7.07 0L5.52 9.59a5 5 0 017.07-7.07L14 4" />
                </svg>
              </div>
              <input
                className="h-8 w-full border border-gray-300 pl-7 pr-2 text-xs"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="border border-gray-200">
        <div className="px-4 py-3">
          <div className="text-[11px] font-semibold text-gray-700">Primary Address</div>
          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="lg:col-span-2">
              <label className="block text-[11px] text-gray-600 mb-1">Street Address</label>
              <div className="relative">
                <div className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M12 21s8-4.5 8-11a8 8 0 10-16 0c0 6.5 8 11 8 11z" />
                    <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M12 11a2 2 0 100-4 2 2 0 000 4z" />
                  </svg>
                </div>
                <input
                  className="h-8 w-full border border-gray-300 pl-7 pr-2 text-xs"
                  value={streetAddress}
                  onChange={(e) => setStreetAddress(e.target.value)}
                />
              </div>
            </div>
            <div className="lg:col-span-2">
              <label className="block text-[11px] text-gray-600 mb-1">Suite/Apt</label>
              <div className="relative">
                <div className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M3 10l9-7 9 7v10a2 2 0 01-2 2H5a2 2 0 01-2-2V10z" />
                    <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M9 22V12h6v10" />
                  </svg>
                </div>
                <input className="h-8 w-full border border-gray-300 pl-7 pr-2 text-xs" value={suiteApt} onChange={(e) => setSuiteApt(e.target.value)} />
              </div>
            </div>

            <div>
              <label className="block text-[11px] text-gray-600 mb-1">City</label>
              <div className="relative">
                <div className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M3 21h18" />
                    <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M5 21V7l7-4 7 4v14" />
                    <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M9 9h1m4 0h1M9 13h1m4 0h1M9 17h1m4 0h1" />
                  </svg>
                </div>
                <input className="h-8 w-full border border-gray-300 pl-7 pr-2 text-xs" value={city} onChange={(e) => setCity(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="block text-[11px] text-gray-600 mb-1">Province</label>
              <select
                className="h-8 w-full border border-gray-300 px-2 text-xs bg-white"
                value={province}
                onChange={(e) => setProvince(e.target.value)}
              >
                <option value="" />
                {provinceOptions.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] text-gray-600 mb-1">Postal Code</label>
              <div className="relative">
                <div className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M3 7h18" />
                    <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M5 7v14h14V7" />
                    <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M7 11h10" />
                  </svg>
                </div>
                <input className="h-8 w-full border border-gray-300 pl-7 pr-2 text-xs" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="block text-[11px] text-gray-600 mb-1">Country</label>
              <select
                className="h-8 w-full border border-gray-300 px-2 text-xs bg-white"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
              >
                <option value="" />
                <option value="CA">CA</option>
              </select>
            </div>

            <div className="lg:col-span-2">
              <label className="block text-[11px] text-gray-600 mb-1">Phone</label>
              <input className="h-8 w-full border border-gray-300 px-2 text-xs" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="lg:col-span-2">
              <label className="block text-[11px] text-gray-600 mb-1">Fax</label>
              <input className="h-8 w-full border border-gray-300 px-2 text-xs" value={fax} onChange={(e) => setFax(e.target.value)} />
            </div>
            <div className="lg:col-span-2">
              <label className="block text-[11px] text-gray-600 mb-1">Email</label>
              <input className="h-8 w-full border border-gray-300 px-2 text-xs" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="lg:col-span-2">
              <label className="block text-[11px] text-gray-600 mb-1">Mobile</label>
              <input className="h-8 w-full border border-gray-300 px-2 text-xs" value={mobile} onChange={(e) => setMobile(e.target.value)} />
            </div>
          </div>
        </div>
      </div>

      <div>
        <div className="text-[11px] font-semibold text-gray-600">Tax/Registration Numbers</div>
        <div className="mt-2 border-t border-gray-200" />
        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] text-gray-600 mb-1">Tax #</label>
            <input className="h-8 w-full border border-gray-300 px-2 text-xs" value={taxNumber} onChange={(e) => setTaxNumber(e.target.value)} />
          </div>
          <div>
            <label className="block text-[11px] text-gray-600 mb-1">RIN</label>
            <input className="h-8 w-full border border-gray-300 px-2 text-xs" value={rin} onChange={(e) => setRin(e.target.value)} />
          </div>
        </div>
      </div>

      <div>
        <div className="text-[11px] font-semibold text-gray-600">License Fees</div>
        <div className="mt-2 border-t border-gray-200" />
        <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-[11px] text-gray-600 mb-1">License Transfer Fee</label>
            <div className="relative">
              <div className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-600 text-xs">$</div>
              <input
                className="h-8 w-full border border-gray-300 pl-6 pr-2 text-xs"
                value={licenseTransferFee}
                onChange={(e) => setLicenseTransferFee(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="block text-[11px] text-gray-600 mb-1">New Plate Fee</label>
            <div className="relative">
              <div className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-600 text-xs">$</div>
              <input className="h-8 w-full border border-gray-300 pl-6 pr-2 text-xs" value={newPlateFee} onChange={(e) => setNewPlateFee(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="block text-[11px] text-gray-600 mb-1">Renewal Fee</label>
            <div className="relative">
              <div className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-600 text-xs">$</div>
              <input className="h-8 w-full border border-gray-300 pl-6 pr-2 text-xs" value={renewalFee} onChange={(e) => setRenewalFee(e.target.value)} />
            </div>
          </div>
        </div>
      </div>

      <div>
        <div className="text-[11px] font-semibold text-gray-600">Settings</div>
        <div className="mt-2 border-t border-gray-200" />
        <div className="mt-3">
          <div className="flex items-center gap-3">
            <div className="text-[11px] text-gray-600">Use sequential stock numbers?</div>
            {toggleButton}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-[11px] text-gray-600 mb-1">Next Sales Invoice #</label>
            <input className="h-8 w-full border border-gray-300 px-2 text-xs" value={nextSalesInvoice} onChange={(e) => setNextSalesInvoice(e.target.value)} />
          </div>
          <div>
            <label className="block text-[11px] text-gray-600 mb-1">Next Purchase Invoice #</label>
            <input className="h-8 w-full border border-gray-300 px-2 text-xs" value={nextPurchaseInvoice} onChange={(e) => setNextPurchaseInvoice(e.target.value)} />
          </div>
          <div>
            <label className="block text-[11px] text-gray-600 mb-1">Next Work Order #</label>
            <input className="h-8 w-full border border-gray-300 px-2 text-xs" value={nextWorkOrder} onChange={(e) => setNextWorkOrder(e.target.value)} />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-[11px] text-gray-600 mb-1">Service Rate</label>
            <div className="relative">
              <div className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-600 text-xs">$</div>
              <input className="h-8 w-full border border-gray-300 pl-6 pr-2 text-xs" value={serviceRate} onChange={(e) => setServiceRate(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="block text-[11px] text-gray-600 mb-1">Finance Interest Rate</label>
            <div className="relative">
              <div className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-600 text-xs">%</div>
              <input
                className="h-8 w-full border border-gray-300 pl-6 pr-2 text-xs"
                value={financeInterestRate}
                onChange={(e) => setFinanceInterestRate(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="block text-[11px] text-gray-600 mb-1">Auto Close Deals In</label>
            <select
              className="h-8 w-full border border-gray-300 px-2 text-xs bg-white"
              value={autoCloseDealsIn}
              onChange={(e) => setAutoCloseDealsIn(e.target.value)}
            >
              <option value="" />
              {autoCloseDealOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-6">
        <button type="button" className="h-8 px-3 bg-gray-600 text-white text-xs font-semibold">
          <span className="inline-flex items-center gap-2">
            <span className="text-sm leading-none">×</span>
            Cancel
          </span>
        </button>
        <button
          type="button"
          onClick={() => void (actionMode === 'save' ? onSave() : onUpdateSupabase())}
          disabled={saving}
          className={
            saving
              ? 'h-8 px-4 bg-[#118df0]/70 text-white text-xs font-semibold cursor-not-allowed'
              : 'h-8 px-4 bg-[#118df0] text-white text-xs font-semibold'
          }
        >
          <span className="inline-flex items-center gap-2">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
              <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M17 21v-8H7v8" />
              <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M7 3v5h8" />
            </svg>
            {saving ? 'Saving…' : actionMode === 'save' ? 'Save' : 'Update'}
          </span>
        </button>
      </div>
    </div>
  )
}
