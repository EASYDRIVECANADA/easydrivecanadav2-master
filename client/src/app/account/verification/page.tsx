'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'

type VerificationDraft = {
  fullName: string
  address: string
  licenseNumber: string
  licenseImageName?: string
  updatedAt: string
  status: 'draft' | 'ready'
}
const VERIFICATION_KEY = 'edc_customer_verification'
const VERIFIED_KEY = 'edc_account_verified'

const readDraft = (): VerificationDraft | null => {
  if (typeof window === 'undefined') return null
  const raw = window.localStorage.getItem(VERIFICATION_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as VerificationDraft
  } catch {
    return null
  }
}

const writeDraft = (draft: VerificationDraft) => {
  window.localStorage.setItem(VERIFICATION_KEY, JSON.stringify(draft))
}

const clearDraft = () => {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(VERIFICATION_KEY)
}

const setStaffAdminSession = (email: string) => {
  if (typeof window === 'undefined') return
  const session = { email: email.trim().toLowerCase(), role: 'STAFF' }
  window.localStorage.setItem('edc_admin_session', JSON.stringify(session))
  window.dispatchEvent(new Event('edc_admin_session_changed'))
}

export default function AccountVerificationPage() {
  const router = useRouter()
  const didInitRef = useRef(false)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [userName, setUserName] = useState<string | null>(null)
  const [licenseFile, setLicenseFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [readingLicense, setReadingLicense] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const N8N_SCAN_WEBHOOK_URL = process.env.NEXT_PUBLIC_N8N_SCAN_WEBHOOK_URL || 'https://primary-production-6722.up.railway.app/webhook/scan'
  const N8N_VALIDATION_WEBHOOK_URL = process.env.NEXT_PUBLIC_N8N_VALIDATION_WEBHOOK_URL || 'https://primary-production-6722.up.railway.app/webhook/validation'
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [showUploadErrorModal, setShowUploadErrorModal] = useState(false)
  const [uploadErrorMessage, setUploadErrorMessage] = useState('')
  const [validatingUpload, setValidatingUpload] = useState(false)
  const [isLicenseImageValid, setIsLicenseImageValid] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [insertingVerification, setInsertingVerification] = useState(false)
  const [insertError, setInsertError] = useState<string | null>(null)
  const [insertSuccess, setInsertSuccess] = useState(false)
  const [dragActive, setDragActive] = useState(false)

  const [fullName, setFullName] = useState('')
  const [address, setAddress] = useState('')
  const [licenseNumber, setLicenseNumber] = useState('')
  const [status, setStatus] = useState<VerificationDraft['status']>('draft')

  useEffect(() => {
    setMounted(true)
    const init = async () => {
      const { data } = await supabase.auth.getSession()
      const user = data.session?.user
      if (!user) {
        router.replace('/account')
        return
      }

      if (user.email) {
        const { data: existing, error: existingError } = await supabase
          .from('edc_account_verifications')
          .select('id')
          .eq('email', user.email)
          .limit(1)

        if (!existingError && Array.isArray(existing) && existing.length > 0) {
          if (typeof window !== 'undefined') {
            window.localStorage.setItem(VERIFIED_KEY, 'true')
          }
          setStaffAdminSession(user.email)
          router.replace('/admin')
          return
        }
      }

      if (typeof window !== 'undefined') {
        const hasHashTokens = /access_token=|refresh_token=|token_type=|expires_in=|provider_token=|issued_at=/.test(window.location.hash)
        const hasCodeParam = /[?&]code=/.test(window.location.search)
        if (hasHashTokens || hasCodeParam) {
          const nextUrl = `${window.location.origin}${window.location.pathname}`
          window.history.replaceState(null, '', nextUrl)
        }
      }

      setUserEmail(user.email || null)
      const metaName = (user.user_metadata as any)?.full_name
      setUserName(typeof metaName === 'string' ? metaName : null)

      clearDraft()
      setFullName('')
      setAddress('')
      setLicenseNumber('')
      setStatus('draft')

      didInitRef.current = true
    }

    void init()
  }, [router])

  useEffect(() => {
    if (!licenseFile) {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      setPreviewUrl(null)
      return
    }

    const url = URL.createObjectURL(licenseFile)
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(url)

    return () => {
      URL.revokeObjectURL(url)
    }
  }, [licenseFile])

  const canAutofill = useMemo(() => {
    return !!licenseFile && isLicenseImageValid
  }, [licenseFile, isLicenseImageValid])

  const parseMaybeJson = (rawText: string) => {
    if (!rawText) return null
    try {
      return JSON.parse(rawText)
    } catch {
      return rawText
    }
  }

  const extractValidationPayload = (raw: any): any | null => {
    if (!raw) return null
    if (Array.isArray(raw)) return extractValidationPayload(raw[0])
    if (typeof raw !== 'object') return raw
    if ((raw as any).json) return extractValidationPayload((raw as any).json)
    if ((raw as any).data) return extractValidationPayload((raw as any).data)
    if ((raw as any).body) {
      const body = (raw as any).body
      if (typeof body === 'string') return extractValidationPayload(parseMaybeJson(body))
      return extractValidationPayload(body)
    }
    return raw
  }

  const isValidationOk = (payload: any) => {
    if (payload == null) return false
    if (typeof payload === 'boolean') return payload
    if (typeof payload === 'string') return payload.toLowerCase() === 'true'
    if (typeof payload !== 'object') return false

    const candidates = [
      (payload as any).valid,
      (payload as any).is_valid,
      (payload as any).isValid,
      (payload as any).license_valid,
      (payload as any).licenseValid,
      (payload as any).is_driver_license,
      (payload as any).isDriverLicense,
    ]

    for (const v of candidates) {
      if (typeof v === 'boolean') return v
      if (typeof v === 'string') {
        const s = v.toLowerCase().trim()
        if (s === 'true') return true
        if (s === 'false') return false
      }
      if (typeof v === 'number') return v === 1
    }

    return false
  }

  const handleSelectedLicenseFile = (file: File | null) => {
    if (!file) {
      setLicenseFile(null)
      setIsLicenseImageValid(false)
      return
    }

    if (!file.type || !file.type.startsWith('image/')) {
      setLicenseFile(null)
      setIsLicenseImageValid(false)
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      setPreviewUrl(null)
      setUploadErrorMessage('Only driver\'s license images are allowed. Please upload an image file (JPG/PNG/WebP).')
      setShowUploadErrorModal(true)
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    setScanError(null)
    setInsertError(null)
    setInsertSuccess(false)
    setValidatingUpload(true)
    setIsLicenseImageValid(false)

    void (async () => {
      try {
        const formData = new FormData()
        formData.append('file', file)

        const res = await fetch(N8N_VALIDATION_WEBHOOK_URL, {
          method: 'POST',
          body: formData,
        })

        const rawText = await res.text().catch(() => '')
        const parsed = parseMaybeJson(rawText)

        if (!res.ok) {
          const msg = (parsed && typeof (parsed as any).error === 'string') ? (parsed as any).error : 'Failed to validate license image'
          setUploadErrorMessage(msg)
          setShowUploadErrorModal(true)
          if (fileInputRef.current) fileInputRef.current.value = ''
          return
        }

        if (parsed && typeof parsed === 'object' && (parsed as any).message === 'Workflow was started') {
          setUploadErrorMessage(
            'n8n validation responded with "Workflow was started". Configure the webhook to respond with a validation result (true/false) using a Respond to Webhook node.'
          )
          setShowUploadErrorModal(true)
          if (fileInputRef.current) fileInputRef.current.value = ''
          return
        }

        const payload = extractValidationPayload(parsed)
        const ok = isValidationOk(payload)
        if (!ok) {
          setLicenseFile(null)
          if (previewUrl) URL.revokeObjectURL(previewUrl)
          setPreviewUrl(null)
          setUploadErrorMessage('Invalid image. Please upload a clear photo of your driver\'s license.')
          setShowUploadErrorModal(true)
          if (fileInputRef.current) fileInputRef.current.value = ''
          return
        }

        setLicenseFile(file)
        setIsLicenseImageValid(true)
      } catch {
        setLicenseFile(null)
        setIsLicenseImageValid(false)
        if (previewUrl) URL.revokeObjectURL(previewUrl)
        setPreviewUrl(null)
        setUploadErrorMessage('Unable to validate this image. Please try again.')
        setShowUploadErrorModal(true)
        if (fileInputRef.current) fileInputRef.current.value = ''
      } finally {
        setValidatingUpload(false)
      }
    })()
  }

  const handleClearLicense = () => {
    setLicenseFile(null)
    setIsLicenseImageValid(false)
    setScanError(null)
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const canSaveReady = useMemo(() => {
    return fullName.trim().length >= 2 && address.trim().length >= 6 && licenseNumber.trim().length >= 4 && !!licenseFile
  }, [fullName, address, licenseNumber, licenseFile])

  const canInsertVerification = useMemo(() => {
    return (
      !!userEmail &&
      canSaveReady &&
      isLicenseImageValid &&
      !!licenseFile &&
      !readingLicense &&
      !validatingUpload &&
      !insertingVerification &&
      !insertSuccess
    )
  }, [userEmail, canSaveReady, isLicenseImageValid, licenseFile, readingLicense, validatingUpload, insertingVerification, insertSuccess])

  const fileToDataUrl = (file: File) => {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '')
      reader.onerror = () => reject(new Error('Failed to read file'))
      reader.readAsDataURL(file)
    })
  }

  const handleInsertVerification = async () => {
    if (!userEmail || !licenseFile || !isLicenseImageValid) return

    setInsertError(null)
    setInsertSuccess(false)
    setInsertingVerification(true)

    try {
      const dataUrl = await fileToDataUrl(licenseFile)
      const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl
      const licenseImagePath = `license-images/${encodeURIComponent(userEmail)}/${licenseFile.name}`

      const { error } = await supabase.from('edc_account_verifications').insert([
        {
          email: userEmail,
          full_name: fullName.trim(),
          address: address.trim(),
          license_number: licenseNumber.trim(),
          license_image_path: licenseImagePath,
          license_image_base64: base64,
          license_image_name: licenseFile.name,
          license_image_mime: licenseFile.type || null,
          is_license_image_valid: true,
          scanned_at: new Date().toISOString(),
        },
      ])

      if (error) {
        setInsertError(error.message || 'Failed to save verification')
        return
      }

      setInsertSuccess(true)
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(VERIFIED_KEY, 'true')
      }

      setStaffAdminSession(userEmail)
      router.push('/admin')
    } catch {
      setInsertError('Failed to save verification. Please try again.')
    } finally {
      setInsertingVerification(false)
    }
  }

  const extractScanPayload = (raw: any): any | null => {
    if (!raw) return null
    if (Array.isArray(raw)) return extractScanPayload(raw[0])
    if (typeof raw !== 'object') return null

    if ((raw as any).json && typeof (raw as any).json === 'object') return extractScanPayload((raw as any).json)
    if ((raw as any).data) return extractScanPayload((raw as any).data)
    if ((raw as any).body) {
      const body = (raw as any).body
      if (typeof body === 'string') {
        try {
          return extractScanPayload(JSON.parse(body))
        } catch {
          return null
        }
      }
      return extractScanPayload(body)
    }

    return raw
  }

  const toCleanString = (value: any) => {
    if (typeof value === 'string') return value
    if (typeof value === 'number') return String(value)
    return ''
  }

  const handleScanAndAutofill = async () => {
    if (!licenseFile || !isLicenseImageValid) return

    setScanError(null)
    setReadingLicense(true)

    try {
      const formData = new FormData()
      formData.append('file', licenseFile)

      const res = await fetch(N8N_SCAN_WEBHOOK_URL, {
        method: 'POST',
        body: formData,
      })

      const rawText = await res.text().catch(() => '')
      const data = (() => {
        if (!rawText) return null
        try {
          return JSON.parse(rawText)
        } catch {
          return rawText
        }
      })()
      if (!res.ok) {
        const message = (data && typeof data.error === 'string') ? data.error : 'Failed to scan license'
        setScanError(message)
        return
      }

      if (data && typeof data === 'object' && (data as any).message === 'Workflow was started') {
        setScanError(
          'n8n responded immediately with "Workflow was started". This means the webhook URL is likely the wrong one (test vs production) or the Webhook node is set to respond immediately. Use the Production webhook URL and set Webhook "Response Mode" to "Using Respond to Webhook Node" so it returns the extracted fields.'
        )
        return
      }

      const payload = extractScanPayload(data)
      if (!payload || typeof payload !== 'object') {
        setScanError('Scan service returned an unexpected response.')
        return
      }

      const nextFullName = toCleanString((payload as any).full_name || (payload as any).fullName)
      const nextAddress = toCleanString((payload as any).address)
      const nextLicenseNumber = toCleanString((payload as any).license_number || (payload as any).licenseNumber)

      if (!nextFullName && !nextAddress && !nextLicenseNumber) {
        const compact = (() => {
          try {
            return JSON.stringify(payload)
          } catch {
            return ''
          }
        })()
        setScanError(`Scan completed but returned empty fields. Webhook payload: ${compact || '[unavailable]'}`)
        setUploadErrorMessage('We could not read a driver\'s license from this image. Please upload a clear photo of your driver\'s license and try again.')
        setShowUploadErrorModal(true)
        return
      }

      if (nextFullName) setFullName(nextFullName)
      if (nextAddress) setAddress(nextAddress)
      if (nextLicenseNumber) setLicenseNumber(nextLicenseNumber)
      setStatus('draft')
    } catch {
      setScanError('Unable to reach the scan service. Please try again.')
    } finally {
      setReadingLicense(false)
    }
  }

  const handleSave = (nextStatus: VerificationDraft['status']) => {
    setStatus(nextStatus)
  }

  const handleClearFields = () => {
    setFullName('')
    setAddress('')
    setLicenseNumber('')
    setStatus('draft')
    setScanError(null)
    setInsertError(null)
    setInsertSuccess(false)
    clearDraft()
  }

  return (
    <div className="section-container py-10 md:py-14">
      <div className="max-w-5xl mx-auto">
        <div className="relative overflow-hidden rounded-3xl border border-gray-200/60 bg-white/60 shadow-soft-lg">
          <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-primary-500/10 blur-3xl" />
          <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-indigo-500/10 blur-3xl" />

          <div className="relative p-6 md:p-10">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-primary-200/60 bg-primary-50/70 px-3 py-1 text-xs font-semibold text-primary-700">
                  Account Setup
                </div>
                <h1 className="mt-3 text-3xl md:text-4xl font-bold tracking-tight text-gray-900">Account Verification</h1>
                <p className="mt-2 text-gray-600 max-w-2xl">
                  Upload a clear photo of your driver’s license. We’ll validate the image first, then you can scan to autofill your
                  details.
                </p>
                {userEmail && (
                  <div className="mt-4 text-sm text-gray-600">
                    Signed in as <span className="font-medium text-gray-900">{userEmail}</span>
                  </div>
                )}
              </div>

              <div />
            </div>

            <div className="mt-8 flex flex-col gap-6">
              <div>
                <div className="glass-card rounded-2xl border border-gray-200/60 bg-white/70 p-5 md:p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-sm font-semibold text-gray-900">BOS Fields</div>
                      <div className="mt-1 text-xs text-gray-600">Verify and edit details before continuing.</div>
                    </div>
                    {readingLicense ? <span className="badge badge-warning">Scanning…</span> : null}
                  </div>

                  <div className="mt-5 grid grid-cols-1 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="fullName">
                        Full name
                      </label>
                      <input
                        id="fullName"
                        className="input-field"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Full name from license"
                        autoComplete="name"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="address">
                        Address
                      </label>
                      <input
                        id="address"
                        className="input-field"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        placeholder="Address from license"
                        autoComplete="street-address"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="licenseNumber">
                        License number
                      </label>
                      <input
                        id="licenseNumber"
                        className="input-field"
                        value={licenseNumber}
                        onChange={(e) => setLicenseNumber(e.target.value)}
                        placeholder="License number"
                      />
                    </div>
                  </div>

                  <div className="mt-6 rounded-2xl border border-gray-200/70 bg-white/60 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="text-sm text-gray-600">You can edit any field after autofill.</div>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <button
                        type="button"
                        onClick={() => handleSave('draft')}
                        className="btn-secondary text-sm px-6 py-3"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={handleClearFields}
                        className="text-sm px-6 py-3 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 transition-colors"
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  <div className="mt-4">
                    <button
                      type="button"
                      onClick={handleInsertVerification}
                      disabled={!canInsertVerification}
                      className="w-full btn-primary text-sm px-6 py-3 disabled:opacity-50"
                    >
                      {insertingVerification ? 'Saving…' : insertSuccess ? 'Saved' : 'Continue to register your account'}
                    </button>

                    {insertError && (
                      <div className="mt-3 p-3 rounded-2xl bg-red-50 border border-red-200 text-sm text-red-700">
                        {insertError}
                      </div>
                    )}

                    {insertSuccess && (
                      <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
                        Account verification submitted successfully.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {mounted && showUploadErrorModal &&
                createPortal(
                  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
                    <div
                      className="fixed inset-0 bg-black/50 backdrop-blur-sm"
                      onClick={() => setShowUploadErrorModal(false)}
                    ></div>

                    <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md my-8 flex flex-col">
                      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
                        <h2 className="text-lg font-bold text-gray-900">Upload Error</h2>
                        <button
                          onClick={() => setShowUploadErrorModal(false)}
                          className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
                        >
                          <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>

                      <div className="p-6">
                        <div className="text-sm text-gray-700">{uploadErrorMessage}</div>
                        <div className="mt-6 flex gap-3 justify-end">
                          <button
                            type="button"
                            onClick={() => setShowUploadErrorModal(false)}
                            className="btn-primary text-sm px-5 py-2.5"
                          >
                            OK
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>,
                  document.body
                )}

              <div>
                <div className="glass-card rounded-2xl border border-gray-200/60 bg-white/70 p-5 md:p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-sm font-semibold text-gray-900">Driver’s License Image</div>
                      <div className="mt-1 text-xs text-gray-600">Image only (JPG/PNG/WebP). No screenshots, blurry, or cropped photos.</div>
                    </div>
                    {validatingUpload ? (
                      <span className="badge badge-warning">Validating…</span>
                    ) : isLicenseImageValid && licenseFile ? (
                      <span className="badge badge-success">Validated</span>
                    ) : (
                      <span className="badge badge-warning">Required</span>
                    )}
                  </div>

                  <div className="mt-4">
                    <input
                      ref={fileInputRef}
                      className="sr-only"
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleSelectedLicenseFile(e.target.files?.[0] || null)}
                    />

                    <div
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          fileInputRef.current?.click()
                        }
                      }}
                      onClick={() => fileInputRef.current?.click()}
                      onDragEnter={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setDragActive(true)
                      }}
                      onDragOver={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setDragActive(true)
                      }}
                      onDragLeave={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setDragActive(false)
                      }}
                      onDrop={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setDragActive(false)
                        const file = e.dataTransfer.files?.[0] || null
                        handleSelectedLicenseFile(file)
                      }}
                      className={
                        dragActive
                          ? 'rounded-2xl border-2 border-primary-500 bg-primary-50/60 p-4 cursor-pointer transition-colors'
                          : 'rounded-2xl border border-dashed border-gray-300 bg-white/60 p-4 cursor-pointer hover:border-primary-300 hover:bg-primary-50/40 transition-colors'
                      }
                    >
                      {previewUrl ? (
                        <div>
                          <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
                            <img src={previewUrl} alt="License preview" className="w-full object-cover" />
                          </div>
                          <div className="mt-2 text-xs text-gray-500 break-all">{licenseFile?.name}</div>
                          <div className="mt-1 text-xs text-gray-600">Click or drop to replace the image.</div>
                          <div className="mt-4 flex flex-col sm:flex-row gap-3">
                            <button
                              type="button"
                              className="btn-secondary text-sm px-5 py-2.5"
                              onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                handleClearLicense()
                                fileInputRef.current?.click()
                              }}
                            >
                              Reupload
                            </button>
                            <button
                              type="button"
                              className="text-sm px-5 py-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 transition-colors"
                              onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                handleClearLicense()
                              }}
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="p-8 text-center">
                          <div className="text-sm font-medium text-gray-900">Drag & drop your license photo here</div>
                          <div className="mt-1 text-xs text-gray-600">or click to choose a file</div>
                        </div>
                      )}
                    </div>
                  </div>

                  {scanError && (
                    <div className="mt-4 p-3 rounded-2xl bg-red-50 border border-red-200 text-sm text-red-700">
                      {scanError}
                    </div>
                  )}

                  <div className="mt-5 flex flex-col sm:flex-row gap-3">
                    <button
                      type="button"
                      onClick={handleScanAndAutofill}
                      disabled={!canAutofill || readingLicense || validatingUpload}
                      className="btn-primary text-sm px-5 py-3 disabled:opacity-50"
                    >
                      {validatingUpload ? 'Validating…' : readingLicense ? 'Processing…' : 'Scan & Autofill'}
                    </button>
                  </div>
                </div>

                <div className="mt-6 flex items-center justify-between">
                  <Link href="/account" className="text-sm text-primary-600 hover:underline">
                    Back to Account
                  </Link>
                  <button
                    type="button"
                    onClick={() => router.push('/')}
                    className="text-sm text-gray-700 hover:text-primary-600 transition-colors"
                  >
                    Continue Browsing
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
