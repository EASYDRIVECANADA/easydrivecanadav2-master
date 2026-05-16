import { supabase } from '@/lib/supabaseClient'
import type { BillOfSaleDealerInfo } from './billOfSalePdf'

type DealershipRow = {
  company_logo?: unknown
  company_name?: string | null
  mvda_number?: string | null
  website?: string | null
  street_address?: string | null
  suite_apt?: string | null
  city?: string | null
  province?: string | null
  postal_code?: string | null
  country?: string | null
  phone?: string | null
  email?: string | null
  tax_number?: string | null
  rin?: string | null
}

type UnknownRecord = Record<string, unknown>

const text = (...values: unknown[]) => {
  for (const value of values) {
    const next = String(value ?? '').trim()
    if (next) return next
  }
  return ''
}

const normalizeLogo = (raw: unknown): string => {
  if (!raw) return ''
  if (typeof raw === 'string') return raw.trim()
  if (typeof raw === 'object') {
    const obj = raw as { data_url?: unknown; url?: unknown }
    return text(obj.data_url, obj.url)
  }
  return ''
}

export function normalizeBillOfSaleDealerInfo(row: DealershipRow | null | undefined): BillOfSaleDealerInfo | undefined {
  if (!row) return undefined

  const street = [text(row.street_address), text(row.suite_apt)].filter(Boolean).join(' ')
  const cityLine = [
    text(row.city),
    [text(row.province), text(row.postal_code)].filter(Boolean).join(' '),
    text(row.country) && text(row.country).toUpperCase() !== 'CA' ? text(row.country) : '',
  ].filter(Boolean).join(', ')

  const contactLine = [
    text(row.phone) ? `P: ${text(row.phone)}` : '',
    text(row.email) ? `E: ${text(row.email)}` : '',
  ].filter(Boolean).join(' | ')

  const registrationLine = [
    text(row.tax_number) ? `Tax: ${text(row.tax_number)}` : '',
    text(row.rin) ? `RIN: ${text(row.rin)}` : '',
    text(row.mvda_number) ? `MVDA: ${text(row.mvda_number)}` : '',
  ].filter(Boolean).join(' | ')

  return {
    logoDataUrl: normalizeLogo(row.company_logo),
    companyName: text(row.company_name),
    addressLines: [street, cityLine].filter(Boolean),
    contactLine,
    website: text(row.website),
    registrationLine,
  }
}

const readAdminSession = (): { email?: string; user_id?: string } | null => {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem('edc_admin_session')
    return raw ? JSON.parse(raw) as { email?: string; user_id?: string } : null
  } catch {
    return null
  }
}

const asRecord = (value: unknown): UnknownRecord => {
  return value && typeof value === 'object' ? value as UnknownRecord : {}
}

const at = (value: unknown, key: string): unknown => asRecord(value)[key]

const dealUserId = (deal: unknown): string => {
  const d = asRecord(deal)
  const customer = at(d, 'customer')
  const customers = Array.isArray(at(d, 'customers')) ? at(d, 'customers') as unknown[] : []
  const submission = at(d, 'submission')
  const vehicles = Array.isArray(at(d, 'vehicles')) ? at(d, 'vehicles') as unknown[] : []
  const worksheet = at(d, 'worksheet')
  const delivery = at(d, 'delivery')

  return text(
    at(d, 'user_id'),
    at(customer, 'user_id'),
    at(customers[0], 'user_id'),
    at(submission, 'user_id'),
    at(vehicles[0], 'user_id'),
    at(worksheet, 'user_id'),
    at(delivery, 'user_id')
  )
}

async function resolveDealershipUserId(deal?: unknown): Promise<string> {
  const session = readAdminSession()
  const directUserId = text(session?.user_id, dealUserId(deal))
  if (directUserId) return directUserId

  const email = text(session?.email).toLowerCase()
  if (!email) return ''

  try {
    const { data } = await supabase
      .from('edc_account_verifications')
      .select('id')
      .eq('email', email)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    return text((data as { id?: unknown } | null)?.id)
  } catch {
    return ''
  }
}

export async function fetchBillOfSaleDealerInfo(deal?: unknown): Promise<BillOfSaleDealerInfo | undefined> {
  const userId = await resolveDealershipUserId(deal)
  if (!userId) return undefined

  try {
    const { data, error } = await supabase
      .from('dealership')
      .select('company_logo, company_name, mvda_number, website, street_address, suite_apt, city, province, postal_code, country, phone, email, tax_number, rin')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (error) return undefined
    return normalizeBillOfSaleDealerInfo(data as DealershipRow | null)
  } catch {
    return undefined
  }
}
