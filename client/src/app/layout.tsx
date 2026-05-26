import type { Metadata, Viewport } from 'next'
import { Plus_Jakarta_Sans } from 'next/font/google'
import './globals.css'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import PageViewTracker from '@/components/PageViewTracker'
import { buildOrganizationJsonLd, buildWebSiteJsonLd } from '@/lib/seo/json-ld'

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-jakarta',
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL('https://easydrivecanada.com'),
  title: {
    default: 'Easy Drive Canada - Quality Used Cars | 100% Online Car Buying',
    template: '%s | EasyDrive Canada',
  },
  description: 'Buy quality pre-owned vehicles 100% online. 150+ point inspection, transparent pricing, and home delivery across Ontario.',
  keywords: 'used cars Canada, pre-owned vehicles, online car buying, car dealership Ontario, quality used cars',
  alternates: {
    canonical: '/',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  formatDetection: {
    telephone: false,
    email: false,
    address: false,
  },
  openGraph: {
    title: 'Easy Drive Canada - Quality Used Cars',
    description: 'Buy quality pre-owned vehicles 100% online with transparent pricing and home delivery.',
    type: 'website',
    locale: 'en_CA',
    siteName: 'EasyDrive Canada',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Easy Drive Canada - Quality Used Cars',
    description: 'Buy quality pre-owned vehicles 100% online with transparent pricing and home delivery.',
  },
  icons: {
    icon: '/images/favicon.png',
    shortcut: '/images/favicon.png',
    apple: '/images/favicon.png',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/images/favicon.png" />
      </head>
      <body className={`${jakarta.variable} ${jakarta.className} min-h-screen flex flex-col`}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(buildOrganizationJsonLd()) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(buildWebSiteJsonLd()) }}
        />
        <PageViewTracker />
        <Header />
        <main id="main-content" className="flex-1 flex flex-col">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  )
}
