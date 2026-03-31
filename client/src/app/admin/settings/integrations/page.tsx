'use client'

export default function SettingsIntegrationsPage() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-16 h-16 rounded-2xl bg-navy-900 flex items-center justify-center mb-6">
        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      </div>
      <h2 className="text-xl font-bold text-slate-800 mb-2">Integrations — Coming Soon</h2>
      <p className="text-sm text-slate-500 max-w-sm">
        Third-party integrations with AutoTrader, CarGurus, Carpages, Kijiji, and more are currently in development. Check back soon.
      </p>
    </div>
  )
}
