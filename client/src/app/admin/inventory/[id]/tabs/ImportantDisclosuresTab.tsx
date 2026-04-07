'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

interface ImportantDisclosuresTabProps {
  vehicleId: string
}

type ImportantDisclosureRow = {
  id: string
  user_id: string | null
  vehicleId: string | null
  disclosures: string | null
  categories: string | null
}

type AdminSession = {
  user_id?: string
  role?: string
}

const getRoleKey = (role: string | null | undefined): 'premier' | 'private' | 'fleet' | 'dealership' => {
  const raw = String(role || '').toLowerCase()
  if (raw.includes('private')) return 'private'
  if (raw.includes('fleet')) return 'fleet'
  if (raw.includes('dealer')) return 'dealership'
  return 'premier'
}

const getDefaultDisclosureText = (role: string | null | undefined) => {
  const key = getRoleKey(role)
  if (key === 'private') {
    return `This vehicle is offered by EasyDrive Canada (EDC) as an EDC Private vehicle.

1. Private Sale Disclosure
- This vehicle is listed as a private sale facilitated through EasyDrive Canada.
- The vehicle is sold as-is unless otherwise stated in writing.

2. Inspection & Test Drive
- Viewing and test drives may be available subject to seller availability.
- Buyers are encouraged to arrange an independent pre-purchase inspection.

3. Safety & Reconditioning
- Safety certification is not included in the listed price unless explicitly noted.
- Safety may be added through EasyDrive Canada starting at $999, which includes the Ontario Safety Standards Certificate.
- Where permitted by law, the vehicle may also be purchased without safety.

4. Fees & Licensing (Mandatory)
- All transactions are subject to the mandatory OMVIC fee of $22 + HST per transaction, shown separately on the Bill of Sale.
- A licensing fee of $59 applies to every transaction and will be shown separately on the Bill of Sale.

5. CARFAX Disclosure
- A CARFAX report will be provided to the client prior to completion of the sale.

No other promises, representations, or guarantees have been made, written or verbal, other than what is disclosed above and on the Bill of Sale.`
  }

  if (key === 'fleet') {
    return `This vehicle is offered by EasyDrive Canada (EDC) as an EDC Fleet Select vehicle.

1. Fleet Disclosure
- This vehicle was previously registered as a fleet vehicle.

2. Purchase Process – EDC Fleet Select
- No test drives are available.
- No appointments or viewings are available.
- This vehicle is offered under a streamlined, wholesale-style purchase option, reflected in its pricing.

3. Safety & Reconditioning
- Safety and reconditioning are not included in the listed price.
- Safety and reconditioning may be added through EasyDrive Canada starting at $999.
- Where permitted by law, the vehicle may also be purchased without safety.

4. Fees & Licensing
- All transactions are subject to the mandatory OMVIC fee of $22 + HST per transaction.
- A licensing fee of $59 applies to every transaction.

5. CARFAX Disclosure
- A CARFAX report will be provided to the client prior to completion of the sale.

No other promises, representations, or guarantees have been made, written or verbal, other than what is disclosed above and on the Bill of Sale.`
  }

  if (key === 'dealership') {
    return `This vehicle is offered by EasyDrive Canada (EDC) as an EDC Dealership vehicle.

1. Dealership Disclosure
- This vehicle is listed through an authorized dealership partner of EasyDrive Canada.
- All representations about this vehicle are made by the dealership.

2. Viewing & Test Drive
- Viewing and test drives are available through the dealership by appointment.

3. Safety & Reconditioning
- Safety certification status is determined by the dealership — please confirm prior to purchase.

4. Fees & Licensing (Mandatory)
- All transactions are subject to the mandatory OMVIC fee of $22 + HST per transaction.
- A licensing fee of $59 applies to every transaction.

5. CARFAX Disclosure
- A CARFAX report will be provided to the client prior to completion of the sale.

No other promises, representations, or guarantees have been made, written or verbal, other than what is disclosed above and on the Bill of Sale.`
  }

  return `This vehicle is offered by EasyDrive Canada (EDC) as an EDC Premier vehicle.

1. Vehicle Status – EDC Premier
- This vehicle is owned and stocked by EasyDrive Canada.
- Viewing and test drives are available by appointment.

2. Safety & Reconditioning
- This vehicle will be sold with a valid Ontario Safety Standards Certificate prior to delivery.
- Any required safety or reconditioning work has been completed or will be completed before delivery.

3. Fees & Licensing (Mandatory)
- All transactions are subject to the mandatory OMVIC fee of $22 + HST per transaction, shown separately on the Bill of Sale.
- A licensing fee of $59 applies to every transaction and will be shown separately on the Bill of Sale.

4. CARFAX Disclosure
- A CARFAX report will be provided to the client prior to completion of the sale.

No other promises, representations, or guarantees have been made, written or verbal, other than what is disclosed above and on the Bill of Sale.`
}

const ImportantDisclosuresTab = ({ vehicleId }: ImportantDisclosuresTabProps) => {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [existingId, setExistingId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError(null)
      setSuccess(null)
      try {
        const id = String(vehicleId || '').trim()
        if (!id) {
          setError('Missing vehicle id – please save vehicle first.')
          return
        }
        let sessionRole: string | null = null
        if (typeof window !== 'undefined') {
          try {
            const raw = window.localStorage.getItem('edc_admin_session')
            if (raw) {
              const parsed = JSON.parse(raw) as AdminSession
              sessionRole = String(parsed?.role || '').trim() || null
            }
          } catch {
            // ignore invalid session payload
          }
        }

        const { data, error } = await supabase
          .from('ImportantDisclosures')
          .select('id, user_id, vehicleId, disclosures, categories')
          .eq('vehicleId', id)
          .maybeSingle()

        if (error && error.code !== 'PGRST116') {
          throw error
        }

        if (!cancelled && data) {
          const row = data as unknown as ImportantDisclosureRow
          setExistingId(String(row.id))
          const current = String(row.disclosures || '').trim()
          const roleForDefault = String(row.categories || '').trim() || sessionRole
          setText(current || getDefaultDisclosureText(roleForDefault))
        } else if (!cancelled) {
          setText(getDefaultDisclosureText(sessionRole))
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message || 'Failed to load important disclosures.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [vehicleId])

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const id = String(vehicleId || '').trim()
      if (!id) {
        setError('Missing vehicle id – please save vehicle first.')
        return
      }

      let currentUserId: string | null = null
      let currentUserRole: string | null = null
      if (typeof window !== 'undefined') {
        try {
          const raw = window.localStorage.getItem('edc_admin_session')
          if (raw) {
            const parsed = JSON.parse(raw) as AdminSession
            const uid = String(parsed?.user_id || '').trim()
            const role = String(parsed?.role || '').trim()
            currentUserId = uid || null
            currentUserRole = role || null
          }
        } catch {
          // ignore invalid session payload
        }
      }

      const payload = {
        user_id: currentUserId,
        vehicleId: id,
        disclosures: text || null,
        categories: currentUserRole,
      }

      if (existingId) {
        const { error } = await supabase
          .from('ImportantDisclosures')
          .update(payload)
          .eq('id', existingId)

        if (error) throw error
        setSuccess('Important disclosure updated.')
      } else {
        const { data, error } = await supabase
          .from('ImportantDisclosures')
          .insert(payload)
          .select('id')
          .maybeSingle()

        if (error) throw error
        if (data?.id) setExistingId(String(data.id))
        setSuccess('Important disclosure saved.')
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to save important disclosure.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white rounded-xl shadow p-6 space-y-4">
      <div>
        <h2 className="text-base font-semibold text-gray-900">Important Disclosures</h2>
        <p className="mt-1 text-sm text-gray-600">
          This text overrides the default Important Disclosure shown on the public marketplace for this specific
          vehicle. If left empty, the system will continue using the default disclosure.
        </p>
      </div>

      {loading ? (
        <div className="text-sm text-gray-500">Loading…</div>
      ) : (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Disclosure text</label>
            <textarea
              rows={14}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Enter the Important Disclosure text that should appear for this vehicle…"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#118df0] focus:border-transparent resize-vertical"
            />
            <p className="mt-1 text-xs text-gray-500">
              Supports plain text. Line breaks will be preserved on the marketplace disclosure modal.
            </p>
          </div>

          {(error || success) && (
            <div
              className={`rounded-md px-3 py-2 text-sm ${
                error ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'
              }`}
            >
              {error || success}
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center justify-center rounded-md bg-[#118df0] px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#0d6ebd] disabled:opacity-50"
            >
              {saving ? 'Saving…' : existingId ? 'Update Disclosure' : 'Save Disclosure'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

export default ImportantDisclosuresTab

