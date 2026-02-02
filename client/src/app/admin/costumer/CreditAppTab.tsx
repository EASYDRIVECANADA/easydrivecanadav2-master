'use client'

import type { Dispatch, SetStateAction } from 'react'

import type { CreditForm, CreditEmployment, CreditIncome } from './types'
import { IconField, MoneyField, Section, ToggleYesNo } from './ui'

export default function CreditAppTab({
  credit,
  setCredit,
}: {
  credit: CreditForm
  setCredit: Dispatch<SetStateAction<CreditForm>>
}) {
  return (
    <div className="px-6 py-5">
      <Section title="Personal Details">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div>
            <div className="text-xs font-semibold text-gray-600 mb-1">Salutation</div>
            <select
              value={credit.salutation}
              onChange={(e) => setCredit((p: CreditForm) => ({ ...p, salutation: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            >
              <option value="">-- Salutation --</option>
              <option value="Mr">Mr</option>
              <option value="Mrs">Mrs</option>
              <option value="Ms">Ms</option>
            </select>
          </div>

          <div>
            <div className="text-xs font-semibold text-gray-600 mb-1">Gender</div>
            <select
              value={credit.gender}
              onChange={(e) => setCredit((p: CreditForm) => ({ ...p, gender: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            >
              <option value="">-- Gender --</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div>
            <div className="text-xs font-semibold text-gray-600 mb-1">Marital Status</div>
            <select
              value={credit.maritalStatus}
              onChange={(e) => setCredit((p: CreditForm) => ({ ...p, maritalStatus: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            >
              <option value="">-- Marital Status --</option>
              <option value="Single">Single</option>
              <option value="Married">Married</option>
              <option value="Common Law">Common Law</option>
            </select>
          </div>
        </div>
      </Section>

      <Section title="Home/Mortgage Details">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-3">
            <div className="text-xs font-semibold text-gray-600 mb-1">Residence Ownership</div>
            <select
              value={credit.residenceOwnership}
              onChange={(e) => setCredit((p: CreditForm) => ({ ...p, residenceOwnership: e.target.value }))}
              className="w-full max-w-sm border border-gray-200 rounded-lg px-3 py-2 text-sm"
            >
              <option value="Own">Own</option>
              <option value="Rent">Rent</option>
              <option value="Live with family">Live with family</option>
            </select>
          </div>

          <MoneyField label="Market Value" value={credit.marketValue} onChange={(v) => setCredit((p: CreditForm) => ({ ...p, marketValue: v }))} />
          <MoneyField label="Mortgage Amount" value={credit.mortgageAmount} onChange={(v) => setCredit((p: CreditForm) => ({ ...p, mortgageAmount: v }))} />
          <MoneyField label="Monthly Payment" value={credit.monthlyPayment} onChange={(v) => setCredit((p: CreditForm) => ({ ...p, monthlyPayment: v }))} />

          <IconField
            label="Bank"
            value={credit.bank}
            onChange={(v) => setCredit((p: CreditForm) => ({ ...p, bank: v }))}
            icon="bank"
            placeholder="bank"
            className="lg:col-span-1"
          />

          <IconField
            label="Years at present address"
            value={credit.yearsAtPresentAddress}
            onChange={(v) => setCredit((p: CreditForm) => ({ ...p, yearsAtPresentAddress: v }))}
            icon="calendar"
            placeholder=""
            className="lg:col-span-1"
          />
        </div>
      </Section>

      <div className="mt-6">
        <div className="flex items-center gap-3 mb-3">
          <div className="text-sm font-semibold text-gray-800">Employment</div>
          <button
            type="button"
            onClick={() =>
              setCredit((p: CreditForm) => ({
                ...p,
                employments: [
                  ...p.employments,
                  {
                    employmentType: 'Full Time',
                    position: '',
                    occupation: '',
                    employerName: '',
                    employerPhone: '',
                    yearsEmployed: '',
                    streetAddress: '',
                    suiteApt: '',
                    city: '',
                    province: 'ON',
                    postalCode: '',
                    country: 'CA',
                  },
                ],
              }))
            }
            className="w-8 h-8 rounded bg-green-600 text-white flex items-center justify-center hover:bg-green-700"
            aria-label="Add employment"
            title="Add employment"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>

        {credit.employments.map((emp: CreditEmployment, idx: number) => (
          <div key={idx} className="border border-gray-300 rounded-lg overflow-hidden mb-5">
            <div className="bg-gray-100 px-4 py-3 flex items-center justify-between">
              <div className="text-sm font-semibold text-gray-800">Primary Employer</div>
              <button
                type="button"
                onClick={() => setCredit((p: CreditForm) => ({ ...p, employments: p.employments.filter((_: CreditEmployment, i: number) => i !== idx) }))}
                className="w-8 h-8 rounded bg-red-600 text-white flex items-center justify-center hover:bg-red-700"
                aria-label="Delete"
                title="Delete"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3m-4 0h14"
                  />
                </svg>
              </button>
            </div>

            <div className="p-4">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div>
                  <div className="text-xs font-semibold text-gray-600 mb-1">Employment Type</div>
                  <select
                    value={emp.employmentType}
                    onChange={(e) =>
                      setCredit((p: CreditForm) => ({
                        ...p,
                        employments: p.employments.map((it: CreditEmployment, i: number) => (i === idx ? { ...it, employmentType: e.target.value } : it)),
                      }))
                    }
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="Full Time">Full Time</option>
                    <option value="Part Time">Part Time</option>
                    <option value="Self Employed">Self Employed</option>
                  </select>
                </div>

                <div>
                  <div className="text-xs font-semibold text-gray-600 mb-1">Position</div>
                  <select
                    value={emp.position}
                    onChange={(e) =>
                      setCredit((p: CreditForm) => ({
                        ...p,
                        employments: p.employments.map((it: CreditEmployment, i: number) => (i === idx ? { ...it, position: e.target.value } : it)),
                      }))
                    }
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="">Position</option>
                    <option value="Manager">Manager</option>
                    <option value="Staff">Staff</option>
                    <option value="Owner">Owner</option>
                  </select>
                </div>

                <IconField
                  label="Occupation"
                  value={emp.occupation}
                  onChange={(v) =>
                    setCredit((p: CreditForm) => ({
                      ...p,
                      employments: p.employments.map((it: CreditEmployment, i: number) => (i === idx ? { ...it, occupation: v } : it)),
                    }))
                  }
                  icon="user"
                  placeholder="ex Office Administrator"
                />

                <IconField
                  label="Employer Name"
                  value={emp.employerName}
                  onChange={(v) =>
                    setCredit((p: CreditForm) => ({
                      ...p,
                      employments: p.employments.map((it: CreditEmployment, i: number) => (i === idx ? { ...it, employerName: v } : it)),
                    }))
                  }
                  icon="calendar"
                  placeholder="employer name"
                />

                <IconField
                  label="Employer Phone"
                  value={emp.employerPhone}
                  onChange={(v) =>
                    setCredit((p: CreditForm) => ({
                      ...p,
                      employments: p.employments.map((it: CreditEmployment, i: number) => (i === idx ? { ...it, employerPhone: v } : it)),
                    }))
                  }
                  icon="phone"
                  placeholder="employer phone"
                />

                <IconField
                  label="Years Employed"
                  value={emp.yearsEmployed}
                  onChange={(v) =>
                    setCredit((p: CreditForm) => ({
                      ...p,
                      employments: p.employments.map((it: CreditEmployment, i: number) => (i === idx ? { ...it, yearsEmployed: v } : it)),
                    }))
                  }
                  icon="clock"
                  placeholder="years employed"
                />

                <div className="lg:col-span-3">
                  <div className="text-xs font-semibold text-gray-600 mb-1">Employer Address</div>
                </div>

                <div className="lg:col-span-2">
                  <IconField
                    label="Street Address"
                    value={emp.streetAddress}
                    onChange={(v) =>
                      setCredit((p: CreditForm) => ({
                        ...p,
                        employments: p.employments.map((it: CreditEmployment, i: number) => (i === idx ? { ...it, streetAddress: v } : it)),
                      }))
                    }
                    icon="pin"
                    placeholder="Enter a location"
                  />
                </div>

                <IconField
                  label="Suite/Apt"
                  value={emp.suiteApt}
                  onChange={(v) =>
                    setCredit((p: CreditForm) => ({
                      ...p,
                      employments: p.employments.map((it: CreditEmployment, i: number) => (i === idx ? { ...it, suiteApt: v } : it)),
                    }))
                  }
                  icon="pin"
                  placeholder="apt/suite #"
                />

                <IconField
                  label="City"
                  value={emp.city}
                  onChange={(v) =>
                    setCredit((p: CreditForm) => ({
                      ...p,
                      employments: p.employments.map((it: CreditEmployment, i: number) => (i === idx ? { ...it, city: v } : it)),
                    }))
                  }
                  icon="pin"
                  placeholder="city"
                />

                <div>
                  <div className="text-xs font-semibold text-gray-600 mb-1">Province</div>
                  <select
                    value={emp.province}
                    onChange={(e) =>
                      setCredit((p: CreditForm) => ({
                        ...p,
                        employments: p.employments.map((it: CreditEmployment, i: number) => (i === idx ? { ...it, province: e.target.value } : it)),
                      }))
                    }
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="ON">ON</option>
                    <option value="BC">BC</option>
                    <option value="AB">AB</option>
                    <option value="MB">MB</option>
                    <option value="QC">QC</option>
                  </select>
                </div>

                <IconField
                  label="Postal Code"
                  value={emp.postalCode}
                  onChange={(v) =>
                    setCredit((p: CreditForm) => ({
                      ...p,
                      employments: p.employments.map((it: CreditEmployment, i: number) => (i === idx ? { ...it, postalCode: v } : it)),
                    }))
                  }
                  icon="pin"
                  placeholder="Postal Code"
                />

                <div>
                  <div className="text-xs font-semibold text-gray-600 mb-1">Country</div>
                  <select
                    value={emp.country}
                    onChange={(e) =>
                      setCredit((p: CreditForm) => ({
                        ...p,
                        employments: p.employments.map((it: CreditEmployment, i: number) => (i === idx ? { ...it, country: e.target.value } : it)),
                      }))
                    }
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="CA">CA</option>
                    <option value="US">US</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-7">
        <div className="flex items-center gap-3 mb-3">
          <div className="text-sm font-semibold text-gray-800">Income</div>
          <button
            type="button"
            onClick={() =>
              setCredit((p: CreditForm) => ({
                ...p,
                incomes: [
                  ...p.incomes,
                  {
                    incomeType: 'Employment',
                    rateHr: '0',
                    hrsWeek: '0',
                    monthlyGross: '0',
                    annualGross: '0',
                    incomeNotes: '',
                  },
                ],
              }))
            }
            className="w-8 h-8 rounded bg-green-600 text-white flex items-center justify-center hover:bg-green-700"
            aria-label="Add income"
            title="Add income"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>

        {credit.incomes.map((inc: CreditIncome, idx: number) => (
          <div key={idx} className="border border-gray-300 rounded-lg overflow-hidden mb-5">
            <div className="bg-gray-100 px-4 py-3 flex items-center justify-between">
              <div className="text-sm font-semibold text-gray-800">Primary Income</div>
              <button
                type="button"
                onClick={() => setCredit((p: CreditForm) => ({ ...p, incomes: p.incomes.filter((_: CreditIncome, i: number) => i !== idx) }))}
                className="w-8 h-8 rounded bg-red-600 text-white flex items-center justify-center hover:bg-red-700"
                aria-label="Delete"
                title="Delete"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3m-4 0h14"
                  />
                </svg>
              </button>
            </div>

            <div className="p-4">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div>
                  <div className="text-xs font-semibold text-gray-600 mb-1">Income Type</div>
                  <select
                    value={inc.incomeType}
                    onChange={(e) =>
                      setCredit((p: CreditForm) => ({
                        ...p,
                        incomes: p.incomes.map((it: CreditIncome, i: number) => (i === idx ? { ...it, incomeType: e.target.value } : it)),
                      }))
                    }
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="Employment">Employment</option>
                    <option value="Self Employment">Self Employment</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <MoneyField
                  label="Rate/Hr"
                  value={inc.rateHr}
                  onChange={(v) =>
                    setCredit((p: CreditForm) => ({
                      ...p,
                      incomes: p.incomes.map((it: CreditIncome, i: number) => (i === idx ? { ...it, rateHr: v } : it)),
                    }))
                  }
                />

                <IconField
                  label="Hrs/Week"
                  value={inc.hrsWeek}
                  onChange={(v) =>
                    setCredit((p: CreditForm) => ({
                      ...p,
                      incomes: p.incomes.map((it: CreditIncome, i: number) => (i === idx ? { ...it, hrsWeek: v } : it)),
                    }))
                  }
                  icon="clock"
                  placeholder="0"
                />

                <MoneyField
                  label="Monthly Gross"
                  value={inc.monthlyGross}
                  onChange={(v) =>
                    setCredit((p: CreditForm) => ({
                      ...p,
                      incomes: p.incomes.map((it: CreditIncome, i: number) => (i === idx ? { ...it, monthlyGross: v } : it)),
                    }))
                  }
                />

                <MoneyField
                  label="Annual Gross"
                  value={inc.annualGross}
                  onChange={(v) =>
                    setCredit((p: CreditForm) => ({
                      ...p,
                      incomes: p.incomes.map((it: CreditIncome, i: number) => (i === idx ? { ...it, annualGross: v } : it)),
                    }))
                  }
                />

                <div className="lg:col-span-3">
                  <div className="text-xs font-semibold text-gray-600 mb-1">Income Notes</div>
                  <textarea
                    rows={4}
                    value={inc.incomeNotes}
                    onChange={(e) =>
                      setCredit((p) => ({
                        ...p,
                        incomes: p.incomes.map((it, i) => (i === idx ? { ...it, incomeNotes: e.target.value } : it)),
                      }))
                    }
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                    placeholder="income notes"
                  />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Section title="Other Details">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <div className="flex items-center justify-between gap-4">
              <div className="text-xs font-semibold text-gray-600">Has ever declared bankruptcy?</div>
              <ToggleYesNo value={credit.declaredBankruptcy} onChange={(v) => setCredit((p) => ({ ...p, declaredBankruptcy: v }))} />
            </div>
            {credit.declaredBankruptcy ? (
              <div className="mt-3">
                <IconField
                  label="Bankruptcy Duration"
                  value={credit.bankruptcyDuration || ''}
                  onChange={(v) => setCredit((p: CreditForm) => ({ ...p, bankruptcyDuration: v }))}
                  icon="clock"
                  placeholder="bankruptcy duration"
                />
              </div>
            ) : null}
            <div className="mt-3">
              <IconField
                label="Financial Institution"
                value={credit.financialInstitution}
                onChange={(v) => setCredit((p: CreditForm) => ({ ...p, financialInstitution: v }))}
                icon="bank"
                placeholder="financial institution"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between gap-4">
              <div className="text-xs font-semibold text-gray-600">Do you have any previous collections or write-offs?</div>
              <ToggleYesNo value={credit.hasCollections} onChange={(v) => setCredit((p) => ({ ...p, hasCollections: v }))} />
            </div>
            {credit.hasCollections ? (
              <div className="mt-3">
                <div className="text-xs font-semibold text-gray-600 mb-1">Collection Notes</div>
                <textarea
                  rows={4}
                  value={credit.collectionNotes || ''}
                  onChange={(e) => setCredit((p: CreditForm) => ({ ...p, collectionNotes: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  placeholder="please describe"
                />
              </div>
            ) : null}
            <div className="mt-3">
              <MoneyField
                label="Desired Monthly Payment"
                value={credit.desiredMonthlyPayment}
                onChange={(v) => setCredit((p: CreditForm) => ({ ...p, desiredMonthlyPayment: v }))}
              />
            </div>
          </div>
        </div>
      </Section>
    </div>
  )
}
