'use client'



import { useEffect, useMemo, useRef, useState } from 'react'

import { supabase } from '@/lib/supabaseClient'



type ProspectRow = {

  id: string

  customer_type?: string | null

  id_type?: string | null

  first_name?: string | null

  middle_name?: string | null

  last_name?: string | null

  rin?: string | null

  drivers_license?: string | null

  dl_expiry?: string | null

  date_of_birth?: string | null

  legal_name?: string | null

  company_name?: string | null

  year_end?: string | null

  tax_number?: string | null

  contact_first_name?: string | null

  contact_last_name?: string | null

  street_address?: string | null

  suite_apt?: string | null

  city?: string | null

  province?: string | null

  postal_code?: string | null

  country?: string | null

  phone?: string | null

  fax?: string | null

  mobile?: string | null

  email?: string | null

  visibility?: string | null

  notes?: string | null

  created_at?: string | null

}



type DealCustomerForm = {

  visibility: 'Private' | 'Public'

  coBuyer: boolean

  coSigner: boolean

  firstName: string

  middleName: string

  lastName: string

  legalName: string

  displayName: string

  taxNumber: string

  yearEnd: string

  rin: string

  contactFirstName: string

  contactLastName: string

  driversLicense: string

  expDate: string

  dateOfBirth: string

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

  insuranceCompany: string

  insuranceAgent: string

  insurancePhone: string

  policyNumber: string

  policyExpiry: string

  notes: string

}



const getDefaultForm = (): DealCustomerForm => ({

  visibility: 'Private',

  coBuyer: false,

  coSigner: false,

  firstName: '',

  middleName: '',

  lastName: '',

  legalName: '',

  displayName: '',

  taxNumber: '',

  yearEnd: '',

  rin: '',

  contactFirstName: '',

  contactLastName: '',

  driversLicense: '',

  expDate: '',

  dateOfBirth: '',

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

  insuranceCompany: '',

  insuranceAgent: '',

  insurancePhone: '',

  policyNumber: '',

  policyExpiry: '',

  notes: '',

})



function IconInput({

  label,

  value,

  onChange,

  icon,

  placeholder,

  type = 'text',

}: {

  label: string

  value: string

  onChange: (v: string) => void

  icon: React.ReactNode

  placeholder?: string

  type?: string

}) {

  return (

    <div>

      {label ? <div className="text-xs text-gray-700 mb-1">{label}</div> : null}

      <div className="flex items-stretch border border-gray-200 rounded bg-white shadow-sm overflow-hidden">

        <div className="w-10 flex items-center justify-center bg-gray-100 text-gray-600 border-r border-gray-200">

          {icon}

        </div>

        <input

          type={type}

          value={value}

          onChange={(e) => onChange(e.target.value)}

          placeholder={placeholder}

          className="flex-1 h-10 px-3 text-sm bg-white outline-none"

        />

      </div>

    </div>

  )

}



function IconSelect({

  label,

  value,

  onChange,

  icon,

  children,

}: {

  label: string

  value: string

  onChange: (v: string) => void

  icon: React.ReactNode

  children: React.ReactNode

}) {

  return (

    <div>

      {label ? <div className="text-xs text-gray-700 mb-1">{label}</div> : null}

      <div className="flex items-stretch border border-gray-200 rounded bg-white shadow-sm overflow-hidden">

        <div className="w-10 flex items-center justify-center bg-gray-100 text-gray-600 border-r border-gray-200">

          {icon}

        </div>

        <select

          value={value}

          onChange={(e) => onChange(e.target.value)}

          className="flex-1 h-10 px-3 text-sm bg-white outline-none"

        >

          {children}

        </select>

      </div>

    </div>

  )

}



export default function CustomersTabNew({

  hideAddButton = false,

  dealId,

  dealDate,

  dealType,

  dealMode,

  onSaved,

  initialData,

}: {

  hideAddButton?: boolean

  dealId?: string

  dealDate?: string

  dealType?: string

  dealMode?: 'RTL' | 'WHL'

  onSaved?: () => void

  initialData?: any

}) {

  const getCustomerTabLabel = (f: DealCustomerForm) => {

    const name = [f.firstName, f.lastName].filter(Boolean).join(' ').trim()

    return name || 'New Customer'

  }



  const [saving, setSaving] = useState(false)

  const [showSavedModal, setShowSavedModal] = useState(false)

  const [forms, setForms] = useState<DealCustomerForm[]>(() => {

    if (initialData) {

      const c = initialData

      return [{

        ...getDefaultForm(),

        visibility: c.visibility || 'Private',

        firstName: c.firstname || '',

        middleName: c.middlename || '',

        lastName: c.lastname || '',

        legalName: c.legalname || '',

        displayName: c.displayname || '',

        taxNumber: c.taxnumber || '',

        yearEnd: c.yearend || '',

        rin: c.rin || '',

        contactFirstName: c.contactfirstname || '',

        contactLastName: c.contactlastname || '',

        driversLicense: c.driverslicense || '',

        expDate: c.expdate || '',

        dateOfBirth: c.dateofbirth || '',

        streetAddress: c.streetaddress || '',

        suiteApt: c.suiteapt || '',

        city: c.city || '',

        province: c.province || 'ON',

        postalCode: c.postalcode || '',

        country: c.country || 'CA',

        phone: c.phone || '',

        fax: c.fax || '',

        mobile: c.mobile || '',

        email: c.email || '',

        insuranceCompany: c.insurancecompany || '',

        insuranceAgent: c.insuranceagent || '',

        insurancePhone: c.insurancephone || '',

        policyNumber: c.policynumber || '',

        policyExpiry: c.policyexpiry || '',

        notes: c.notes || '',

      }]

    }

    return [getDefaultForm()]

  })

  const [activeCustomer, setActiveCustomer] = useState(0)

  const form = forms[activeCustomer] ?? getDefaultForm()

  const setForm = (

    next:

      | DealCustomerForm

      | ((prev: DealCustomerForm) => DealCustomerForm)

  ) => {

    setForms((prev) =>

      prev.map((f, idx) => {

        if (idx !== activeCustomer) return f

        if (typeof next === 'function') return (next as (p: DealCustomerForm) => DealCustomerForm)(f)

        return next

      })

    )

  }

  const editorRef = useRef<HTMLDivElement | null>(null)

  const colorRef = useRef<HTMLInputElement | null>(null)

  const [postState, setPostState] = useState<'idle' | 'posting' | 'posted'>('idle')

  const [ind, setInd] = useState(true)

  const [idType, setIdType] = useState<'DL' | 'RIN'>('DL')



  const [prospectQuery, setProspectQuery] = useState('')

  const [prospectLoading, setProspectLoading] = useState(false)

  const [prospectResults, setProspectResults] = useState<ProspectRow[]>([])

  const [prospectOpen, setProspectOpen] = useState(false)

  const [prospectError, setProspectError] = useState<string | null>(null)



  const addCustomerTab = () => {

    setForms((prev) => [...prev, getDefaultForm()])

    setActiveCustomer((prev) => prev + 1)

  }



  const copyPrimary = () => {

    setForms((prev) =>

      prev.map((f, idx) => {

        if (idx !== activeCustomer) return f

        const primary = prev[0]

        if (!primary) return f

        return { ...primary }

      })

    )

  }



  const removeActiveCustomer = () => {

    if (activeCustomer === 0) return

    setForms((prev) => prev.filter((_, idx) => idx !== activeCustomer))

    setActiveCustomer((prev) => (prev <= 1 ? 0 : prev - 1))

  }



  const loadProspects = async (q: string) => {

    const query = q.trim()

    setProspectLoading(true)

    setProspectError(null)

    try {

      const baseSelect = [

        'id',

        'customer_type',

        'id_type',

        'first_name',

        'middle_name',

        'last_name',

        'rin',

        'drivers_license',

        'dl_expiry',

        'date_of_birth',

        'legal_name',

        'company_name',

        'mvda',

        'year_end',

        'tax_number',

        'contact_first_name',

        'contact_last_name',

        'street_address',

        'suite_apt',

        'city',

        'province',

        'postal_code',

        'country',

        'phone',

        'fax',

        'mobile',

        'email',

        'visibility',

        'notes',

        'created_at',

      ].join(',')



      let req = supabase.from('edc_customer').select(baseSelect)



      if (query) {

        req = req.or(

          [

            `first_name.ilike.%${query}%`,

            `middle_name.ilike.%${query}%`,

            `last_name.ilike.%${query}%`,

            `legal_name.ilike.%${query}%`,

            `company_name.ilike.%${query}%`,

            `email.ilike.%${query}%`,

            `phone.ilike.%${query}%`,

            `mobile.ilike.%${query}%`,

            `drivers_license.ilike.%${query}%`,

            `rin.ilike.%${query}%`,

          ].join(',')

        )

      } else {

        req = req.order('created_at', { ascending: false })

      }



      const { data, error } = await req.limit(10)

      if (error) {

        setProspectError(error.message)

        setProspectResults([])

        return

      }

      const rows = (Array.isArray(data) ? data : []) as unknown as ProspectRow[]

      setProspectResults(rows)

    } finally {

      setProspectLoading(false)

    }

  }



  useEffect(() => {

    const q = prospectQuery.trim()

    if (!q) {

      if (!prospectOpen) {

        setProspectResults([])

        setProspectError(null)

        setProspectLoading(false)

      }

      return

    }



    const handle = window.setTimeout(async () => {

      await loadProspects(q)

    }, 250)



    return () => {

      window.clearTimeout(handle)

    }

  }, [prospectQuery])



  const applyProspect = (row: ProspectRow) => {

    const has = (s: string | null | undefined) => s !== null && s !== undefined

    const pick = (next: string | null | undefined, current: string) => (has(next) ? String(next) : current)



    const rowVisibility = (row.visibility ?? '').toLowerCase()

    const mappedVisibility: DealCustomerForm['visibility'] =

      rowVisibility === 'public' ? 'Public' : 'Private'



    const next: DealCustomerForm = {

      ...form,

      visibility: has(row.visibility) ? mappedVisibility : form.visibility,

      firstName: pick(row.first_name, form.firstName),

      middleName: pick(row.middle_name, form.middleName),

      lastName: pick(row.last_name, form.lastName),

      legalName: pick(row.legal_name ?? row.company_name, form.legalName),

      displayName: pick(row.company_name ?? row.legal_name, form.displayName),

      taxNumber: pick(row.tax_number, form.taxNumber),

      yearEnd: pick(row.year_end, form.yearEnd),

      rin: pick(row.rin, form.rin),

      contactFirstName: pick(row.contact_first_name, form.contactFirstName),

      contactLastName: pick(row.contact_last_name, form.contactLastName),

      driversLicense: pick(row.drivers_license, form.driversLicense),

      expDate: pick(row.dl_expiry, form.expDate),

      dateOfBirth: pick(row.date_of_birth, form.dateOfBirth),

      streetAddress: pick(row.street_address, form.streetAddress),

      suiteApt: pick(row.suite_apt, form.suiteApt),

      city: pick(row.city, form.city),

      province: pick(row.province, form.province),

      postalCode: pick(row.postal_code, form.postalCode),

      country: pick(row.country, form.country),

      phone: pick(row.phone, form.phone),

      fax: pick(row.fax, form.fax),

      mobile: pick(row.mobile, form.mobile),

      email: pick(row.email, form.email),

      notes: pick(row.notes, form.notes),

    }



    setForm(next)



    const t = (row.id_type ?? '').toUpperCase()

    if (t === 'RIN') setIdType('RIN')

    if (t === 'DL' || t === 'DRIVERS_LICENSE' || t === 'DRIVER_LICENSE') setIdType('DL')



    setProspectOpen(false)

    setProspectError(null)

    const name = [row.first_name, row.last_name].filter(Boolean).join(' ').trim()

    setProspectQuery(name || row.legal_name || row.company_name || '')

  }



  useEffect(() => {

    if (dealMode === 'WHL') setInd(false)

    if (dealMode === 'RTL') setInd(true)

  }, [dealMode])



  useEffect(() => {

    const el = editorRef.current

    if (!el) return

    const next = form.notes ?? ''

    if (el.innerHTML !== next) el.innerHTML = next

  }, [form.notes])



  const exec = (command: string, value?: string) => {

    const el = editorRef.current

    if (!el) return

    el.focus()

    document.execCommand(command, false, value)

    setForm((p) => ({ ...p, notes: el.innerHTML }))

  }



  const setFontSizePx = (px: number) => {

    const el = editorRef.current

    if (!el) return

    el.focus()

    const size = px <= 12 ? '3' : px <= 14 ? '4' : '5'

    document.execCommand('fontSize', false, size)



    const fontEls = el.querySelectorAll('font[size]')

    fontEls.forEach((node) => {

      const font = node as HTMLFontElement

      font.removeAttribute('size')

      font.style.fontSize = `${px}px`

    })



    setForm((p) => ({ ...p, notes: el.innerHTML }))

  }



  const handlePost = async () => {

    if (postState === 'posting') return

    setPostState('posting')

    try {

      const el = editorRef.current

      const text = el?.innerText ?? ''

      if (navigator.clipboard?.writeText) {

        await navigator.clipboard.writeText(text)

      }

      setPostState('posted')

      window.setTimeout(() => setPostState('idle'), 1200)

    } catch {

      setPostState('idle')

    }

  }



  const handleSave = async () => {

    if (saving) return

    setSaving(true)

    try {

      const toNulls = (obj: Record<string, unknown>) => {

        const out: Record<string, unknown> = {}

        for (const [k, v] of Object.entries(obj)) {

          if (v === '') out[k] = null

          else out[k] = v

        }

        return out

      }



      const normalizedCustomer: Record<string, unknown> = {

        ...form,

        idType,

        driversLicense: idType === 'DL' ? form.driversLicense : '',

        rin: idType === 'RIN' ? form.rin : '',

      }



      const merged: Record<string, unknown> = {

        ...normalizedCustomer,

        dealId: dealId ?? '',

        dealDate: dealDate ?? '',

        dealType: dealType ?? '',

        dealMode: dealMode ?? '',

        customerMode: ind ? 'IND' : 'CMP',

      }

      const payload = toNulls(merged)



      if (initialData?.id) {

        // Editing mode — update existing row in Supabase

        const updateData: Record<string, unknown> = {

          visibility: payload.visibility ?? null,

          firstname: payload.firstName ?? null,

          middlename: payload.middleName ?? null,

          lastname: payload.lastName ?? null,

          legalname: payload.legalName ?? null,

          displayname: payload.displayName ?? null,

          taxnumber: payload.taxNumber ?? null,

          yearend: payload.yearEnd ?? null,

          rin: payload.rin ?? null,

          contactfirstname: payload.contactFirstName ?? null,

          contactlastname: payload.contactLastName ?? null,

          driverslicense: payload.driversLicense ?? null,

          expdate: payload.expDate ?? null,

          dateofbirth: payload.dateOfBirth ?? null,

          streetaddress: payload.streetAddress ?? null,

          suiteapt: payload.suiteApt ?? null,

          city: payload.city ?? null,

          province: payload.province ?? null,

          postalcode: payload.postalCode ?? null,

          country: payload.country ?? null,

          phone: payload.phone ?? null,

          fax: payload.fax ?? null,

          mobile: payload.mobile ?? null,

          email: payload.email ?? null,

          insurancecompany: payload.insuranceCompany ?? null,

          insuranceagent: payload.insuranceAgent ?? null,

          insurancephone: payload.insurancePhone ?? null,

          policynumber: payload.policyNumber ?? null,

          policyexpiry: payload.policyExpiry ?? null,

          notes: payload.notes ?? null,

          dealdate: payload.dealDate ?? null,

          dealtype: payload.dealType ?? null,

          dealmode: payload.dealMode ?? null,

          customertype: payload.customerMode ?? null,

        }

        const res = await fetch('/api/deals/update', {

          method: 'POST',

          headers: { 'Content-Type': 'application/json' },

          body: JSON.stringify({ table: 'edc_deals_customers', id: initialData.id, data: updateData }),

        })

        const json = await res.json()

        if (!res.ok || json.error) throw new Error(json.error || `Update failed (${res.status})`)

      } else {

        // New deal — create via webhook

        const res = await fetch('/api/proxy/customers', {

          method: 'POST',

          headers: { 'Content-Type': 'application/json' },

          body: JSON.stringify(payload),

        })

        const text = await res.text()

        if (!res.ok) throw new Error(text || `Webhook error (${res.status})`)

      }



      setShowSavedModal(true)

      window.setTimeout(() => {

        setShowSavedModal(false)

        onSaved?.()

      }, 900)

    } finally {

      setSaving(false)

    }

  }



  return (

    <div className="w-full">

      {showSavedModal ? (

        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">

          <div className="w-[92vw] max-w-md rounded-lg bg-white shadow-xl border border-gray-100 p-5">

            <div className="text-base font-semibold text-gray-900">Customer saved</div>

            <div className="mt-1 text-sm text-gray-600">Customer information has been saved successfully.</div>

            <div className="mt-4 flex justify-end">

              <button

                type="button"

                onClick={() => {

                  setShowSavedModal(false)

                  onSaved?.()

                }}

                className="h-9 px-4 rounded bg-[#118df0] text-white text-sm font-semibold hover:bg-[#0d6ebd]"

              >

                Continue

              </button>

            </div>

          </div>

        </div>

      ) : null}

      <div className="flex items-center flex-wrap gap-10">

        {forms.map((_, idx) => (

          <button

            key={idx}

            type="button"

            onClick={() => setActiveCustomer(idx)}

            className={

              idx === activeCustomer

                ? 'h-10 px-4 rounded bg-[#118df0] text-white text-sm font-semibold hover:bg-[#0d6ebd] whitespace-nowrap'

                : 'text-sm font-semibold text-[#118df0] hover:text-[#0d6ebd] whitespace-nowrap'

            }

          >

            {getCustomerTabLabel(forms[idx] ?? getDefaultForm())}

          </button>

        ))}

        {hideAddButton ? null : (

          <button

            type="button"

            aria-label="Add customer"

            onClick={addCustomerTab}

            className="h-10 w-10 rounded bg-[#118df0] text-white flex items-center justify-center hover:bg-[#0d6ebd]"

          >

            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">

              <path

                strokeLinecap="round"

                strokeLinejoin="round"

                strokeWidth={2}

                d="M18 8a3 3 0 11-6 0 3 3 0 016 0zM6 8a3 3 0 116 0 3 3 0 01-6 0z"

              />

              <path

                strokeLinecap="round"

                strokeLinejoin="round"

                strokeWidth={2}

                d="M2 20a4 4 0 014-4h4a4 4 0 014 4m6-8v6m3-3h-6"

              />

            </svg>

          </button>

        )}

      </div>



      <div className="grid grid-cols-1 lg:grid-cols-[160px_1fr] gap-6">

        <div>

          <button type="button" className="mt-4 h-10 w-24 rounded bg-[#118df0] text-white text-sm font-semibold">

            Details

          </button>



          {activeCustomer > 0 ? (

            <button type="button" onClick={copyPrimary} className="mt-3 text-xs text-gray-700 hover:text-gray-900">

              Copy Primary

            </button>

          ) : null}



          {dealMode === 'WHL' ? null : (

            <div className="mt-6 flex items-center gap-2">

              <button

                type="button"

                onClick={() => setInd((v) => !v)}

                aria-label="Toggle IND/CMP"

                className="h-6 w-[58px] px-2 rounded-full border border-[#118df0] bg-white flex items-center justify-between"

              >

                {ind ? (

                  <>

                    <div className="text-[10px] font-semibold text-[#118df0] leading-none">IND</div>

                    <div className="h-3 w-3 rounded-full bg-[#118df0]" />

                  </>

                ) : (

                  <>

                    <div className="h-3 w-3 rounded-full bg-[#118df0]" />

                    <div className="text-[10px] font-semibold text-[#118df0] leading-none">CMP</div>

                  </>

                )}

              </button>

            </div>

          )}

        </div>



        <div>

          <div className="h-[96px]" />

          <div className="flex items-start gap-6">

            <div className="flex-1 flex justify-center">

              <div className="relative w-full">

                <input

                  placeholder="search prospects"

                  value={prospectQuery}

                  onChange={(e) => {

                    setProspectQuery(e.target.value)

                    setProspectOpen(true)

                  }}

                  onFocus={() => {

                    setProspectOpen(true)

                  }}

                  className="w-full h-10 border border-gray-200 rounded bg-white pl-10 pr-3 text-sm shadow-sm"

                />

                <svg

                  className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2"

                  fill="none"

                  stroke="currentColor"

                  viewBox="0 0 24 24"

                >

                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35m1.35-5.65a7 7 0 11-14 0 7 7 0 0114 0z" />

                </svg>



                {prospectOpen && prospectQuery.trim() !== '' && (prospectLoading || prospectResults.length > 0 || !!prospectError) ? (

                  <div className="absolute left-0 right-0 top-[44px] z-20 rounded border border-gray-200 bg-white shadow-lg overflow-hidden">

                    {prospectLoading ? (

                      <div className="px-3 py-2 text-xs text-gray-500">Searching...</div>

                    ) : null}



                    {prospectError ? (

                      <div className="px-3 py-2 text-xs text-red-600">{prospectError}</div>

                    ) : null}



                    {!prospectLoading

                      ? !prospectError && prospectResults.length === 0

                        ? (

                            <div className="px-3 py-2 text-xs text-gray-500">No customers found</div>

                          )

                        : null

                      : null}



                    {!prospectLoading

                      ? prospectResults.map((r) => {

                          const title = [r.first_name, r.middle_name, r.last_name].filter(Boolean).join(' ').trim()

                          return (

                            <button

                              key={r.id}

                              type="button"

                              onClick={() => applyProspect(r)}

                              className="w-full text-left px-3 py-2 hover:bg-gray-50"

                            >

                              <div className="text-sm text-gray-900">

                                {title || r.legal_name || r.company_name || 'Customer'}

                              </div>

                            </button>

                          )

                        })

                      : null}

                  </div>

                ) : null}

              </div>

            </div>



            <div className="flex items-start gap-3">

              <div className="w-64">

                <div className="text-xs text-gray-700 mb-1">Visibility</div>

                {activeCustomer > 0 ? (

                  <div className="mb-2 flex items-center justify-end gap-4">

                    <label className="flex items-center gap-2 text-xs text-gray-700">

                      <input

                        type="checkbox"

                        checked={!!form.coBuyer}

                        onChange={(e) => setForm((p) => ({ ...p, coBuyer: e.target.checked }))}

                        className="h-3 w-3"

                      />

                      Co-Buyer

                    </label>

                    <label className="flex items-center gap-2 text-xs text-gray-700">

                      <input

                        type="checkbox"

                        checked={!!form.coSigner}

                        onChange={(e) => setForm((p) => ({ ...p, coSigner: e.target.checked }))}

                        className="h-3 w-3"

                      />

                      Co-Signer

                    </label>

                  </div>

                ) : null}

                <select

                  value={form.visibility}

                  onChange={(e) =>

                    setForm((p) => ({ ...p, visibility: e.target.value as DealCustomerForm['visibility'] }))

                  }

                  className="w-full h-10 border border-gray-200 rounded bg-white px-3 text-sm shadow-sm"

                >

                  <option value="Private">Private</option>

                  <option value="Public">Public</option>

                </select>

              </div>



              <button

                type="button"

                className="h-10 w-10 rounded bg-red-600 text-white flex items-center justify-center hover:bg-red-700 mt-5"

                aria-label="Remove"

                onClick={removeActiveCustomer}

                disabled={activeCustomer === 0}

                style={activeCustomer === 0 ? { opacity: 0, pointerEvents: 'none' } : undefined}

              >

                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">

                  <path

                    strokeLinecap="round"

                    strokeLinejoin="round"

                    strokeWidth={2}

                    d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"

                  />

                  <circle cx="9" cy="7" r="4" strokeWidth={2} />

                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 8l-4 4m0-4l4 4" />

                </svg>

              </button>

            </div>

          </div>

        </div>

      </div>



      <div className="mt-4">

        <div className="grid grid-cols-1 lg:grid-cols-6 gap-4">

          {ind ? (

            <>

              <div className="lg:col-span-2">

                <IconInput

                  label=""

                  value={form.firstName}

                  onChange={(v) => setForm((p) => ({ ...p, firstName: v }))}

                  icon={

                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">

                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />

                      <circle cx="12" cy="7" r="4" strokeWidth={2} />

                    </svg>

                  }

                  placeholder="First name"

                />

              </div>

              <div className="lg:col-span-2">

                <IconInput

                  label=""

                  value={form.middleName}

                  onChange={(v) => setForm((p) => ({ ...p, middleName: v }))}

                  icon={

                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">

                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />

                      <circle cx="12" cy="7" r="4" strokeWidth={2} />

                    </svg>

                  }

                  placeholder="Middle name"

                />

              </div>

              <div className="lg:col-span-2">

                <IconInput

                  label=""

                  value={form.lastName}

                  onChange={(v) => setForm((p) => ({ ...p, lastName: v }))}

                  icon={

                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">

                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />

                      <circle cx="12" cy="7" r="4" strokeWidth={2} />

                    </svg>

                  }

                  placeholder="Last name"

                />

              </div>



              <div className="lg:col-span-2">

                <div className="flex items-end gap-3">

                  <button

                    type="button"

                    onClick={() => setIdType((v) => (v === 'DL' ? 'RIN' : 'DL'))}

                    aria-label="Toggle DL/RIN"

                    className="h-6 w-[58px] px-2 rounded-full border border-[#118df0] bg-white flex items-center justify-between mb-[2px]"

                  >

                    {idType === 'DL' ? (

                      <>

                        <div className="text-[10px] font-semibold text-[#118df0] leading-none">DL</div>

                        <div className="h-3 w-3 rounded-full bg-[#118df0]" />

                      </>

                    ) : (

                      <>

                        <div className="h-3 w-3 rounded-full bg-[#118df0]" />

                        <div className="text-[10px] font-semibold text-[#118df0] leading-none">RIN</div>

                      </>

                    )}

                  </button>



                  <div className="flex-1">

                    <IconInput

                      label=""

                      value={idType === 'DL' ? form.driversLicense : form.rin}

                      onChange={(v) =>

                        setForm((p) =>

                          idType === 'DL'

                            ? { ...p, driversLicense: v }

                            : { ...p, rin: v }

                        )

                      }

                      icon={

                        idType === 'DL' ? (

                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">

                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7h16M4 17h16M7 11h3" />

                          </svg>

                        ) : (

                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">

                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h10M7 11h10M7 15h6" />

                          </svg>

                        )

                      }

                      placeholder={idType === 'DL' ? 'Drivers license' : 'RIN'}

                    />

                  </div>

                </div>

              </div>

              <div className="lg:col-span-2">

                <IconInput

                  label=""

                  value={form.expDate}

                  onChange={(v) => setForm((p) => ({ ...p, expDate: v }))}

                  icon={

                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">

                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3M5 11h14M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />

                    </svg>

                  }

                  placeholder="Exp. Date"

                  type="date"

                />

              </div>

              <div className="lg:col-span-2">

                <IconInput

                  label=""

                  value={form.dateOfBirth}

                  onChange={(v) => setForm((p) => ({ ...p, dateOfBirth: v }))}

                  icon={

                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">

                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3M5 11h14M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />

                    </svg>

                  }

                  placeholder="Date of birth"

                  type="date"

                />

              </div>

            </>

          ) : (

            <>

              <div className="lg:col-span-2">

                <IconInput

                  label=""

                  value={form.legalName}

                  onChange={(v) => setForm((p) => ({ ...p, legalName: v }))}

                  icon={

                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">

                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7h16M4 17h16" />

                    </svg>

                  }

                  placeholder="legal name"

                />

              </div>

              <div className="lg:col-span-2">

                <IconInput

                  label=""

                  value={form.displayName}

                  onChange={(v) => setForm((p) => ({ ...p, displayName: v }))}

                  icon={

                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">

                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7h16M4 17h16" />

                    </svg>

                  }

                  placeholder="display name"

                />

              </div>

              <div className="lg:col-span-2">

                <IconInput

                  label=""

                  value={form.taxNumber}

                  onChange={(v) => setForm((p) => ({ ...p, taxNumber: v }))}

                  icon={

                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">

                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h10M7 11h10M7 15h6" />

                    </svg>

                  }

                  placeholder="tax number"

                />

              </div>



              <div className="lg:col-span-2">

                <IconInput

                  label=""

                  value={form.yearEnd}

                  onChange={(v) => setForm((p) => ({ ...p, yearEnd: v }))}

                  icon={

                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">

                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3M5 11h14" />

                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />

                    </svg>

                  }

                  placeholder="year end"

                />

              </div>

              <div className="lg:col-span-2">

                <IconInput

                  label=""

                  value={form.rin}

                  onChange={(v) => setForm((p) => ({ ...p, rin: v }))}

                  icon={

                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">

                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7h16M4 17h16M7 11h3" />

                    </svg>

                  }

                  placeholder="RIN"

                />

              </div>

              <div className="lg:col-span-2" />



              <div className="lg:col-span-2">

                <IconInput

                  label=""

                  value={form.contactFirstName}

                  onChange={(v) => setForm((p) => ({ ...p, contactFirstName: v }))}

                  icon={

                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">

                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />

                      <circle cx="12" cy="7" r="4" strokeWidth={2} />

                    </svg>

                  }

                  placeholder="contact first name"

                />

              </div>

              <div className="lg:col-span-2">

                <IconInput

                  label=""

                  value={form.contactLastName}

                  onChange={(v) => setForm((p) => ({ ...p, contactLastName: v }))}

                  icon={

                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">

                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />

                      <circle cx="12" cy="7" r="4" strokeWidth={2} />

                    </svg>

                  }

                  placeholder="contact last name"

                />

              </div>

              <div className="lg:col-span-2" />

            </>

          )}



          <div className="lg:col-span-4">

            <div className="text-xs text-gray-700 mb-1">Street Address</div>

            <div className="flex items-stretch border border-gray-200 rounded bg-white shadow-sm overflow-hidden">

              <div className="w-10 flex items-center justify-center bg-gray-100 text-gray-600 border-r border-gray-200">

                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">

                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c1.657 0 3-1.343 3-3S13.657 5 12 5 9 6.343 9 8s1.343 3 3 3z" />

                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.5 8c0 7-7.5 13-7.5 13S4.5 15 4.5 8a7.5 7.5 0 1115 0z" />

                </svg>

              </div>

              <input

                value={form.streetAddress}

                onChange={(e) => setForm((p) => ({ ...p, streetAddress: e.target.value }))}

                placeholder="Enter a location"

                className="flex-1 h-10 px-3 text-sm bg-white outline-none"

              />

            </div>

          </div>



          <div className="lg:col-span-2">

            <IconInput

              label="Suite/Apt"

              value={form.suiteApt}

              onChange={(v) => setForm((p) => ({ ...p, suiteApt: v }))}

              icon={

                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">

                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c1.657 0 3-1.343 3-3S13.657 5 12 5 9 6.343 9 8s1.343 3 3 3z" />

                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.5 8c0 7-7.5 13-7.5 13S4.5 15 4.5 8a7.5 7.5 0 1115 0z" />

                </svg>

              }

              placeholder="apt/suite #"

            />

          </div>



          <div className="lg:col-span-2">

            <IconInput

              label="City"

              value={form.city}

              onChange={(v) => setForm((p) => ({ ...p, city: v }))}

              icon={

                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">

                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c1.657 0 3-1.343 3-3S13.657 5 12 5 9 6.343 9 8s1.343 3 3 3z" />

                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.5 8c0 7-7.5 13-7.5 13S4.5 15 4.5 8a7.5 7.5 0 1115 0z" />

                </svg>

              }

              placeholder="city"

            />

          </div>



          <div className="lg:col-span-2">

            <IconSelect

              label="Province"

              value={form.province}

              onChange={(v) => setForm((p) => ({ ...p, province: v }))}

              icon={

                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">

                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c1.657 0 3-1.343 3-3S13.657 5 12 5 9 6.343 9 8s1.343 3 3 3z" />

                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.5 8c0 7-7.5 13-7.5 13S4.5 15 4.5 8a7.5 7.5 0 1115 0z" />

                </svg>

              }

            >

              <option value="ON">ON</option>

              <option value="BC">BC</option>

              <option value="AB">AB</option>

              <option value="MB">MB</option>

              <option value="QC">QC</option>

            </IconSelect>

          </div>



          <IconInput

            label="Postal Code"

            value={form.postalCode}

            onChange={(v) => setForm((p) => ({ ...p, postalCode: v }))}

            icon={

              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">

                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c1.657 0 3-1.343 3-3S13.657 5 12 5 9 6.343 9 8s1.343 3 3 3z" />

                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.5 8c0 7-7.5 13-7.5 13S4.5 15 4.5 8a7.5 7.5 0 1115 0z" />

              </svg>

            }

            placeholder="Postal Code"

          />



          <IconSelect

            label="Country"

            value={form.country}

            onChange={(v) => setForm((p) => ({ ...p, country: v }))}

            icon={

              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">

                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c1.657 0 3-1.343 3-3S13.657 5 12 5 9 6.343 9 8s1.343 3 3 3z" />

                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.5 8c0 7-7.5 13-7.5 13S4.5 15 4.5 8a7.5 7.5 0 1115 0z" />

              </svg>

            }

          >

            <option value="CA">CA</option>

            <option value="US">US</option>

          </IconSelect>



          <IconInput

            label="Phone"

            value={form.phone}

            onChange={(v) => setForm((p) => ({ ...p, phone: v }))}

            icon={

              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">

                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h2.28a1 1 0 01.948.684l1.5 4.5a1 1 0 01-.272 1.06l-1.7 1.7a16 16 0 006.586 6.586l1.7-1.7a1 1 0 011.06-.272l4.5 1.5a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />

              </svg>

            }

            placeholder="phone"

          />



          {ind ? null : (

            <IconInput

              label="Fax"

              value={form.fax}

              onChange={(v) => setForm((p) => ({ ...p, fax: v }))}

              icon={

                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">

                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 9V3h12v6" />

                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18h12v3H6z" />

                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 9h12a3 3 0 013 3v3H3v-3a3 3 0 013-3z" />

                </svg>

              }

              placeholder="fax"

            />

          )}



          <IconInput

            label="Mobile"

            value={form.mobile}

            onChange={(v) => setForm((p) => ({ ...p, mobile: v }))}

            icon={

              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">

                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4h10a2 2 0 012 2v12a2 2 0 01-2 2H7a2 2 0 01-2-2V6a2 2 0 012-2z" />

              </svg>

            }

            placeholder="mobile"

          />



          <IconInput

            label="Email"

            value={form.email}

            onChange={(v) => setForm((p) => ({ ...p, email: v }))}

            icon={

              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">

                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l9 6 9-6" />

                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 8v10a2 2 0 01-2 2H5a2 2 0 01-2-2V8" />

              </svg>

            }

            placeholder="email"

          />



          <IconInput

            label="Insurance company"

            value={form.insuranceCompany}

            onChange={(v) => setForm((p) => ({ ...p, insuranceCompany: v }))}

            icon={

              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">

                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2l7 4v6c0 5-3 9-7 10-4-1-7-5-7-10V6l7-4z" />

              </svg>

            }

            placeholder="insurance company"

          />



          <IconInput

            label="Insurance agent"

            value={form.insuranceAgent}

            onChange={(v) => setForm((p) => ({ ...p, insuranceAgent: v }))}

            icon={

              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">

                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />

                <circle cx="12" cy="7" r="4" strokeWidth={2} />

              </svg>

            }

            placeholder="insurance agent"

          />



          <IconInput

            label="Insurance phone"

            value={form.insurancePhone}

            onChange={(v) => setForm((p) => ({ ...p, insurancePhone: v }))}

            icon={

              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">

                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h2.28a1 1 0 01.948.684l1.5 4.5a1 1 0 01-.272 1.06l-1.7 1.7a16 16 0 006.586 6.586l1.7-1.7a1 1 0 011.06-.272l4.5 1.5a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />

              </svg>

            }

            placeholder="insurance phone"

          />



          <div className="lg:col-span-2">

            <IconInput

              label="policy #"

              value={form.policyNumber}

              onChange={(v) => setForm((p) => ({ ...p, policyNumber: v }))}

              icon={

                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">

                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h10M7 11h10M7 15h6" />

                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z" />

                </svg>

              }

              placeholder="policy #"

            />

          </div>



          <div className="lg:col-span-2">

            <IconInput

              label="policy expiry"

              value={form.policyExpiry}

              onChange={(v) => setForm((p) => ({ ...p, policyExpiry: v }))}

              icon={

                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">

                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3M5 11h14M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />

                </svg>

              }

              placeholder="policy expiry"

              type="date"

            />

          </div>



          <div className="lg:col-span-2" />

        </div>



        <div className="mt-8">

          <div className="text-xs text-gray-700">Notes</div>

          <div className="mt-2 border-t border-dashed border-gray-300" />

          <div className="mt-4 border border-gray-200 bg-white shadow-sm">

            <div className="bg-gray-50 px-3 py-2 flex items-center gap-2 text-xs text-gray-600 border-b border-gray-200">

              <button type="button" onClick={() => exec('bold')} className="px-2 py-1 border border-gray-200 bg-white">

                B

              </button>

              <button type="button" onClick={() => exec('italic')} className="px-2 py-1 border border-gray-200 bg-white italic">

                I

              </button>

              <button type="button" onClick={() => exec('underline')} className="px-2 py-1 border border-gray-200 bg-white underline">

                U

              </button>

              <button type="button" onClick={() => exec('removeFormat')} className="px-2 py-1 border border-gray-200 bg-white">

                Tx

              </button>

              <button type="button" onClick={() => exec('strikeThrough')} className="px-2 py-1 border border-gray-200 bg-white">

                S

              </button>

              <button type="button" onClick={() => exec('subscript')} className="px-2 py-1 border border-gray-200 bg-white">

                x

              </button>

              <select

                className="h-7 text-xs border border-gray-200 bg-white px-2"

                defaultValue="16"

                onChange={(e) => setFontSizePx(Number(e.target.value) || 16)}

              >

                <option value="12">12</option>

                <option value="14">14</option>

                <option value="16">16</option>

              </select>

              <input

                ref={colorRef}

                type="color"

                className="hidden"

                defaultValue="#111827"

                onChange={(e) => exec('foreColor', e.target.value)}

              />

              <button type="button" onClick={() => colorRef.current?.click()} className="px-2 py-1 border border-gray-200 bg-white">

                A

              </button>

              <button type="button" onClick={() => exec('justifyLeft')} className="px-2 py-1 border border-gray-200 bg-white">

                ≡

              </button>

              <button type="button" onClick={() => exec('insertUnorderedList')} className="px-2 py-1 border border-gray-200 bg-white">

                Tˇ

              </button>

              <div className="flex-1" />

              <button type="button" onClick={() => exec('insertOrderedList')} className="px-2 py-1 border border-gray-200 bg-white">

                ▾

              </button>

            </div>



            <div

              ref={editorRef}

              contentEditable

              role="textbox"

              aria-multiline="true"

              onInput={() => {

                const el = editorRef.current

                if (!el) return

                setForm((p) => ({ ...p, notes: el.innerHTML }))

              }}

              className="w-full px-4 py-3 text-sm focus:outline-none bg-white min-h-[240px]"

            />



            <div className="px-4 py-3">

              <button

                type="button"

                onClick={handlePost}

                className="h-8 px-3 rounded bg-[#118df0] text-white text-xs font-semibold hover:bg-[#0d6ebd]"

              >

                {postState === 'posted' ? 'Posted' : 'Post'}

              </button>

            </div>

          </div>

        </div>



        <div className="mt-8 flex items-center justify-end">

          <button

            type="button"

            onClick={handleSave}

            disabled={saving}

            className={

              saving

                ? 'h-10 px-8 rounded bg-[#118df0]/60 text-white text-sm font-semibold cursor-not-allowed'

                : 'h-10 px-8 rounded bg-[#118df0] text-white text-sm font-semibold hover:bg-[#0d6ebd]'

            }

          >

            Save

          </button>

        </div>

      </div>

    </div>

  )

}

