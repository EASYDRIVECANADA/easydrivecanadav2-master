import { Suspense } from 'react'
import BookingClient from './BookingClient'

export const dynamic = 'force-dynamic'

export default function TestDriveBookingPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-slate-50" />}>
      <BookingClient />
    </Suspense>
  )
}
