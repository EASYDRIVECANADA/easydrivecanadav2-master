import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const clean = (value: unknown) => String(value ?? '').trim()

const toNumberOrNull = (value: unknown) => {
  const raw = clean(value).replace(/[$,\s]/g, '')
  if (!raw) return null
  const num = Number(raw)
  return Number.isFinite(num) ? num : null
}

const toMonthlyIncome = (value: unknown) => {
  const num = toNumberOrNull(value)
  return num === null ? null : Math.round(num)
}

const buildMessage = (fields: Array<[string, unknown]>) =>
  fields
    .map(([label, value]) => {
      const text = typeof value === 'boolean' ? (value ? 'Yes' : 'No') : clean(value)
      return text ? `${label}: ${text}` : ''
    })
    .filter(Boolean)
    .join('\n')

const isExternalLeadSource = (source: string) =>
  ['easydrivefinance.ca', 'easydriveinsurance.ca', 'insurance.easydrivecanada.com'].includes(source)

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })

    const source = clean(body?.source || 'unknown')
    const webhookSecret = clean(process.env.LEADS_WEBHOOK_SECRET)
    if (webhookSecret && isExternalLeadSource(source)) {
      const incomingSecret = clean(request.headers.get('x-edc-leads-secret') || body?.secret)
      if (incomingSecret !== webhookSecret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    // Map both contact_form and financing_application payloads into edc_leads columns
    const insert: Record<string, any> = {
      source,
      email: clean(body?.email).toLowerCase() || null,
      phone: clean(body?.phone) || null,
      message: clean(body?.message) || null,
      created_at: new Date().toISOString(),
    }

    if (source === 'contact_form') {
      const name = clean(body?.name)
      insert.first_name = name.split(' ')[0] || null
      insert.last_name = name.split(' ').slice(1).join(' ') || null
      insert.subject = clean(body?.subject) || null
    }

    if (source === 'financing_application') {
      const annualIncome = toNumberOrNull(body?.annualIncome)
      insert.first_name = clean(body?.firstName) || null
      insert.last_name = clean(body?.lastName) || null
      insert.date_of_birth = clean(body?.dateOfBirth) || null
      insert.monthly_income = annualIncome === null ? null : Math.round(annualIncome / 12)
      insert.street_address = clean(body?.streetAddress) || null
      insert.city = clean(body?.city) || null
      insert.province = clean(body?.province) || null
      insert.postal_code = clean(body?.postalCode) || null
      insert.employment_status = clean(body?.employmentStatus) || null
      insert.down_payment = toNumberOrNull(body?.downPayment)
      insert.credit_score = clean(body?.creditProfile) || null
    }

    if (source === 'easydrivefinance.ca') {
      insert.first_name = clean(body?.firstName) || null
      insert.last_name = clean(body?.lastName) || null
      insert.date_of_birth = clean(body?.dob) || null
      insert.monthly_income = toMonthlyIncome(body?.income)
      insert.street_address = clean(body?.addressStreet) || null
      insert.suite_unit = clean(body?.addressUnit) || null
      insert.city = clean(body?.addressCity) || null
      insert.province = clean(body?.addressProvince) || null
      insert.postal_code = clean(body?.addressPostalCode) || null
      insert.employment_status = clean(body?.employment) || null
      insert.down_payment = toNumberOrNull(body?.downPayment)
      insert.credit_score = clean(body?.credit) || null
      insert.message = buildMessage([
        ['Address', body?.address],
        ['Canadian resident', body?.isCanadianResident],
        ['Time at address', body?.addressDuration],
        ['Employer', body?.employerName],
        ['Time employed', body?.employerDuration],
        ['Housing', body?.housing],
        ['Referrer', body?.referrer],
      ]) || null
    }

    if (source === 'easydriveinsurance.ca' || source === 'insurance.easydrivecanada.com') {
      insert.first_name = clean(body?.firstName) || null
      insert.last_name = clean(body?.lastName) || null
      insert.street_address = clean(body?.streetAddress) || null
      insert.suite_unit = clean(body?.unitApartment) || null
      insert.city = clean(body?.city) || null
      insert.province = clean(body?.province) || null
      insert.postal_code = clean(body?.postalCode) || null
      insert.vehicle_interest = [body?.vehicleYear, body?.vehicleMake, body?.vehicleModel]
        .map(clean)
        .filter(Boolean)
        .join(' ') || null
      insert.message = buildMessage([
        ['License number', body?.licenseNumber],
        ['Address', body?.address],
        ['VIN', body?.vin],
        ['Canadian resident address', body?.canadianResidentAddress],
        ['Consent to contact', body?.consentContact],
        ['Consent accurate', body?.consentAccurate],
        ['Referrer', body?.referrer],
      ]) || null
    }

    const { error } = await supabase.from('edc_leads').insert(insert)

    if (error) {
      console.error('leads insert error:', error)
      return NextResponse.json({ error: 'Failed to save lead' }, { status: 500 })
    }

    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (err) {
    console.error('leads route error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
