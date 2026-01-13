'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
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

export default function AccountVerificationPage() {
  const router = useRouter()
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [userName, setUserName] = useState<string | null>(null)
  const [licenseFile, setLicenseFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [readingLicense, setReadingLicense] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const N8N_SCAN_WEBHOOK_URL = process.env.NEXT_PUBLIC_N8N_SCAN_WEBHOOK_URL || 'https://primary-production-6722.up.railway.app/webhook/scan'
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [showUploadErrorModal, setShowUploadErrorModal] = useState(false)
  const [uploadErrorMessage, setUploadErrorMessage] = useState('')
  const [validatingUpload, setValidatingUpload] = useState(false)
  const [isLicenseImageValid, setIsLicenseImageValid] = useState(false)

  const [fullName, setFullName] = useState('')
  const [address, setAddress] = useState('')
  const [licenseNumber, setLicenseNumber] = useState('')
  const [status, setStatus] = useState<VerificationDraft['status']>('draft')

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getSession()
      const user = data.session?.user
      if (!user) {
        router.replace('/account')
        return
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

      const existing = readDraft()
      if (existing) {
        setFullName(existing.fullName)
        setAddress(existing.address)
        setLicenseNumber(existing.licenseNumber)
        setStatus(existing.status)
      } else {
        setFullName(typeof metaName === 'string' ? metaName : '')
      }
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

  const validateLooksLikeDriversLicense = async (file: File) => {
    const { recognize } = await import('tesseract.js')
    const result = await recognize(file, 'eng')
    const text = (result?.data?.text || '').toLowerCase()

    const keywords = [
      'driver',
      'licence',
      'license',
      'class',
      'address',
      'dob',
      'birth',
      'expires',
      'expiry',
      'exp',
      'issued',
      'iss',
    ]

    const keywordHits = keywords.reduce((acc, k) => acc + (text.includes(k) ? 1 : 0), 0)
    const hasLikelyLicenseNumber = /\b[a-z0-9]{6,14}\b/i.test(text)

    return keywordHits >= 2 || (keywordHits >= 1 && hasLikelyLicenseNumber)
  }

  const canSaveReady = useMemo(() => {
    return fullName.trim().length >= 2 && address.trim().length >= 6 && licenseNumber.trim().length >= 4 && !!licenseFile
  }, [fullName, address, licenseNumber, licenseFile])

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
    const draft: VerificationDraft = {
      fullName: fullName.trim(),
      address: address.trim(),
      licenseNumber: licenseNumber.trim(),
      licenseImageName: licenseFile?.name,
      updatedAt: new Date().toISOString(),
      status: nextStatus,
    }

    writeDraft(draft)
    setStatus(nextStatus)
  }

  return (
    <div className="section-container py-12">
      <div className="max-w-3xl mx-auto">
        <div className="glass-card rounded-2xl p-8 shadow-soft-lg">
          <div className="flex items-start justify-between gap-6">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold">Account Verification</h1>
              <p className="mt-2 text-gray-600">
                Upload your driver’s license. Click Scan & Autofill to process the image and populate your details. You can
                edit the fields before continuing.
              </p>
              {userEmail && (
                <div className="mt-3 text-sm text-gray-600">
                  Signed in as <span className="font-medium text-gray-900">{userEmail}</span>
                </div>
              )}
            </div>

            <span className={status === 'ready' ? 'badge badge-success' : 'badge badge-warning'}>
              {status === 'ready' ? 'Ready' : 'Draft'}
            </span>
          </div>

          <div className="mt-8 grid grid-cols-1 lg:grid-cols-5 gap-6">
            <div className="lg:col-span-2">
              <div className="rounded-2xl border border-gray-200/60 bg-white/70 p-5">
                <div className="text-sm font-semibold text-gray-900">Driver’s License</div>
                <div className="mt-3">
                  <input
                    ref={fileInputRef}
                    className="block w-full text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-primary-600 file:text-white hover:file:bg-primary-700"
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null
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
                      setValidatingUpload(true)
                      setIsLicenseImageValid(false)

                      void (async () => {
                        try {
                          const ok = await validateLooksLikeDriversLicense(file)
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
                          setUploadErrorMessage('Unable to validate this image. Please try another driver\'s license photo.')
                          setShowUploadErrorModal(true)
                          if (fileInputRef.current) fileInputRef.current.value = ''
                        } finally {
                          setValidatingUpload(false)
                        }
                      })()
                    }}
                  />
                </div>

                {previewUrl ? (
                  <div className="mt-4">
                    <img src={previewUrl} alt="License preview" className="w-full rounded-xl border border-gray-200" />
                    <div className="mt-2 text-xs text-gray-500">{licenseFile?.name}</div>
                  </div>
                ) : (
                  <div className="mt-4 rounded-xl border border-dashed border-gray-300 bg-white/60 p-6 text-center text-sm text-gray-600">
                    Upload an image to preview it here.
                  </div>
                )}

                {scanError && (
                  <div className="mt-4 p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
                    {scanError}
                  </div>
                )}

                <div className="mt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={handleScanAndAutofill}
                    disabled={!canAutofill || readingLicense || validatingUpload}
                    className="btn-secondary text-sm px-4 py-2.5 disabled:opacity-50"
                  >
                    {validatingUpload ? 'Validating…' : readingLicense ? 'Processing…' : 'Scan & Autofill'}
                  </button>

                </div>
              </div>
            </div>

            {showUploadErrorModal && (
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
              </div>
            )}

            <div className="lg:col-span-3">
              <div className="rounded-2xl border border-gray-200/60 bg-white/70 p-5">
                <div className="text-sm font-semibold text-gray-900">BOS Fields</div>
                <div className="mt-4 grid grid-cols-1 gap-4">
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

                <div className="mt-6 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
                  <div className="text-sm text-gray-600">
                    You can edit any field after autofill.
                  </div>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => handleSave('draft')}
                      className="btn-secondary text-sm px-5 py-2.5"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      disabled={!canSaveReady}
                      onClick={() => handleSave('ready')}
                      className="btn-primary text-sm px-5 py-2.5 disabled:opacity-50"
                    >
                      Mark as Ready
                    </button>
                  </div>
                </div>

                {status === 'ready' && (
                  <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
                    Verification details saved locally. Backend + real OCR will be added next.
                  </div>
                )}
              </div>

              <div className="mt-6 flex items-center justify-between">
                <Link href="/account" className="text-sm text-primary-600 hover:underline">
                  Back to Account
                </Link>
                <button type="button" onClick={() => router.push('/')} className="text-sm text-gray-700 hover:text-primary-600 transition-colors">
                  Continue Browsing
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
