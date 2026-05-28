import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import Module from 'node:module'
import { dirname, resolve } from 'node:path'
import { test } from 'node:test'
import ts from 'typescript'

function loadTsModule(relativePath) {
  const filename = resolve(import.meta.dirname, relativePath)
  const source = readFileSync(filename, 'utf8')
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText
  const mod = new Module(filename)
  mod.filename = filename
  mod.paths = Module._nodeModulePaths(dirname(filename))
  mod._compile(compiled, filename)
  return mod.exports
}

const { clearOnlinePurchaseSignatures, hasOnlinePurchaseSignatures } = loadTsModule('./purchaseResign.ts')

test('hasOnlinePurchaseSignatures detects captured checkout signatures', () => {
  assert.equal(hasOnlinePurchaseSignatures({
    signatures: {
      billOfSaleCustomer: { typedName: 'Test Test' },
    },
  }), true)
  assert.equal(hasOnlinePurchaseSignatures({ signatures: {} }), false)
})

test('clearOnlinePurchaseSignatures removes checkout signatures and records reset event', () => {
  const updated = clearOnlinePurchaseSignatures({
    signatures: {
      billOfSaleCustomer: { typedName: 'Test Test', signedAt: '2026-05-27T10:00:00Z' },
      dealerGuaranteeCustomer: { typedName: 'Test Test', signedAt: '2026-05-27T10:00:00Z' },
    },
    carfax: {
      typedInitials: 'TT',
      initialDataUrl: 'data:image/png;base64,abc',
      acknowledgedAt: '2026-05-27T10:00:00Z',
    },
    events: [{ type: 'order_created', actor: 'customer' }],
  }, 'admin@example.com', '2026-05-28T15:00:00Z')

  assert.equal(updated.signatures.billOfSaleCustomer, null)
  assert.equal(updated.signatures.dealerGuaranteeCustomer, null)
  assert.equal(updated.carfax.typedInitials, null)
  assert.equal(updated.carfax.initialDataUrl, null)
  assert.equal(updated.carfax.acknowledgedAt, null)
  assert.deepEqual(updated.events.at(-1), {
    at: '2026-05-28T15:00:00Z',
    type: 'signature_reset_for_resign',
    actor: 'admin',
    note: 'admin@example.com',
  })
})
