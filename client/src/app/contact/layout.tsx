import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Contact EasyDrive Canada — Used Car Sales Support',
  description:
    'Get in touch with EasyDrive Canada. Questions about a vehicle, financing, warranty, or your purchase — our team is here to help.',
  alternates: { canonical: '/contact' },
  openGraph: {
    title: 'Contact EasyDrive Canada',
    description: 'Reach out with questions about a vehicle, financing, warranty, or your purchase.',
    url: '/contact',
    type: 'website',
    siteName: 'EasyDrive Canada',
  },
}

export default function ContactLayout({ children }: { children: ReactNode }) {
  return <>{children}</>
}
