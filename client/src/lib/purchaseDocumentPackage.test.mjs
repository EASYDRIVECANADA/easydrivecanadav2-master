import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  buildDocumentPackagePatch,
  buildPackageLink,
  getCheckoutBillOfSaleSignature,
  sanitizePackageFileName,
} from './purchaseDocumentPackage.mjs'

test('uses drawn checkout BOS signature when present', () => {
  const result = getCheckoutBillOfSaleSignature({
    signatures: {
      billOfSaleCustomer: {
        typedName: 'Jane Buyer',
        drawnDataUrl: 'data:image/png;base64,abc123',
        signedAt: '2026-05-18T00:00:00.000Z',
      },
    },
  })

  assert.deepEqual(result, {
    purchaserSignatureB64: 'data:image/png;base64,abc123',
    purchaserSignatureText: '',
  })
})

test('falls back to typed checkout BOS signature text', () => {
  const result = getCheckoutBillOfSaleSignature({
    signatures: {
      billOfSaleCustomer: {
        typedName: 'Jane Buyer',
        drawnDataUrl: '',
        signedAt: '2026-05-18T00:00:00.000Z',
      },
    },
  })

  assert.deepEqual(result, {
    purchaserSignatureB64: '',
    purchaserSignatureText: 'Jane Buyer',
  })
})

test('builds package patch with token, BOS path, CARFAX files, and status', () => {
  const patch = buildDocumentPackagePatch({
    token: 'token-123',
    bosPath: 'purchase-documents/sub-1/Bill_of_Sale_WEB-1.pdf',
    carfaxFiles: [{ name: 'carfax.pdf', path: 'vehicle-1/carfax.pdf' }],
    createdAt: '2026-05-18T00:00:00.000Z',
  })

  assert.deepEqual(patch, {
    document_package_token: 'token-123',
    document_package_created_at: '2026-05-18T00:00:00.000Z',
    bos_pdf_url: 'purchase-documents/sub-1/Bill_of_Sale_WEB-1.pdf',
    carfax_files: [{ name: 'carfax.pdf', path: 'vehicle-1/carfax.pdf' }],
    document_package_status: 'ready',
  })
})

test('builds stable customer package links without double slashes', () => {
  assert.equal(
    buildPackageLink('https://easydrivecanada.com/', 'abc'),
    'https://easydrivecanada.com/documents/purchase/abc'
  )
})

test('sanitizes generated package file names', () => {
  assert.equal(
    sanitizePackageFileName('Bill of Sale WEB/123?.pdf'),
    'Bill_of_Sale_WEB_123_.pdf'
  )
})
