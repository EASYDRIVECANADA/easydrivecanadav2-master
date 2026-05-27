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

const { fitPdfCellText, wrapPdfCellText } = loadTsModule('./pdfTextFit.ts')

function mockDoc() {
  let fontSize = 7
  return {
    getFontSize: () => fontSize,
    setFontSize: (next) => {
      fontSize = next
    },
    getTextWidth: (value) => String(value).length * fontSize * 0.5,
  }
}

test('fitPdfCellText keeps short values unchanged', () => {
  const doc = mockDoc()

  const fitted = fitPdfCellText(doc, '12 Mo', 40)

  assert.deepEqual(fitted, { text: '12 Mo', fontSize: 7 })
  assert.equal(doc.getFontSize(), 7)
})

test('fitPdfCellText shrinks medium warranty values to fit narrow columns', () => {
  const doc = mockDoc()

  const fitted = fitPdfCellText(doc, '12 Mo / Unlimited', 43, { minFontSize: 5 })

  assert.equal(fitted.text, '12 Mo / Unlimited')
  assert.ok(fitted.fontSize < 7)
  assert.ok(fitted.fontSize >= 5)
})

test('fitPdfCellText truncates only after reaching the minimum font size', () => {
  const doc = mockDoc()

  const fitted = fitPdfCellText(doc, '12 Mo / Unlimited (5,000 claim limit)', 42, { minFontSize: 5 })

  assert.ok(fitted.text.endsWith('...'))
  assert.ok(doc.getTextWidth(fitted.text) <= 42)
  assert.equal(fitted.fontSize, 5)
})

test('wrapPdfCellText preserves warranty ranges by wrapping across lines', () => {
  const doc = mockDoc()

  const wrapped = wrapPdfCellText(doc, '60,001 - 100,000', 30, { fontSize: 6.5, maxLines: 3 })

  assert.equal(wrapped.lines.join(' '), '60,001 - 100,000')
  assert.ok(wrapped.lines.every((line) => doc.getTextWidth(line) <= 30))
  assert.equal(wrapped.fontSize, 6.5)
})

test('wrapPdfCellText does not drop warranty details when no line cap is set', () => {
  const doc = mockDoc()
  const value = '12 Mo / Unlimited (5,000 claim limit) $5,011.00'

  const wrapped = wrapPdfCellText(doc, value, 34, { fontSize: 6.2 })

  assert.equal(wrapped.lines.join(' '), value)
  assert.ok(wrapped.lines.length > 3)
  assert.ok(wrapped.lines.every((line) => doc.getTextWidth(line) <= 34))
})
