import Link from 'next/link'

export default function CTA() {
  return (
    <section className="py-20 bg-secondary-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-gradient-to-br from-primary-500 to-primary-700 rounded-3xl p-8 md:p-12 text-center relative overflow-hidden">
          {/* Background Pattern */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full blur-3xl translate-x-1/2 -translate-y-1/2"></div>
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-white rounded-full blur-3xl -translate-x-1/2 translate-y-1/2"></div>
          </div>

          <div className="relative z-10">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4">
              Ready to Find Your Dream Car?
            </h2>
            <p className="text-primary-100 text-lg md:text-xl mb-8 max-w-2xl mx-auto">
              Join thousands of happy customers who found their perfect vehicle 
              on EasyDrive. Start browsing today.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link 
                href="/inventory" 
                className="bg-white text-primary-600 px-8 py-4 rounded-full font-semibold text-lg hover:bg-secondary-50 transition-all shadow-lg hover:shadow-xl hover:scale-105 inline-flex items-center justify-center gap-2"
              >
                Browse Vehicles
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </Link>
              <Link 
                href="/sell" 
                className="bg-transparent text-white px-8 py-4 rounded-full font-semibold text-lg hover:bg-white/10 transition-all border-2 border-white/30 inline-flex items-center justify-center gap-2"
              >
                Sell Your Car
              </Link>
            </div>

            {/* Trust Badges */}
            <div className="flex flex-wrap justify-center gap-8 mt-10 pt-8 border-t border-white/20">
              <div className="flex items-center gap-2 text-primary-100">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                <span className="font-medium">4.9/5 Rating</span>
              </div>
              <div className="flex items-center gap-2 text-primary-100">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <span className="font-medium">150+ Point Inspection</span>
              </div>
              <div className="flex items-center gap-2 text-primary-100">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span className="font-medium">10-Day Returns</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
