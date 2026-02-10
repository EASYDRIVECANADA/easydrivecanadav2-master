export default function HowItWorks() {
  const steps = [
    {
      number: '1',
      title: 'Browse & Choose',
      description: 'Search our curated inventory of quality-inspected vehicles. Filter by make, model, price, and more.',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      )
    },
    {
      number: '2',
      title: 'Get Financing',
      description: 'Apply online in minutes. Get pre-approved with competitive rates and flexible terms.',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
        </svg>
      )
    },
    {
      number: '3',
      title: 'Sign Online',
      description: 'Complete all paperwork digitally from your home. No dealership visits required.',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      )
    },
    {
      number: '4',
      title: 'Get Delivered',
      description: 'Your car arrives at your doorstep, fully detailed and ready to drive. It\'s that simple.',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
        </svg>
      )
    }
  ]

  return (
    <section className="py-20 lg:py-28 bg-secondary-50" aria-label="How to buy a car">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <span className="inline-flex items-center gap-1.5 text-primary-600 font-semibold text-sm uppercase tracking-wider">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
            How It Works
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-secondary-900 mt-3 mb-4">
            Buy a Car in 4 Simple Steps
          </h2>
          <p className="text-lg text-secondary-500 max-w-2xl mx-auto leading-relaxed">
            Skip the dealership. Buy your next car entirely online, from the comfort of your home.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8" role="list">
          {steps.map((step, index) => (
            <div key={index} className="relative" role="listitem">
              {/* Connector Line */}
              {index < steps.length - 1 && (
                <div className="hidden lg:block absolute top-12 left-[60%] w-[calc(100%-10px)] h-[2px]" aria-hidden="true">
                  <div className="w-full h-full bg-gradient-to-r from-primary-400 to-primary-200 rounded-full" />
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 bg-primary-300 rounded-full" />
                </div>
              )}
              
              <div className="relative bg-white rounded-2xl p-7 shadow-card hover:shadow-card-hover transition-all duration-300 hover:-translate-y-1 group">
                {/* Step Number Badge */}
                <div className="absolute -top-4 left-7 w-9 h-9 bg-primary-600 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-primary-600/30">
                  {step.number}
                </div>
                
                <div className="pt-5">
                  <div className="w-14 h-14 bg-primary-50 rounded-2xl flex items-center justify-center text-primary-600 mb-5 group-hover:bg-primary-100 group-hover:scale-110 transition-all duration-300">
                    {step.icon}
                  </div>
                  <h3 className="text-lg font-bold text-secondary-900 mb-2">
                    {step.title}
                  </h3>
                  <p className="text-secondary-500 text-[15px] leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* 100% Online Badge */}
        <div className="text-center mt-12">
          <div className="inline-flex items-center gap-2.5 bg-primary-50 text-primary-700 px-6 py-3 rounded-full font-semibold text-sm border border-primary-100">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            100% Online — No Dealership Visits Required
          </div>
        </div>
      </div>
    </section>
  )
}
