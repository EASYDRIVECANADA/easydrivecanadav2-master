'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

function getOrCreateSessionId(): string {
  if (typeof window === 'undefined') return ''
  let sid = sessionStorage.getItem('edc_sid')
  if (!sid) {
    sid = crypto.randomUUID()
    sessionStorage.setItem('edc_sid', sid)
  }
  return sid
}

export default function PageViewTracker() {
  const pathname = usePathname()

  useEffect(() => {
    // Don't track admin pages
    if (pathname.startsWith('/admin')) return

    const sessionId = getOrCreateSessionId()
    if (!sessionId) return

    fetch('/api/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, path: pathname }),
    }).catch(() => {/* silent */})
  }, [pathname])

  return null
}
