export default function Benefits() {
  const benefits = [
    {
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      ),
      title: '150+ Point Inspection',
      description: 'Certified mechanics check every component'
    },
    {
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
        </svg>
      ),
      title: 'Free Delivery',
      description: 'Right to your door, anywhere in Ontario'
    },
    {
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ),
      title: '3-Month Warranty',
      description: 'Comprehensive coverage included'
    },
    {
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      title: 'CARFAX Included',
      description: 'Full vehicle history with every listing'
    },
  ]

  const savings = [
    { icon: '✕', label: 'No dealer admin fees', amount: 'Save $999' },
    { icon: '✕', label: 'No documentation fees', amount: 'Save $999' },
    { icon: '✕', label: 'Free delivery included', amount: 'Save $299' },
    { icon: '✕', label: 'Below market pricing', amount: 'Save $1,000+' },
  ]

  return (
    <section className="py-20 lg:py-28 bg-primary-600" aria-label="Benefits and savings">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left Content */}
          <div className="text-white">
            <span className="inline-flex items-center gap-1.5 text-primary-200 font-semibold text-sm uppercase tracking-wider">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              The EasyDrive Promise
            </span>
            <h2 className="text-3xl md:text-4xl font-bold mt-3 mb-6 leading-tight">
              Peace of Mind, Guaranteed
            </h2>
            <p className="text-primary-100 text-lg mb-10 leading-relaxed max-w-lg">
              Every vehicle on EasyDrive is backed by our comprehensive guarantee. 
              We stand behind every car we sell because we&apos;ve already put it through 
              our rigorous 150+ point inspection.
            </p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {benefits.map((benefit, index) => (
                <div key={index} className="flex items-start gap-3.5 group">
                  <div className="w-11 h-11 bg-white/15 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-white/25 transition-colors">
                    {benefit.icon}
                  </div>
                  <div>
                    <h4 className="font-semibold mb-0.5">{benefit.title}</h4>
                    <p className="text-primary-200 text-sm leading-relaxed">{benefit.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right — Savings Card */}
          <div className="bg-white rounded-3xl p-8 lg:p-10 shadow-2xl">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-50 rounded-2xl mb-4">
                <svg className="w-8 h-8 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-secondary-900">Save More With Us</h3>
              <p className="text-secondary-500 mt-1.5 text-[15px]">Compared to traditional dealerships</p>
            </div>

            <div className="space-y-0">
              {savings.map((item, index) => (
                <div key={index} className="flex items-center justify-between py-4 border-b border-secondary-100 last:border-b-0 group">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-accent-green/10 rounded-lg flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-accent-green" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span className="text-secondary-700 font-medium text-[15px]">{item.label}</span>
                  </div>
                  <span className="font-bold text-accent-green text-[15px]">{item.amount}</span>
                </div>
              ))}
            </div>

            <div className="mt-6 pt-6 border-t-2 border-secondary-100">
              <div className="flex justify-between items-center">
                <span className="text-lg font-bold text-secondary-900">Total Average Savings</span>
                <span className="text-3xl font-extrabold text-primary-600">$3,297+</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
