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

const {
  buildRenderedPageSequence,
  getFieldsForRenderedPage,
  getNextRequiredField,
  parseEnvelopeDocuments,
} = loadTsModule('./eSignatureDocuments.ts')

test('parseEnvelopeDocuments preserves every uploaded document', () => {
  const docs = parseEnvelopeDocuments(JSON.stringify([
    { file_name: 'Bill of Sale.pdf', url: 'https://example.com/bos.pdf' },
    { file_name: 'Warranty.pdf', file_b64: 'JVBERi0x' },
  ]))

  assert.equal(docs.length, 2)
  assert.deepEqual(docs.map((doc) => doc.fileIndex), [0, 1])
  assert.deepEqual(docs.map((doc) => doc.name), ['Bill of Sale.pdf', 'Warranty.pdf'])
  assert.equal(docs[1].source, 'JVBERi0x')
})

test('buildRenderedPageSequence maps global pages back to document and page number', () => {
  const pages = buildRenderedPageSequence([
    { fileIndex: 0, name: 'Bill of Sale.pdf', pages: ['bos-page-1', 'bos-page-2'] },
    { fileIndex: 1, name: 'Warranty.pdf', pages: ['warranty-page-1'] },
  ])

  assert.deepEqual(
    pages.map((page) => ({ globalPageNumber: page.globalPageNumber, fileIndex: page.fileIndex, pageNumber: page.pageNumber })),
    [
      { globalPageNumber: 1, fileIndex: 0, pageNumber: 1 },
      { globalPageNumber: 2, fileIndex: 0, pageNumber: 2 },
      { globalPageNumber: 3, fileIndex: 1, pageNumber: 1 },
    ]
  )
})

test('getFieldsForRenderedPage uses fileIndex so second document fields are visible', () => {
  const renderedPage = { globalPageIndex: 2, globalPageNumber: 3, fileIndex: 1, pageNumber: 1, documentName: 'Warranty.pdf', url: 'warranty-page-1' }
  const fields = [
    { id: 'first-doc', type: 'signature', page: 1, fileIndex: 0, x: 10, y: 10, width: 50, height: 20 },
    { id: 'second-doc', type: 'signature', page: 1, fileIndex: 1, x: 10, y: 10, width: 50, height: 20 },
  ]

  assert.deepEqual(getFieldsForRenderedPage(fields, renderedPage).map((field) => field.id), ['second-doc'])
})

test('getNextRequiredField walks required fields across all documents', () => {
  const fields = [
    { id: 'signed', type: 'signature', page: 1, fileIndex: 0, x: 10, y: 10, width: 50, height: 20, value: 'data:image/png;base64,signed' },
    { id: 'initial', type: 'initial', page: 2, fileIndex: 0, x: 10, y: 20, width: 50, height: 20 },
    { id: 'second-doc', type: 'signature', page: 1, fileIndex: 1, x: 10, y: 10, width: 50, height: 20 },
  ]

  assert.equal(getNextRequiredField(fields)?.id, 'initial')
  assert.equal(getNextRequiredField(fields, 'initial')?.id, 'second-doc')
})
