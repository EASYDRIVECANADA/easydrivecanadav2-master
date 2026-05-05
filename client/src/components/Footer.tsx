 'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

export default function Footer() {
  const pathname = usePathname()
  const [userEmail, setUserEmail] = useState<string | null>(null)

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getSession()
      setUserEmail(data.session?.user?.email || null)
    }

    void init()

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user?.email || null)
    })

    return () => {
      sub.subscription.unsubscribe()
    }
  }, [])

  if (pathname.startsWith('/admin')) return null
  if (pathname.startsWith('/account')) return null
  if (userEmail) return null

  return (
    <footer className="border-t-2 border-[#118df0] bg-[#111827] text-white" role="contentinfo">
      <div className="mx-auto max-w-7xl px-4 pb-5 pt-7 sm:px-6 sm:pb-6 sm:pt-12 lg:px-8">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-3 sm:gap-12">

          {/* Company Info */}
          <div className="text-center sm:text-left">
            <div className="mb-3 flex justify-center sm:justify-start">
              <Image
                src="/images/logo.png"
                alt="Easy Drive Canada"
                width={180}
                height={48}
                className="h-9 w-auto"
              />
            </div>
            <p className="text-sm leading-relaxed text-gray-500">
              Quality pre-owned vehicles delivered to your door. Transparent pricing, flexible financing, and a 7-day money-back guarantee.
            </p>
          </div>

          {/* Navigate */}
          <div className="text-center sm:text-left">
            <h3 className="mb-3 text-[10px] font-bold uppercase tracking-widest text-gray-600">Navigate</h3>
            <ul className="flex flex-wrap justify-center gap-x-5 gap-y-2 sm:flex-col sm:flex-nowrap sm:justify-start sm:gap-x-0 sm:gap-y-2.5">
              {[
                { label: 'Shop Cars', href: '/inventory' },
                { label: 'Apply for Financing', href: '/financing' },
                { label: 'Sell Your Car', href: '/sell' },
                { label: 'Contact Us', href: '/contact' },
                { label: 'Warranty', href: '/warranty' },
              ].map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="text-sm text-gray-400 transition-colors hover:text-white">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div className="text-center sm:text-left">
            <h3 className="mb-3 text-[10px] font-bold uppercase tracking-widest text-gray-600">Contact</h3>
            <ul className="space-y-2.5 text-sm text-gray-400">
              <li className="flex items-center justify-center gap-2 sm:justify-start">
                <svg className="h-3.5 w-3.5 shrink-0 text-[#118df0]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                <a href="tel:+16137772395" className="transition-colors hover:text-white">(613) 777-2395</a>
              </li>
              <li className="flex items-center justify-center gap-2 sm:justify-start">
                <svg className="h-3.5 w-3.5 shrink-0 text-[#118df0]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <a href="mailto:info@easydrivecanada.com" className="transition-colors hover:text-white">info@easydrivecanada.com</a>
              </li>
              <li className="flex items-center justify-center gap-2 sm:items-start sm:justify-start">
                <svg className="h-3.5 w-3.5 shrink-0 text-[#118df0] sm:mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>4856 Bank St, Unit A, Ottawa ON</span>
              </li>
            </ul>
          </div>

        </div>

        <div className="mt-8 border-t border-white/[0.06] pt-5 text-center text-xs text-gray-700">
          &copy; {new Date().getFullYear()} Easy Drive Canada. All rights reserved.
        </div>
      </div>
    </footer>
  )
}
