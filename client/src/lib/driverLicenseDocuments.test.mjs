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
  buildDriverLicensePrintHtml,
  getDriverLicenseDownloadName,
  normalizeDriverLicensePhoto,
} = loadTsModule('./driverLicenseDocuments.ts')

test('normalizeDriverLicensePhoto returns labelled image details', () => {
  assert.deepEqual(
    normalizeDriverLicensePhoto('front', 'data:image/jpeg;base64,abc'),
    { side: 'front', title: "Driver's License Front", src: 'data:image/jpeg;base64,abc' }
  )
})

test('getDriverLicenseDownloadName builds stable filenames', () => {
  assert.equal(getDriverLicenseDownloadName('front', 'W4318 - 41170 - 20909'), 'drivers-license-front-W4318-41170-20909.jpg')
  assert.equal(getDriverLicenseDownloadName('back', ''), 'drivers-license-back.jpg')
})

test('buildDriverLicensePrintHtml contains both selected image and print trigger', () => {
  const html = buildDriverLicensePrintHtml({
    title: "Driver's License Front",
    src: 'data:image/jpeg;base64,abc',
  })

  assert.match(html, /Driver&#39;s License Front/)
  assert.match(html, /data:image\/jpeg;base64,abc/)
  assert.match(html, /window.print/)
})
