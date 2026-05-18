/* eslint-disable @typescript-eslint/no-explicit-any */
import { randomBytes } from 'crypto'
import { jsPDF } from 'jspdf'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import { buildBillOfSaleCustomerFields } from '@/app/admin/sales/deals/new/billOfSaleCustomers'
import { renderBillOfSalePdf, type BillOfSaleData, type BillOfSaleDealerInfo } from '@/app/admin/sales/deals/new/billOfSalePdf'
import { buildBillOfSaleSettlement } from '@/app/admin/sales/deals/new/billOfSaleSettlement'
import {
  buildDocumentPackagePatch,
  buildPackageLink,
  getCheckoutBillOfSaleSignature,
  parseJsonLoose,
  sanitizePackageFileName,
  text,
} from '@/lib/purchaseDocumentPackage.mjs'

const DOCUMENT_BUCKET = 'purchase-documents'
const CARFAX_BUCKET = 'Carfax'

type AnyRow = Record<string, any>

export type PurchaseDocumentPackageResult = {
  submissionId: string
  dealId: string
  token: string
  packageLink: string
  bosPath: string
  carfaxFiles: Array<{ name: string; path: string }>
}

export type PurchaseDocumentPackageView = {
  token: string
  dealId: string
  createdAt: string
  vehicleLabel: string
  customerName: string
  customerEmail: string
  bos: { name: string; path: string; signedUrl: string }
  carfaxFiles: Array<{ name: string; path: string; signedUrl: string }>
}

function getSupabaseServerConfig() {
  const supabaseUrl = String(process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '')
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseKey) throw new Error('Supabase server not configured')
  return { supabaseUrl, supabaseKey }
}

export function getPackageBaseUrl() {
  return String(
    process.env.NEXT_PUBLIC_APP_ORIGIN ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    'https://easydrivecanada.com'
  ).replace(/\/+$/, '')
}

export function getSupabaseServiceClient(): SupabaseClient {
  const { supabaseUrl, supabaseKey } = getSupabaseServerConfig()
  return createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}

function parseItems(value: unknown): any[] {
  if (Array.isArray(value)) return value
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  return []
}

function normalizeWorksheet(row: AnyRow | null) {
  if (!row) return null
  const next = { ...row }
  for (const key of ['fees', 'accessories', 'warranties', 'insurances', 'payments']) {
    next[key] = parseItems(next[key])
  }
  return next
}

async function fetchDealForPackage(supabase: SupabaseClient, dealId: string) {
  const [customersRes, vehiclesRes, worksheetRes, disclosuresRes, deliveryRes, submissionRes] = await Promise.all([
    supabase.from('edc_deals_customers').select('*').eq('deal_id', dealId).order('id', { ascending: true }),
    supabase.from('edc_deals_vehicles').select('*').eq('deal_id', dealId).order('created_at', { ascending: true }),
    supabase.from('edc_deals_worksheet').select('*').eq('deal_id', dealId).limit(1),
    supabase.from('edc_deals_disclosures').select('*').eq('deal_id', dealId).limit(1),
    supabase.from('edc_deals_delivery').select('*').eq('deal_id', dealId).limit(1),
    supabase.from('edc_purchase_submissions').select('*').eq('deal_id', dealId).limit(1),
  ])

  return {
    customers: customersRes.data || [],
    customer: customersRes.data?.[0] || null,
    vehicles: vehiclesRes.data || [],
    worksheet: normalizeWorksheet(worksheetRes.data?.[0] || null),
    disclosures: disclosuresRes.data?.[0] || null,
    delivery: deliveryRes.data?.[0] || null,
    submission: submissionRes.data?.[0] || null,
  }
}

function normalizeDealerInfo(row: AnyRow | null): BillOfSaleDealerInfo | undefined {
  if (!row) return undefined
  const logo = (() => {
    const raw = row.company_logo
    if (!raw) return ''
    if (typeof raw === 'string') return raw.trim()
    if (typeof raw === 'object') return text(raw.data_url, raw.url)
    return ''
  })()
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
    logoDataUrl: logo,
    companyName: text(row.company_name),
    addressLines: [street, cityLine].filter(Boolean),
    contactLine,
    website: text(row.website),
    registrationLine,
  }
}

async function fetchDealerInfo(supabase: SupabaseClient, deal: AnyRow): Promise<BillOfSaleDealerInfo | undefined> {
  const userId = text(
    deal?.customer?.user_id,
    deal?.customers?.[0]?.user_id,
    deal?.submission?.user_id,
    deal?.vehicles?.[0]?.user_id,
    deal?.worksheet?.user_id,
    deal?.delivery?.user_id
  )
  if (!userId) return undefined

  const { data } = await supabase
    .from('dealership')
    .select('company_logo, company_name, mvda_number, website, street_address, suite_apt, city, province, postal_code, country, phone, email, tax_number, rin')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  return normalizeDealerInfo((data as AnyRow | null) || null)
}

function buildWarrantyData(deal: AnyRow, worksheet: AnyRow, submission: AnyRow) {
  const warranties = parseItems(worksheet?.warranties)
  if (warranties.length > 0) {
    const totalCost = warranties.reduce((sum, item) => sum + Number(item?.amount || 0), 0)
    const orderData = parseJsonLoose(submission?.order_data)
    const selectedWarranty = orderData?.warranty || null
    return {
      has_extended: true,
      description: warranties.map((item) => [text(item?.name), text(item?.desc)].filter(Boolean).join('\n')).filter(Boolean).join('\n\n'),
      duration: text(warranties.find((item) => item?.duration)?.duration, selectedWarranty?.termLabel),
      distance: text(warranties.find((item) => item?.distance)?.distance),
      cost: totalCost > 0 ? String(totalCost) : '',
      basePrice: selectedWarranty?.baseTotal ? String(selectedWarranty.baseTotal) : '',
      addOns: Array.isArray(selectedWarranty?.addOns) ? selectedWarranty.addOns : [],
    }
  }

  const orderData = parseJsonLoose(submission?.order_data)
  const selectedWarranty = orderData?.warranty || null
  const warrantyName = text(submission?.warranty_name, selectedWarranty?.planName)
  const warrantyTotal = Number(submission?.warranty_total ?? selectedWarranty?.total ?? 0)
  if (!submission?.warrantyDeclined && warrantyName && warrantyTotal > 0) {
    return {
      has_extended: true,
      description: warrantyName,
      duration: text(selectedWarranty?.termLabel),
      distance: '',
      cost: String(warrantyTotal),
      basePrice: selectedWarranty?.baseTotal ? String(selectedWarranty.baseTotal) : '',
      addOns: Array.isArray(selectedWarranty?.addOns) ? selectedWarranty.addOns : [],
    }
  }

  return null
}

async function buildBillOfSaleDataForPackage(supabase: SupabaseClient, deal: AnyRow, dealId: string): Promise<BillOfSaleData> {
  const customerFields = buildBillOfSaleCustomerFields(deal)
  const vRaw = deal?.vehicles?.[0] || {}
  const sv = vRaw.selectedVehicle || vRaw
  const submission = deal?.submission || {}
  const worksheet = deal?.worksheet || {}
  const delivery = deal?.delivery || {}
  const disclosures = deal?.disclosures || {}
  const vehiclePrice = Number(submission?.vehicle_price || sv.selected_price || sv.price || 0)
  const settlement = buildBillOfSaleSettlement(worksheet, vehiclePrice)
  const dealer = await fetchDealerInfo(supabase, deal)
  const checkoutSignature = getCheckoutBillOfSaleSignature(submission?.order_data)
  const warrantyData = buildWarrantyData(deal, worksheet, submission)
  const approvedAt = text(submission?.approved_at, delivery?.delivery_date)

  return {
    dealDate: approvedAt ? new Date(approvedAt).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' }) : '',
    invoiceNumber: dealId,
    dealer,
    ...customerFields,
    ...checkoutSignature,
    email: text(customerFields.email, submission?.customer_email).toLowerCase(),
    stockNumber: text(sv.selected_stock_number, submission?.vehicle_stock_number),
    year: text(sv.selected_year, submission?.vehicle_year),
    make: text(sv.selected_make, submission?.vehicle_make),
    model: text(sv.selected_model, submission?.vehicle_model),
    trim: text(sv.selected_trim, submission?.vehicle_trim),
    colour: text(sv.selected_exterior_color, sv.exterior_color),
    keyNumber: '',
    vin: text(sv.selected_vin, submission?.vehicle_vin),
    odometerStatus: text(sv.selected_status, sv.status, 'Used'),
    odometer: text(sv.selected_odometer, sv.odometer)
      ? `${Number(text(sv.selected_odometer, sv.odometer)).toLocaleString()} ${text(sv.selected_odometer_unit, sv.odometer_unit, 'kms')}`
      : '',
    serviceDate: '',
    deliveryDate: text(delivery?.delivery_date),
    ...settlement,
    extendedWarranty: warrantyData ? '' : 'DECLINED',
    extendedWarrantyData: warrantyData,
    commentsHtml: text(disclosures?.disclosures_html),
    salesperson: text(delivery?.salesperson),
    salespersonRegNo: '4782496',
    acceptorName: text(delivery?.approved_by, 'Syed Islam'),
    acceptorRegNo: '4782496',
  }
}

async function listCarfaxFiles(supabase: SupabaseClient, vehicleId: string): Promise<Array<{ name: string; path: string }>> {
  if (!vehicleId) return []
  const { data, error } = await supabase.storage
    .from(CARFAX_BUCKET)
    .list(vehicleId, { limit: 100, sortBy: { column: 'name', order: 'asc' } })
  if (error || !Array.isArray(data)) return []
  return data
    .filter((file) => !!file?.name && !String(file.name).endsWith('/'))
    .map((file) => ({ name: String(file.name), path: `${vehicleId}/${file.name}` }))
}

function objectPathFromStoredPath(path: string, bucket: string) {
  const prefix = `${bucket}/`
  return path.startsWith(prefix) ? path.slice(prefix.length) : path
}

export async function generatePurchaseDocumentPackage(submissionId: string): Promise<PurchaseDocumentPackageResult> {
  const supabase = getSupabaseServiceClient()
  const { data: submission, error } = await supabase
    .from('edc_purchase_submissions')
    .select('*')
    .eq('id', submissionId)
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(error.message || 'Failed to load purchase submission')
  if (!submission) throw new Error('Purchase submission not found')

  const dealId = text((submission as AnyRow).deal_id)
  if (!dealId) throw new Error('Purchase submission has no approved deal')

  const deal = await fetchDealForPackage(supabase, dealId)
  const billData = await buildBillOfSaleDataForPackage(supabase, deal, dealId)
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' })
  renderBillOfSalePdf(doc, billData, { pageStart: 1, totalPages: 3 })

  const arrayBuffer = doc.output('arraybuffer')
  const pdfBuffer = Buffer.from(arrayBuffer)
  const fileName = sanitizePackageFileName(`Bill_of_Sale_${dealId}.pdf`)
  const objectPath = `${submissionId}/${fileName}`
  const storedBosPath = `${DOCUMENT_BUCKET}/${objectPath}`

  const upload = await supabase.storage
    .from(DOCUMENT_BUCKET)
    .upload(objectPath, pdfBuffer, {
      contentType: 'application/pdf',
      upsert: true,
    })
  if (upload.error) throw new Error(`Failed to store BOS package PDF: ${upload.error.message}`)

  const token = text((submission as AnyRow).document_package_token) || randomBytes(24).toString('hex')
  const createdAt = new Date().toISOString()
  const carfaxFiles = await listCarfaxFiles(supabase, text((submission as AnyRow).vehicle_id))
  const patch = buildDocumentPackagePatch({ token, bosPath: storedBosPath, carfaxFiles, createdAt })

  const patchRes = await supabase
    .from('edc_purchase_submissions')
    .update(patch)
    .eq('id', submissionId)
    .select('id')
    .limit(1)
  if (patchRes.error) throw new Error(`Failed to save document package metadata: ${patchRes.error.message}`)

  return {
    submissionId,
    dealId,
    token,
    packageLink: buildPackageLink(getPackageBaseUrl(), token),
    bosPath: storedBosPath,
    carfaxFiles,
  }
}

export async function getPurchaseDocumentPackageByToken(token: string): Promise<PurchaseDocumentPackageView | null> {
  const normalizedToken = text(token)
  if (!normalizedToken) return null

  const supabase = getSupabaseServiceClient()
  const { data: submission, error } = await supabase
    .from('edc_purchase_submissions')
    .select('id, deal_id, customer_first_name, customer_last_name, customer_email, vehicle_year, vehicle_make, vehicle_model, vehicle_trim, document_package_token, document_package_created_at, bos_pdf_url, carfax_files, document_package_status')
    .eq('document_package_token', normalizedToken)
    .limit(1)
    .maybeSingle()

  if (error || !submission) return null
  const row = submission as AnyRow
  if (text(row.document_package_status) !== 'ready') return null

  const bosStoredPath = text(row.bos_pdf_url)
  const bosObjectPath = objectPathFromStoredPath(bosStoredPath, DOCUMENT_BUCKET)
  const signedBos = await supabase.storage.from(DOCUMENT_BUCKET).createSignedUrl(bosObjectPath, 60 * 60)
  if (signedBos.error || !signedBos.data?.signedUrl) return null

  const carfaxRows = Array.isArray(row.carfax_files) ? row.carfax_files : parseItems(row.carfax_files)
  const carfaxFiles = await Promise.all(carfaxRows.map(async (file: AnyRow) => {
    const filePath = text(file.path)
    const signed = await supabase.storage.from(CARFAX_BUCKET).createSignedUrl(filePath, 60 * 60)
    return {
      name: text(file.name, filePath.split('/').pop()),
      path: filePath,
      signedUrl: signed.data?.signedUrl || '',
    }
  }))

  return {
    token: normalizedToken,
    dealId: text(row.deal_id),
    createdAt: text(row.document_package_created_at),
    vehicleLabel: [row.vehicle_year, row.vehicle_make, row.vehicle_model, row.vehicle_trim].map((v) => text(v)).filter(Boolean).join(' '),
    customerName: [row.customer_first_name, row.customer_last_name].map((v) => text(v)).filter(Boolean).join(' '),
    customerEmail: text(row.customer_email).toLowerCase(),
    bos: {
      name: bosObjectPath.split('/').pop() || 'Bill_of_Sale.pdf',
      path: bosStoredPath,
      signedUrl: signedBos.data.signedUrl,
    },
    carfaxFiles: carfaxFiles.filter((file) => file.path && file.signedUrl),
  }
}

export async function getPurchaseDocumentPackageByDealId(dealId: string): Promise<PurchaseDocumentPackageView | null> {
  const supabase = getSupabaseServiceClient()
  const { data } = await supabase
    .from('edc_purchase_submissions')
    .select('document_package_token')
    .eq('deal_id', dealId)
    .limit(1)
    .maybeSingle()
  const token = text((data as AnyRow | null)?.document_package_token)
  return token ? getPurchaseDocumentPackageByToken(token) : null
}
