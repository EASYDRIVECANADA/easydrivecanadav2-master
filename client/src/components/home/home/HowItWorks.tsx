export default function HowItWorks() {
  const steps = [
    {
      number: '1',
      title: 'Browse & Choose',
      description: 'Search our curated inventory of quality-inspected vehicles. Filter by make, model, price, and more.',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      )
    },
    {
      number: '2',
      title: 'Get Financing',
      description: 'Apply online in minutes. Get pre-approved with competitive rates and flexible terms.',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
        </svg>
      )
    },
    {
      number: '3',
      title: 'Sign Online',
      description: 'Complete all paperwork digitally from your home. No dealership visits required.',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      )
    },
    {
      number: '4',
      title: 'Get Delivered',
      description: 'Your car arrives at your doorstep, fully detailed and ready to drive. It\'s that simple.',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
        </svg>
      )
    }
  ]

  return (
    <section className="py-20 bg-secondary-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <span className="text-primary-600 font-semibold text-sm uppercase tracking-wider">How It Works</span>
          <h2 className="text-3xl md:text-4xl font-bold text-secondary-900 mt-2 mb-4">
            Buy a Car in 4 Simple Steps
          </h2>
          <p className="text-lg text-secondary-600 max-w-2xl mx-auto">
            Skip the dealership. Buy your next car entirely online, from the comfort of your home.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((step, index) => (
            <div key={index} className="relative">
              {/* Connector Line */}
              {index < steps.length - 1 && (
                <div className="hidden lg:block absolute top-8 left-[60%] w-full h-0.5 bg-gradient-to-r from-primary-300 to-primary-100" />
              )}
              
              <div className="relative bg-white rounded-2xl p-6 shadow-card hover:shadow-card-hover transition-shadow">
                {/* Step Number */}
                <div className="absolute -top-4 left-6 w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                  {step.number}
                </div>
                
                <div className="pt-4">
                  <div className="w-14 h-14 bg-primary-50 rounded-xl flex items-center justify-center text-primary-600 mb-4">
                    {step.icon}
                  </div>
                  <h3 className="text-lg font-semibold text-secondary-900 mb-2">
                    {step.title}
                  </h3>
                  <p className="text-secondary-600 text-sm leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
