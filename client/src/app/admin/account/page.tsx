'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

type AdminSession = {
  email?: string
  role?: string
}

type AdminUserRow = {
  email: string
  role: string
  is_active: boolean
  created_at: string
  updated_at: string
}

type VerificationRow = {
  id: string
  email: string
  full_name: string
  address: string
  license_number: string
  created_at: string
}

const deriveNameFromEmail = (email: string) => {
  const left = String(email || '').split('@')[0] || ''
  const cleaned = left.replace(/[._-]+/g, ' ').trim()
  if (!cleaned) return ''
  return cleaned
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

export default function AdminAccountPage() {
  const router = useRouter()
  const [session, setSession] = useState<AdminSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [adminUser, setAdminUser] = useState<AdminUserRow | null>(null)
  const [verification, setVerification] = useState<VerificationRow | null>(null)
  const [showManageAccount, setShowManageAccount] = useState(false)
  const [usersRow, setUsersRow] = useState<any | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [editFirstName, setEditFirstName] = useState('')
  const [editLastName, setEditLastName] = useState('')
  const [editTitle, setEditTitle] = useState('')
  const [editRole, setEditRole] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editMobile, setEditMobile] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editPassword, setEditPassword] = useState('')
  const [updatingAccount, setUpdatingAccount] = useState(false)
  const [updateAccountError, setUpdateAccountError] = useState('')
  const [updateAccountSuccess, setUpdateAccountSuccess] = useState('')
  const [profileFile, setProfileFile] = useState<File | null>(null)
  const [profilePreviewUrl, setProfilePreviewUrl] = useState<string | null>(null)
  const [profileUploading, setProfileUploading] = useState(false)
  const [profileUploadError, setProfileUploadError] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [licenseFile, setLicenseFile] = useState<File | null>(null)
  const [licensePreviewUrl, setLicensePreviewUrl] = useState<string | null>(null)
  const [sendingLicense, setSendingLicense] = useState(false)
  const [licenseSendResult, setLicenseSendResult] = useState('')
  const [licenseSendError, setLicenseSendError] = useState('')

  const profileImgSrc = useMemo(() => {
    if (profilePreviewUrl) return profilePreviewUrl
    const raw = String(avatarUrl || '').trim()
    if (!raw) return null
    if (raw.startsWith('data:')) return raw
    if (raw.startsWith('http://') || raw.startsWith('https://')) return raw
    return `data:image/jpeg;base64,${raw}`
  }, [avatarUrl, profilePreviewUrl])
  const [validationModalOpen, setValidationModalOpen] = useState(false)
  const [validationModalMode, setValidationModalMode] = useState<'FORM' | 'ERROR'>('FORM')
  const [validationModalMessage, setValidationModalMessage] = useState('')
  const [validationForm, setValidationForm] = useState({ full_name: '', address: '', license_number: '' })
  const [savingIdInfo, setSavingIdInfo] = useState(false)
  const [saveIdInfoError, setSaveIdInfoError] = useState('')
  const [saveIdInfoResult, setSaveIdInfoResult] = useState('')

  const [newUserOpen, setNewUserOpen] = useState(false)
  const [newUserTab, setNewUserTab] = useState<'details' | 'permissions' | 'password'>('details')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [registration, setRegistration] = useState('')
  const [phone, setPhone] = useState('')
  const [mobile, setMobile] = useState('')
  const [newUserEmail, setNewUserEmail] = useState('')
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
  const [newUserError, setNewUserError] = useState<string | null>(null)
  const [savingNewUser, setSavingNewUser] = useState(false)

  const getNextRegistration = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('registration, created_at')
        .not('registration', 'is', null)
        .order('created_at', { ascending: false })
        .limit(200)

      if (error) return '01'

      const rows = Array.isArray(data) ? (data as any[]) : []
      let maxNum = 0
      let width = 2
      for (const r of rows) {
        const regRaw = String(r?.registration ?? '').trim()
        if (!regRaw) continue
        if (/^\d+$/.test(regRaw)) width = Math.max(width, regRaw.length)
        const numeric = parseInt(regRaw.replace(/\D/g, ''), 10)
        if (!Number.isFinite(numeric)) continue
        if (numeric > maxNum) maxNum = numeric
      }
      const next = maxNum + 1
      return String(next).padStart(width, '0')
    } catch {
      return '01'
    }
  }

  useEffect(() => {
    if (!newUserOpen) return
    if (registration.trim()) return
    const run = async () => {
      const next = await getNextRegistration()
      setRegistration(next)
    }
    void run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newUserOpen])

  const visibleUserFields = useMemo(
    () => [
      'first_name',
      'last_name',
      'title',
      'role',
      'email',
      'phone',
      'mobile',
      'password',
    ],
    []
  )

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

  const closeNewUser = () => {
    setNewUserOpen(false)
    setNewUserTab('details')
    setFirstName('')
    setLastName('')
    setRegistration('')
    setPhone('')
    setMobile('')
    setNewUserEmail('')
    setFacebook('')
    setTwitter('')
    setPassword('')
    setConfirmPassword('')
    setNewUserError(null)
    setSavingNewUser(false)
  }

  const goNext = () => {
    if (newUserTab === 'details') {
      setNewUserTab('permissions')
      return
    }
    if (newUserTab === 'permissions') {
      setNewUserTab('password')
    }
  }

  const handleNewUserSave = async () => {
    if (newUserTab !== 'password') return
    if (savingNewUser) return
    setNewUserError(null)

    if (!firstName.trim()) {
      setNewUserError('First name is required.')
      return
    }
    if (!newUserEmail.trim()) {
      setNewUserError('Email is required.')
      return
    }
    if (!password.trim()) {
      setNewUserError('A password is required.')
      return
    }
    if (password !== confirmPassword) {
      setNewUserError('Passwords do not match.')
      return
    }

    setSavingNewUser(true)
    try {
      const payload = {
        user_id: await getWebhookUserId(),
        first_name: nullIfEmpty(firstName),
        last_name: nullIfEmpty(lastName),
        title: 'Owner',
        registration: nullIfEmpty(registration),
        phone: nullIfEmpty(phone),
        mobile: nullIfEmpty(mobile),
        email: nullIfEmpty(newUserEmail),
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

      try {
        const insertRow: any = {
          user_id: payload.user_id,
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
        await supabase.from('users').insert(insertRow)
      } catch {
        // ignore
      }

      if (typeof window !== 'undefined') {
        window.localStorage.setItem('edc_account_verified', 'true')
        window.dispatchEvent(new Event('storage'))
      }

      closeNewUser()
    } catch (e) {
      setNewUserError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSavingNewUser(false)
    }
  }

  const saveIdInfo = async () => {
    if (savingIdInfo) return
    const email = String(session?.email || '').trim().toLowerCase()
    if (!email) {
      setSaveIdInfoError('Missing email')
      return
    }

    if (!licenseFile) {
      setSaveIdInfoError('Missing image file')
      return
    }

    const fileToBase64 = async (file: File): Promise<string> => {
      const ab = await file.arrayBuffer()
      const bytes = new Uint8Array(ab)
      let binary = ''
      const chunkSize = 0x8000
      for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, i + chunkSize)
        binary += String.fromCharCode(...Array.from(chunk))
      }
      return window.btoa(binary)
    }

    setSavingIdInfo(true)
    setSaveIdInfoError('')
    setSaveIdInfoResult('')
    try {
      const b64 = await fileToBase64(licenseFile)
      const res = await fetch('/api/save-idinfo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, gmail: email, b64, ...validationForm }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        setSaveIdInfoError(String(json?.error || 'Failed to save'))
        return
      }

      const upstreamBody = String(json?.upstreamBody || '').trim()
      const isDone = upstreamBody.toLowerCase() === 'done'
      if (!isDone) {
        setValidationModalMode('ERROR')
        setValidationModalMessage('Error saving data')
        setValidationModalOpen(true)
        return
      }

      setSaveIdInfoResult('Saved')
      setValidationModalOpen(false)
      setNewUserTab('details')
      setNewUserOpen(true)
      setNewUserEmail(email)
      setFirstName('')
      setLastName('')
      setRegistration('')
      setPhone('')
      setMobile('')
      setFacebook('')
      setTwitter('')
      setPassword('')
      setConfirmPassword('')
      setNewUserError(null)
    } catch (e: any) {
      setSaveIdInfoError(e?.message || 'Failed to save')
    } finally {
      setSavingIdInfo(false)
    }
  }

  useEffect(() => {
    if (typeof window === 'undefined') return

    const raw = window.localStorage.getItem('edc_admin_session')
    if (!raw) {
      router.replace('/admin')
      return
    }

    try {
      const parsed = JSON.parse(raw) as AdminSession
      if (!parsed?.email) {
        router.replace('/admin')
        return
      }
      setSession(parsed)
    } catch {
      router.replace('/admin')
    }
  }, [router])

  useEffect(() => {
    const p = String((usersRow as any)?.profile || '').trim()
    setAvatarUrl(p ? p : null)
  }, [usersRow])

  useEffect(() => {
    const email = session?.email?.trim().toLowerCase()
    if (!email) return

    const run = async () => {
      setLoading(true)
      setError('')
      try {
        const [{ data: adminData, error: adminErr }, { data: verifyData, error: verifyErr }, { data: userData, error: userErr }] =
          await Promise.all([
          supabase
            .from('edc_admin_users')
            .select('email, role, is_active, created_at, updated_at')
            .eq('email', email)
            .limit(1)
            .maybeSingle(),
          supabase
            .from('edc_account_verifications')
            .select('id, email, full_name, address, license_number, created_at')
            .eq('email', email)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase.from('users').select('*').eq('email', email).limit(1).maybeSingle(),
        ])

        if (adminErr) throw adminErr
        if (verifyErr) throw verifyErr
        if (userErr) throw userErr

        setAdminUser(adminData ? (adminData as AdminUserRow) : null)
        setVerification(verifyData ? (verifyData as VerificationRow) : null)
        setUsersRow(userData ?? null)
      } catch (e: any) {
        setError(e?.message || 'Failed to load account settings')
      } finally {
        setLoading(false)
      }
    }

    void run()
  }, [session])

  useEffect(() => {
    const row = usersRow as any
    setEditFirstName(String(row?.first_name ?? '').trim())
    setEditLastName(String(row?.last_name ?? '').trim())
    setEditTitle(String(row?.title ?? '').trim())
    setEditRole(String(row?.role ?? '').trim())
    setEditPhone(String(row?.phone ?? '').trim())
    setEditMobile(String(row?.mobile ?? '').trim())
    setEditEmail(String(row?.email ?? session?.email ?? '').trim())
    setEditPassword(String(row?.password ?? '').trim())
  }, [session?.email, usersRow])

  const buildUpdatePayload = (overrides?: Record<string, any>) => {
    const sessionEmail = String(session?.email || '').trim().toLowerCase()
    const base = (usersRow && typeof usersRow === 'object' ? { ...(usersRow as any) } : {}) as any
    return {
      session_email: sessionEmail,
      ...base,
      first_name: editFirstName,
      last_name: editLastName,
      title: editTitle,
      role: editRole,
      phone: editPhone,
      mobile: editMobile,
      email: editEmail,
      password: editPassword,
      profile: avatarUrl,
      ...(overrides || {}),
    }
  }

  const handleUpdateAccount = async () => {
    if (updatingAccount) return
    const email = String(session?.email || '').trim().toLowerCase()
    if (!email) return

    setUpdatingAccount(true)
    setUpdateAccountError('')
    setUpdateAccountSuccess('')
    try {
      let profileImageBase64: string | null = null
      let profileImageName: string | null = null
      let profileImageType: string | null = null

      if (profileFile) {
        setProfileUploading(true)
        setProfileUploadError('')
        try {
          profileImageName = profileFile.name
          profileImageType = profileFile.type
          profileImageBase64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader()
            reader.onerror = () => reject(new Error('Unable to read profile image'))
            reader.onload = () => {
              const res = String(reader.result || '')
              const comma = res.indexOf(',')
              resolve(comma >= 0 ? res.slice(comma + 1) : res)
            }
            reader.readAsDataURL(profileFile)
          })
        } finally {
          setProfileUploading(false)
        }
      }

      const payload = buildUpdatePayload({
        profile: avatarUrl,
        profile_image_base64: profileImageBase64,
        profile_image_name: profileImageName,
        profile_image_type: profileImageType,
      })

      const res = await fetch('https://primary-production-6722.up.railway.app/webhook/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const text = await res.text().catch(() => '')
      if (!res.ok) throw new Error(text || `Request failed (${res.status})`)

      const trimmed = String(text || '').trim()
      const isDone = trimmed.toLowerCase() === 'done'
      if (!isDone) throw new Error(trimmed || 'Update failed')

      try {
        const fetchEmail = String(editEmail || email).trim().toLowerCase()
        const { data: fresh } = await supabase.from('users').select('*').eq('email', fetchEmail).limit(1).maybeSingle()
        if (fresh) {
          setUsersRow(fresh)
        } else {
          setUsersRow((prev: any) => {
            const base = prev && typeof prev === 'object' ? { ...(prev as any) } : {}
            return {
              ...base,
              first_name: editFirstName,
              last_name: editLastName,
              title: editTitle,
              role: editRole,
              phone: editPhone,
              mobile: editMobile,
              email: editEmail,
              password: editPassword,
            }
          })
        }
      } catch {
        setUsersRow((prev: any) => {
          const base = prev && typeof prev === 'object' ? { ...(prev as any) } : {}
          return {
            ...base,
            first_name: editFirstName,
            last_name: editLastName,
            title: editTitle,
            role: editRole,
            phone: editPhone,
            mobile: editMobile,
            email: editEmail,
            password: editPassword,
          }
        })
      }

      setUpdateAccountSuccess('Done')
      if (profileFile) setProfileFile(null)
    } catch (e: any) {
      setUpdateAccountError(e?.message || 'Update failed')
    } finally {
      setUpdatingAccount(false)
    }
  }

  const displayRole = useMemo(() => {
    const r = (session?.role || adminUser?.role || '').toString().trim()
    return r || 'STAFF'
  }, [adminUser?.role, session?.role])

  const isFromVerification = !!verification

  const sendLicenseForValidation = async () => {
    if (sendingLicense) return

    const email = String(session?.email || '').trim().toLowerCase()
    if (!email) {
      setLicenseSendError('Missing email')
      setLicenseSendResult('')
      return
    }

    if (!licenseFile) {
      setLicenseSendError('Please choose an image first')
      setLicenseSendResult('')
      return
    }

    setSendingLicense(true)
    setLicenseSendError('')
    setLicenseSendResult('')
    setValidationModalOpen(false)
    setValidationModalMessage('')
    setSaveIdInfoError('')
    setSaveIdInfoResult('')

    try {
      const form = new FormData()
      form.append('email', email)
      form.append('file', licenseFile)

      const res = await fetch('/api/validation', {
        method: 'POST',
        body: form,
      })

      const json = await res.json().catch(() => null)

      const getUpstreamArray = () => {
        const upstreamJson = (json as any)?.upstreamJson
        if (Array.isArray(upstreamJson)) return upstreamJson
        if (upstreamJson && typeof upstreamJson === 'object') return [upstreamJson]

        const raw = String((json as any)?.upstreamBody || '').trim()
        if (!raw) return null
        try {
          const parsed = JSON.parse(raw)
          if (Array.isArray(parsed)) return parsed
          if (parsed && typeof parsed === 'object') return [parsed]
          return null
        } catch {
          return null
        }
      }

      const getOutputMessage = (arr: any[] | null) => {
        if (!Array.isArray(arr) || arr.length === 0) return ''
        const first = arr[0] as any
        if (!first || typeof first !== 'object') return ''
        return String(first?.Output ?? first?.output ?? first?.message ?? '').trim()
      }

      const showWarningModal = (msg: string) => {
        const m = String(msg || '').trim()
        if (!m) return
        setValidationModalMode('ERROR')
        setValidationModalMessage(m)
        setValidationModalOpen(true)
      }

      const showFormModalIfPresent = (arr: any[] | null) => {
        if (!Array.isArray(arr) || arr.length === 0) return
        const first = arr[0] as any
        if (!first || typeof first !== 'object') return
        const status = String(first?.status || '').trim().toUpperCase()
        const fullName = String(first?.full_name || '').trim()
        const address = String(first?.address || '').trim()
        const licenseNumber = String(first?.license_number || '').trim()

        if (status === 'DRIVER_LICENSE' || fullName || address || licenseNumber) {
          setValidationModalMode('FORM')
          setValidationForm({ full_name: fullName, address, license_number: licenseNumber })
          setValidationModalOpen(true)
        }
      }

      if (!res.ok) {
        const msg = String(json?.error || 'Request failed')
        setLicenseSendError(msg)

        const upstreamArr = getUpstreamArray()
        const out = getOutputMessage(upstreamArr)
        if (out) showWarningModal(out)
        return
      }

      const upstreamArr = getUpstreamArray()
      const out = getOutputMessage(upstreamArr)
      if (out) {
        showWarningModal(out)
        return
      }

      showFormModalIfPresent(upstreamArr)
    } catch (e: any) {
      setLicenseSendError(e?.message || 'Request failed')
    } finally {
      setSendingLicense(false)
    }
  }

  useEffect(() => {
    if (!licenseFile) {
      if (licensePreviewUrl) URL.revokeObjectURL(licensePreviewUrl)
      setLicensePreviewUrl(null)
      return
    }

    const url = URL.createObjectURL(licenseFile)
    if (licensePreviewUrl) URL.revokeObjectURL(licensePreviewUrl)
    setLicensePreviewUrl(url)
    return () => {
      URL.revokeObjectURL(url)
    }
  }, [licenseFile])

  useEffect(() => {
    if (!profileFile) {
      if (profilePreviewUrl) URL.revokeObjectURL(profilePreviewUrl)
      setProfilePreviewUrl(null)
      return
    }

    const url = URL.createObjectURL(profileFile)
    if (profilePreviewUrl) URL.revokeObjectURL(profilePreviewUrl)
    setProfilePreviewUrl(url)
    return () => {
      URL.revokeObjectURL(url)
    }
  }, [profileFile])

  const displayRoleLabel = useMemo(() => {
    if (!isFromVerification && displayRole === 'STAFF') return `NOT VALIDATED ${displayRole}`
    return displayRole
  }, [displayRole, isFromVerification])

  const canEditRole = useMemo(() => {
    const accountValue = String((usersRow as any)?.account ?? '').trim().toLowerCase()
    return accountValue === 'admin'
  }, [usersRow])

  return (
    <div
      className="min-h-screen relative"
      style={{
        backgroundImage: "linear-gradient(rgba(0,0,0,0.22), rgba(0,0,0,0.22)), url('/images/Background.png')",
        backgroundSize: 'cover',
        backgroundPosition: 'center top',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <div className="relative z-10">
        <div className="px-6 pt-8 pb-4 bg-transparent">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 rounded-xl bg-white/10 backdrop-blur flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.55)]">Account Settings</h1>
              <p className="text-sm text-white/70 mt-0.5 drop-shadow-[0_2px_8px_rgba(0,0,0,0.55)]">Manage your admin session and verification details.</p>
            </div>
          </div>
        </div>

        <div className="px-6 pb-10">
        {validationModalOpen ? (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" role="dialog" aria-modal="true">
            <button
              type="button"
              aria-label="Close"
              className="edc-overlay"
              style={{ zIndex: 0 }}
              onClick={() => setValidationModalOpen(false)}
            />
            <div className="edc-modal relative z-[1] w-full max-w-lg p-6">
              <div className="flex items-center justify-between">
                <div className="text-lg font-semibold text-slate-900">
                  {validationModalMode === 'ERROR' ? 'Warning' : 'Driver License Details'}
                </div>
                <button
                  type="button"
                  onClick={() => setValidationModalOpen(false)}
                  className="w-9 h-9 rounded-xl hover:bg-slate-50 flex items-center justify-center"
                  aria-label="Close"
                >
                  <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {validationModalMode === 'ERROR' ? (
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  {validationModalMessage}
                </div>
              ) : (
                <div className="mt-4 grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1">Full name</label>
                    <input
                      className="edc-input"
                      value={validationForm.full_name}
                      onChange={(e) => setValidationForm((p) => ({ ...p, full_name: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1">Address</label>
                    <textarea
                      className="edc-input min-h-24"
                      value={validationForm.address}
                      onChange={(e) => setValidationForm((p) => ({ ...p, address: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1">License number</label>
                    <input
                      className="edc-input"
                      value={validationForm.license_number}
                      onChange={(e) => setValidationForm((p) => ({ ...p, license_number: e.target.value }))}
                    />
                  </div>

                  {saveIdInfoError ? (
                    <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-danger-600">{saveIdInfoError}</div>
                  ) : null}

                  {saveIdInfoResult ? (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{saveIdInfoResult}</div>
                  ) : null}
                </div>
              )}

              <div className="mt-6 flex items-center justify-end gap-2">
                {validationModalMode === 'FORM' ? (
                  <button
                    type="button"
                    className="edc-btn-primary h-9 px-5"
                    onClick={saveIdInfo}
                    disabled={savingIdInfo}
                  >
                    {savingIdInfo ? 'Saving…' : 'Save'}
                  </button>
                ) : (
                  <button type="button" className="edc-btn-ghost h-9 px-4" onClick={() => setValidationModalOpen(false)}>
                    Close
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : null}

        {newUserOpen ? (
          <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto" role="dialog" aria-modal="true">
            <div className="absolute inset-0 bg-navy-900/60 backdrop-blur-sm" onMouseDown={closeNewUser} />
            <div
              className="edc-modal w-full max-w-[460px] relative z-10 flex flex-col max-h-[calc(100vh-2rem)]"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="h-11 px-4 border-b border-slate-200/60 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                    <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M12 11a4 4 0 100-8 4 4 0 000 8z" />
                  </svg>
                  New User
                </div>
                <button type="button" className="h-8 w-8 flex items-center justify-center" onClick={closeNewUser}>
                  <span className="text-xl leading-none text-slate-400">×</span>
                </button>
              </div>

              <div className="px-4 pt-3">
                <div className="flex items-center gap-4 border-b border-slate-200/60">
                  <button
                    type="button"
                    className={
                      newUserTab === 'details'
                        ? 'h-7 px-3 text-xs font-semibold text-white bg-navy-900'
                        : 'h-7 px-3 text-xs text-slate-600'
                    }
                    onClick={() => setNewUserTab('details')}
                  >
                    Details
                  </button>
                  <button
                    type="button"
                    className={
                      newUserTab === 'permissions'
                        ? 'h-7 px-3 text-xs font-semibold text-white bg-navy-900'
                        : 'h-7 px-3 text-xs text-slate-600'
                    }
                    onClick={() => setNewUserTab('permissions')}
                  >
                    Permissions
                  </button>
                  <button
                    type="button"
                    className={
                      newUserTab === 'password'
                        ? 'h-7 px-3 text-xs font-semibold text-white bg-navy-900'
                        : 'h-7 px-3 text-xs text-slate-600'
                    }
                    onClick={() => setNewUserTab('password')}
                  >
                    Password
                  </button>
                </div>
              </div>

              <div className="px-4 py-3 flex-1 overflow-y-auto">
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
                        value: 'Owner',
                        onChange: (_v: string) => {},
                        disabled: true,
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
                        onChange: (_v: string) => {},
                        disabled: true,
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
                        value: newUserEmail,
                        onChange: (v: string) => setNewUserEmail(v),
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
                        <div className="text-[11px] text-slate-600">{f.label}</div>
                        <div className="mt-1 flex items-center border border-slate-200/60">
                          <div className="w-9 h-8 flex items-center justify-center text-slate-400 border-r border-slate-200/60">
                            {f.icon}
                          </div>
                          <input
                            className={
                              (f as any).disabled
                                ? 'h-8 flex-1 px-2 text-xs outline-none bg-slate-50'
                                : 'h-8 flex-1 px-2 text-xs outline-none'
                            }
                            placeholder={f.placeholder}
                            value={(f as any).value ?? ''}
                            disabled={Boolean((f as any).disabled)}
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
                    <div className="border border-slate-200/60 bg-slate-50 p-3 rounded-lg">
                      <div className="flex items-start gap-2">
                        <div className="mt-0.5 text-slate-600">
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M12 8h.01" />
                            <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M11 12h1v4h1" />
                            <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M12 22C6.48 22 2 17.52 2 12S6.48 2 12 2s10 4.48 10 10-4.48 10-10 10z" />
                          </svg>
                        </div>
                        <div className="text-[11px] text-slate-700 leading-snug">
                          Any changes to a users permissions will not take effect until{' '}
                          <span className="font-semibold underline">after</span> user has logged out. For this reason it is
                          recommended that you do not set permissions to any sensitive information until you are sure what the user
                          will have access to.
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 text-[12px] font-semibold text-slate-700">System Access</div>
                    <div className="mt-2 border-t border-slate-200/60" />

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
                            <div className="text-[11px] text-slate-600">{p.label}</div>
                            <button
                              type="button"
                              className="h-5 w-16 rounded-full border border-slate-300 bg-white px-2 text-[9px] font-semibold text-slate-600 flex items-center justify-between"
                              onClick={() => setPermissions((prev) => ({ ...prev, [p.key]: !v }))}
                              aria-pressed={v}
                            >
                              {v ? (
                                <>
                                  <span className="h-2.5 w-2.5 rounded-full bg-navy-900 transition-all duration-150" />
                                  <span>YES</span>
                                </>
                              ) : (
                                <>
                                  <span>NO</span>
                                  <span className="h-2.5 w-2.5 rounded-full bg-navy-900 transition-all duration-150" />
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
                    <div className="text-[11px] text-slate-600">Password</div>
                    <div className="mt-1 flex items-center border border-slate-200/60">
                      <div className="w-9 h-8 flex items-center justify-center text-slate-400 border-r border-slate-200/60 bg-slate-50">
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
                          setNewUserError(null)
                        }}
                        className="h-8 flex-1 px-2 text-xs outline-none"
                      />
                    </div>
                    {newUserError ? <div className="mt-1 text-[11px] text-red-600">{newUserError}</div> : null}
                    {!newUserError && password.trim() && confirmPassword.trim() && password !== confirmPassword ? (
                      <div className="mt-1 text-[11px] text-red-600">Passwords do not match.</div>
                    ) : null}

                    <div className="mt-3 text-[11px] text-slate-600">Confirm Password</div>
                    <div className="mt-1 flex items-center border border-slate-200/60">
                      <div className="w-9 h-8 flex items-center justify-center text-slate-400 border-r border-slate-200/60 bg-slate-50">
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
                          setNewUserError(null)
                        }}
                        className="h-8 flex-1 px-2 text-xs outline-none"
                      />
                    </div>

                    {!newUserError && (!firstName.trim() || !newUserEmail.trim() || !password.trim() || !confirmPassword.trim()) ? (
                      <div className="mt-2 text-[11px] text-slate-500">Fill First Name, Email, and matching passwords to enable Save.</div>
                    ) : null}
                  </div>
                )}
              </div>

              <div className="h-12 px-4 border-t border-slate-200/60 flex items-center justify-end gap-2">
                <button type="button" className="edc-btn-danger h-8 px-4 text-xs" onClick={closeNewUser}>
                  Cancel
                </button>
                {newUserTab === 'password' ? (
                  (() => {
                    const saveEnabled =
                      Boolean(firstName.trim()) &&
                      Boolean(newUserEmail.trim()) &&
                      Boolean(password.trim()) &&
                      password === confirmPassword &&
                      !savingNewUser
                    return (
                  <button
                    type="button"
                    disabled={!saveEnabled}
                    className={saveEnabled ? 'edc-btn-primary h-8 px-4 text-xs' : 'edc-btn-primary h-8 px-4 text-xs opacity-50 cursor-not-allowed'}
                    onClick={() => void handleNewUserSave()}
                  >
                    {savingNewUser ? 'Saving…' : 'Save'}
                  </button>
                    )
                  })()
                ) : (
                  <button type="button" className="edc-btn-primary h-8 px-4 text-xs" onClick={goNext}>
                    Next
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : null}

        <div className="max-w-3xl">
          {error ? (
            <div className="p-4 rounded-xl border border-red-200 bg-red-50 text-danger-600 text-sm">{error}</div>
          ) : null}

          <div className="mt-4 rounded-2xl border border-white/30 bg-white/55 backdrop-blur-md shadow-[0_18px_50px_rgba(0,0,0,0.22)] overflow-hidden">

            {/* ── Profile header ── */}
            <div className="px-6 pt-6 pb-5 flex flex-col sm:flex-row sm:items-center gap-4 border-b border-white/30">
              <div className="h-16 w-16 rounded-2xl overflow-hidden border-2 border-white/60 shadow-md bg-white/80 flex items-center justify-center shrink-0">
                {profileImgSrc ? (
                  <img src={profileImgSrc as string} alt="Profile" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-2xl font-bold text-slate-600">
                    {String(session?.email || 'A').trim().charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-base font-semibold text-slate-800 truncate">
                  {deriveNameFromEmail(session?.email || '') || 'Account'}
                </div>
                <div className="mt-0.5 text-sm text-slate-500 truncate">{session?.email || '—'}</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className={displayRole === 'ADMIN'
                    ? 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800'
                    : 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800'
                  }>
                    {displayRoleLabel}
                  </span>
                  <span className={isFromVerification
                    ? 'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800'
                    : 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600'
                  }>
                    {isFromVerification && (
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                    {isFromVerification ? 'Verified' : 'Access-code account'}
                  </span>
                </div>
              </div>
            </div>

            {/* ── Tab nav — at the top ── */}
            <div className="px-6 pt-4 flex gap-1 bg-white/20">
              <button
                type="button"
                onClick={() => setShowManageAccount(false)}
                className={`px-5 py-2 rounded-t-lg text-sm font-semibold transition-colors ${
                  !showManageAccount
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-800 hover:bg-white/40'
                }`}
              >
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0" />
                  </svg>
                  Validate ID
                </span>
              </button>
              <button
                type="button"
                onClick={() => setShowManageAccount(true)}
                className={`px-5 py-2 rounded-t-lg text-sm font-semibold transition-colors ${
                  showManageAccount
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-800 hover:bg-white/40'
                }`}
              >
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Manage Account
                </span>
              </button>
            </div>

            {/* ── Tab content ── */}
            <div className="bg-white/60 rounded-b-2xl px-6 py-6">

              {loading ? (
                <div className="flex items-center gap-3 text-sm text-slate-500 py-4">
                  <div className="h-4 w-4 rounded-full border-2 border-slate-400 border-t-transparent animate-spin" />
                  Loading…
                </div>
              ) : !showManageAccount ? (

                /* ── VALIDATE ID TAB ── */
                isFromVerification ? (
                  <div>
                    <div className="flex items-center gap-2 mb-5">
                      <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center">
                        <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-slate-800">Identity Verified</div>
                        <div className="text-xs text-slate-500">Your driver&apos;s license details are on file.</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Full name</label>
                        <input className="edc-input bg-white border border-slate-200 disabled:opacity-100 disabled:text-slate-800 rounded-lg" value={verification?.full_name || ''} disabled />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Address</label>
                        <input className="edc-input bg-white border border-slate-200 disabled:opacity-100 disabled:text-slate-800 rounded-lg" value={verification?.address || ''} disabled />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Driver license number</label>
                        <input className="edc-input bg-white border border-slate-200 disabled:opacity-100 disabled:text-slate-800 rounded-lg" value={verification?.license_number || ''} disabled />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="mb-5">
                      <div className="text-sm font-semibold text-slate-800">Upload Driver&apos;s License</div>
                      <div className="mt-1 text-xs text-slate-500">Upload a clear photo of your driver&apos;s license for identity verification.</div>
                    </div>
                    <div className="flex items-center gap-3 p-4 rounded-xl border-2 border-dashed border-slate-300 bg-white hover:border-blue-400 transition-colors">
                      <svg className="w-8 h-8 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      <div className="flex-1 min-w-0">
                        <input
                          type="file"
                          accept="image/*"
                          className="block w-full text-sm text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200"
                          onChange={(e) => { setLicenseFile(e.target.files?.[0] || null); setLicenseSendError(''); setLicenseSendResult('') }}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={sendLicenseForValidation}
                        disabled={!licenseFile || sendingLicense}
                        className="shrink-0 px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        {sendingLicense ? 'Sending…' : 'Send'}
                      </button>
                    </div>
                    {licensePreviewUrl ? (
                      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 overflow-hidden">
                        <img src={licensePreviewUrl} alt="License preview" className="w-full max-h-80 object-contain" />
                      </div>
                    ) : null}
                    {licenseSendError ? <div className="mt-3 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{licenseSendError}</div> : null}
                  </div>
                )

              ) : (

                /* ── MANAGE ACCOUNT TAB ── */
                <div className="space-y-6">

                  {/* Profile photo — only on this tab */}
                  <div className="p-4 rounded-xl border border-slate-200 bg-white">
                    <div className="flex items-center gap-4">
                      <div className="h-14 w-14 rounded-xl overflow-hidden border-2 border-slate-200 bg-slate-100 flex items-center justify-center shrink-0">
                        {profileImgSrc ? (
                          <img src={profileImgSrc as string} alt="Profile" className="h-full w-full object-cover" />
                        ) : (
                          <span className="text-lg font-bold text-slate-500">
                            {String(session?.email || 'A').trim().charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-slate-800">Profile photo</div>
                        <div className="text-xs text-slate-500 mt-0.5">Upload a square photo for best results.</div>
                        <div className="mt-2">
                          <input
                            type="file"
                            accept="image/*"
                            className="block w-full text-sm text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200"
                            onChange={(e) => { setProfileFile(e.target.files?.[0] || null); setProfileUploadError('') }}
                          />
                        </div>
                        {profileUploadError ? <div className="mt-1 text-xs text-red-600">{profileUploadError}</div> : null}
                      </div>
                    </div>
                  </div>

                  {/* Account fields */}
                  <div>
                    <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Account Details</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      {Object.entries(usersRow || {}).length ? (
                        Object.entries(usersRow || {})
                          .filter(([k]) => visibleUserFields.includes(k))
                          .map(([key, value]) =>
                            key === 'password' ? (
                              <div key={key}>
                                <div>
                                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Password</label>
                                  <div className="relative">
                                    <input
                                      type={showPassword ? 'text' : 'password'}
                                      className="edc-input bg-white border border-slate-200 rounded-lg pr-11"
                                      value={editPassword}
                                      onChange={(e) => setEditPassword(e.target.value)}
                                    />
                                    <button type="button" onClick={() => setShowPassword((v) => !v)}
                                      className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 inline-flex items-center justify-center rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition"
                                    >
                                      {showPassword ? (
                                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" />
                                        </svg>
                                      ) : (
                                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                          <path d="M10.733 5.08A10.744 10.744 0 0 1 12 5c6.5 0 10 7 10 7a18.16 18.16 0 0 1-1.67 2.68" />
                                          <path d="M6.61 6.61A12.56 12.56 0 0 0 2 12s3.5 7 10 7c1.78 0 3.3-.33 4.6-.9" />
                                          <path d="M8.71 8.71A3 3 0 0 0 12 15a3 3 0 0 0 3.29-3.29" /><path d="M3 3l18 18" />
                                        </svg>
                                      )}
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ) : key === 'role' ? (
                              <div key={key}>
                                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                                  Role
                                </label>
                                <select
                                  className="edc-input bg-white border border-slate-200 rounded-lg disabled:text-slate-800"
                                  disabled={!canEditRole}
                                  value={editRole}
                                  onChange={(e) => {
                                    if (!canEditRole) return
                                    setEditRole(e.target.value)
                                  }}
                                >
                                  <option value="Premier">Premier</option>
                                  <option value="Private">Private</option>
                                  <option value="Small dealership">Small Dealer</option>
                                  <option value="Medium dealership">Medium Dealer</option>
                                  <option value="large dealership">Large Dealer</option>
                                  <option value="Fleet">Fleet</option>
                                </select>
                              </div>
                            ) : (
                              <div key={key}>
                                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                                  {String(key).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                                </label>
                                <input
                                  className={
                                    key === 'title' || (key === 'role' && !canEditRole)
                                      ? 'edc-input bg-white border border-slate-200 rounded-lg disabled:text-slate-800'
                                      : 'edc-input bg-white border border-slate-200 rounded-lg'
                                  }
                                  disabled={key === 'title' || (key === 'role' && !canEditRole)}
                                  onChange={(e) => {
                                    const next = e.target.value
                                    if (key === 'first_name') setEditFirstName(next)
                                    else if (key === 'last_name') setEditLastName(next)
                                    else if (key === 'title') return
                                    else if (key === 'role') {
                                      if (!canEditRole) return
                                      setEditRole(next)
                                    }
                                    else if (key === 'phone') setEditPhone(next)
                                    else if (key === 'mobile') setEditMobile(next)
                                    else if (key === 'email') setEditEmail(next)
                                  }}
                                  value={
                                    key === 'first_name' ? editFirstName
                                      : key === 'last_name' ? editLastName
                                      : key === 'title' ? editTitle
                                      : key === 'role' ? editRole
                                      : key === 'phone' ? editPhone
                                      : key === 'mobile' ? editMobile
                                      : key === 'email' ? editEmail
                                      : value == null ? ''
                                      : typeof value === 'boolean' ? (value ? 'True' : 'False')
                                      : String(value)
                                  }
                                />
                              </div>
                            )
                          )
                      ) : (
                        <>
                          <div>
                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Email</label>
                            <input className="edc-input bg-white border border-slate-200 rounded-lg disabled:text-slate-800" value={adminUser?.email || session?.email || ''} disabled />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Role</label>
                            <input className="edc-input bg-white border border-slate-200 rounded-lg disabled:text-slate-800" value={adminUser?.role || displayRole} disabled />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Status</label>
                            <input className="edc-input bg-white border border-slate-200 rounded-lg disabled:text-slate-800" value={adminUser ? (adminUser.is_active ? 'Active' : 'Inactive') : '—'} disabled />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Password</label>
                            <div className="relative">
                              <input type={showPassword ? 'text' : 'password'} className="edc-input bg-white border border-slate-200 rounded-lg pr-11 disabled:text-slate-800" value="" disabled />
                              <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 inline-flex items-center justify-center rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition">
                                {showPassword ? (
                                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>
                                ) : (
                                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M10.733 5.08A10.744 10.744 0 0 1 12 5c6.5 0 10 7 10 7a18.16 18.16 0 0 1-1.67 2.68" />
                                    <path d="M6.61 6.61A12.56 12.56 0 0 0 2 12s3.5 7 10 7c1.78 0 3.3-.33 4.6-.9" />
                                    <path d="M8.71 8.71A3 3 0 0 0 12 15a3 3 0 0 0 3.29-3.29" /><path d="M3 3l18 18" />
                                  </svg>
                                )}
                              </button>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                    <div className="mt-4 flex flex-col items-start">
                      <button
                        type="button"
                        onClick={() => void handleUpdateAccount()}
                        disabled={updatingAccount}
                        className="h-10 px-6 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {updatingAccount ? 'Updating…' : 'Update'}
                      </button>
                      {updateAccountSuccess ? <div className="mt-1 text-xs text-emerald-700">{updateAccountSuccess}</div> : null}
                      {updateAccountError ? <div className="mt-1 text-xs text-red-600">{updateAccountError}</div> : null}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  )
}
