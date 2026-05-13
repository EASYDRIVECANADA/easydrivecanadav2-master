import type { BillOfSaleData } from './billOfSalePdf'

type CustomerRow = Record<string, unknown>

export type BillOfSaleCustomerFields = Pick<
  BillOfSaleData,
  | 'fullName'
  | 'phone'
  | 'mobile'
  | 'email'
  | 'address'
  | 'city'
  | 'province'
  | 'postalCode'
  | 'driversLicense'
  | 'insuranceCompany'
  | 'policyNumber'
  | 'policyExpiry'
  | 'purchaserName'
  | 'purchaserSignatureB64'
  | 'additionalPurchasers'
>

function text(...values: unknown[]): string {
  for (const value of values) {
    const s = String(value ?? '').trim()
    if (s) return s
  }
  return ''
}

function fullName(c: CustomerRow): string {
  return (
    [c.firstname, c.middlename, c.lastname].map((v) => text(v)).filter(Boolean).join(' ') ||
    [c.first_name, c.middle_name, c.last_name].map((v) => text(v)).filter(Boolean).join(' ') ||
    text(c.legalname, c.legal_name, c.displayname, c.display_name, c.companyname, c.company_name)
  )
}

function mapCustomer(c: CustomerRow) {
  return {
    fullName: fullName(c),
    phone: text(c.phone),
    mobile: text(c.mobile),
    email: text(c.email).toLowerCase(),
    address: text(c.street_address, c.streetaddress),
    city: text(c.city),
    province: text(c.province) || 'ON',
    postalCode: text(c.postal_code, c.postalcode),
    driversLicense: text(c.drivers_license, c.driverslicense),
    insuranceCompany: text(c.insurance_company, c.insurancecompany),
    policyNumber: text(c.policy_number, c.policynumber),
    policyExpiry: text(c.policy_expiry, c.policyexpiry),
  }
}

export function buildBillOfSaleCustomerFields(deal: unknown): BillOfSaleCustomerFields {
  const dealObj = deal && typeof deal === 'object' ? deal as Record<string, unknown> : {}
  const rawCustomers = Array.isArray(dealObj.customers)
    ? dealObj.customers as CustomerRow[]
    : []
  const customers = rawCustomers.length > 0
    ? rawCustomers
    : dealObj.customer && typeof dealObj.customer === 'object'
      ? [dealObj.customer as CustomerRow]
      : []

  const primary = customers[0] || {}
  const primaryMapped = mapCustomer(primary)
  const additionalPurchasers = customers.slice(1).map(mapCustomer).filter((c) => c.fullName)

  return {
    ...primaryMapped,
    purchaserName: primaryMapped.fullName,
    purchaserSignatureB64: text(primary.signature) || undefined,
    additionalPurchasers,
  }
}
