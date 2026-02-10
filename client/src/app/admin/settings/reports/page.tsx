'use client'

import { useMemo, useState } from 'react'

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={
        checked
          ? 'h-4 w-9 rounded-full bg-[#118df0] relative border border-[#118df0]'
          : 'h-4 w-9 rounded-full bg-white relative border border-gray-300'
      }
      aria-pressed={checked}
    >
      <span
        className={
          checked
            ? 'absolute right-0.5 top-0.5 h-3 w-3 rounded-full bg-white'
            : 'absolute left-0.5 top-0.5 h-3 w-3 rounded-full bg-gray-400'
        }
      />
    </button>
  )
}

function EditorBlock({
  title,
  subtitle,
  value,
  onChange,
  height = 160,
}: {
  title: string
  subtitle?: string
  value: string
  onChange: (v: string) => void
  height?: number
}) {
  const toolbarButtons = useMemo(
    () => [
      { label: 'B' },
      { label: 'I' },
      { label: 'U' },
      { label: '•' },
      { label: '1.' },
      { label: '⟲' },
      { label: '⟲⟲' },
      { label: '⛶' },
    ],
    []
  )

  return (
    <div className="mt-5">
      <div className="text-[11px] font-semibold text-gray-600">{title}</div>
      {subtitle ? <div className="mt-1 text-[10px] text-gray-500">{subtitle}</div> : null}
      <div className="mt-2 border border-gray-300">
        <div className="h-7 px-2 flex items-center gap-1 border-b border-gray-200 bg-gray-50">
          {toolbarButtons.map((b) => (
            <button
              key={b.label}
              type="button"
              className="h-5 min-w-5 px-1 border border-gray-200 bg-white text-[10px] text-gray-700"
              tabIndex={-1}
            >
              {b.label}
            </button>
          ))}
        </div>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{ height }}
          className="w-full p-3 text-xs text-gray-800 outline-none resize-none"
          placeholder="Type the text you want to display in this section"
        />
      </div>
    </div>
  )
}

export default function SettingsReportsPage() {
  const [showDealDateOnBos, setShowDealDateOnBos] = useState(true)
  const [showSalespersonOnBos, setShowSalespersonOnBos] = useState(true)
  const [showAcceptedByOnBos, setShowAcceptedByOnBos] = useState(true)
  const [showOmvicDisclosure, setShowOmvicDisclosure] = useState(true)
  const [showVehicleCertification, setShowVehicleCertification] = useState(true)

  const [creditCardTerms, setCreditCardTerms] = useState('')
  const [disclosuresOnBos, setDisclosuresOnBos] = useState(
    'AS-IS VEHICLE SALE CLAUSE\n\nVehicle is sold\n\nThe buyer hereby acknowledges and agrees that the vehicle is sold “AS IS” with no warranties, express or implied, except as expressly stated herein. Buyer has inspected the vehicle and accepts it in its current condition.\n\nBuyer Release\n\nBuyer releases and forever discharges Easy Drive Canada and its agents, servants and assigns from any and all claims, demands, actions or causes of action arising out of the purchase and ownership of the vehicle.\n'
  )
  const [newCarBosText, setNewCarBosText] = useState('')
  const [usedCarBosText, setUsedCarBosText] = useState('')
  const [waiverOfLegalDescription, setWaiverOfLegalDescription] = useState('')
  const [retailLegalDescription, setRetailLegalDescription] = useState('')
  const [wholesaleLegalDescription, setWholesaleLegalDescription] = useState('')
  const [showRetailServiceInvoiceNote, setShowRetailServiceInvoiceNote] = useState(false)

  return (
    <div className="pb-6">
      <div className="text-[11px] font-semibold text-gray-600">BILL OF SALE</div>
      <div className="mt-2 border-t border-gray-200" />

      <div className="mt-4 space-y-3">
        <div className="flex items-center justify-between gap-4">
          <div className="text-[11px] text-gray-700">Display deal date on bill of sale?</div>
          <Toggle checked={showDealDateOnBos} onChange={setShowDealDateOnBos} />
        </div>
        <div className="flex items-center justify-between gap-4">
          <div className="text-[11px] text-gray-700">Show salesperson on bill of sale?</div>
          <Toggle checked={showSalespersonOnBos} onChange={setShowSalespersonOnBos} />
        </div>
        <div className="flex items-center justify-between gap-4">
          <div className="text-[11px] text-gray-700">Show accepted by on bill of sale?</div>
          <Toggle checked={showAcceptedByOnBos} onChange={setShowAcceptedByOnBos} />
        </div>
        <div className="flex items-center justify-between gap-4">
          <div className="text-[11px] text-gray-700">Show OMVIC disclosure on bill of sale?</div>
          <Toggle checked={showOmvicDisclosure} onChange={setShowOmvicDisclosure} />
        </div>
        <div className="flex items-center justify-between gap-4">
          <div className="text-[11px] text-gray-700">Show vehicle certification on bill of sale?</div>
          <Toggle checked={showVehicleCertification} onChange={setShowVehicleCertification} />
        </div>
      </div>

      <div className="mt-4 border-t border-gray-200" />

      <EditorBlock
        title="Credit Card Terms"
        subtitle="If text is supplied it will be added to the bill of sale and contract terms."
        value={creditCardTerms}
        onChange={setCreditCardTerms}
        height={90}
      />

      <EditorBlock
        title="Disclosures Form, As-Is/Used Car Description"
        subtitle="This content will be displayed in the disclosures section."
        value={disclosuresOnBos}
        onChange={setDisclosuresOnBos}
        height={180}
      />

      <EditorBlock
        title="New Car Bill of Sale, Additional Description"
        subtitle="Optional additional description for new car bill of sale."
        value={newCarBosText}
        onChange={setNewCarBosText}
        height={150}
      />

      <EditorBlock
        title="Used Car Bill of Sale, Additional Description"
        subtitle="Optional additional description for used car bill of sale."
        value={usedCarBosText}
        onChange={setUsedCarBosText}
        height={150}
      />

      <EditorBlock
        title="Waiver of Legal Description"
        subtitle="This paragraph can be displayed in the legal description section."
        value={waiverOfLegalDescription}
        onChange={setWaiverOfLegalDescription}
        height={120}
      />

      <EditorBlock
        title="Retail Legal Description"
        subtitle="This paragraph can be displayed in the legal description section for retail deals."
        value={retailLegalDescription}
        onChange={setRetailLegalDescription}
        height={120}
      />

      <EditorBlock
        title="Wholesale Legal Description"
        subtitle="This paragraph can be displayed in the legal description section for wholesale deals."
        value={wholesaleLegalDescription}
        onChange={setWholesaleLegalDescription}
        height={120}
      />

      <div className="mt-6">
        <div className="text-[11px] font-semibold text-gray-600">SERVICE INVOICE</div>
        <div className="mt-2 border-t border-gray-200" />
        <div className="mt-3 flex items-center gap-3">
          <input
            id="showRetailServiceInvoiceNote"
            type="checkbox"
            checked={showRetailServiceInvoiceNote}
            onChange={(e) => setShowRetailServiceInvoiceNote(e.target.checked)}
            className="h-3.5 w-3.5"
          />
          <label htmlFor="showRetailServiceInvoiceNote" className="text-[11px] text-gray-700">
            Show labor detail on service invoice?
          </label>
        </div>
      </div>

      <div className="flex items-center justify-between pt-8">
        <button type="button" className="h-8 px-3 bg-gray-600 text-white text-xs font-semibold">
          <span className="inline-flex items-center gap-2">
            <span className="text-sm leading-none">×</span>
            Cancel
          </span>
        </button>
        <button type="button" className="h-8 px-4 bg-[#118df0] text-white text-xs font-semibold">
          <span className="inline-flex items-center gap-2">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
              <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M17 21v-8H7v8" />
              <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M7 3v5h8" />
            </svg>
            Save
          </span>
        </button>
      </div>
    </div>
  )
}
