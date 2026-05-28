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

const { normalizeWarrantyTerms } = loadTsModule('./warrantyTerms.ts')

test('normalizeWarrantyTerms moves mileage range from duration to distance', () => {
  assert.deepEqual(
    normalizeWarrantyTerms({
      duration: '60,001 - 100,000 km : 12 Mo / Unlimited ($5,000/claim)',
      distance: '',
    }),
    {
      duration: '12 Mo / Unlimited ($5,000/claim)',
      distance: '60,001 - 100,000 km',
    }
  )
})

test('normalizeWarrantyTerms keeps explicit distance over inferred mileage', () => {
  assert.deepEqual(
    normalizeWarrantyTerms({
      duration: '60,001 - 100,000 km : 12 Mo / Unlimited',
      distance: '120,000 km',
    }),
    {
      duration: '12 Mo / Unlimited',
      distance: '120,000 km',
    }
  )
})
