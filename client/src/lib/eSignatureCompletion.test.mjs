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
  buildCompletionNotificationEmail,
  buildESignatureReadinessReport,
  collectCompletionNotificationRecipients,
  shouldSendCompletionNotification,
} = loadTsModule('./eSignatureCompletion.ts')

test('collectCompletionNotificationRecipients sends to owner and EasyDrive without duplicates', () => {
  assert.deepEqual(
    collectCompletionNotificationRecipients('Owner@Example.com', 'info@easydrivecanada.com'),
    ['owner@example.com', 'info@easydrivecanada.com']
  )
  assert.deepEqual(
    collectCompletionNotificationRecipients('info@easydrivecanada.com', 'info@easydrivecanada.com'),
    ['info@easydrivecanada.com']
  )
})

test('shouldSendCompletionNotification only returns true for final completion before notification is recorded', () => {
  const completeRows = [{ signed_at: '2026-05-28T15:00:00Z' }, { status: 'completed' }]
  assert.equal(shouldSendCompletionNotification(completeRows, []), true)
  assert.equal(shouldSendCompletionNotification([{ signed_at: '2026-05-28T15:00:00Z' }, { status: 'sent' }], []), false)
  assert.equal(shouldSendCompletionNotification(completeRows, [{ action: 'Completion Notification Sent' }]), false)
})

test('buildCompletionNotificationEmail includes recipients and admin link', () => {
  const email = buildCompletionNotificationEmail({
    envelopeId: 'deal-123',
    documentTitle: 'Bill of Sale.pdf',
    adminUrl: 'https://easydrivecanada.com/admin/esignature/prepare/deal-123',
    recipients: [
      { full_name: 'Jane Customer', email: 'jane@example.com' },
      { full_name: 'Sales Rep', email: 'rep@example.com' },
    ],
  })

  assert.equal(email.subject, 'All recipients signed: Bill of Sale.pdf')
  assert.match(email.text, /Jane Customer <jane@example.com>/)
  assert.match(email.text, /https:\/\/easydrivecanada.com\/admin\/esignature\/prepare\/deal-123/)
})

test('buildESignatureReadinessReport flags missing env and audit table state', () => {
  assert.deepEqual(
    buildESignatureReadinessReport({
      env: {
        SMTP_HOST: 'smtp.example.com',
        SMTP_USER: 'mailer@example.com',
        SMTP_PASS: 'secret',
        SMTP_FROM: 'noreply@example.com',
        NEXT_PUBLIC_SITE_URL: 'https://easydrivecanada.com',
      },
      auditTableReachable: true,
    }),
    {
      ok: true,
      checks: [
        { key: 'audit_table', label: 'E-signature audit table', ok: true, message: 'edc_signature_events is reachable.' },
        { key: 'smtp', label: 'Completion email SMTP', ok: true, message: 'SMTP settings are configured.' },
        { key: 'site_url', label: 'Admin link site URL', ok: true, message: 'NEXT_PUBLIC_SITE_URL is configured.' },
      ],
    }
  )

  const report = buildESignatureReadinessReport({
    env: { SMTP_HOST: '', SMTP_USER: '', SMTP_PASS: '', SMTP_FROM: '', NEXT_PUBLIC_SITE_URL: '' },
    auditTableReachable: false,
  })
  assert.equal(report.ok, false)
  assert.match(report.checks[0].message, /not reachable/)
  assert.match(report.checks[1].message, /SMTP_HOST, SMTP_USER, SMTP_PASS, SMTP_FROM/)
  assert.match(report.checks[2].message, /NEXT_PUBLIC_SITE_URL is missing/)
})
