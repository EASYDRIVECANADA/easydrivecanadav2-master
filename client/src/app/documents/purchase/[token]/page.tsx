import Link from 'next/link'
import { notFound } from 'next/navigation'

import { getPurchaseDocumentPackageByToken } from '@/lib/purchaseDocumentPackageServer'
import DocumentPackageActions from './DocumentPackageActions'

export const dynamic = 'force-dynamic'

export default async function PurchaseDocumentsPage({ params }: { params: { token: string } }) {
  const pkg = await getPurchaseDocumentPackageByToken(params.token)
  if (!pkg) notFound()

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6">
          <Link href="/" className="text-sm font-medium text-slate-500 hover:text-slate-800">
            EasyDrive Canada
          </Link>
        </div>

        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[#118df0]">Approved purchase documents</p>
              <h1 className="mt-2 text-2xl font-bold text-slate-950">{pkg.vehicleLabel || 'Vehicle purchase'}</h1>
              <div className="mt-3 space-y-1 text-sm text-slate-600">
                <p>Deal reference: <span className="font-semibold text-slate-900">{pkg.dealId}</span></p>
                <p>Customer: <span className="font-semibold text-slate-900">{pkg.customerName || pkg.customerEmail}</span></p>
                {pkg.createdAt && (
                  <p>Package created: <span className="font-semibold text-slate-900">{new Date(pkg.createdAt).toLocaleString('en-CA', { dateStyle: 'medium', timeStyle: 'short' })}</span></p>
                )}
              </div>
            </div>
            <DocumentPackageActions bosUrl={pkg.bos.signedUrl} />
          </div>
        </section>

        <section className="mt-6 grid gap-4">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">Signed Bill of Sale</h2>
                <p className="mt-1 text-sm text-slate-500">{pkg.bos.name}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <a
                  href={pkg.bos.signedUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  Open
                </a>
                <a
                  href={pkg.bos.signedUrl}
                  download
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Download
                </a>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-bold text-slate-900">CARFAX files</h2>
            {pkg.carfaxFiles.length > 0 ? (
              <div className="mt-4 divide-y divide-slate-100">
                {pkg.carfaxFiles.map((file) => (
                  <div key={file.path} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{file.name}</p>
                      <p className="text-xs text-slate-400">Vehicle history report</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <a
                        href={file.signedUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                      >
                        Open / Print
                      </a>
                      <a
                        href={file.signedUrl}
                        download
                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Download
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-500">No CARFAX report was attached to this vehicle at the time this package was generated.</p>
            )}
          </div>
        </section>

        <p className="mt-6 text-xs text-slate-400">
          This secure page provides customer copies of the approved purchase documents. Driver licence photos are not included.
        </p>
      </div>
    </main>
  )
}
