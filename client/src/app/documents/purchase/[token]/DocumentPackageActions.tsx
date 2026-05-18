'use client'

type Props = {
  bosUrl: string
}

export default function DocumentPackageActions({ bosUrl }: Props) {
  return (
    <div className="flex flex-wrap gap-3">
      <a
        href={bosUrl}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center justify-center rounded-lg bg-[#118df0] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#0f7fd8]"
      >
        Open / Print BOS
      </a>
      <a
        href={bosUrl}
        download
        className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
      >
        Download BOS
      </a>
      <button
        type="button"
        onClick={() => window.print()}
        className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
      >
        Print page
      </button>
    </div>
  )
}
