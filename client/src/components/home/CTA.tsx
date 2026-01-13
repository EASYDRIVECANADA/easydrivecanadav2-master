import Link from 'next/link'

export default function CTA() {
  return (
    <section className="py-24 bg-secondary-900" aria-label="Call to action">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-gradient-to-br from-primary-600 to-primary-700 rounded-3xl p-8 md:p-12 text-center relative overflow-hidden">
          {/* Background Pattern */}
          <div className="absolute inset-0 opacity-10" aria-hidden="true">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full blur-3xl translate-x-1/2 -translate-y-1/2"></div>
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-white rounded-full blur-3xl -translate-x-1/2 translate-y-1/2"></div>
          </div>

          <div className="relative z-10">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4 leading-[1.1]">
              Ready to Find Your Dream Car?
            </h2>
            <p className="text-white/90 text-lg md:text-xl mb-8 max-w-2xl mx-auto">
              Join happy customers who found their perfect vehicle on EasyDrive.
              Start browsing today.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link 
                href="/inventory"
                aria-label="Browse available vehicles"
                className="w-full sm:w-auto bg-white text-primary-600 px-8 py-4 rounded-full font-semibold text-lg hover:bg-secondary-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white transition-shadow shadow-lg hover:shadow-xl inline-flex items-center justify-center gap-2"
              >
                Browse Vehicles
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </Link>
              <Link 
                href="/contact"
                aria-label="Contact us"
                className="w-full sm:w-auto bg-transparent text-white px-8 py-4 rounded-full font-semibold text-lg hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white transition-all border-2 border-white/30 hover:border-white/50 inline-flex items-center justify-center gap-2"
              >
                Contact Us
              </Link>
            </div>

            {/* Trust Badges */}
            <div className="flex flex-wrap justify-center gap-8 mt-10 pt-8 border-t border-white/20" role="list" aria-label="Trust indicators">
              <div className="flex items-center gap-2 text-white/90" role="listitem">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <span className="font-medium">150+ Point Inspection</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
