'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Bot, Copy, ExternalLink, RefreshCw, Search, Save } from 'lucide-react'

type FacebookPostRow = {
  postId: string
  vehicleId: string
  title: string
  description: string
  price: number
  mileage: number
  location: string
  images: string[]
  publicUrl: string
  vin: string
  stockNumber: string
  vehicleStatus: string
  status: string
  facebookListingUrl: string
  notes: string
  assistStatus?: string
  assistStartedAt?: string
  assistCompletedAt?: string
  assistError?: string
  readiness: { ready: boolean; score: number; missing: string[] }
}

type Summary = {
  total: number
  ready: number
  draft: number
  posted: number
  needsUpdate: number
  soldRemove: number
  skipped: number
  failed: number
}

const STATUS_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'ready', label: 'Ready' },
  { value: 'draft', label: 'Draft' },
  { value: 'posted', label: 'Posted' },
  { value: 'needs_update', label: 'Needs Update' },
  { value: 'sold_remove', label: 'Sold / Remove' },
  { value: 'skipped', label: 'Skipped' },
  { value: 'failed', label: 'Failed' },
]

const facebookMarketplaceUrl = 'https://www.facebook.com/marketplace/create/vehicle'

const statusLabel = (status: string) =>
  STATUS_OPTIONS.find((item) => item.value === status)?.label || status || 'Draft'

const assistLabel = (status?: string) => {
  if (!status) return ''
  return status.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

type AssistLaunch = {
  command: string
  localUrl: string
}

type AssistResponse = {
  setupRequired?: boolean
  error?: string
  launchToken?: unknown
}

export default function FacebookMarketplaceClient() {
  const [posts, setPosts] = useState<FacebookPostRow[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [selected, setSelected] = useState<FacebookPostRow | null>(null)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState('')
  const [assistLaunch, setAssistLaunch] = useState<AssistLaunch | null>(null)
  const [form, setForm] = useState({
    title: '',
    description: '',
    price: '',
    location: '',
    facebookListingUrl: '',
    notes: '',
    status: 'draft',
  })

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const params = new URLSearchParams()
    if (query.trim()) params.set('q', query.trim())
    if (status) params.set('status', status)

    const suffix = params.toString() ? `?${params.toString()}` : ''
    const res = await fetch(`/api/admin/marketplace/facebook/posts${suffix}`, { cache: 'no-store' })
    const json = await res.json().catch(() => null)

    if (!res.ok) {
      setError(json?.setupRequired
        ? 'Run supabase/edc_facebook_marketplace_posts.sql before using the Facebook posting queue.'
        : json?.error || 'Failed to load Facebook posting queue.')
      setPosts([])
      setSummary(null)
      setLoading(false)
      return
    }

    setPosts(Array.isArray(json?.posts) ? json.posts : [])
    setSummary(json?.summary || null)
    setLoading(false)
  }, [query, status])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    setAssistLaunch(null)
    if (!selected) return
    setForm({
      title: selected.title || '',
      description: selected.description || '',
      price: selected.price ? String(selected.price) : '',
      location: selected.location || '',
      facebookListingUrl: selected.facebookListingUrl || '',
      notes: selected.notes || '',
      status: selected.status || 'draft',
    })
  }, [selected])

  const filteredSummary = useMemo(
    () => summary || { total: 0, ready: 0, draft: 0, posted: 0, needsUpdate: 0, soldRemove: 0, skipped: 0, failed: 0 },
    [summary]
  )

  const prepareSelected = async (vehicleIds: string[]) => {
    setSaving(true)
    setError('')
    const res = await fetch('/api/admin/marketplace/facebook/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vehicleIds }),
    })
    const json = await res.json().catch(() => null)
    setSaving(false)

    if (!res.ok) {
      setError(json?.error || 'Failed to prepare Facebook posts.')
      return false
    }

    await load()
    return true
  }

  const copyText = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(label)
      window.setTimeout(() => setCopied(''), 1400)
    } catch {
      setError(`Could not copy ${label}. Select the text manually and copy it.`)
    }
  }

  const saveSelected = async () => {
    if (!selected) return
    if (!selected.postId) {
      const prepared = await prepareSelected([selected.vehicleId])
      if (prepared) setSelected(null)
      return
    }

    setSaving(true)
    setError('')
    const res = await fetch(`/api/admin/marketplace/facebook/posts/${encodeURIComponent(selected.postId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const json = await res.json().catch(() => null)
    setSaving(false)

    if (!res.ok) {
      setError(json?.error || 'Failed to save Facebook post.')
      return
    }

    setSelected(null)
    await load()
  }

  const assistSelected = async () => {
    if (!selected?.postId) {
      setError('Prepare and save this vehicle before launching browser assistance.')
      return
    }
    if (!selected.readiness?.ready) {
      setError('Resolve missing Marketplace fields before launching browser assistance.')
      return
    }

    setSaving(true)
    setError('')
    let res: Response
    let json: AssistResponse | null = null
    try {
      res = await fetch(`/api/admin/marketplace/facebook/posts/${encodeURIComponent(selected.postId)}/assist`, {
        cache: 'no-store',
      })
      json = (await res.json().catch(() => null)) as AssistResponse | null
    } catch {
      setSaving(false)
      setError('Failed to reach browser assistance endpoint.')
      return
    }
    setSaving(false)

    if (!res.ok) {
      setError(json?.setupRequired
        ? 'Run supabase/edc_facebook_marketplace_posts_assist.sql before browser assistance.'
        : json?.error || 'Failed to launch browser assistance.')
      return
    }
    if (!json?.launchToken) {
      setError('Missing browser assistance launch token.')
      return
    }

    const tokenJson = JSON.stringify(json.launchToken)
    const encodedToken = encodeURIComponent(tokenJson)
    const localUrl = `http://127.0.0.1:4777/assist?token=${encodedToken}`
    const command = `node scripts/facebook-marketplace-assist-runner.mjs --profile-dir ".facebook-assist-profile" --token '${tokenJson}'`
    setAssistLaunch({ command, localUrl })
    window.open(localUrl, '_blank', 'noopener,noreferrer')
    await load()
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Marketplace</p>
            <h1 className="text-2xl font-bold text-slate-950">Facebook Posting Queue</h1>
            <p className="mt-1 text-sm text-slate-600">Prepare inventory copy, open Facebook Marketplace, and track manual posting status.</p>
          </div>
          <button
            type="button"
            onClick={() => void prepareSelected(posts.map((post) => post.vehicleId))}
            disabled={saving || loading || posts.length === 0}
            className="edc-btn-primary inline-flex items-center gap-2 text-sm"
          >
            <RefreshCw className="h-4 w-4" />
            Prepare Visible
          </button>
        </div>

        {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

        <div className="grid grid-cols-2 gap-3 md:grid-cols-7">
          {[
            ['Total', filteredSummary.total],
            ['Ready', filteredSummary.ready],
            ['Draft', filteredSummary.draft],
            ['Posted', filteredSummary.posted],
            ['Needs Update', filteredSummary.needsUpdate],
            ['Sold Remove', filteredSummary.soldRemove],
            ['Failed', filteredSummary.failed],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="text-xs text-slate-500">{label}</div>
              <div className="mt-1 text-xl font-bold text-slate-950">{String(value)}</div>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3 md:flex-row">
          <label className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search make, model, VIN, stock, status"
              className="edc-input pl-9"
            />
          </label>
          <select value={status} onChange={(event) => setStatus(event.target.value)} className="edc-input md:w-56">
            {STATUS_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </div>

        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="hidden grid-cols-[88px_1fr_120px_130px_130px] border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-slate-500 md:grid">
            <div>Photo</div>
            <div>Vehicle</div>
            <div>Readiness</div>
            <div>Status</div>
            <div>Action</div>
          </div>
          {loading ? (
            <div className="p-6 text-sm text-slate-500">Loading Facebook posting queue...</div>
          ) : posts.length === 0 ? (
            <div className="p-6 text-sm text-slate-500">No vehicles match the current filters.</div>
          ) : posts.map((post) => (
            <button
              key={post.vehicleId}
              type="button"
              onClick={() => setSelected(post)}
              className="grid w-full grid-cols-[72px_1fr] items-center gap-3 border-b border-slate-100 px-4 py-3 text-left hover:bg-slate-50 md:grid-cols-[88px_1fr_120px_130px_130px]"
            >
              <div>{post.images?.[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={post.images[0]} alt="" className="h-14 w-20 rounded object-cover" />
              ) : <div className="h-14 w-20 rounded bg-slate-100" />}</div>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-slate-950">{post.title || 'Untitled vehicle'}</div>
                <div className="mt-1 truncate text-xs text-slate-500">
                  {post.stockNumber || 'No stock'} - {post.vin || 'No VIN'} - ${Number(post.price || 0).toLocaleString('en-CA')}
                </div>
                <div className="mt-1 text-xs text-slate-500 md:hidden">
                  {post.readiness?.score || 0}% - {statusLabel(post.status)}
                  {post.assistStatus ? ` - Assist: ${assistLabel(post.assistStatus)}` : ''}
                </div>
              </div>
              <div className="hidden text-sm font-semibold text-slate-700 md:block">{post.readiness?.score || 0}%</div>
              <div className="hidden text-sm text-slate-600 md:block">
                <div>{statusLabel(post.status)}</div>
                {post.assistStatus ? <div className="mt-1 text-xs text-slate-500">Assist: {assistLabel(post.assistStatus)}</div> : null}
              </div>
              <div className="hidden text-sm font-semibold text-[#1EA7FF] md:block">Open</div>
            </button>
          ))}
        </div>
      </div>

      {selected ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30">
          <button type="button" aria-label="Close drawer" className="flex-1" onClick={() => setSelected(null)} />
          <aside className="h-full w-full max-w-2xl overflow-y-auto bg-white shadow-xl">
            <div className="sticky top-0 z-10 border-b border-slate-200 bg-white px-5 py-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-slate-950">{selected.title}</h2>
                  <p className="text-sm text-slate-500">{statusLabel(selected.status)} - {selected.readiness?.score || 0}% ready</p>
                  {selected.assistStatus ? <p className="text-xs text-slate-500">Assist: {assistLabel(selected.assistStatus)}</p> : null}
                </div>
                <button type="button" onClick={() => setSelected(null)} className="edc-btn-ghost text-sm">Close</button>
              </div>
            </div>
            <div className="space-y-4 p-5">
              <Field label="Title" value={form.title} onChange={(value) => setForm((prev) => ({ ...prev, title: value }))} onCopy={() => copyText('title', form.title)} />
              <TextArea label="Description" value={form.description} onChange={(value) => setForm((prev) => ({ ...prev, description: value }))} onCopy={() => copyText('description', form.description)} />
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Field label="Price" value={form.price} onChange={(value) => setForm((prev) => ({ ...prev, price: value }))} onCopy={() => copyText('price', form.price)} />
                <Field label="Location" value={form.location} onChange={(value) => setForm((prev) => ({ ...prev, location: value }))} onCopy={() => copyText('location', form.location)} />
              </div>
              <Field label="Facebook Listing URL" value={form.facebookListingUrl} onChange={(value) => setForm((prev) => ({ ...prev, facebookListingUrl: value }))} />
              <TextArea label="Internal Notes" value={form.notes} onChange={(value) => setForm((prev) => ({ ...prev, notes: value }))} />
              <select value={form.status} onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value }))} className="edc-input">
                {STATUS_OPTIONS.filter((item) => item.value).map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => window.open(facebookMarketplaceUrl, '_blank', 'noopener,noreferrer')} className="edc-btn-primary inline-flex items-center gap-2 text-sm">
                  <ExternalLink className="h-4 w-4" />
                  Open Facebook
                </button>
                <button type="button" onClick={() => copyText('vehicle link', selected.publicUrl)} className="edc-btn-ghost inline-flex items-center gap-2 text-sm">
                  <Copy className="h-4 w-4" />
                  Copy Vehicle Link
                </button>
                <button
                  type="button"
                  onClick={() => void assistSelected()}
                  disabled={saving || !selected.readiness?.ready}
                  className="inline-flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Bot className="h-4 w-4" />
                  Assist Post
                </button>
                <button type="button" onClick={() => void saveSelected()} disabled={saving} className="edc-btn-primary inline-flex items-center gap-2 text-sm">
                  <Save className="h-4 w-4" />
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
              {assistLaunch ? (
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
                  <div className="font-semibold">Local browser assistant</div>
                  <div className="mt-1 text-xs">The assistant uses a dedicated Facebook browser profile. Log in once in that window and future runs will reuse it.</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button type="button" onClick={() => window.open(assistLaunch.localUrl, '_blank', 'noopener,noreferrer')} className="text-xs font-semibold underline">
                      Open local runner
                    </button>
                    <button type="button" onClick={() => void copyText('assist command', assistLaunch.command)} className="text-xs font-semibold underline">
                      Copy runner command
                    </button>
                  </div>
                </div>
              ) : null}
              {copied ? <div className="text-sm text-emerald-700">Copied {copied}.</div> : null}
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  )
}

function Field({ label, value, onChange, onCopy }: { label: string; value: string; onChange: (value: string) => void; onCopy?: () => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</span>
      <div className="flex gap-2">
        <input value={value} onChange={(event) => onChange(event.target.value)} className="edc-input" />
        {onCopy ? <button type="button" onClick={onCopy} className="edc-btn-ghost text-sm" aria-label={`Copy ${label}`}><Copy className="h-4 w-4" /></button> : null}
      </div>
    </label>
  )
}

function TextArea({ label, value, onChange, onCopy }: { label: string; value: string; onChange: (value: string) => void; onCopy?: () => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</span>
      <div className="space-y-2">
        <textarea value={value} onChange={(event) => onChange(event.target.value)} rows={8} className="edc-input min-h-40" />
        {onCopy ? <button type="button" onClick={onCopy} className="edc-btn-ghost inline-flex items-center gap-2 text-sm"><Copy className="h-4 w-4" />Copy</button> : null}
      </div>
    </label>
  )
}
