import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Sell Your Car in Canada — Get an Online Offer',
  description:
    'Sell your car online with EasyDrive Canada. Get a fair offer, list privately, or trade in your vehicle — fast, simple, and transparent.',
  alternates: { canonical: '/sell' },
  openGraph: {
    title: 'Sell Your Car | EasyDrive Canada',
    description: 'Sell your car online in Canada. Fair offers, private listings, and trade-ins.',
    url: '/sell',
    type: 'website',
    siteName: 'EasyDrive Canada',
  },
}

export default function SellLayout({ children }: { children: ReactNode }) {
  return <>{children}</>
}
