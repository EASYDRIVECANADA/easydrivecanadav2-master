import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Sell Cars Online — Dealer Platform for Canadian Dealerships',
  description:
    'Join EasyDrive Canada as a dealer. Reach Canadian buyers, manage inventory, process finance applications, and grow your dealership online.',
  alternates: { canonical: '/dealers' },
  openGraph: {
    title: 'Dealer Platform | EasyDrive Canada',
    description: 'Sell cars online in Canada. Reach buyers, manage inventory, and grow your dealership.',
    url: '/dealers',
    type: 'website',
    siteName: 'EasyDrive Canada',
  },
}

export default function DealersLayout({ children }: { children: ReactNode }) {
  return <>{children}</>
}
