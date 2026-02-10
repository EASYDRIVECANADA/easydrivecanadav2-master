'use client'

import { useState } from 'react'

interface FAQItem {
  question: string
  answer: string
}

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  const faqs: FAQItem[] = [
    {
      question: "How does buying a car online work?",
      answer: "Browse our inventory, select your vehicle, complete financing online, and we'll deliver it right to your door. Our entire process is 100% digital - from browsing to signing. You can complete your purchase from the comfort of your home, and we handle all the paperwork electronically. Once approved, we'll schedule delivery at your convenience."
    },
    {
      question: "What's included in the 150+ point inspection?",
      answer: "Every vehicle undergoes a comprehensive inspection by certified mechanics covering engine performance, transmission, brakes, suspension, electrical systems, tires, interior condition, and more. We provide a detailed inspection report with every vehicle, documenting the condition of all major components. This ensures you know exactly what you're getting before purchase."
    },
    {
      question: "What financing options are available?",
      answer: "We offer competitive financing rates for all credit types, including bad credit and first-time buyers. Apply online in minutes and get pre-approved instantly. We work with multiple lenders to find you the best rate. Our financing specialists will help you choose between lease and loan options, with flexible terms from 24-84 months."
    },
    {
      question: "Do you deliver vehicles?",
      answer: "Yes! We offer free home delivery anywhere in Ontario. We'll bring the vehicle directly to your home or workplace at no extra charge. Delivery typically takes 3-7 business days after purchase. Our driver will walk you through the vehicle features and answer any questions you have upon delivery."
    },
    {
      question: "Can I trade in my current vehicle?",
      answer: "Absolutely! We accept trade-ins and offer competitive values. Simply provide your vehicle details during the financing application, and we'll give you an instant trade-in estimate. You can also bring your vehicle in for a free in-person appraisal. Trade-in value can be applied directly to your down payment."
    },
    {
      question: "What documents do I need to purchase a car?",
      answer: "You'll need a valid driver's license, proof of insurance, proof of income (recent pay stubs or bank statements), and proof of residence (utility bill or lease agreement). For financing, we may also need employment verification and references. All documents can be uploaded securely through our online portal."
    },
    {
      question: "Is there a warranty on the vehicles?",
      answer: "Yes, every vehicle comes with a 3-month comprehensive warranty covering major mechanical components including engine, transmission, and drivetrain. Extended warranty options are also available for additional peace of mind. Our warranty is fully transferable and honored at any licensed repair facility across Canada."
    },
    {
      question: "Can I schedule a test drive?",
      answer: "Yes! While we offer 100% online purchasing, you're welcome to schedule an in-person test drive at our showroom or request a home test drive. Contact us to arrange a convenient time. Test drives typically last 30-45 minutes and give you a chance to thoroughly evaluate the vehicle."
    },
    {
      question: "What if I'm not satisfied with my purchase?",
      answer: "We stand behind every vehicle we sell. If you're not completely satisfied, contact us within the warranty period and we'll work with you to resolve any issues. All vehicles come with a detailed inspection report, and we're committed to ensuring your complete satisfaction with your purchase."
    },
    {
      question: "Do you accept cash or debit payments?",
      answer: "Yes, we accept multiple payment methods including cash, debit, certified cheque, bank wire transfer, and financing. For online purchases, you can complete your down payment securely through our payment portal. Full payment is due before delivery, and we'll provide all necessary receipts and documentation."
    },
    {
      question: "Are the vehicle prices negotiable?",
      answer: "Our prices are transparently set at market value with no hidden fees or haggling required. We use data-driven pricing to ensure you're getting a fair deal from the start. However, we're always willing to discuss trade-in values and financing terms to help you get the best overall deal."
    },
    {
      question: "How do I know the vehicle history is accurate?",
      answer: "Every vehicle comes with a complete CARFAX report showing accident history, service records, previous owners, and more. We verify all information before listing. You'll receive the full vehicle history report before purchase, and we encourage you to review it carefully. If there's any history concern, we disclose it upfront."
    }
  ]

  return (
    <section className="py-20 lg:py-28 bg-white" aria-label="Frequently asked questions">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <span className="inline-flex items-center gap-1.5 text-primary-600 font-semibold text-sm uppercase tracking-wider">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            FAQ
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-secondary-900 mt-3 mb-4">
            Frequently Asked Questions
          </h2>
          <p className="text-lg text-secondary-500 max-w-2xl mx-auto leading-relaxed">
            Everything you need to know about buying a car online with Easy Drive Canada
          </p>
        </div>

        <div className="space-y-3" role="list">
          {faqs.map((faq, index) => (
            <div 
              key={index}
              className={`bg-white rounded-2xl overflow-hidden transition-all duration-200 ${
                openIndex === index 
                  ? 'shadow-card border border-primary-200' 
                  : 'border border-secondary-200 hover:border-secondary-300'
              }`}
              role="listitem"
            >
              <button
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="w-full flex items-center justify-between p-5 sm:p-6 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-inset rounded-2xl"
                aria-expanded={openIndex === index}
              >
                <span className={`font-semibold pr-8 text-[15px] sm:text-base transition-colors ${
                  openIndex === index ? 'text-primary-700' : 'text-secondary-900'
                }`}>
                  {faq.question}
                </span>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-200 ${
                  openIndex === index 
                    ? 'bg-primary-100 text-primary-600 rotate-180' 
                    : 'bg-secondary-100 text-secondary-500'
                }`}>
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>
              
              <div
                className={`overflow-hidden transition-all duration-300 ease-in-out ${
                  openIndex === index ? 'max-h-96' : 'max-h-0'
                }`}
              >
                <div className="px-5 sm:px-6 pb-5 sm:pb-6">
                  <p className="text-secondary-500 leading-relaxed text-[15px]">
                    {faq.answer}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Contact CTA */}
        <div className="mt-14 text-center p-8 sm:p-10 bg-secondary-50 rounded-3xl border border-secondary-100">
          <div className="w-14 h-14 bg-primary-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-secondary-900 mb-2">
            Still have questions?
          </h3>
          <p className="text-secondary-500 mb-6 max-w-md mx-auto">
            Can&apos;t find the answer you&apos;re looking for? Our team is here to help.
          </p>
          <a
            href="/contact"
            className="inline-flex items-center gap-2.5 bg-primary-600 text-white px-7 py-3.5 rounded-full font-semibold hover:bg-primary-700 transition-all shadow-lg shadow-primary-600/20 hover:shadow-xl hover:-translate-y-0.5"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Contact Us
          </a>
        </div>
      </div>
    </section>
  )
}
