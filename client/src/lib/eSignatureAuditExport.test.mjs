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

const { buildAuditTraceCsv } = loadTsModule('./eSignatureAuditExport.ts')

test('buildAuditTraceCsv exports visible audit columns and escapes values', () => {
  const csv = buildAuditTraceCsv([
    {
      time: '5/28/2026, 11:02:00 AM',
      user: 'Jane Customer',
      user_email: 'jane@example.com',
      action: 'Recipient Signed',
      activity: 'Signed "Bill of Sale"',
      ip: '127.0.0.1',
      device: 'Chrome on Windows',
      status: 'Signed',
    },
  ])

  assert.match(csv, /^Time,User,Email,Action,Activity,IP Address,Device,Status/)
  assert.match(csv, /"Signed ""Bill of Sale"""/)
})
