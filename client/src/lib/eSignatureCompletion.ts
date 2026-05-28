export type SignatureRecipient = {
  email?: string | null
  full_name?: string | null
  signed_at?: string | null
  status?: string | null
}

export type SignatureAuditEvent = {
  action?: string | null
}

type ReadinessEnvKey = 'SMTP_HOST' | 'SMTP_USER' | 'SMTP_PASS' | 'SMTP_FROM' | 'NEXT_PUBLIC_SITE_URL'

export type CompletionEmailInput = {
  envelopeId: string
  documentTitle: string
  adminUrl: string
  recipients: SignatureRecipient[]
}

export type ESignatureReadinessCheck = {
  key: 'audit_table' | 'smtp' | 'site_url'
  label: string
  ok: boolean
  message: string
}

export type ESignatureReadinessReport = {
  ok: boolean
  checks: ESignatureReadinessCheck[]
}

const normalizeEmail = (email: unknown) => String(email || '').trim().toLowerCase()
const hasValue = (value: unknown) => String(value || '').trim().length > 0

export function collectCompletionNotificationRecipients(ownerEmail: unknown, easyDriveEmail = 'info@easydrivecanada.com'): string[] {
  const recipients = [normalizeEmail(ownerEmail), normalizeEmail(easyDriveEmail)]
  return Array.from(new Set(recipients.filter(Boolean)))
}

export function isSignatureRowCompleted(row: SignatureRecipient): boolean {
  const status = String(row?.status || '').trim().toLowerCase()
  return Boolean(row?.signed_at || status === 'completed' || status === 'signed')
}

export function shouldSendCompletionNotification(rows: SignatureRecipient[], events: SignatureAuditEvent[]): boolean {
  const allComplete = rows.length > 0 && rows.every(isSignatureRowCompleted)
  const alreadySent = events.some((event) => String(event?.action || '') === 'Completion Notification Sent')
  return allComplete && !alreadySent
}

export function buildCompletionNotificationEmail(input: CompletionEmailInput) {
  const title = input.documentTitle || 'Document'
  const recipients = input.recipients
    .map((recipient) => {
      const name = String(recipient.full_name || '').trim()
      const email = String(recipient.email || '').trim()
      return name && email ? `${name} <${email}>` : name || email
    })
    .filter(Boolean)

  const text = [
    `All recipients have signed ${title}.`,
    '',
    `Envelope ID: ${input.envelopeId}`,
    `Recipients: ${recipients.join(', ') || 'N/A'}`,
    '',
    `View the completed envelope: ${input.adminUrl}`,
  ].join('\n')

  const htmlRecipients = recipients.map((recipient) => `<li>${escapeHtml(recipient)}</li>`).join('')
  const html = `
    <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.5;">
      <h2 style="margin: 0 0 12px;">All recipients have signed</h2>
      <p style="margin: 0 0 16px;">${escapeHtml(title)} is complete.</p>
      <p style="margin: 0 0 8px;"><strong>Envelope ID:</strong> ${escapeHtml(input.envelopeId)}</p>
      <p style="margin: 0 0 8px;"><strong>Recipients:</strong></p>
      <ul style="margin: 0 0 16px; padding-left: 20px;">${htmlRecipients || '<li>N/A</li>'}</ul>
      <p style="margin: 0;"><a href="${escapeAttribute(input.adminUrl)}">View completed envelope</a></p>
    </div>
  `

  return {
    subject: `All recipients signed: ${title}`,
    text,
    html,
  }
}

export function buildESignatureReadinessReport({
  env,
  auditTableReachable,
}: {
  env: Partial<Record<ReadinessEnvKey, unknown>>
  auditTableReachable: boolean
}): ESignatureReadinessReport {
  const missingSmtp = (['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM'] as ReadinessEnvKey[])
    .filter((key) => !hasValue(env[key]))
  const siteUrlOk = hasValue(env.NEXT_PUBLIC_SITE_URL)

  const checks: ESignatureReadinessCheck[] = [
    {
      key: 'audit_table',
      label: 'E-signature audit table',
      ok: auditTableReachable,
      message: auditTableReachable
        ? 'edc_signature_events is reachable.'
        : 'edc_signature_events is not reachable. Apply the Supabase audit table SQL before client sign-off.',
    },
    {
      key: 'smtp',
      label: 'Completion email SMTP',
      ok: missingSmtp.length === 0,
      message: missingSmtp.length === 0
        ? 'SMTP settings are configured.'
        : `Missing SMTP settings: ${missingSmtp.join(', ')}. Signing will still work, but completion email will be logged as skipped.`,
    },
    {
      key: 'site_url',
      label: 'Admin link site URL',
      ok: siteUrlOk,
      message: siteUrlOk
        ? 'NEXT_PUBLIC_SITE_URL is configured.'
        : 'NEXT_PUBLIC_SITE_URL is missing. Completion emails may not include the production admin link.',
    },
  ]

  return {
    ok: checks.every((check) => check.ok),
    checks,
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case '&': return '&amp;'
      case '<': return '&lt;'
      case '>': return '&gt;'
      case '"': return '&quot;'
      case "'": return '&#39;'
      default: return char
    }
  })
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replace(/`/g, '&#96;')
}
