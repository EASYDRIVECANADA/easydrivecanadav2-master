
'use client'

import { type Dispatch, type SetStateAction, useEffect, useRef } from 'react'

import type { CustomerForm } from './types'
import { CustomerDateIconField, CustomerIconField, PillIdToggle, PillModeToggle } from './ui'

export default function CustomerInformationTab({
  form,
  setForm,
  hideVisibility,
}: {
  form: CustomerForm
  setForm: Dispatch<SetStateAction<CustomerForm>>
  hideVisibility?: boolean
}) {
  const editorRef = useRef<HTMLDivElement | null>(null)
  const colorRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    const el = editorRef.current
    if (!el) return
    const next = form.notes ?? ''
    if (el.innerHTML !== next) el.innerHTML = next
  }, [form.notes])

  const exec = (command: string, value?: string) => {
    const el = editorRef.current
    if (!el) return
    el.focus()
    document.execCommand(command, false, value)
    setForm((p: CustomerForm) => ({ ...p, notes: el.innerHTML }))
  }

  const setFontSizePx = (px: number) => {
    const el = editorRef.current
    if (!el) return
    el.focus()
    const size = px <= 12 ? '3' : px <= 14 ? '4' : '5'
    document.execCommand('fontSize', false, size)

    const fontEls = el.querySelectorAll('font[size]')
    fontEls.forEach((node) => {
      const font = node as HTMLFontElement
      font.removeAttribute('size')
      font.style.fontSize = `${px}px`
    })

    setForm((p: CustomerForm) => ({ ...p, notes: el.innerHTML }))
  }

  return (
    <div className="px-6 py-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <PillModeToggle
            label={form.customerType}
            onClick={() =>
              setForm((p: CustomerForm) => ({
                ...p,
                customerType: p.customerType === 'IND' ? 'CMP' : 'IND',
              }))
            }
          />
        </div>
        {hideVisibility ? null : (
          <div className="w-64">
            <div className="text-xs font-semibold text-gray-600 mb-1">Visibility</div>
            <select
              value={form.visibility}
              onChange={(e) => setForm((p: CustomerForm) => ({ ...p, visibility: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            >
              <option value="Private">Private</option>
              <option value="Public">Public</option>
            </select>
          </div>
        )}
      </div>

      {form.customerType === 'IND' ? (
        <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
          <CustomerIconField
            label="First Name"
            value={form.firstName}
            onChange={(v) => setForm((p: CustomerForm) => ({ ...p, firstName: v }))}
            icon="user"
            placeholder="first name"
          />
          <CustomerIconField
            label="Middle Name"
            value={form.middleName}
            onChange={(v) => setForm((p: CustomerForm) => ({ ...p, middleName: v }))}
            icon="user"
            placeholder="Middle name"
          />
          <CustomerIconField
            label="Last Name"
            value={form.lastName}
            onChange={(v) => setForm((p: CustomerForm) => ({ ...p, lastName: v }))}
            icon="user"
            placeholder="Last name"
          />

          <div>
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold text-gray-600">{form.idType === 'RIN' ? 'RIN#' : 'Drivers License #'}</div>
              <PillIdToggle
                label={form.idType}
                onClick={() =>
                  setForm((p: CustomerForm) => ({
                    ...p,
                    idType: p.idType === 'RIN' ? 'DL' : 'RIN',
                  }))
                }
              />
            </div>
            <div className="mt-1">
              {form.idType === 'RIN' ? (
                <CustomerIconField
                  label=""
                  value={form.rin}
                  onChange={(v) => setForm((p: CustomerForm) => ({ ...p, rin: v }))}
                  icon="hash"
                  placeholder="RIN"
                  hideLabel
                />
              ) : (
                <CustomerIconField
                  label=""
                  value={form.driversLicense}
                  onChange={(v) => setForm((p: CustomerForm) => ({ ...p, driversLicense: v }))}
                  icon="id"
                  placeholder="Drivers license"
                  hideLabel
                />
              )}
            </div>
          </div>

          <CustomerDateIconField
            label="DL Expiry"
            value={form.dlExpiry}
            onChange={(v) => setForm((p: CustomerForm) => ({ ...p, dlExpiry: v }))}
          />
          <CustomerDateIconField
            label="Date of birth"
            value={form.dateOfBirth}
            onChange={(v) => setForm((p: CustomerForm) => ({ ...p, dateOfBirth: v }))}
          />

          <div className="lg:col-span-3">
            <div className="text-xs font-semibold text-gray-600 mb-1">Primary Address</div>
          </div>

          <div className="lg:col-span-2">
            <CustomerIconField
              label="Street Address"
              value={form.streetAddress}
              onChange={(v) => setForm((p: CustomerForm) => ({ ...p, streetAddress: v }))}
              icon="pin"
              placeholder="Enter a location"
            />
          </div>
          <CustomerIconField
            label="Suite/Apt"
            value={form.suiteApt}
            onChange={(v) => setForm((p: CustomerForm) => ({ ...p, suiteApt: v }))}
            icon="pin"
            placeholder="apt/suite #"
          />

          <CustomerIconField
            label="City"
            value={form.city}
            onChange={(v) => setForm((p: CustomerForm) => ({ ...p, city: v }))}
            icon="pin"
            placeholder="city"
          />

          <div>
            <div className="text-xs font-semibold text-gray-600 mb-1">Province</div>
            <select
              value={form.province}
              onChange={(e) => setForm((p: CustomerForm) => ({ ...p, province: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            >
              <option value="ON">ON</option>
              <option value="BC">BC</option>
              <option value="AB">AB</option>
              <option value="MB">MB</option>
              <option value="QC">QC</option>
            </select>
          </div>

          <CustomerIconField
            label="Postal Code"
            value={form.postalCode}
            onChange={(v) => setForm((p: CustomerForm) => ({ ...p, postalCode: v }))}
            icon="pin"
            placeholder="Postal Code"
          />

          <div>
            <div className="text-xs font-semibold text-gray-600 mb-1">Country</div>
            <select
              value={form.country}
              onChange={(e) => setForm((p: CustomerForm) => ({ ...p, country: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            >
              <option value="CA">CA</option>
              <option value="US">US</option>
            </select>
          </div>

          <CustomerIconField
            label="Phone"
            value={form.phone}
            onChange={(v) => setForm((p: CustomerForm) => ({ ...p, phone: v }))}
            icon="phone"
            placeholder="phone"
          />
          <CustomerIconField
            label="Mobile"
            value={form.mobile}
            onChange={(v) => setForm((p: CustomerForm) => ({ ...p, mobile: v }))}
            icon="mobile"
            placeholder="mobile"
          />
          <CustomerIconField
            label="Email"
            value={form.email}
            onChange={(v) => setForm((p: CustomerForm) => ({ ...p, email: v }))}
            icon="email"
            placeholder="email"
          />

          <div>
            <div className="text-xs font-semibold text-gray-600 mb-1">Salesperson</div>
            <select
              value={form.salesperson}
              onChange={(e) => setForm((p: CustomerForm) => ({ ...p, salesperson: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            >
              <option value="Nawshad Syed">Nawshad Syed</option>
              <option value="Syed Islam">Syed Islam</option>
            </select>
          </div>
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
          <CustomerIconField
            label="Legal Name"
            value={form.legalName}
            onChange={(v) => setForm((p: CustomerForm) => ({ ...p, legalName: v }))}
            icon="id"
            placeholder="legal name"
          />
          <CustomerIconField
            label="Company Name"
            value={form.companyName}
            onChange={(v) => setForm((p: CustomerForm) => ({ ...p, companyName: v }))}
            icon="id"
            placeholder="display name"
          />
          <CustomerIconField
            label="MVDA# (wholesale only)"
            value={form.mvda}
            onChange={(v) => setForm((p: CustomerForm) => ({ ...p, mvda: v }))}
            icon="hash"
            placeholder="MVDA# (wholesale only)"
          />

          <CustomerDateIconField
            label="Year End"
            value={form.yearEnd}
            onChange={(v) => setForm((p: CustomerForm) => ({ ...p, yearEnd: v }))}
          />
          <CustomerIconField
            label="RIN #"
            value={form.rin}
            onChange={(v) => setForm((p: CustomerForm) => ({ ...p, rin: v }))}
            icon="id"
            placeholder="RIN"
          />
          <CustomerIconField
            label="Tax #"
            value={form.taxNumber}
            onChange={(v) => setForm((p: CustomerForm) => ({ ...p, taxNumber: v }))}
            icon="pin"
            placeholder="tax number"
          />

          <CustomerIconField
            label="Contact First Name"
            value={form.contactFirstName}
            onChange={(v) => setForm((p: CustomerForm) => ({ ...p, contactFirstName: v }))}
            icon="user"
            placeholder="contact first name"
          />
          <CustomerIconField
            label="Contact Last Name"
            value={form.contactLastName}
            onChange={(v) => setForm((p: CustomerForm) => ({ ...p, contactLastName: v }))}
            icon="user"
            placeholder="contact last name"
          />
          <CustomerIconField
            label="Salesperson Reg. #"
            value={form.salespersonReg}
            onChange={(v) => setForm((p: CustomerForm) => ({ ...p, salespersonReg: v }))}
            icon="id"
            placeholder="salesperson reg # (wholesale only)"
          />

          <div className="lg:col-span-3">
            <div className="text-xs font-semibold text-gray-600 mb-1">Primary Address</div>
          </div>

          <div className="lg:col-span-2">
            <CustomerIconField
              label="Street Address"
              value={form.streetAddress}
              onChange={(v) => setForm((p) => ({ ...p, streetAddress: v }))}
              icon="pin"
              placeholder="Enter a location"
            />
          </div>
          <CustomerIconField
            label="Suite/Apt"
            value={form.suiteApt}
            onChange={(v) => setForm((p) => ({ ...p, suiteApt: v }))}
            icon="pin"
            placeholder="apt/suite #"
          />

          <CustomerIconField
            label="City"
            value={form.city}
            onChange={(v) => setForm((p) => ({ ...p, city: v }))}
            icon="pin"
            placeholder="city"
          />

          <div>
            <div className="text-xs font-semibold text-gray-600 mb-1">Province</div>
            <select
              value={form.province}
              onChange={(e) => setForm((p) => ({ ...p, province: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            >
              <option value="ON">ON</option>
              <option value="BC">BC</option>
              <option value="AB">AB</option>
              <option value="MB">MB</option>
              <option value="QC">QC</option>
            </select>
          </div>

          <CustomerIconField
            label="Postal Code"
            value={form.postalCode}
            onChange={(v) => setForm((p) => ({ ...p, postalCode: v }))}
            icon="pin"
            placeholder="Postal Code"
          />

          <div>
            <div className="text-xs font-semibold text-gray-600 mb-1">Country</div>
            <select
              value={form.country}
              onChange={(e) => setForm((p) => ({ ...p, country: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            >
              <option value="CA">CA</option>
              <option value="US">US</option>
            </select>
          </div>

          <CustomerIconField
            label="Phone"
            value={form.phone}
            onChange={(v) => setForm((p: CustomerForm) => ({ ...p, phone: v }))}
            icon="phone"
            placeholder="phone"
          />
          <CustomerIconField
            label="Fax"
            value={form.fax}
            onChange={(v) => setForm((p: CustomerForm) => ({ ...p, fax: v }))}
            icon="id"
            placeholder="fax"
          />
          <CustomerIconField
            label="Mobile"
            value={form.mobile}
            onChange={(v) => setForm((p: CustomerForm) => ({ ...p, mobile: v }))}
            icon="mobile"
            placeholder="mobile"
          />

          <CustomerIconField
            label="Email"
            value={form.email}
            onChange={(v) => setForm((p) => ({ ...p, email: v }))}
            icon="email"
            placeholder="email"
          />

          <div>
            <div className="text-xs font-semibold text-gray-600 mb-1">Salesperson</div>
            <select
              value={form.salesperson}
              onChange={(e) => setForm((p) => ({ ...p, salesperson: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            >
              <option value="Nawshad Syed">Nawshad Syed</option>
              <option value="Syed Islam">Syed Islam</option>
            </select>
          </div>
        </div>
      )}

      <div className="mt-5">
        <div className="text-xs font-semibold text-gray-600 mb-2">Notes</div>
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <div className="bg-gray-50 px-3 py-2 flex items-center gap-2 text-xs text-gray-500 border-b border-gray-200">
            <div className="w-9 h-9 rounded bg-purple-600 text-white flex items-center justify-center font-semibold">NA</div>
            <button type="button" onClick={() => exec('bold')} className="px-2 py-1 rounded bg-white border border-gray-200 font-semibold">
              B
            </button>
            <button type="button" onClick={() => exec('italic')} className="px-2 py-1 rounded bg-white border border-gray-200 italic">
              I
            </button>
            <button type="button" onClick={() => exec('underline')} className="px-2 py-1 rounded bg-white border border-gray-200 underline">
              U
            </button>
            <button type="button" onClick={() => exec('removeFormat')} className="px-2 py-1 rounded bg-white border border-gray-200">
              Tx
            </button>
            <button type="button" onClick={() => exec('strikeThrough')} className="px-2 py-1 rounded bg-white border border-gray-200">
              S
            </button>
            <button type="button" onClick={() => exec('subscript')} className="px-2 py-1 rounded bg-white border border-gray-200">
              x
            </button>
            <select
              className="h-7 text-xs border border-gray-200 rounded px-2"
              defaultValue="16"
              onChange={(e) => setFontSizePx(Number(e.target.value) || 16)}
            >
              <option value="12">12</option>
              <option value="14">14</option>
              <option value="16">16</option>
            </select>
            <input
              ref={colorRef}
              type="color"
              className="hidden"
              defaultValue="#111827"
              onChange={(e) => exec('foreColor', e.target.value)}
            />
            <button
              type="button"
              onClick={() => colorRef.current?.click()}
              className="px-2 py-1 rounded bg-white border border-gray-200"
            >
              A
            </button>
            <button type="button" onClick={() => exec('justifyLeft')} className="px-2 py-1 rounded bg-white border border-gray-200">
              ≡
            </button>
            <button type="button" onClick={() => exec('insertUnorderedList')} className="px-2 py-1 rounded bg-white border border-gray-200">
              Tˇ
            </button>
            <div className="flex-1" />
            <button type="button" onClick={() => exec('insertOrderedList')} className="px-2 py-1 rounded bg-white border border-gray-200">
              ▾
            </button>
          </div>

          <div
            ref={editorRef}
            contentEditable
            role="textbox"
            aria-multiline="true"
            onInput={() => {
              const el = editorRef.current
              if (!el) return
              setForm((p: CustomerForm) => ({ ...p, notes: el.innerHTML }))
            }}
            className="w-full px-4 py-3 text-sm focus:outline-none bg-white min-h-[300px]"
            data-placeholder="enter your note here..."
          />

        </div>
      </div>
    </div>
  )
}
