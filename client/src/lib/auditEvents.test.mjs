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
  buildAuditEventsQuery,
  buildAuditTrailCsv,
  normalizeAuditEventPayload,
} = loadTsModule('./auditEvents.ts')

test('normalizeAuditEventPayload trims required display fields and preserves metadata objects', () => {
  assert.deepEqual(
    normalizeAuditEventPayload({
      module: ' Leads ',
      action: ' Status Updated ',
      summary: ' Lead moved to Booked ',
      actor_email: ' Manager@EasyDriveCanada.com ',
      record_type: ' lead ',
      record_id: ' abc-123 ',
      metadata: { from: 'In Talks', to: 'Booked' },
    }),
    {
      module: 'Leads',
      action: 'Status Updated',
      summary: 'Lead moved to Booked',
      actor_name: '',
      actor_email: 'manager@easydrivecanada.com',
      record_type: 'lead',
      record_id: 'abc-123',
      ip_address: '',
      user_agent: '',
      metadata: { from: 'In Talks', to: 'Booked' },
    }
  )
})

test('buildAuditEventsQuery applies filters and caps large limits', () => {
  const query = buildAuditEventsQuery({
    module: 'Leads',
    action: 'Status Updated',
    actor: 'manager@example.com',
    q: 'Booked',
    startDate: '2026-06-01',
    endDate: '2026-06-16',
    limit: 9999,
  })

  assert.match(query, /select=\*/)
  assert.match(query, /order=created_at\.desc/)
  assert.match(query, /limit=500/)
  assert.match(query, /module=eq\.Leads/)
  assert.match(query, /action=eq\.Status%20Updated/)
  assert.match(query, /actor_email=ilike\.\*manager%40example\.com\*/)
  assert.match(query, /created_at=gte\.2026-06-01T00%3A00%3A00\.000Z/)
  assert.match(query, /created_at=lte\.2026-06-16T23%3A59%3A59\.999Z/)
  assert.match(query, /or=\(summary\.ilike\.\*Booked\*/)
})

test('buildAuditTrailCsv exports the system audit columns and escapes quoted summaries', () => {
  const csv = buildAuditTrailCsv([
    {
      created_at: '2026-06-16T10:00:00.000Z',
      module: 'Customers',
      action: 'Updated',
      summary: 'Updated "Jane Doe"',
      actor_name: 'Admin',
      actor_email: 'admin@example.com',
      record_type: 'customer',
      record_id: 'cust-1',
      ip_address: '127.0.0.1',
      user_agent: 'Chrome',
    },
  ])

  assert.match(csv, /^Time,Module,Action,Summary,Actor,Actor Email,Record Type,Record ID,IP Address,Device/)
  assert.match(csv, /"Updated ""Jane Doe"""/)
})
