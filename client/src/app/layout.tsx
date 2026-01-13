import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Header from '@/components/Header'
import Footer from '@/components/Footer'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Easy Drive Canada - Quality Used Cars | 100% Online Car Buying',
  description: 'Buy quality pre-owned vehicles 100% online. 150+ point inspection, transparent pricing, and home delivery across Ontario.',
  keywords: 'used cars Canada, pre-owned vehicles, online car buying, car dealership Ontario, quality used cars',
  openGraph: {
    title: 'Easy Drive Canada - Quality Used Cars',
    description: 'Buy quality pre-owned vehicles 100% online with transparent pricing and home delivery.',
    type: 'website',
    locale: 'en_CA',
  },
  icons: {
    icon: '/images/favicon.png',
    shortcut: '/images/favicon.png',
    apple: '/images/favicon.png',
  },
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
      <body className={inter.className}>
        <Header />
        <main id="main-content" className="min-h-screen">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  )
}
