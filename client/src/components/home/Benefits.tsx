

export default function Benefits() {
  const benefits = [
    {
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      ),
      title: '30-Day Warranty',
      description: 'Every vehicle comes with comprehensive coverage'
    },
    {
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
        </svg>
      ),
      title: 'Free Delivery',
      description: 'Right to your door, anywhere in Ontario'
    },

  ]

  return (
    <section className="py-24 bg-primary-600">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left Content */}
          <div className="text-white">
            <span className="text-primary-200 font-semibold text-sm uppercase tracking-wider">The EasyDrive Promise</span>
            <h2 className="text-3xl md:text-4xl font-bold mt-2 mb-6">
              Peace of Mind, Guaranteed
            </h2>
            <p className="text-primary-100 text-lg mb-8 leading-relaxed">
              Every vehicle on EasyDrive is backed by our comprehensive guarantee. 
              We stand behind every car we sell because we&apos;ve already put it through 
              our rigorous 150+ point inspection.
            </p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {benefits.map((benefit, index) => (
                <div key={index} className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
                    {benefit.icon}
                  </div>
                  <div>
                    <h4 className="font-semibold mb-1">{benefit.title}</h4>
                    <p className="text-primary-200 text-sm">{benefit.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Card */}
          <div className="bg-white rounded-3xl p-8 shadow-xl">
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-100 rounded-full mb-4">
                <svg className="w-8 h-8 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-secondary-900">Save More</h3>
              <p className="text-secondary-600 mt-2">Compared to traditional dealerships</p>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center py-3 border-b border-secondary-100">
                <span className="text-secondary-600">No dealer admin fees</span>
                <span className="font-semibold text-accent-green">Save $999</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-secondary-100">
                <span className="text-secondary-600">No documentation fees</span>
                <span className="font-semibold text-accent-green">Save $999</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-secondary-100">
                <span className="text-secondary-600">Free delivery</span>
                <span className="font-semibold text-accent-green">Save $299</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-secondary-100">
                <span className="text-secondary-600">Below market pricing</span>
                <span className="font-semibold text-accent-green">Save $1,000+</span>
              </div>
              <div className="flex justify-between items-center pt-4">
                <span className="text-lg font-bold text-secondary-900">Total Average Savings</span>
                <span className="text-2xl font-bold text-primary-600">$3,297+</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
