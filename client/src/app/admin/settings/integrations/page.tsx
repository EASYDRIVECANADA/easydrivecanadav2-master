'use client'

import { useMemo, useState } from 'react'

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={
        checked
          ? 'h-4 w-9 rounded-full bg-navy-900 relative border border-navy-900'
          : 'h-4 w-9 rounded-full bg-white relative border border-slate-300'
      }
      aria-pressed={checked}
    >
      <span
        className={
          checked
            ? 'absolute right-0.5 top-0.5 h-3 w-3 rounded-full bg-white'
            : 'absolute left-0.5 top-0.5 h-3 w-3 rounded-full bg-slate-400'
        }
      />
    </button>
  )
}

type IntegrationKey =
  | 'lubrico'
  | 'cargurus'
  | 'carpages'
  | 'autotrader'
  | 'kijiji'
  | 'edealer'
  | 'siriusxm'

type IntegrationRow = {
  key: IntegrationKey
  name: string
  description: React.ReactNode
  defaultEnabled: boolean
  logoText: string
  logoColorClass: string
}

export default function SettingsIntegrationsPage() {
  const integrations = useMemo<IntegrationRow[]>(
    () => [
      {
        key: 'lubrico',
        name: 'Lubrico',
        logoText: 'Lubrico',
        logoColorClass: 'text-red-600',
        description:
          'The Lubrico integration will allow you to push Lubrico warranties to the Lubrico portal. This helpful integration will cut down on duplicate entry.',
        defaultEnabled: false,
      },
      {
        key: 'cargurus',
        name: 'CarGurus',
        logoText: 'CarGurus',
        logoColorClass: 'text-red-500',
        description: 'The CarGurus integration will unlock the ability to add inventory to a Cargurus feed.',
        defaultEnabled: true,
      },
      {
        key: 'carpages',
        name: 'Carpages',
        logoText: 'carpages',
        logoColorClass: 'text-green-600',
        description: 'The Carpages integration will unlock the ability to add inventory to a Carpages feed.',
        defaultEnabled: true,
      },
      {
        key: 'autotrader',
        name: 'AutoTrader',
        logoText: 'AutoTrader',
        logoColorClass: 'text-red-600',
        description:
          'The AutoTrader integration will unlock the ability to add inventory to a AutoTrader feed.',
        defaultEnabled: true,
      },
      {
        key: 'kijiji',
        name: 'Kijiji',
        logoText: 'kijiji',
        logoColorClass: 'text-indigo-600',
        description: 'The Kijiji integration will unlock the ability to add inventory to a Kijiji feed.',
        defaultEnabled: false,
      },
      {
        key: 'edealer',
        name: 'eDealer',
        logoText: 'eDealer',
        logoColorClass: 'text-blue-600',
        description: 'The eDealer integration will unlock the ability to add inventory to a eDealer feed.',
        defaultEnabled: false,
      },
      {
        key: 'siriusxm',
        name: 'SiriusXM',
        logoText: 'SiriusXM',
        logoColorClass: 'text-blue-700',
        description: (
          <span>
            Do not enable this integration prior to enrolling in the Sirius XM dealer enrollment. You can enroll{' '}
            <a href="#" className="text-navy-900 underline">
              here.
            </a>
          </span>
        ),
        defaultEnabled: false,
      },
    ],
    []
  )

  const [enabled, setEnabled] = useState<Record<IntegrationKey, boolean>>(() => {
    const initial = {} as Record<IntegrationKey, boolean>
    integrations.forEach((i) => {
      initial[i.key] = i.defaultEnabled
    })
    return initial
  })

  return (
    <div>
      <div className="border border-slate-200/60 bg-white rounded-lg">
        {integrations.map((i, idx) => (
          <div key={i.key} className={idx === 0 ? '' : 'border-t border-slate-100'}>
            <div className="flex items-center justify-between gap-6 px-3 py-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 w-20">
                  <div className={`text-sm font-semibold ${i.logoColorClass}`}>{i.logoText}</div>
                </div>
                <div>
                  <div className="text-[11px] font-semibold text-slate-700">{i.name}</div>
                  <div className="mt-1 text-[11px] text-slate-500 max-w-[760px]">{i.description}</div>
                </div>
              </div>
              <Toggle checked={!!enabled[i.key]} onChange={(v) => setEnabled((p) => ({ ...p, [i.key]: v }))} />
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between pt-8">
        <button type="button" className="h-8 px-3 bg-slate-600 text-white text-xs font-semibold rounded">
          <span className="inline-flex items-center gap-2">
            <span className="text-sm leading-none">×</span>
            Cancel
          </span>
        </button>
        <button type="button" className="edc-btn-primary h-8 px-4 text-xs">
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
