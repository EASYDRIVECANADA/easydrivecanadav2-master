export function text(...values) {
  for (const value of values) {
    const next = String(value ?? '').trim()
    if (next) return next
  }
  return ''
}

export function parseJsonLoose(value, fallback = {}) {
  if (!value) return fallback
  if (typeof value === 'object') return value
  if (typeof value !== 'string') return fallback
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' ? parsed : fallback
  } catch {
    return fallback
  }
}

export function getCheckoutBillOfSaleSignature(orderData) {
  const order = parseJsonLoose(orderData)
  const signature = order?.signatures?.billOfSaleCustomer || {}
  const drawnDataUrl = text(signature.drawnDataUrl)
  if (drawnDataUrl) {
    return {
      purchaserSignatureB64: drawnDataUrl,
      purchaserSignatureText: '',
    }
  }

  return {
    purchaserSignatureB64: '',
    purchaserSignatureText: text(signature.typedName),
  }
}

export function buildDocumentPackagePatch({ token, bosPath, carfaxFiles, createdAt }) {
  return {
    document_package_token: text(token),
    document_package_created_at: text(createdAt),
    bos_pdf_url: text(bosPath),
    carfax_files: Array.isArray(carfaxFiles) ? carfaxFiles : [],
    document_package_status: 'ready',
  }
}

export function buildPackageLink(baseUrl, token) {
  const origin = text(baseUrl).replace(/\/+$/, '')
  return `${origin}/documents/purchase/${encodeURIComponent(text(token))}`
}

export function sanitizePackageFileName(value) {
  return text(value, 'document.pdf').replace(/[^a-zA-Z0-9._-]/g, '_')
}
