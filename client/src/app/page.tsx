import Hero from '@/components/home/Hero'
import FeaturedCars from '@/components/home/FeaturedCars'
import Features from '@/components/home/Features'
import HowItWorks from '@/components/home/HowItWorks'
import Benefits from '@/components/home/Benefits'
import FAQ from '@/components/home/FAQ'
import CTA from '@/components/home/CTA'

export default function Home() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "name": "Easy Drive Canada",
    "description": "Quality pre-owned vehicles with 150+ point inspection",
    "url": "https://easydrivecanada.ca",
    "telephone": "+1-613-777-2395",
    "address": {
      "@type": "PostalAddress",
      "addressLocality": "Toronto",
      "addressRegion": "ON",
      "addressCountry": "CA"
    },
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "4.9",
      "reviewCount": "2500"
    }
  }

  return (
    <>
      {/* Structured Data for SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      
      <Hero />
      <FeaturedCars />
      <Features />
      <HowItWorks />
      <Benefits />
      <FAQ />
      <CTA />
    </>
  )
}
