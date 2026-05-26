import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Car Financing in Canada — Apply Online',
  description:
    'Get approved for used car financing in Canada. Apply online with EasyDrive Canada — flexible terms, competitive rates, and credit options for every situation.',
  alternates: { canonical: '/financing' },
  openGraph: {
    title: 'Car Financing in Canada | EasyDrive Canada',
    description: 'Apply online for used car financing in Canada. Flexible terms, competitive rates.',
    url: '/financing',
    type: 'website',
    siteName: 'EasyDrive Canada',
  },
}

export default function FinancingLayout({ children }: { children: ReactNode }) {
  return <>{children}</>
}
