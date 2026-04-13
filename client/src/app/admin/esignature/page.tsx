import nextDynamic from 'next/dynamic'

// Prevent static prerendering — this page uses browser-only libraries (jsPDF, etc.)
export const dynamic = 'force-dynamic'

const EsignatureClient = nextDynamic(() => import('./EsignatureClient'), { ssr: false })

export default function ESignaturePage() {
  return <EsignatureClient />
}
