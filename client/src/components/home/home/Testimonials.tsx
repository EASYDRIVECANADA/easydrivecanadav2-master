'use client'

const testimonials = [
  {
    id: 1,
    name: 'Sarah M.',
    location: 'Toronto, ON',
    rating: 5,
    text: 'Bought my Honda CR-V entirely online. The process was seamless, and the car was delivered to my door in perfect condition. Saved over $3,000 compared to the dealership!',
    vehicle: '2022 Honda CR-V',
    avatar: 'SM'
  },
  {
    id: 2,
    name: 'Michael R.',
    location: 'Vancouver, BC',
    rating: 5,
    text: 'I was skeptical about buying a car online, but EasyDrive made it so easy. The 10-day return policy gave me peace of mind. Highly recommend!',
    vehicle: '2023 Toyota Camry',
    avatar: 'MR'
  },
  {
    id: 3,
    name: 'Jennifer L.',
    location: 'Calgary, AB',
    rating: 5,
    text: 'The financing process was quick and easy. Got approved in minutes with a great rate. The car arrived faster than expected. Amazing experience!',
    vehicle: '2022 Mazda CX-5',
    avatar: 'JL'
  },
  {
    id: 4,
    name: 'David K.',
    location: 'Ottawa, ON',
    rating: 5,
    text: 'No haggling, no pressure, just a fair price. The inspection report was thorough and gave me confidence in my purchase. Will definitely use again!',
    vehicle: '2021 Ford F-150',
    avatar: 'DK'
  },
]

export default function Testimonials() {
  return (
    <section className="py-20 bg-secondary-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <span className="text-primary-600 font-semibold text-sm uppercase tracking-wider">Testimonials</span>
          <h2 className="text-3xl md:text-4xl font-bold text-secondary-900 mt-2 mb-4">
            Loved by Thousands of Canadians
          </h2>
          <p className="text-lg text-secondary-600 max-w-2xl mx-auto">
            Don&apos;t just take our word for it. Here&apos;s what our customers have to say.
          </p>
        </div>

        {/* Rating Summary */}
        <div className="flex justify-center items-center gap-6 mb-12">
          <div className="flex items-center gap-1">
            {[...Array(5)].map((_, i) => (
              <svg key={i} className="w-6 h-6 text-accent-yellow" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            ))}
          </div>
          <div className="text-secondary-900">
            <span className="font-bold text-lg">4.9</span>
            <span className="text-secondary-500"> / 5 from </span>
            <span className="font-semibold">2,500+ reviews</span>
          </div>
        </div>

        {/* Testimonials Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {testimonials.map((testimonial) => (
            <div 
              key={testimonial.id}
              className="bg-white rounded-2xl p-6 shadow-card hover:shadow-card-hover transition-all"
            >
              {/* Stars */}
              <div className="flex gap-1 mb-4">
                {[...Array(testimonial.rating)].map((_, i) => (
                  <svg key={i} className="w-5 h-5 text-accent-yellow" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>

              {/* Text */}
              <p className="text-secondary-700 mb-6 leading-relaxed text-sm">
                &quot;{testimonial.text}&quot;
              </p>

              {/* Author */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center text-primary-600 font-semibold text-sm">
                  {testimonial.avatar}
                </div>
                <div>
                  <div className="font-semibold text-secondary-900 text-sm">{testimonial.name}</div>
                  <div className="text-secondary-500 text-xs">{testimonial.location}</div>
                </div>
              </div>

              {/* Vehicle */}
              <div className="mt-4 pt-4 border-t border-secondary-100">
                <span className="text-xs text-secondary-500">Purchased: </span>
                <span className="text-xs font-medium text-secondary-700">{testimonial.vehicle}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
