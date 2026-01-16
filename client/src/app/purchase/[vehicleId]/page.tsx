'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import {
  PHASE3_CHANGE_EVENT,
  cancelHoldMock,
  computeRemainingSeconds,
  expireHoldIfNeeded,
  formatClock,
  getActiveHoldVehicleId,
  getVehicleHoldRecord,
  placeOnHoldMock,
  releaseHoldMock,
} from '@/lib/phase3Mock'

type Phase3State =
  | 'DEPOSIT_REQUIRED'
  | 'ON_HOLD'
  | 'CANCELLED'
  | 'AWAITING_BALANCE'

type Phase3Snapshot = {
  state: Phase3State
  vehicleId: string
  depositAmount: number
  holdExpiresAt: number | null
  timeRemainingSeconds: number | null
  transactionStatus: 'AVAILABLE' | 'ON_HOLD' | 'CANCELLED'
  remainingBalancePaymentMethods: string[]
  remainingBalanceStatus: 'PENDING'
  insuranceStatus: 'PENDING'
  message: string | null
}

const VERIFIED_KEY = 'edc_account_verified'

const PAYMENT_METHODS = ['wire transfer', 'direct deposit', 'certified cheque / bank draft']

export default function PurchaseVehiclePage() {
  const params = useParams()
  const vehicleId = String((params as any)?.vehicleId || '')

  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [verified, setVerified] = useState(false)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [snapshot, setSnapshot] = useState<Phase3Snapshot | null>(null)
  const [confirmingDeposit, setConfirmingDeposit] = useState(false)
  const [showDepositModal, setShowDepositModal] = useState(true)
  const [tick, setTick] = useState(0)

  const refreshSnapshot = () => {
    if (!vehicleId) return
    const rec = expireHoldIfNeeded(vehicleId)
    const activeHoldVehicleId = getActiveHoldVehicleId()

    const lockedByOtherVehicle = !!activeHoldVehicleId && activeHoldVehicleId !== vehicleId
    const isOnHold = rec?.status === 'ON_HOLD'
    const isCancelled = rec?.status === 'CANCELLED'

    const state: Phase3State = isOnHold ? 'ON_HOLD' : isCancelled ? 'CANCELLED' : 'DEPOSIT_REQUIRED'
    const txStatus: Phase3Snapshot['transactionStatus'] = isOnHold ? 'ON_HOLD' : isCancelled ? 'CANCELLED' : 'AVAILABLE'
    const remaining = computeRemainingSeconds(rec)

    const next: Phase3Snapshot = {
      state: isOnHold ? 'AWAITING_BALANCE' : state,
      vehicleId,
      depositAmount: rec?.depositAmount ?? 1000,
      holdExpiresAt: rec?.holdExpiresAt ?? null,
      timeRemainingSeconds: remaining,
      transactionStatus: txStatus,
      remainingBalancePaymentMethods: PAYMENT_METHODS,
      remainingBalanceStatus: 'PENDING',
      insuranceStatus: 'PENDING',
      message: lockedByOtherVehicle
        ? 'First-come, first-served: another vehicle is currently on hold. You cannot place this vehicle on hold right now.'
        : null,
    }

    setSnapshot(next)
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
  }, [])

  useEffect(() => {
    if (!loading) {
      refreshSnapshot()
      if (typeof window !== 'undefined') {
        const onChange = () => refreshSnapshot()
        window.addEventListener(PHASE3_CHANGE_EVENT, onChange)
        return () => window.removeEventListener(PHASE3_CHANGE_EVENT, onChange)
      }
    }
    return
  }, [loading, vehicleId])

  useEffect(() => {
    if (!verified) return
    if (typeof window === 'undefined') return
    const interval = window.setInterval(() => setTick((t) => t + 1), 1000)
    return () => window.clearInterval(interval)
  }, [verified])

  useEffect(() => {
    if (!verified) return
    refreshSnapshot()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick])

  const canConfirmDeposit = useMemo(() => {
    if (!verified || !vehicleId || confirmingDeposit) return false
    const activeHoldVehicleId = getActiveHoldVehicleId()
    if (activeHoldVehicleId && activeHoldVehicleId !== vehicleId) return false
    const rec = getVehicleHoldRecord(vehicleId)
    if (rec?.status === 'ON_HOLD') return false
    return true
  }, [verified, vehicleId, confirmingDeposit, tick])

  const handleConfirmDeposit = async () => {
    if (!canConfirmDeposit) return

    setError(null)
    setConfirmingDeposit(true)

    try {
      const res = placeOnHoldMock({ vehicleId, holderEmail: userEmail, depositAmount: 1000 })
      if (!res.ok) {
        if (res.reason === 'LOCKED_BY_OTHER_VEHICLE') {
          setError('Another vehicle is already on hold. First-come, first-served lock is active.')
          return
        }
        if (res.reason === 'ALREADY_ON_HOLD') {
          setShowDepositModal(false)
          return
        }
        setError('Unable to place vehicle on hold.')
        return
      }
      setShowDepositModal(false)
      refreshSnapshot()
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

  const countdown = formatClock(snapshot?.timeRemainingSeconds ?? null)

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
                <p className="mt-2 text-gray-600 max-w-2xl">Deposit-first hold workflow (mocked UI only).</p>
                <div className="mt-4 text-sm text-gray-600">
                  Vehicle ID: <span className="font-medium text-gray-900">{vehicleId}</span>
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
                    <div className="mt-1 text-xs text-gray-600">Mocked local state (n8n will replace this later).</div>
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
                    <div className="text-sm font-semibold text-gray-900">$1,000 Security Deposit Required</div>
                    <div className="mt-1 text-xs text-gray-600">First-come, first-served. Deposit must be confirmed before the hold starts.</div>

                    <div className="mt-4 flex flex-col sm:flex-row gap-3">
                      <button
                        type="button"
                        onClick={() => setShowDepositModal(true)}
                        disabled={!verified}
                        className="btn-primary text-sm px-6 py-3 disabled:opacity-50"
                      >
                        Place on Hold
                      </button>

                      <div className="text-xs text-gray-600 self-center">
                        Deposit amount: <span className="font-medium text-gray-900">$1,000</span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-gray-200/70 bg-white/60 p-4">
                    <div className="text-sm font-semibold text-gray-900">Vehicle Hold</div>
                    <div className="mt-1 text-xs text-gray-600">Starts immediately after deposit confirmation (mocked).</div>

                    <div className="mt-3 text-sm text-gray-700">
                      Status: <span className="font-medium text-gray-900">{snapshot?.transactionStatus || 'AVAILABLE'}</span>
                    </div>

                    <div className="mt-2 text-sm text-gray-700">
                      Countdown: <span className="font-medium text-gray-900">{countdown}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="glass-card rounded-2xl border border-gray-200/60 bg-white/70 p-5 md:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">Remaining Balance</div>
                    <div className="mt-1 text-xs text-gray-600">Pay within the hold window after deposit confirmation (instructions only).</div>
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
                      If the timer expires, the hold is cancelled and the deposit is refunded (mock message only).
                    </div>

                    {snapshot?.transactionStatus === 'ON_HOLD' ? (
                      <div className="mt-4 flex flex-col sm:flex-row gap-3">
                        <button
                          type="button"
                          className="btn-secondary text-sm px-6 py-3"
                          onClick={() => {
                            cancelHoldMock(vehicleId)
                            refreshSnapshot()
                          }}
                        >
                          Cancel Transaction
                        </button>

                        <button
                          type="button"
                          className="btn-outline text-sm px-6 py-3"
                          onClick={() => {
                            releaseHoldMock(vehicleId)
                            refreshSnapshot()
                          }}
                        >
                          Reset to Available
                        </button>
                      </div>
                    ) : null}

                    {snapshot?.transactionStatus === 'CANCELLED' ? (
                      <div className="mt-4 rounded-2xl border border-amber-200/60 bg-amber-50/70 p-4 text-sm text-amber-800">
                        Transaction Cancelled. Deposit refunded (mock).
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <Link href="/inventory" className="text-sm text-primary-600 hover:underline">
                  Back to Inventory
                </Link>
                <button type="button" onClick={() => refreshSnapshot()} className="text-sm text-gray-700 hover:text-primary-600 transition-colors">
                  Refresh
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showDepositModal ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setShowDepositModal(false)
          }}
        >
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
              <div className="text-lg font-semibold text-gray-900">$1,000 Security Deposit Required</div>
              <button
                type="button"
                className="w-10 h-10 rounded-xl hover:bg-gray-100 flex items-center justify-center"
                onClick={() => setShowDepositModal(false)}
                aria-label="Close"
              >
                <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-6 py-5 space-y-3">
              <div className="text-sm text-gray-700">
                First-come, first-served: the deposit must be confirmed before a vehicle can be placed on hold.
              </div>
              <div className="text-sm text-gray-700">
                Once confirmed, the vehicle will be placed on hold for <span className="font-semibold">72 hours</span>.
              </div>
              <div className="text-xs text-gray-500">This is a mocked UI step. Future n8n integration will replace this action.</div>
            </div>

            <div className="px-6 pb-6 flex items-center justify-end gap-3">
              <button
                type="button"
                className="h-10 px-4 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50"
                onClick={() => setShowDepositModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="h-10 px-4 rounded-xl bg-[#118df0] text-white text-sm font-semibold hover:bg-[#0d6ebd] disabled:opacity-50"
                onClick={() => {
                  void handleConfirmDeposit()
                }}
                disabled={!canConfirmDeposit}
              >
                {confirmingDeposit ? 'Confirming…' : 'Confirm Deposit'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

