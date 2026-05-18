export function text(...values: unknown[]): string
export function parseJsonLoose<T = Record<string, unknown>>(value: unknown, fallback?: T): T
export function getCheckoutBillOfSaleSignature(orderData: unknown): {
  purchaserSignatureB64: string
  purchaserSignatureText: string
}
export function buildDocumentPackagePatch(params: {
  token: string
  bosPath: string
  carfaxFiles: Array<{ name: string; path: string }>
  createdAt: string
}): {
  document_package_token: string
  document_package_created_at: string
  bos_pdf_url: string
  carfax_files: Array<{ name: string; path: string }>
  document_package_status: string
}
export function buildPackageLink(baseUrl: string, token: string): string
export function sanitizePackageFileName(value: string): string
