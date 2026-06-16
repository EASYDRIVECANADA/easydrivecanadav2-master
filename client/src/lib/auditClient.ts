import type { AuditEventInput } from './auditEvents'

type StorageLike = {
  getItem: (key: string) => string | null
}

const clean = (value: unknown) => String(value ?? '').trim()
const cleanEmail = (value: unknown) => clean(value).toLowerCase()

export function readAuditActorFromStorage(storage: StorageLike | null | undefined) {
  if (!storage) return { actor_name: '', actor_email: '' }

  try {
    const raw = storage.getItem('edc_admin_session')
    if (raw) {
      const parsed = JSON.parse(raw)
      const actorName = clean(parsed?.name || [parsed?.first_name, parsed?.last_name].filter(Boolean).join(' '))
      const actorEmail = cleanEmail(parsed?.email || parsed?.user_email)
      if (actorName || actorEmail) return { actor_name: actorName, actor_email: actorEmail }
    }
  } catch {
    // Fall through to older session keys.
  }

  const fallbackEmail = cleanEmail(
    storage.getItem('edc_user_email') ||
    storage.getItem('edc_admin_email') ||
    storage.getItem('edc_email')
  )

  return { actor_name: '', actor_email: fallbackEmail }
}

export function getCurrentAuditActor() {
  if (typeof window === 'undefined') return { actor_name: '', actor_email: '' }
  return readAuditActorFromStorage(window.localStorage)
}

export async function recordSystemAuditEvent(input: AuditEventInput) {
  try {
    const actor = getCurrentAuditActor()
    await fetch('/api/audit/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...input,
        actor_name: input.actor_name || actor.actor_name,
        actor_email: input.actor_email || actor.actor_email,
      }),
    })
  } catch {
    // Audit logging must not block the user's primary workflow.
  }
}
