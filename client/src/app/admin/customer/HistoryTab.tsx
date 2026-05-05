'use client'

import { useEffect, useState } from 'react'

import { supabase } from '@/lib/supabaseClient'

interface HistoryEntry {
  id: string
  created_at: string
  type: 'customer' | 'credit'
  notes?: string
  user_id: string
}

interface HistoryTabProps {
  customerId: string
}

export default function HistoryTab({ customerId }: HistoryTabProps) {
  const [entries, setEntries] = useState<HistoryEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchHistory = async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from('edc_history')
        .select('*')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false })

      if (!error && data) {
        setEntries(data as HistoryEntry[])
      }
      setLoading(false)
    }

    if (customerId) {
      fetchHistory()
    }
  }, [customerId, supabase])

  if (loading) {
    return (
      <div className="px-6 py-5">
        <div className="text-sm text-gray-500">Loading history...</div>
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <div className="px-6 py-5">
        <div className="text-sm text-gray-500 italic">No history records found.</div>
      </div>
    )
  }

  return (
    <div className="px-6 py-5">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">History</h3>
      <div className="space-y-3">
        {entries.map((entry) => (
          <div key={entry.id} className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700 capitalize">{entry.type}</span>
              <span className="text-xs text-gray-500">
                {new Date(entry.created_at).toLocaleString()}
              </span>
            </div>
            {entry.notes && (
              <div className="text-sm text-gray-600">{entry.notes}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
