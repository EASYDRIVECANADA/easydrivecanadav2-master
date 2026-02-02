import { type ReactNode } from 'react'

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mt-4">
      <div className="text-sm font-semibold text-gray-800">{title}</div>
      <div className="mt-2 border-t border-gray-200 pt-4">{children}</div>
    </div>
  )
}

export function MoneyField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <div className="text-xs font-semibold text-gray-600 mb-1">{label}</div>
      <div className="flex items-center">
        <div className="h-10 w-10 border border-gray-200 rounded-l-lg bg-gray-50 flex items-center justify-center text-gray-600 text-sm">$
        </div>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full border border-gray-200 rounded-r-lg px-3 py-2 text-sm h-10"
        />
      </div>
    </div>
  )
}

export function IconField({
  label,
  value,
  onChange,
  placeholder,
  icon,
  className,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  icon: 'bank' | 'calendar' | 'phone' | 'clock' | 'pin' | 'user'
  className?: string
}) {
  return (
    <div className={className}>
      <div className="text-xs font-semibold text-gray-600 mb-1">{label}</div>
      <div className="flex items-center">
        <div className="h-10 w-10 border border-gray-200 rounded-l-lg bg-gray-50 flex items-center justify-center text-gray-500">
          {icon === 'bank' ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M5 10V20m4-10V20m6-10V20m4-10V20M4 20h16M12 3l9 5H3l9-5z" />
            </svg>
          ) : icon === 'calendar' ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3M5 11h14M5 7h14a2 2 0 012 2v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9a2 2 0 012-2z" />
            </svg>
          ) : icon === 'phone' ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3l2 5-2 1a11 11 0 005 5l1-2 5 2v3a2 2 0 01-2 2h-1C9.716 19 5 14.284 5 8V7a2 2 0 01-2-2z" />
            </svg>
          ) : icon === 'clock' ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ) : icon === 'pin' ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11a3 3 0 100-6 3 3 0 000 6z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.5 10.5c0 7-7.5 11-7.5 11s-7.5-4-7.5-11a7.5 7.5 0 1115 0z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7a4 4 0 108 0 4 4 0 00-8 0z" />
            </svg>
          )}
        </div>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full border border-gray-200 rounded-r-lg px-3 py-2 text-sm h-10"
        />
      </div>
    </div>
  )
}

export function ToggleYesNo({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  const dotLeft = value
  const label = value ? 'Yes' : 'No'
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`h-6 px-2 rounded-full border border-[#118df0] bg-white flex items-center gap-2 ${dotLeft ? '' : 'flex-row-reverse'}`}
      aria-label={`Toggle ${label}`}
      title={label}
    >
      <span className="w-3.5 h-3.5 rounded-full bg-[#118df0]" />
      <span className="text-[10px] font-semibold text-gray-700">{label}</span>
    </button>
  )
}

export function PillModeToggle({ label, onClick }: { label: string; onClick: () => void }) {
  const dotLeft = label === 'CMP'
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-6 px-2 rounded-full border border-[#118df0] bg-white flex items-center gap-2 ${dotLeft ? 'flex-row-reverse' : ''}`}
      aria-label={label}
    >
      <span className="text-[10px] font-semibold text-gray-700">{label}</span>
      <span className="w-3.5 h-3.5 rounded-full bg-[#118df0]" />
    </button>
  )
}

export function PillIdToggle({ label, onClick }: { label: 'RIN' | 'DL'; onClick: () => void }) {
  const dotLeft = label === 'DL'
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-6 px-2 rounded-full border border-[#118df0] bg-white flex items-center gap-2 ${dotLeft ? 'flex-row-reverse' : ''}`}
      aria-label={label}
      title={label}
    >
      <span className="text-[10px] font-semibold text-gray-700">{label}</span>
      <span className="w-3.5 h-3.5 rounded-full bg-[#118df0]" />
    </button>
  )
}

export function CustomerIconField({
  label,
  value,
  onChange,
  placeholder,
  icon,
  disabled,
  hideLabel,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  icon: 'user' | 'pin' | 'phone' | 'mobile' | 'email' | 'id' | 'hash'
  disabled?: boolean
  hideLabel?: boolean
}) {
  return (
    <div>
      {hideLabel ? null : <div className="text-xs font-semibold text-gray-600 mb-1">{label}</div>}
      <div className="flex items-center">
        <div className="h-10 w-10 border border-gray-200 rounded-l-lg bg-gray-50 flex items-center justify-center text-gray-500">
          {icon === 'user' ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7a4 4 0 108 0 4 4 0 00-8 0z" />
            </svg>
          ) : icon === 'pin' ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11a3 3 0 100-6 3 3 0 000 6z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.5 10.5c0 7-7.5 11-7.5 11s-7.5-4-7.5-11a7.5 7.5 0 1115 0z" />
            </svg>
          ) : icon === 'phone' ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3l2 5-2 1a11 11 0 005 5l1-2 5 2v3a2 2 0 01-2 2h-1C9.716 19 5 14.284 5 8V7a2 2 0 01-2-2z" />
            </svg>
          ) : icon === 'mobile' ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4h10a2 2 0 012 2v12a2 2 0 01-2 2H7a2 2 0 01-2-2V6a2 2 0 012-2z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 18h2" />
            </svg>
          ) : icon === 'email' ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l9 6 9-6" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 8v10a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h14a2 2 0 012 2z" />
            </svg>
          ) : icon === 'id' ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h10M7 11h10M7 15h6" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z" />
            </svg>
          ) : (
            <span className="text-sm font-semibold text-gray-600">#</span>
          )}
        </div>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className={`w-full border border-gray-200 rounded-r-lg px-3 py-2 text-sm h-10 ${disabled ? 'bg-gray-50 text-gray-500' : ''}`}
        />
      </div>
    </div>
  )
}

export function CustomerDateIconField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <div className="text-xs font-semibold text-gray-600 mb-1">{label}</div>
      <div className="flex items-center">
        <div className="h-10 w-10 border border-gray-200 rounded-l-lg bg-gray-50 flex items-center justify-center text-gray-500">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3M5 11h14M5 7h14a2 2 0 012 2v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9a2 2 0 012-2z" />
          </svg>
        </div>
        <input
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full border border-gray-200 rounded-r-lg px-3 py-2 text-sm h-10"
        />
      </div>
    </div>
  )
}
