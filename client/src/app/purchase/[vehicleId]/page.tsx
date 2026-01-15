'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

type Phase3State =
  | 'DEPOSIT_REQUIRED'
  | 'DEPOSIT_PENDING'
  | 'ON_HOLD'
  | 'AWAITING_BALANCE'
  | 'CANCELLED'
  | 'COMPLETED'

type Phase3Snapshot = {
  state: Phase3State
  vehicleId: string
  vehicleLabel?: string
  depositAmount?: number
  depositStatus?: string
  transactionStatus?: string
  holdExpiresAt?: string
  timeRemainingSeconds?: number
  remainingBalancePaymentMethods?: string[]
  remainingBalanceStatus?: 'PENDING' | 'CONFIRMED'
  insuranceStatus?: 'PENDING' | 'UPLOADED' | 'CONFIRMED'
  message?: string
}

const VERIFIED_KEY = 'edc_account_verified'

const parseMaybeJson = (rawText: string) => {
  if (!rawText) return null
  try {
    return JSON.parse(rawText)
  } catch {
    return rawText
  }
}

const extractPayload = (raw: any): any | null => {
  if (!raw) return null
  if (Array.isArray(raw)) return extractPayload(raw[0])
  if (typeof raw !== 'object') return raw
  if ((raw as any).json) return extractPayload((raw as any).json)
  if ((raw as any).data) return extractPayload((raw as any).data)
  if ((raw as any).body) {
    const body = (raw as any).body
    if (typeof body === 'string') return extractPayload(parseMaybeJson(body))
    return extractPayload(body)
  }
  return raw
}

const toNumber = (v: any) => {
  if (typeof v === 'number') return v
  if (typeof v === 'string') {
    const n = Number(v)
    return Number.isFinite(n) ? n : undefined
  }
  return undefined
}

const toString = (v: any) => {
  if (typeof v === 'string') return v
  if (typeof v === 'number') return String(v)
  return undefined
}

const normalizeState = (payload: any): Phase3State => {
  const direct = toString(payload?.state || payload?.phase3_state || payload?.phase3State)
  if (direct && ['DEPOSIT_REQUIRED', 'DEPOSIT_PENDING', 'ON_HOLD', 'AWAITING_BALANCE', 'CANCELLED', 'COMPLETED'].includes(direct)) {
    return direct as Phase3State
  }

  const tx = toString(payload?.transaction_status || payload?.transactionStatus)
  const dep = toString(payload?.deposit_status || payload?.depositStatus)

  if (tx === 'CANCELLED') return 'CANCELLED'
  if (tx === 'COMPLETED') return 'COMPLETED'
  if (tx === 'ON_HOLD' || tx === 'HOLD') return 'ON_HOLD'
  if (tx === 'AWAITING_BALANCE' || tx === 'PENDING_BALANCE') return 'AWAITING_BALANCE'

  if (dep === 'PENDING') return 'DEPOSIT_PENDING'
  if (dep === 'CONFIRMED' && (tx === 'ON_HOLD' || tx === 'HOLD')) return 'ON_HOLD'

  return 'DEPOSIT_REQUIRED'
}

const secondsToClock = (seconds?: number) => {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 0) return null
  const hrs = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`
}

export default function PurchaseVehiclePage() {
  const params = useParams()
  const vehicleId = String((params as any)?.vehicleId || '')

  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [verified, setVerified] = useState(false)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [snapshot, setSnapshot] = useState<Phase3Snapshot | null>(null)
  const [confirmingDeposit, setConfirmingDeposit] = useState(false)

  const pollRef = useRef<number | null>(null)

  const N8N_PHASE3_STATUS_URL =
    process.env.NEXT_PUBLIC_N8N_PHASE3_STATUS_URL || 'https://primary-production-6722.up.railway.app/webhook/phase3/status'

  const N8N_PHASE3_DEPOSIT_CONFIRM_URL =
    process.env.NEXT_PUBLIC_N8N_PHASE3_DEPOSIT_CONFIRM_URL ||
    'https://primary-production-6722.up.railway.app/webhook/phase3/deposit/confirm'

  const stopPolling = () => {
    if (pollRef.current) {
      window.clearInterval(pollRef.current)
      pollRef.current = null
    }
  }

  const fetchStatus = async () => {
    if (!vehicleId) return

    setError(null)

    const url = new URL(N8N_PHASE3_STATUS_URL)
    url.searchParams.set('vehicle_id', vehicleId)
    if (userEmail) url.searchParams.set('email', userEmail)

    const res = await fetch(url.toString(), { method: 'GET' })
    const rawText = await res.text().catch(() => '')
    const parsed = parseMaybeJson(rawText)

    if (!res.ok) {
      const msg = parsed && typeof (parsed as any).error === 'string' ? (parsed as any).error : 'Unable to load purchase status'
      setError(msg)
      return
    }

    if (parsed && typeof parsed === 'object' && (parsed as any).message === 'Workflow was started') {
      setError(
        'n8n responded with "Workflow was started". Configure the workflow to respond with the current Phase 3 status using a Respond to Webhook node.'
      )
      return
    }

    const payload = extractPayload(parsed)
    if (!payload || typeof payload !== 'object') {
      setError('Unexpected status response from workflow.')
      return
    }

    const next: Phase3Snapshot = {
      state: normalizeState(payload),
      vehicleId,
      vehicleLabel: toString(payload.vehicle_label || payload.vehicleLabel || payload.vehicle_name || payload.vehicleName),
      depositAmount: toNumber(payload.deposit_amount || payload.depositAmount) ?? 1000,
      depositStatus: toString(payload.deposit_status || payload.depositStatus),
      transactionStatus: toString(payload.transaction_status || payload.transactionStatus),
      holdExpiresAt: toString(payload.hold_expires_at || payload.holdExpiresAt),
      timeRemainingSeconds: toNumber(payload.time_remaining_seconds || payload.timeRemainingSeconds),
      remainingBalancePaymentMethods:
        Array.isArray(payload.remaining_balance_methods)
          ? payload.remaining_balance_methods
          : Array.isArray(payload.remainingBalancePaymentMethods)
            ? payload.remainingBalancePaymentMethods
            : ['wire transfer', 'direct deposit', 'certified cheque / bank draft'],
      remainingBalanceStatus: toString(payload.remaining_balance_status || payload.remainingBalanceStatus) as any,
      insuranceStatus: toString(payload.insurance_status || payload.insuranceStatus) as any,
      message: toString(payload.message || payload.status_message || payload.statusMessage),
    }

    setSnapshot(next)

    if (next.state === 'CANCELLED' || next.state === 'COMPLETED') {
      stopPolling()
    }
  }

  const startPolling = () => {
    if (pollRef.current) return
    pollRef.current = window.setInterval(() => {
      void fetchStatus()
    }, 5000)
  }

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getSession()
      const email = data.session?.user?.email || null
      setUserEmail(email)

      if (typeof window !== 'undefined') {
        setVerified(window.localStorage.getItem(VERIFIED_KEY) === 'true')
      }

      setLoading(false)
    }

    void init()

    return () => {
      stopPolling()
    }
  }, [])

  useEffect(() => {
    if (!loading && verified) {
      void fetchStatus().finally(() => {
        startPolling()
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, verified, userEmail, vehicleId])

  const canConfirmDeposit = useMemo(() => {
    return verified && !!vehicleId && !confirmingDeposit
  }, [verified, vehicleId, confirmingDeposit])

  const handleConfirmDeposit = async () => {
    if (!canConfirmDeposit) return

    setError(null)
    setConfirmingDeposit(true)

    try {
      const res = await fetch(N8N_PHASE3_DEPOSIT_CONFIRM_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicle_id: vehicleId,
          email: userEmail,
        }),
      })

      const rawText = await res.text().catch(() => '')
      const parsed = parseMaybeJson(rawText)

      if (!res.ok) {
        const msg = parsed && typeof (parsed as any).error === 'string' ? (parsed as any).error : 'Unable to confirm deposit'
        setError(msg)
        return
      }

      if (parsed && typeof parsed === 'object' && (parsed as any).message === 'Workflow was started') {
        setError(
          'n8n responded with "Workflow was started". Configure the workflow to respond with the updated Phase 3 status using a Respond to Webhook node.'
        )
        return
      }

      const payload = extractPayload(parsed)
      if (payload && typeof payload === 'object') {
        setSnapshot((prev) => {
          const nextState = normalizeState(payload)
          return {
            ...(prev || { state: 'DEPOSIT_PENDING', vehicleId }),
            state: nextState,
            depositStatus: toString(payload.deposit_status || payload.depositStatus) ?? prev?.depositStatus,
            transactionStatus: toString(payload.transaction_status || payload.transactionStatus) ?? prev?.transactionStatus,
            holdExpiresAt: toString(payload.hold_expires_at || payload.holdExpiresAt) ?? prev?.holdExpiresAt,
            timeRemainingSeconds: toNumber(payload.time_remaining_seconds || payload.timeRemainingSeconds) ?? prev?.timeRemainingSeconds,
            message: toString(payload.message || payload.status_message || payload.statusMessage) ?? prev?.message,
          }
        })
      } else {
        setSnapshot((prev) => ({ ...(prev || { state: 'DEPOSIT_PENDING', vehicleId }), state: 'DEPOSIT_PENDING' }))
      }

      startPolling()
      void fetchStatus()
    } catch {
      setError('Unable to reach the deposit confirmation workflow. Please try again.')
    } finally {
      setConfirmingDeposit(false)
    }
  }

  if (loading) {
    return (
      <div className="section-container py-10 md:py-14">
        <div className="max-w-5xl mx-auto">
          <div className="glass-card rounded-2xl p-8">Loading…</div>
        </div>
      </div>
    )
  }

  if (!verified) {
    return (
      <div className="section-container py-10 md:py-14">
        <div className="max-w-5xl mx-auto">
          <div className="glass-card rounded-2xl p-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200/60 bg-emerald-50/70 px-3 py-1 text-xs font-semibold text-emerald-700">
              Account Required
            </div>
            <h1 className="mt-4 text-2xl font-bold text-gray-900">Complete verification to continue</h1>
            <p className="mt-2 text-gray-600">You must verify your account before starting the deposit workflow.</p>
            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <Link href="/account/verification" className="btn-primary px-6 py-3 text-sm text-center">
                Go to Verification
              </Link>
              <Link href={`/inventory/${vehicleId}`} className="btn-secondary px-6 py-3 text-sm text-center">
                Back to Vehicle
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const countdown = secondsToClock(snapshot?.timeRemainingSeconds)

  return (
    <div className="section-container py-10 md:py-14">
      <div className="max-w-5xl mx-auto">
        <div className="relative overflow-hidden rounded-3xl border border-gray-200/60 bg-white/60 shadow-soft-lg">
          <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-primary-500/10 blur-3xl" />
          <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-indigo-500/10 blur-3xl" />

          <div className="relative p-6 md:p-10">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200/60 bg-emerald-50/70 px-3 py-1 text-xs font-semibold text-emerald-700">
                  Account Verified
                </div>
                <h1 className="mt-3 text-3xl md:text-4xl font-bold tracking-tight text-gray-900">Secure Your Vehicle</h1>
                <p className="mt-2 text-gray-600 max-w-2xl">
                  Phase 3 is managed by automated workflows. Your deposit and transaction status will update automatically.
                </p>
                <div className="mt-4 text-sm text-gray-600">
                  Vehicle ID: <span className="font-medium text-gray-900">{vehicleId}</span>
                  {snapshot?.vehicleLabel ? (
                    <span className="ml-2 text-gray-500">({snapshot.vehicleLabel})</span>
                  ) : null}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2">
                <Link href={`/inventory/${vehicleId}`} className="text-sm text-primary-600 hover:underline">
                  Back to Vehicle
                </Link>
              </div>
            </div>

            {error ? (
              <div className="mt-6 p-4 rounded-2xl bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>
            ) : null}

            <div className="mt-8 flex flex-col gap-6">
              <div className="glass-card rounded-2xl border border-gray-200/60 bg-white/70 p-5 md:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">Phase 3 Status</div>
                    <div className="mt-1 text-xs text-gray-600">State reported by n8n workflows.</div>
                  </div>
                  <span className="badge badge-warning">{snapshot?.state || 'DEPOSIT_REQUIRED'}</span>
                </div>

                {snapshot?.message ? (
                  <div className="mt-4 rounded-2xl border border-gray-200/70 bg-white/60 p-4 text-sm text-gray-700">
                    {snapshot.message}
                  </div>
                ) : null}

                <div className="mt-5 grid grid-cols-1 gap-4">
                  <div className="rounded-2xl border border-gray-200/70 bg-white/60 p-4">
                    <div className="text-sm font-semibold text-gray-900">$1,000 Security Deposit</div>
                    <div className="mt-1 text-xs text-gray-600">Required before the vehicle can be placed on hold.</div>

                    <div className="mt-4 flex flex-col sm:flex-row gap-3">
                      <button
                        type="button"
                        onClick={handleConfirmDeposit}
                        disabled={!canConfirmDeposit}
                        className="btn-primary text-sm px-6 py-3 disabled:opacity-50"
                      >
                        {confirmingDeposit ? 'Confirming…' : 'Confirm Deposit'}
                      </button>

                      <div className="text-xs text-gray-600 self-center">
                        Deposit status: <span className="font-medium text-gray-900">{snapshot?.depositStatus || 'UNKNOWN'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-gray-200/70 bg-white/60 p-4">
                    <div className="text-sm font-semibold text-gray-900">Vehicle Hold</div>
                    <div className="mt-1 text-xs text-gray-600">Only applies after deposit is confirmed by workflow.</div>

                    <div className="mt-3 text-sm text-gray-700">
                      Status:{' '}
                      <span className="font-medium text-gray-900">{snapshot?.transactionStatus || 'UNKNOWN'}</span>
                    </div>

                    <div className="mt-2 text-sm text-gray-700">
                      Countdown:{' '}
                      <span className="font-medium text-gray-900">{countdown || '—'}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="glass-card rounded-2xl border border-gray-200/60 bg-white/70 p-5 md:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">Remaining Balance</div>
                    <div className="mt-1 text-xs text-gray-600">Pay within the allowed window after deposit confirmation.</div>
                  </div>
                  {snapshot?.state === 'CANCELLED' ? <span className="badge badge-warning">Cancelled</span> : null}
                </div>

                <div className="mt-5 grid grid-cols-1 gap-4">
                  <div className="rounded-2xl border border-gray-200/70 bg-white/60 p-4">
                    <div className="text-sm font-semibold text-gray-900">Accepted Methods</div>
                    <div className="mt-2 text-sm text-gray-700">
                      {(snapshot?.remainingBalancePaymentMethods || []).map((m) => (
                        <div key={m}>{m}</div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-gray-200/70 bg-white/60 p-4">
                    <div className="text-sm font-semibold text-gray-900">Insurance Requirement</div>
                    <div className="mt-2 text-sm text-gray-700">
                      Status:{' '}
                      <span className="font-medium text-gray-900">{snapshot?.insuranceStatus || 'PENDING'}</span>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-gray-200/70 bg-white/60 p-4">
                    <div className="text-sm font-semibold text-gray-900">Cancellation</div>
                    <div className="mt-2 text-sm text-gray-700">
                      This transaction will be cancelled automatically if the workflow signals a timeout or failure.
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <Link href="/inventory" className="text-sm text-primary-600 hover:underline">
                  Back to Inventory
                </Link>
                <button type="button" onClick={() => void fetchStatus()} className="text-sm text-gray-700 hover:text-primary-600 transition-colors">
                  Refresh Status
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
