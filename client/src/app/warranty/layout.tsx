import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Used Car Warranty Plans — Coverage & Protection',
  description:
    'Protect your purchase with EasyDrive Canada warranty plans. Comprehensive used car coverage including powertrain, tire & rim, and extended protection.',
  alternates: { canonical: '/warranty' },
  openGraph: {
    title: 'Used Car Warranty Plans | EasyDrive Canada',
    description: 'Comprehensive used car warranty plans including powertrain, tire & rim, and extended coverage.',
    url: '/warranty',
    type: 'website',
    siteName: 'EasyDrive Canada',
  },
}

export default function WarrantyLayout({ children }: { children: ReactNode }) {
  return <>{children}</>
}
