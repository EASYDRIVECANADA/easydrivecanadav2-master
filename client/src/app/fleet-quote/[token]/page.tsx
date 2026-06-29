import FleetQuoteClient from './FleetQuoteClient'

export const dynamic = 'force-dynamic'

export default function FleetQuotePage({ params }: { params: { token: string } }) {
  return <FleetQuoteClient token={params.token} />
}
