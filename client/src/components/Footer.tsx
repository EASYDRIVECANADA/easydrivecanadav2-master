import Link from 'next/link'
import Image from 'next/image'

export default function Footer() {
  return (
    <footer className="bg-gradient-to-b from-slate-900 to-slate-950 text-white relative overflow-hidden" role="contentinfo">
      {/* Decorative Elements */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary-600/5 rounded-full blur-3xl" aria-hidden="true"></div>
      <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-primary-600/5 rounded-full blur-3xl" aria-hidden="true"></div>
      
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
          {/* Company Info */}
          <div className="col-span-1 md:col-span-2">
            <div className="mb-6">
              <Image
                src="/images/logo.png"
                alt="Easy Drive Canada"
                width={180}
                height={48}
                className="h-10 w-auto"
              />
            </div>
            <p className="text-slate-400 mb-6 leading-relaxed max-w-md">
              Your trusted destination for quality pre-owned vehicles. We make car buying easy with transparent pricing and flexible financing options.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-lg font-semibold mb-6">Quick Links</h3>
            <ul className="space-y-4">
              <li>
                <Link href="/inventory" className="text-slate-300 hover:text-primary-400 focus-visible:text-primary-400 transition-colors inline-flex items-center gap-2 group focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 rounded">
                  <span className="w-1.5 h-1.5 bg-primary-400 rounded-full opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity" aria-hidden="true"></span>
                  Shop Cars
                </Link>
              </li>
              <li>
                <Link href="/financing" className="text-slate-300 hover:text-primary-400 focus-visible:text-primary-400 transition-colors inline-flex items-center gap-2 group focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 rounded">
                  <span className="w-1.5 h-1.5 bg-primary-400 rounded-full opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity" aria-hidden="true"></span>
                  Apply for Financing
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-slate-300 hover:text-primary-400 focus-visible:text-primary-400 transition-colors inline-flex items-center gap-2 group focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 rounded">
                  <span className="w-1.5 h-1.5 bg-primary-400 rounded-full opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity" aria-hidden="true"></span>
                  Contact Us
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h3 className="text-lg font-semibold mb-6">Contact</h3>
            <ul className="space-y-4 text-slate-300">
              <li className="flex items-start gap-3">
                <div className="w-10 h-10 bg-primary-600/10 rounded-xl flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div>
                  <span className="text-white font-medium">Office Location</span>
                  <span className="text-primary-400 text-sm ml-1">(Appointment Only)</span>
                  <br/>4856 Bank St, Unit A<br/>Ottawa, ON K1X 1G6
                </div>
              </li>
              <li className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary-600/10 rounded-xl flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                </div>
                <a href="tel:+16137772395" className="hover:text-primary-400 focus-visible:text-primary-400 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 rounded">(613) 777-2395</a>
              </li>
              <li className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary-600/10 rounded-xl flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <a href="mailto:info@easydrivecanada.com" className="hover:text-primary-400 focus-visible:text-primary-400 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 rounded">info@easydrivecanada.com</a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-slate-800 mt-12 pt-8 text-center text-slate-500">
          <p>&copy; {new Date().getFullYear()} Easy Drive Canada. All rights reserved.</p>
        </div>
      </div>
    </footer>
  )
}
