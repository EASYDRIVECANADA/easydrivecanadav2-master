'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

type AdminUserRow = {
  id: string
  first_name: string | null
  last_name: string | null
  title: string | null
  registration: string | null
  phone: string | null
  mobile: string | null
  email: string
  facebook?: string | null
  twitter?: string | null
  password?: string | null
  access_all_deals?: boolean | null
  access_all_leads_customers?: boolean | null
  administrator?: boolean | null
  approver?: boolean | null
  vendors?: boolean | null
  delete_vendors?: boolean | null
  costs?: boolean | null
  customers?: boolean | null
  delete_customers?: boolean | null
  sales?: boolean | null
  delete_sales?: boolean | null
  inventory?: boolean | null
  delete_inventory?: boolean | null
  settings?: boolean | null
  sales_reports_access?: boolean | null
  inventory_reports_access?: boolean | null
  created_at: string
}

const toTitle = (s: string) => {
  const cleaned = (s || '').replace(/[_\-.]+/g, ' ').replace(/\s+/g, ' ').trim()
  if (!cleaned) return ''
  return cleaned
    .split(' ')
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ')
}

const deriveNameFromEmail = (email: string) => {
  const local = (email || '').split('@')[0] || ''
  if (!local) return ''
  return toTitle(local)
}

export default function SettingsUsersPage() {
  const router = useRouter()
  const [rows, setRows] = useState<AdminUserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [pageSize, setPageSize] = useState(5)
  const [scopedUserId, setScopedUserId] = useState<string | null>(null)
  const [userAddedOpen, setUserAddedOpen] = useState(false)
  const [userAddedMessage, setUserAddedMessage] = useState('User information added')
  const [sessionEmail, setSessionEmail] = useState<string | null>(null)
  const [sessionFullName, setSessionFullName] = useState<string | null>(null)
  const [editingUserId, setEditingUserId] = useState<string | null>(null)

  const [newUserOpen, setNewUserOpen] = useState(false)
  const [newUserTab, setNewUserTab] = useState<'details' | 'permissions' | 'password'>('details')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [title, setTitle] = useState('')
  const [registration, setRegistration] = useState('')
  const [phone, setPhone] = useState('')
  const [mobile, setMobile] = useState('')
  const [email, setEmail] = useState('')
  const [facebook, setFacebook] = useState('')
  const [twitter, setTwitter] = useState('')
  const [permissions, setPermissions] = useState<Record<string, boolean>>({
    access_all_deals: false,
    access_all_leads_customers: false,
    administrator: false,
    approver: false,
    vendors: false,
    delete_vendors: false,
    costs: false,
    customers: false,
    delete_customers: false,
    sales: false,
    delete_sales: false,
    inventory: false,
    delete_inventory: false,
    settings: false,
    sales_reports_access: false,
    inventory_reports_access: false,
  })
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [savingNewUser, setSavingNewUser] = useState(false)

  const closeNewUser = () => {
    setNewUserOpen(false)
    setNewUserTab('details')
    setEditingUserId(null)
    setFirstName('')
    setLastName('')
    setTitle('')
    setRegistration('')
    setPhone('')
    setMobile('')
    setEmail('')
    setFacebook('')
    setTwitter('')
    setPassword('')
    setConfirmPassword('')
    setPasswordError(null)
    setSavingNewUser(false)
  }

  const nullIfEmpty = (v: string) => {
    const s = (v || '').trim()
    return s.length ? s : null
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

  const handleNewUserSave = async () => {
    if (newUserTab !== 'password') return
    if (savingNewUser) return
    setPasswordError(null)

    if (!firstName.trim()) {
      setPasswordError('First name is required.')
      return
    }
    if (!email.trim()) {
      setPasswordError('Email is required.')
      return
    }
    if (!editingUserId) {
      if (!password.trim()) {
        setPasswordError('A password is required.')
        return
      }
      if (password !== confirmPassword) {
        setPasswordError('Passwords do not match.')
        return
      }
    } else {
      if (password.trim() && password !== confirmPassword) {
        setPasswordError('Passwords do not match.')
        return
      }
    }

    setSavingNewUser(true)
    try {
      if (editingUserId) {
        const updateRow: any = {
          first_name: nullIfEmpty(firstName),
          last_name: nullIfEmpty(lastName),
          title: nullIfEmpty(title),
          registration: nullIfEmpty(registration),
          phone: nullIfEmpty(phone),
          mobile: nullIfEmpty(mobile),
          email: nullIfEmpty(email),
          facebook: nullIfEmpty(facebook),
          twitter: nullIfEmpty(twitter),
          ...permissions,
        }

        if (password.trim()) {
          updateRow.password = nullIfEmpty(password)
        }

        const { error: updateError } = await supabase
          .from('users')
          .update(updateRow)
          .eq('id', editingUserId)
          .eq('user_id', scopedUserId)
        if (updateError) throw updateError

        await fetchUsers()
        closeNewUser()
        setUserAddedMessage('User information updated')
        setUserAddedOpen(true)
        return
      }

      const payload = {
        user_id: await getWebhookUserId(),
        first_name: nullIfEmpty(firstName),
        last_name: nullIfEmpty(lastName),
        title: nullIfEmpty(title),
        registration: nullIfEmpty(registration),
        phone: nullIfEmpty(phone),
        mobile: nullIfEmpty(mobile),
        email: nullIfEmpty(email),
        facebook: nullIfEmpty(facebook),
        twitter: nullIfEmpty(twitter),
        password: nullIfEmpty(password),
        permissions,
      }

      const res = await fetch('https://primary-production-6722.up.railway.app/webhook/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const text = await res.text().catch(() => '')
      if (!res.ok) throw new Error(text || `Request failed (${res.status})`)
      if (String(text).trim() !== 'Done') throw new Error(text || 'Webhook did not return Done')

      closeNewUser()
      setUserAddedMessage('User information added')
      setUserAddedOpen(true)

      try {
        const insertRow: any = {
          user_id: scopedUserId,
          first_name: payload.first_name,
          last_name: payload.last_name,
          title: payload.title,
          registration: payload.registration,
          phone: payload.phone,
          mobile: payload.mobile,
          email: payload.email,
          facebook: payload.facebook,
          twitter: payload.twitter,
          password: payload.password,
          ...permissions,
        }

        const { error: insertError } = await supabase.from('users').insert(insertRow)
        if (!insertError) {
          await fetchUsers()
        }
      } catch {
        // ignore
      }
    } catch (e) {
      setPasswordError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSavingNewUser(false)
    }
  }

  const saveEnabled =
    newUserTab === 'password' &&
    Boolean(firstName.trim()) &&
    Boolean(email.trim()) &&
    (editingUserId ? true : Boolean(password.trim())) &&
    (editingUserId ? (password.trim() ? password === confirmPassword : true) : password === confirmPassword) &&
    !savingNewUser

  const goNext = () => {
    if (newUserTab === 'details') {
      setNewUserTab('permissions')
      return
    }
    if (newUserTab === 'permissions') {
      setNewUserTab('password')
    }
  }

  const fetchUsers = async () => {
    if (!scopedUserId) {
      setRows([])
      return
    }
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('users')
        .select(
          'id, first_name, last_name, title, registration, phone, mobile, email, facebook, twitter, password, access_all_deals, access_all_leads_customers, administrator, approver, vendors, delete_vendors, costs, customers, delete_customers, sales, delete_sales, inventory, delete_inventory, settings, sales_reports_access, inventory_reports_access, created_at'
        )
        .eq('user_id', scopedUserId)
        .order('created_at', { ascending: false })

      if (error) throw error
      setRows((data as any as AdminUserRow[]) || [])
    } catch {
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!scopedUserId) return
    void fetchUsers()
  }, [scopedUserId])

  useEffect(() => {
    const init = async () => {
      try {
        const { data } = await supabase.auth.getSession()
        const user = data.session?.user
        setSessionEmail(user?.email || null)
        const fullName = (user?.user_metadata as any)?.full_name
        setSessionFullName(typeof fullName === 'string' ? fullName : null)
      } catch {
        setSessionEmail(null)
        setSessionFullName(null)
      }
    }

    void init()

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user
      setSessionEmail(user?.email || null)
      const fullName = (user?.user_metadata as any)?.full_name
      setSessionFullName(typeof fullName === 'string' ? fullName : null)
    })

    return () => {
      sub.subscription.unsubscribe()
    }
  }, [])

  const displayRows = useMemo(() => {
    const email = (sessionEmail || '').trim().toLowerCase()
    if (!email) return rows

    const normalized = rows.map((r) => {
      if ((r.email || '').trim().toLowerCase() !== email) return r
      return { ...r, title: 'Owner' }
    })

    const exists = normalized.some((r) => (r.email || '').trim().toLowerCase() === email)
    if (exists) return normalized

    const fallbackName = sessionFullName?.trim() || deriveNameFromEmail(sessionEmail || '')
    const ownerRow: AdminUserRow = {
      id: 'current-session-owner',
      first_name: fallbackName || null,
      last_name: null,
      title: 'Owner',
      registration: null,
      phone: null,
      mobile: null,
      email: sessionEmail || '',
      created_at: new Date().toISOString(),
    }

    return [ownerRow, ...normalized]
  }, [rows, sessionEmail, sessionFullName])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return displayRows
    return displayRows.filter((r) => {
      const name = `${r.first_name || ''} ${r.last_name || ''}`.trim() || deriveNameFromEmail(r.email)
      const title = r.title || ''
      return (
        r.email.toLowerCase().includes(q) ||
        name.toLowerCase().includes(q) ||
        title.toLowerCase().includes(q)
      )
    })
  }, [displayRows, search])

  const visible = useMemo(() => filtered.slice(0, pageSize), [filtered, pageSize])

  const handleDelete = async (id: string, email: string) => {
    if (!confirm(`Delete user ${email}? This cannot be undone.`)) return
    try {
      if (!scopedUserId) return
      const { error } = await supabase.from('users').delete().eq('id', id).eq('user_id', scopedUserId)
      if (error) return
      setRows((prev) => prev.filter((r) => r.id !== id))
    } catch {
      // ignore
    }
  }

  const openEdit = (r: AdminUserRow) => {
    if (r.id === 'current-session-owner') return
    setEditingUserId(r.id)
    setNewUserTab('details')
    setNewUserOpen(true)
    setFirstName(r.first_name || '')
    setLastName(r.last_name || '')
    setTitle(r.title || '')
    setRegistration(r.registration || '')
    setPhone(r.phone || '')
    setMobile(r.mobile || '')
    setEmail(r.email || '')
    setFacebook((r.facebook as any) || '')
    setTwitter((r.twitter as any) || '')
    setPassword((r.password as any) || '')
    setConfirmPassword((r.password as any) || '')
    setPasswordError(null)
    setPermissions({
      access_all_deals: Boolean(r.access_all_deals),
      access_all_leads_customers: Boolean(r.access_all_leads_customers),
      administrator: Boolean(r.administrator),
      approver: Boolean(r.approver),
      vendors: Boolean(r.vendors),
      delete_vendors: Boolean(r.delete_vendors),
      costs: Boolean(r.costs),
      customers: Boolean(r.customers),
      delete_customers: Boolean(r.delete_customers),
      sales: Boolean(r.sales),
      delete_sales: Boolean(r.delete_sales),
      inventory: Boolean(r.inventory),
      delete_inventory: Boolean(r.delete_inventory),
      settings: Boolean(r.settings),
      sales_reports_access: Boolean(r.sales_reports_access),
      inventory_reports_access: Boolean(r.inventory_reports_access),
    })
  }

  return (
    <div>
      {userAddedOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/50" onMouseDown={() => setUserAddedOpen(false)} />
          <div className="relative w-[360px] bg-white shadow-lg">
            <div className="h-11 px-4 border-b border-gray-200 flex items-center justify-between">
              <div className="text-sm font-semibold text-gray-800">Success</div>
              <button type="button" className="h-8 w-8 flex items-center justify-center" onClick={() => setUserAddedOpen(false)}>
                <span className="text-xl leading-none text-gray-500">×</span>
              </button>
            </div>
            <div className="p-4 text-xs text-gray-700">{userAddedMessage}</div>
            <div className="h-12 px-4 border-t border-gray-200 flex items-center justify-end">
              <button type="button" className="h-8 px-4 bg-[#118df0] text-white text-xs font-semibold" onClick={() => setUserAddedOpen(false)}>
                OK
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {newUserOpen ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-12" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/50" onMouseDown={closeNewUser} />
          <div className="relative w-[460px] bg-white shadow-lg">
            <div className="h-11 px-4 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                  <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M12 11a4 4 0 100-8 4 4 0 000 8z" />
                </svg>
                New User
              </div>
              <button type="button" className="h-8 w-8 flex items-center justify-center" onClick={closeNewUser}>
                <span className="text-xl leading-none text-gray-500">×</span>
              </button>
            </div>

            <div className="px-4 pt-3">
              <div className="flex items-center gap-4 border-b border-gray-200">
                <button
                  type="button"
                  className={
                    newUserTab === 'details'
                      ? 'h-7 px-3 text-xs font-semibold text-white bg-[#118df0]'
                      : 'h-7 px-3 text-xs text-gray-700'
                  }
                  onClick={() => setNewUserTab('details')}
                >
                  Details
                </button>
                <button
                  type="button"
                  className={
                    newUserTab === 'permissions'
                      ? 'h-7 px-3 text-xs font-semibold text-white bg-[#118df0]'
                      : 'h-7 px-3 text-xs text-gray-700'
                  }
                  onClick={() => setNewUserTab('permissions')}
                >
                  Permissions
                </button>
                <button
                  type="button"
                  className={
                    newUserTab === 'password'
                      ? 'h-7 px-3 text-xs font-semibold text-white bg-[#118df0]'
                      : 'h-7 px-3 text-xs text-gray-700'
                  }
                  onClick={() => setNewUserTab('password')}
                >
                  Password
                </button>
              </div>
            </div>

            <div className="px-4 py-3">
              {newUserTab === 'details' ? (
                <div className="space-y-2">
                  {[
                    {
                      label: 'First Name',
                      placeholder: 'first name',
                      value: firstName,
                      onChange: (v: string) => setFirstName(v),
                      icon: (
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                        <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M12 11a4 4 0 100-8 4 4 0 000 8z" />
                      </svg>
                      ),
                    },
                    {
                      label: 'Last Name',
                      placeholder: 'last name',
                      value: lastName,
                      onChange: (v: string) => setLastName(v),
                      icon: (
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                        <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M12 11a4 4 0 100-8 4 4 0 000 8z" />
                      </svg>
                      ),
                    },
                    {
                      label: 'Title',
                      placeholder: 'Title',
                      value: title,
                      onChange: (v: string) => setTitle(v),
                      icon: (
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4 8 4 8-4z" />
                        <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M4 7v10l8 4 8-4V7" />
                      </svg>
                      ),
                    },
                    {
                      label: 'Registration',
                      placeholder: 'Registration #',
                      value: registration,
                      onChange: (v: string) => setRegistration(v),
                      icon: (
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M9 12h6" />
                        <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M12 9v6" />
                        <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M4 6h16v14H4z" />
                      </svg>
                      ),
                    },
                    {
                      label: 'Phone',
                      placeholder: '(___) ___-____ ext ____',
                      value: phone,
                      onChange: (v: string) => setPhone(v),
                      icon: (
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M22 16.92v3a2 2 0 01-2.18 2A19.86 19.86 0 012 4.18 2 2 0 014 2h3a2 2 0 012 1.72c.12.86.3 1.7.54 2.5a2 2 0 01-.45 2.11L8 9a16 16 0 007 7l.67-1.09a2 2 0 012.11-.45c.8.24 1.64.42 2.5.54A2 2 0 0122 16.92z" />
                      </svg>
                      ),
                    },
                    {
                      label: 'Mobile',
                      placeholder: '(___) ___-____',
                      value: mobile,
                      onChange: (v: string) => setMobile(v),
                      icon: (
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M22 16.92v3a2 2 0 01-2.18 2A19.86 19.86 0 012 4.18 2 2 0 014 2h3a2 2 0 012 1.72c.12.86.3 1.7.54 2.5a2 2 0 01-.45 2.11L8 9a16 16 0 007 7l.67-1.09a2 2 0 012.11-.45c.8.24 1.64.42 2.5.54A2 2 0 0122 16.92z" />
                      </svg>
                      ),
                    },
                    {
                      label: 'Email',
                      placeholder: 'email',
                      value: email,
                      onChange: (v: string) => setEmail(v),
                      icon: (
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M4 4h16v16H4z" />
                        <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M22 6l-10 7L2 6" />
                      </svg>
                      ),
                    },
                    {
                      label: 'Facebook',
                      placeholder: 'facebook',
                      value: facebook,
                      onChange: (v: string) => setFacebook(v),
                      icon: (
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z" />
                      </svg>
                      ),
                    },
                    {
                      label: 'Twitter',
                      placeholder: 'twitter',
                      value: twitter,
                      onChange: (v: string) => setTwitter(v),
                      icon: (
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M23 3a10.9 10.9 0 01-3.14 1.53A4.48 4.48 0 0012 8v1A10.66 10.66 0 013 4s-4 9 5 13a11.64 11.64 0 01-7 2c9 5 20 0 20-11v-1a4.5 4.5 0 00-1.27-3.16A10.9 10.9 0 0023 3z" />
                      </svg>
                      ),
                    },
                  ].map((f) => (
                    <div key={f.label}>
                      <div className="text-[11px] text-gray-700">{f.label}</div>
                      <div className="mt-1 flex items-center border border-gray-200">
                        <div className="w-9 h-8 flex items-center justify-center text-gray-500 border-r border-gray-200">
                          {f.icon}
                        </div>
                        <input
                          className="h-8 flex-1 px-2 text-xs outline-none"
                          placeholder={f.placeholder}
                          value={(f as any).value ?? ''}
                          onChange={(e) => {
                            const fn = (f as any).onChange as ((v: string) => void) | undefined
                            if (fn) fn(e.target.value)
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : newUserTab === 'permissions' ? (
                <div>
                  <div className="border border-[#9ec5fe] bg-[#dbeafe] p-3">
                    <div className="flex items-start gap-2">
                      <div className="mt-0.5 text-[#1e40af]">
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                          <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M12 8h.01" />
                          <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M11 12h1v4h1" />
                          <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M12 22C6.48 22 2 17.52 2 12S6.48 2 12 2s10 4.48 10 10-4.48 10-10 10z" />
                        </svg>
                      </div>
                      <div className="text-[11px] text-[#1e40af] leading-snug">
                        Any changes to a users permissions will not take effect until <span className="font-semibold underline">after</span>{' '}
                        user has logged out. For this reason it is recommended that you do not set permissions to any sensitive
                        information until you are sure what the user will have access to.
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 text-[12px] font-semibold text-gray-800">System Access</div>
                  <div className="mt-2 border-t border-gray-200" />

                  <div className="mt-2 space-y-1">
                    {[
                      { key: 'access_all_deals', label: 'Access all Deals' },
                      { key: 'access_all_leads_customers', label: 'Access all Leads/Customers' },
                      { key: 'administrator', label: 'Administrator' },
                      { key: 'approver', label: 'Approver' },
                      { key: 'vendors', label: 'Vendors' },
                      { key: 'delete_vendors', label: 'Delete Vendors' },
                      { key: 'costs', label: 'Costs' },
                      { key: 'customers', label: 'Customers' },
                      { key: 'delete_customers', label: 'Delete Customers' },
                      { key: 'sales', label: 'Sales' },
                      { key: 'delete_sales', label: 'Delete Sales' },
                      { key: 'inventory', label: 'Inventory' },
                      { key: 'delete_inventory', label: 'Delete Inventory' },
                      { key: 'settings', label: 'Settings' },
                      { key: 'sales_reports_access', label: 'Sales Reports Access' },
                      { key: 'inventory_reports_access', label: 'Inventory Reports Access' },
                    ].map((p) => {
                      const v = Boolean((permissions as any)[p.key])
                      return (
                        <div key={p.key} className="flex items-center justify-between gap-4 py-1">
                          <div className="text-[11px] text-gray-700">{p.label}</div>
                          <button
                            type="button"
                            className="h-5 w-16 rounded-full border border-gray-300 bg-white px-2 text-[9px] font-semibold text-gray-700 flex items-center justify-between"
                            onClick={() => setPermissions((prev) => ({ ...prev, [p.key]: !v }))}
                            aria-pressed={v}
                          >
                            {v ? (
                              <>
                                <span className="h-2.5 w-2.5 rounded-full bg-[#118df0] transition-all duration-150" />
                                <span>YES</span>
                              </>
                            ) : (
                              <>
                                <span>NO</span>
                                <span className="h-2.5 w-2.5 rounded-full bg-[#118df0] transition-all duration-150" />
                              </>
                            )}
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <div>
                  <div className="text-[11px] text-gray-700">Password</div>
                  <div className="mt-1 flex items-center border border-gray-200">
                    <div className="w-9 h-8 flex items-center justify-center text-gray-500 border-r border-gray-200 bg-gray-50">
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M12 11V7a4 4 0 10-8 0v4" />
                        <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M6 11h12v10H6z" />
                      </svg>
                    </div>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value)
                        setPasswordError(null)
                      }}
                      className="h-8 flex-1 px-2 text-xs outline-none"
                    />
                  </div>
                  {passwordError ? <div className="mt-1 text-[11px] text-red-600">{passwordError}</div> : null}

                  <div className="mt-3 text-[11px] text-gray-700">Confirm Password</div>
                  <div className="mt-1 flex items-center border border-gray-200">
                    <div className="w-9 h-8 flex items-center justify-center text-gray-500 border-r border-gray-200 bg-gray-50">
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M12 11V7a4 4 0 10-8 0v4" />
                        <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M6 11h12v10H6z" />
                      </svg>
                    </div>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value)
                        setPasswordError(null)
                      }}
                      className="h-8 flex-1 px-2 text-xs outline-none"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="h-12 px-4 border-t border-gray-200 flex items-center justify-end gap-2">
              <button type="button" className="h-8 px-4 bg-red-600 text-white text-xs font-semibold" onClick={closeNewUser}>
                Cancel
              </button>
              {newUserTab === 'password' ? (
                <button
                  type="button"
                  disabled={!saveEnabled}
                  className={
                    saveEnabled
                      ? 'h-8 px-4 bg-[#118df0] text-white text-xs font-semibold'
                      : 'h-8 px-4 bg-[#118df0]/60 text-white text-xs font-semibold cursor-not-allowed'
                  }
                  onClick={() => void handleNewUserSave()}
                >
                  {savingNewUser ? 'Saving…' : editingUserId ? 'Update' : 'Save'}
                </button>
              ) : (
                <button type="button" className="h-8 px-4 bg-[#118df0] text-white text-xs font-semibold" onClick={goNext}>
                  Next
                </button>
              )}
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-4 py-2">
        <button
          type="button"
          className="h-7 w-7 flex items-center justify-center text-[#118df0]"
          title="Add user"
          onClick={() => {
            setNewUserTab('details')
            setNewUserOpen(true)
          }}
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
            <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M8.5 11a4 4 0 100-8 4 4 0 000 8z" />
            <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M20 8v6" />
            <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M17 11h6" />
          </svg>
        </button>

        <div className="flex-1 flex items-center gap-2">
          <div className="relative w-full max-w-[360px]">
            <div className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35" />
                <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M11 19a8 8 0 110-16 8 8 0 010 16z" />
              </svg>
            </div>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="search"
              className="h-7 w-full border border-gray-300 pl-7 pr-2 text-xs"
            />
          </div>
        </div>

        <select
          className="h-7 border border-gray-300 px-2 text-xs bg-white"
          value={pageSize}
          onChange={(e) => setPageSize(parseInt(e.target.value, 10))}
        >
          <option value={5}>5</option>
          <option value={10}>10</option>
          <option value={20}>20</option>
        </select>
      </div>

      <div className="mt-2 border border-gray-200 bg-white">
        <div className="grid grid-cols-[56px_1fr_1fr_1fr] gap-0 border-b border-gray-200 bg-gray-50">
          <div className="h-9" />
          <div className="h-9 flex items-center px-3 text-[11px] font-semibold text-gray-700">Name</div>
          <div className="h-9 flex items-center px-3 text-[11px] font-semibold text-gray-700">Email</div>
          <div className="h-9 flex items-center px-3 text-[11px] font-semibold text-gray-700">Title</div>
        </div>

        {loading ? (
          <div className="p-6 text-xs text-gray-500">Loading…</div>
        ) : visible.length === 0 ? (
          <div className="p-6 text-xs text-gray-500">No users found.</div>
        ) : (
          <div>
            {visible.map((r) => {
              const isOwnerSessionRow = r.id === 'current-session-owner'
              const name = `${r.first_name || ''} ${r.last_name || ''}`.trim() || deriveNameFromEmail(r.email)
              const title = r.title || ''
              return (
                <div key={r.id} className="grid grid-cols-[56px_1fr_1fr_1fr] border-b border-gray-200 hover:bg-gray-50">
                  <div className="h-9 flex items-center justify-center gap-3">
                    {isOwnerSessionRow ? (
                      <div className="h-6 w-6" />
                    ) : (
                      <>
                        <button
                          type="button"
                          className="h-6 w-6 flex items-center justify-center text-gray-500 hover:text-gray-800"
                          title="Edit"
                          onClick={() => openEdit(r)}
                        >
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M12 20h9" />
                            <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4 12.5-12.5z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          className="h-6 w-6 flex items-center justify-center text-red-600 hover:text-red-700"
                          title="Delete"
                          onClick={() => void handleDelete(r.id, r.email)}
                        >
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M3 6h18" />
                            <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M8 6V4h8v2" />
                            <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M19 6l-1 14H6L5 6" />
                          </svg>
                        </button>
                      </>
                    )}
                  </div>
                  <div className="h-9 flex items-center px-3 text-xs text-gray-800">{name}</div>
                  <div className="h-9 flex items-center px-3 text-xs text-gray-800">{r.email}</div>
                  <div className="h-9 flex items-center px-3 text-xs text-gray-800">{title}</div>
                </div>
              )
            })}
          </div>
        )}
      </div>

    </div>
  )
}
