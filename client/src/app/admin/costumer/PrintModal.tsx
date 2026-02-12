'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

interface PrintModalProps {
  open: boolean
  onClose: () => void
  customerId: string
}

interface CustomerData {
  first_name?: string
  last_name?: string
  phone?: string
  street_address?: string
  city?: string
  province?: string
  postal_code?: string
  country?: string
  date_of_birth?: string
}

interface CreditAppData {
  gender?: string
  residence_ownership?: string
  market_value?: string
  mortgage_amount?: string
  monthly_payment?: string
  employments?: Array<{
    employment_type?: string
    position?: string
    occupation?: string
    years_employed?: string
  }>
  incomes?: Array<{
    income_type?: string
    monthly_gross?: string
    annual_gross?: string
  }>
}

export default function PrintModal({ open, onClose, customerId }: PrintModalProps) {
  const [customer, setCustomer] = useState<CustomerData | null>(null)
  const [creditApp, setCreditApp] = useState<CreditAppData | null>(null)

  useEffect(() => {
    if (!open || !customerId) return

    const fetchData = async () => {
      const { data: cust } = await supabase
        .from('edc_customer')
        .select('*')
        .eq('id', customerId)
        .single()

      const { data: credit } = await supabase
        .from('edc_creditapp')
        .select('*')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      setCustomer(cust)
      setCreditApp(credit)
    }

    fetchData()
  }, [open, customerId])

  useEffect(() => {
    const handleAfterPrint = () => onClose()
    window.addEventListener('afterprint', handleAfterPrint)
    return () => window.removeEventListener('afterprint', handleAfterPrint)
  }, [onClose])

  if (!open) return null

  const employment = creditApp?.employments?.[0]
  const income = creditApp?.incomes?.[0]

  return (
    <div id="print-content" className="p-12 text-[13px] text-black bg-white">
      {/* TOP HEADER */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <img src="/edc-logo.png" alt="EDC" className="h-10 mb-2" />
        </div>

        <div className="text-right text-xs">
          <p className="font-bold">EASYDRIVE CANADA</p>
          <p>4856 Bank St Unit A</p>
          <p>Ottawa ON K1X 1G6 CA</p>
          <p>6138798355</p>
        </div>
      </div>

      {/* TITLE */}
      <div className="text-center mb-6">
        <p className="font-semibold text-base">Credit Consent</p>
        <p className="text-xs mt-1">
          {new Date().toLocaleDateString()}
        </p>
      </div>

      {/* APPLICANT HEADER */}
      <div className="flex justify-between mb-6">
        <div className="text-sm">
          <p className="font-semibold">
            {customer?.first_name} {customer?.last_name}
          </p>
          <p>
            {customer?.street_address}
          </p>
          <p>
            {customer?.city}, {customer?.province} {customer?.postal_code}
          </p>
          <p>{customer?.phone}</p>
          <p>Years at address: ______</p>
        </div>

        <div className="text-sm text-right">
          <p><span className="font-semibold">Gender:</span> {creditApp?.gender}</p>
          <p><span className="font-semibold">DOB:</span> {customer?.date_of_birth}</p>
        </div>
      </div>

      {/* HOME / MORTGAGE */}
      <div className="mb-6">
        <p className="font-semibold mb-2">Home / Mortgage Details</p>
        <div className="grid grid-cols-2 gap-y-1 text-sm">
          <p><span className="font-semibold">Rent / Own:</span> {creditApp?.residence_ownership}</p>
          <p><span className="font-semibold">Lien Holder:</span></p>
          <p><span className="font-semibold">Market Value:</span> {creditApp?.market_value}</p>
          <p><span className="font-semibold">Monthly Payment:</span> {creditApp?.monthly_payment}</p>
          <p><span className="font-semibold">Mortgage Amount:</span> {creditApp?.mortgage_amount}</p>
        </div>
      </div>

      {/* EMPLOYMENT */}
      <div className="mb-6">
        <p className="font-semibold mb-2">Employment Details</p>
        <div className="grid grid-cols-2 gap-y-1 text-sm">
          <p><span className="font-semibold">Type:</span> {employment?.employment_type}</p>
          <p><span className="font-semibold">Position:</span> {employment?.position}</p>
          <p><span className="font-semibold">Occupation:</span> {employment?.occupation}</p>
          <p><span className="font-semibold">Years Employed:</span> {employment?.years_employed}</p>
        </div>
      </div>

      {/* INCOME */}
      <div className="mb-8">
        <p className="font-semibold mb-2">Income Details</p>
        <div className="grid grid-cols-2 gap-y-1 text-sm">
          <p><span className="font-semibold">Source:</span> {income?.income_type}</p>
          <p><span className="font-semibold">Monthly Gross:</span> {income?.monthly_gross}</p>
          <p><span className="font-semibold">Annual Gross:</span> {income?.annual_gross}</p>
        </div>
      </div>

      {/* CONSENT TEXT */}
      <div className="text-xs mb-10">
        EASYDRIVE CANADA consents to do a background check with Equifax.
      </div>

      {/* SIGNATURES */}
      <div className="flex justify-between mt-16 text-xs">
        <div className="text-center">
          <div className="border-t border-black w-64 mb-1" />
          <p>Signature of {customer?.first_name} {customer?.last_name}</p>
        </div>

        <div className="text-center">
          <div className="border-t border-black w-64 mb-1" />
          <p>Authorized by Syed Islam - Owner</p>
        </div>
      </div>

      {/* PRINT STYLES */}
      <style jsx>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #print-content,
          #print-content * {
            visibility: visible;
          }
          #print-content {
            position: absolute;
            inset: 0;
          }
        }
        @media screen {
          #print-content {
            display: none;
          }
        }
      `}</style>
    </div>
  )
}
