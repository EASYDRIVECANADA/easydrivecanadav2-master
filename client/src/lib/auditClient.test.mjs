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

const { readAuditActorFromStorage } = loadTsModule('./auditClient.ts')

test('readAuditActorFromStorage extracts actor identity from the admin session', () => {
  const storage = {
    getItem(key) {
      if (key !== 'edc_admin_session') return null
      return JSON.stringify({
        name: 'Manager User',
        email: ' Manager@EasyDriveCanada.com ',
      })
    },
  }

  assert.deepEqual(readAuditActorFromStorage(storage), {
    actor_name: 'Manager User',
    actor_email: 'manager@easydrivecanada.com',
  })
})

test('readAuditActorFromStorage falls back to known account email values', () => {
  const storage = {
    getItem(key) {
      if (key === 'edc_admin_session') return 'not json'
      if (key === 'edc_user_email') return 'owner@example.com'
      return null
    },
  }

  assert.deepEqual(readAuditActorFromStorage(storage), {
    actor_name: '',
    actor_email: 'owner@example.com',
  })
})
