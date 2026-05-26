const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://easydrivecanada.com').replace(/\/+$/, '')
const SITE_NAME = 'EasyDrive Canada'

export function buildOrganizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${SITE_URL}/#organization`,
    name: SITE_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}/images/favicon.png`,
    sameAs: [] as string[],
    areaServed: { '@type': 'Country', name: 'Canada' },
  }
}

export function buildWebSiteJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${SITE_URL}/#website`,
    name: SITE_NAME,
    url: SITE_URL,
    publisher: { '@id': `${SITE_URL}/#organization` },
    potentialAction: {
      '@type': 'SearchAction',
      target: `${SITE_URL}/inventory?search={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  }
}

export function buildBreadcrumbJsonLd(items: Array<{ name: string; url: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      name: item.name,
      item: item.url,
    })),
  }
}

export type CollectionItem = {
  id: string
  year?: number | string | null
  make?: string | null
  model?: string | null
  series?: string | null
  price?: number | string | null
  image?: string | null
}

export function buildInventoryCollectionJsonLd(items: CollectionItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': `${SITE_URL}/inventory#collection`,
    url: `${SITE_URL}/inventory`,
    name: 'Used Car Inventory | EasyDrive Canada',
    isPartOf: { '@id': `${SITE_URL}/#website` },
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: items.length,
      itemListElement: items.map((v, idx) => {
        const name = [v.year, v.make, v.model, v.series].filter(Boolean).join(' ').trim()
        return {
          '@type': 'ListItem',
          position: idx + 1,
          url: `${SITE_URL}/inventory/${v.id}`,
          name: name || 'Vehicle',
        }
      }),
    },
  }
}
