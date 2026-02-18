'use client'

import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import jsPDF from 'jspdf'
import NextImage from 'next/image'

import { renderBillOfSalePdf, type BillOfSaleData } from '../new/billOfSalePdf'

function DealsSignaturePageInner() {
  const searchParams = useSearchParams()
  const dealId = searchParams.get('dealId')

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const signatureBoxRef = useRef<HTMLDivElement | null>(null)
  const drawingRef = useRef(false)
  const lastPointRef = useRef<{ x: number; y: number } | null>(null)

  const [penSize, setPenSize] = useState(2)
  const [penColor, setPenColor] = useState('#111827')
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [pdfError, setPdfError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveModalOpen, setSaveModalOpen] = useState(false)
  const [saveOk, setSaveOk] = useState<boolean | null>(null)
  const [saveMessage, setSaveMessage] = useState<string>('')

  const title = useMemo(() => {
    if (dealId) return `Signature (Deal #${dealId})`
    return 'Signature'
  }, [dealId])

  useEffect(() => {
    const run = async () => {
      if (!dealId) return
      setPdfLoading(true)
      setPdfError(null)
      try {
        const res = await fetch(`/api/deals/${encodeURIComponent(dealId)}`)
        const deal = res.ok ? await res.json() : null
        const c = deal?.customer || {}
        const vRaw = deal?.vehicles?.[0] || {}
        const sv = vRaw.selectedVehicle || vRaw
        const v = {
          stock_number: sv.selected_stock_number ?? sv.stockNumber ?? sv.stock_number ?? '',
          year: sv.selected_year ?? sv.year ?? '',
          make: sv.selected_make ?? sv.make ?? '',
          model: sv.selected_model ?? sv.model ?? '',
          trim: sv.selected_trim ?? sv.trim ?? '',
          vin: sv.selected_vin ?? sv.vin ?? '',
          exterior_color: sv.selected_exterior_color ?? sv.exteriorColor ?? sv.exterior_color ?? '',
          interior_color: sv.selected_interior_color ?? sv.interiorColor ?? sv.interior_color ?? '',
          odometer: sv.selected_odometer ?? sv.odometer ?? '',
          odometer_unit: sv.selected_odometer_unit ?? sv.odometerUnit ?? sv.odometer_unit ?? 'kms',
          status: sv.selected_status ?? sv.status ?? 'Used',
        }

        const w = deal?.worksheet || {}
        const d = deal?.delivery || {}
        const disc = deal?.disclosures || {}

        const parseFeeItems = (raw: any): any[] => {
          if (!raw) return []
          if (Array.isArray(raw)) return raw
          if (typeof raw === 'string') {
            try {
              const parsed = JSON.parse(raw)
              return Array.isArray(parsed) ? parsed : []
            } catch {
              return []
            }
          }
          return []
        }

        const sumItems = (raw: any, amtKey: string) => {
          const items = parseFeeItems(raw)
          return items.reduce((s: number, i: any) => s + (Number(i?.[amtKey] ?? 0) || 0), 0)
        }

        const getOmvicFromFees = (rawFees: any): number => {
          const fees = parseFeeItems(rawFees)
          for (const f of fees) {
            const name = String(f?.fee_name ?? f?.name ?? f?.label ?? '').toLowerCase()
            if (!name) continue
            if (name.includes('omvic')) {
              const amt = Number(f?.fee_amount ?? f?.amount ?? f?.value ?? 0)
              return Number.isFinite(amt) ? amt : 0
            }
          }
          return 0
        }

        const price = Number(w.purchase_price ?? 0)
        const omvic = Number(w.omvic_fee ?? getOmvicFromFees(w.fees) ?? 0)
        const discount = Number(w.discount ?? 0)
        const subtotal1 = price + omvic
        const tradeValue = Number(w.trade_value ?? 0)
        const lienPayout = Number(w.lien_payout ?? 0)
        const netDiff = subtotal1 - discount - tradeValue + lienPayout
        const taxRate = Number(w.tax_rate ?? 0.13)
        const hst = netDiff * taxRate
        const totalTax = hst
        const licenseFee = Number(w.license_fee ?? 91)

        const feesTotal = sumItems(w.fees, 'amount')
        const accessoriesTotal = sumItems(w.accessories, 'price')
        const warrantiesTotal = sumItems(w.warranties, 'amount')
        const insurancesTotal = sumItems(w.insurances, 'amount')
        const paymentsTotal = sumItems(w.payments, 'amount')

        const subtotal2 = netDiff + totalTax + licenseFee + feesTotal + accessoriesTotal + warrantiesTotal + insurancesTotal + paymentsTotal
        const deposit = Number(w.deposit ?? 0)
        const downPayment = Number(w.down_payment ?? 0)
        const taxInsurance = Number(w.tax_on_insurance ?? 0)
        const totalDue = subtotal2 - deposit - downPayment + taxInsurance

        const fullName = [c.firstname, c.lastname].filter(Boolean).join(' ') || [c.first_name, c.last_name].filter(Boolean).join(' ') || ''
        const rawDealDate = String(c.dealdate ?? c.deal_date ?? c.dealDate ?? '').trim()

        const billData: BillOfSaleData = {
          dealDate: rawDealDate ? new Date(rawDealDate + 'T00:00:00').toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' }) : '',
          invoiceNumber: String(dealId || ''),
          fullName,
          phone: c.phone ?? '',
          mobile: c.mobile ?? '',
          email: c.email ?? '',
          address: c.street_address ?? c.streetaddress ?? '',
          city: c.city ?? '',
          province: c.province ?? 'ON',
          postalCode: c.postal_code ?? c.postalcode ?? '',
          driversLicense: c.drivers_license ?? c.driverslicense ?? '',
          insuranceCompany: c.insurance_company ?? c.insurancecompany ?? '',
          policyNumber: c.policy_number ?? c.policynumber ?? '',
          policyExpiry: c.policy_expiry ?? c.policyexpiry ?? '',
          stockNumber: v.stock_number,
          year: String(v.year ?? ''),
          make: String(v.make ?? ''),
          model: String(v.model ?? ''),
          trim: String(v.trim ?? ''),
          colour: String(v.exterior_color ?? ''),
          keyNumber: '',
          vin: String(v.vin ?? ''),
          odometerStatus: String(v.status ?? ''),
          odometer: v.odometer ? `${Number(v.odometer).toLocaleString()} ${v.odometer_unit || 'kms'}` : '',
          serviceDate: '',
          deliveryDate: d.delivery_date ?? '',
          vehiclePrice: String(price),
          omvicFee: String(omvic),
          subtotal1: String(subtotal1),
          netDifference: String(netDiff),
          hstOnNetDifference: String(hst),
          totalTax: String(totalTax),
          licenseFee: String(licenseFee),
          feesTotal: String(feesTotal),
          accessoriesTotal: String(accessoriesTotal),
          warrantiesTotal: String(warrantiesTotal),
          insurancesTotal: String(insurancesTotal),
          paymentsTotal: String(paymentsTotal),
          subtotal2: String(subtotal2),
          deposit: String(deposit),
          downPayment: String(downPayment),
          taxOnInsurance: String(taxInsurance),
          totalBalanceDue: String(totalDue),
          extendedWarranty: 'DECLINED',
          commentsHtml: disc.disclosures_html ?? '',
          purchaserName: fullName,
          purchaserSignatureB64: c.signature || undefined,
          salesperson: d.salesperson ?? '',
          salespersonRegNo: '4782496',
          acceptorName: d.approved_by ?? 'Syed Islam',
          acceptorRegNo: '4782496',
        }

        const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' })
        renderBillOfSalePdf(doc, billData, { pageStart: 1, totalPages: 3 })
        const ab = doc.output('arraybuffer')
        const blob = new Blob([ab], { type: 'application/pdf' })

        setPdfUrl((prev) => {
          if (prev) {
            try { URL.revokeObjectURL(prev) } catch {}
          }
          return URL.createObjectURL(blob)
        })
      } catch (e: any) {
        setPdfError(e?.message || 'Failed to load bill of sale')
      } finally {
        setPdfLoading(false)
      }
    }

    void run()

    return () => {
      setPdfUrl((prev) => {
        if (prev) {
          try { URL.revokeObjectURL(prev) } catch {}
        }
        return null
      })
    }
  }, [dealId])

  const getCanvas = () => canvasRef.current

  const getCtx = () => {
    const c = getCanvas()
    if (!c) return null
    return c.getContext('2d')
  }

  const getPointFromEvent = (e: PointerEvent) => {
    const c = getCanvas()
    if (!c) return null
    const rect = c.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    return { x, y }
  }

  const ensureHiDpi = () => {
    const c = getCanvas()
    if (!c) return

    const rect = c.getBoundingClientRect()
    const cssW = Math.max(1, Math.floor(rect.width))
    const cssH = Math.max(1, Math.floor(rect.height))
    const dpr = window.devicePixelRatio || 1

    const nextW = Math.floor(cssW * dpr)
    const nextH = Math.floor(cssH * dpr)

    if (c.width === nextW && c.height === nextH) return

    const ctx = c.getContext('2d')
    if (!ctx) return

    const prev = document.createElement('canvas')
    prev.width = c.width
    prev.height = c.height
    const prevCtx = prev.getContext('2d')
    if (prevCtx) prevCtx.drawImage(c, 0, 0)

    c.width = nextW
    c.height = nextH

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = penColor
    ctx.lineWidth = penSize

    if (prev.width && prev.height) {
      ctx.drawImage(prev, 0, 0, prev.width, prev.height, 0, 0, cssW, cssH)
    }
  }

  const applyPen = () => {
    const ctx = getCtx()
    if (!ctx) return
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = penColor
    ctx.lineWidth = penSize
  }

  const startDraw = (e: PointerEvent) => {
    const c = getCanvas()
    const ctx = getCtx()
    if (!c || !ctx) return

    ensureHiDpi()
    applyPen()

    const p = getPointFromEvent(e)
    if (!p) return

    drawingRef.current = true
    lastPointRef.current = p

    ctx.beginPath()
    ctx.moveTo(p.x, p.y)
  }

  const moveDraw = (e: PointerEvent) => {
    if (!drawingRef.current) return
    const ctx = getCtx()
    if (!ctx) return

    const p = getPointFromEvent(e)
    if (!p) return

    const last = lastPointRef.current
    if (!last) {
      lastPointRef.current = p
      return
    }

    ctx.beginPath()
    ctx.moveTo(last.x, last.y)
    ctx.lineTo(p.x, p.y)
    ctx.stroke()

    lastPointRef.current = p
  }

  const endDraw = () => {
    drawingRef.current = false
    lastPointRef.current = null
  }

  const clear = () => {
    const c = getCanvas()
    const ctx = getCtx()
    if (!c || !ctx) return

    const rect = c.getBoundingClientRect()
    ctx.clearRect(0, 0, rect.width, rect.height)
    setDataUrl(null)
  }

  const save = async () => {
    if (saving) return
    const c = getCanvas()
    if (!c) return
    const url = c.toDataURL('image/png')
    setDataUrl(url)
    const key = dealId ? `edc_deal_signature_${dealId}` : 'edc_deal_signature'
    window.localStorage.setItem(key, url)

    setSaving(true)
    setSaveModalOpen(false)
    setSaveOk(null)
    setSaveMessage('')

    try {
      const b64 = url.split(',')[1] || url
      
      let ipAddress = 'unknown'
      try {
        const ipRes = await fetch('https://api.ipify.org?format=json')
        const ipData = await ipRes.json()
        ipAddress = ipData.ip || 'unknown'
      } catch {
        // ignore
      }

      const macAddress = 'unavailable-browser'

      const hookRes = await fetch('https://primary-production-6722.up.railway.app/webhook/receive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: dealId || null,
          signature_b64: b64,
          ip_address: ipAddress,
          mac_address: macAddress,
        }),
      })

      if (!hookRes.ok) {
        const t = await hookRes.text().catch(() => '')
        throw new Error(t || `Webhook failed (${hookRes.status})`)
      }

      const maybeJson = await hookRes
        .clone()
        .json()
        .then((j) => (j ? JSON.stringify(j) : ''))
        .catch(() => '')

      setSaveOk(true)
      setSaveMessage(maybeJson || 'Signature saved successfully.')
      setSaveModalOpen(true)
    } catch (err) {
      setSaveOk(false)
      setSaveMessage(err instanceof Error ? err.message : 'Failed to send signature to webhook.')
      setSaveModalOpen(true)
    }

    setSaving(false)
  }

  useEffect(() => {
    ensureHiDpi()
    applyPen()
  }, [])

  useEffect(() => {
    const c = getCanvas()
    if (!c) return

    const onPointerDown = (e: PointerEvent) => {
      c.setPointerCapture(e.pointerId)
      startDraw(e)
    }
    const onPointerMove = (e: PointerEvent) => moveDraw(e)
    const onPointerUp = () => endDraw()
    const onPointerCancel = () => endDraw()

    c.addEventListener('pointerdown', onPointerDown)
    c.addEventListener('pointermove', onPointerMove)
    c.addEventListener('pointerup', onPointerUp)
    c.addEventListener('pointercancel', onPointerCancel)

    return () => {
      c.removeEventListener('pointerdown', onPointerDown)
      c.removeEventListener('pointermove', onPointerMove)
      c.removeEventListener('pointerup', onPointerUp)
      c.removeEventListener('pointercancel', onPointerCancel)
    }
  }, [penColor, penSize])

  useEffect(() => {
    const onResize = () => {
      ensureHiDpi()
      applyPen()
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [penColor, penSize])

  useEffect(() => {
    const host = signatureBoxRef.current
    if (!host) return

    const ro = new ResizeObserver(() => {
      ensureHiDpi()
      applyPen()
    })
    ro.observe(host)
    return () => ro.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    applyPen()
  }, [penColor, penSize])

  useEffect(() => {
    try {
      const key = dealId ? `edc_deal_signature_${dealId}` : 'edc_deal_signature'
      const existing = window.localStorage.getItem(key)
      if (!existing) return

      const ImgCtor = typeof window !== 'undefined' ? window.Image : null
      if (!ImgCtor) return
      const img = new ImgCtor()
      img.onload = () => {
        const c = getCanvas()
        const ctx = getCtx()
        if (!c || !ctx) return
        ensureHiDpi()
        const rect = c.getBoundingClientRect()
        ctx.drawImage(img, 0, 0, rect.width, rect.height)
        setDataUrl(existing)
      }
      img.src = existing
    } catch {
      // ignore
    }
  }, [dealId])

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-[#070A10] via-[#0B1220] to-[#070A10]">
      <div className="sticky top-0 z-10 border-b border-white/10 bg-[#0b1220]/75 backdrop-blur">
        <div className="w-full px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex flex-col items-center text-center">
            <div className="relative h-14 w-14 sm:h-16 sm:w-16">
              <NextImage src="/images/logo.png" alt="EDC" fill className="object-contain" />
            </div>
            <div className="mt-2 text-lg sm:text-xl font-extrabold tracking-tight text-white">{title}</div>
            <div className="mt-1 text-xs text-white/60">Review the Bill of Sale first, then sign below.</div>
          </div>
        </div>
      </div>

      <div className="w-full px-4 sm:px-6 lg:px-8 py-6">
        <div className="rounded-2xl border border-white/10 bg-[#0b1220]/70 backdrop-blur shadow-[0_18px_60px_rgba(0,0,0,0.45)] p-4 sm:p-6">
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div>
              <div className="text-sm font-semibold text-white">Bill of Sale</div>
              <div className="text-xs text-white/60">Drag the bottom-right corner to resize. The document stays centered.</div>
            </div>
          </div>

          <div className="mt-4 flex justify-center">
            <div
              className="max-w-full rounded-xl border-2 border-black bg-white overflow-hidden"
              style={{ width: '1100px', height: '560px', resize: 'both', overflow: 'hidden', boxShadow: '0 0 0 1px rgba(255,255,255,0.06) inset' }}
            >
              {pdfError ? (
                <div className="rounded border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm">{pdfError}</div>
              ) : pdfLoading ? (
                <div className="flex items-center justify-center text-gray-500 w-full h-full">Loading...</div>
              ) : pdfUrl ? (
                <iframe
                  title="Bill of Sale"
                  src={pdfUrl}
                  className="w-full h-full border-0"
                />
              ) : (
                <div className="flex items-center justify-center text-gray-500 w-full h-full">No Bill of Sale</div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-white/10 bg-[#0b1220]/70 backdrop-blur shadow-[0_18px_60px_rgba(0,0,0,0.45)] p-4 sm:p-6">
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div>
              <div className="text-sm font-semibold text-white">E‑Signature</div>
              <div className="text-xs text-white/60">Draw your signature below.</div>
            </div>

            <div className="flex items-end gap-3">
              <div>
                <div className="text-[11px] font-semibold text-white/70 mb-1">Pen Size</div>
                <input
                  type="number"
                  value={penSize}
                  min={1}
                  max={12}
                  onChange={(e) => setPenSize(Math.min(12, Math.max(1, Number(e.target.value) || 2)))}
                  className="w-28 h-9 border border-white/15 rounded px-3 text-sm bg-white/5 text-white outline-none"
                />
              </div>
              <div>
                <div className="text-[11px] font-semibold text-white/70 mb-1">Pen Color</div>
                <input
                  type="color"
                  value={penColor}
                  onChange={(e) => setPenColor(e.target.value)}
                  className="w-28 h-9 border border-white/15 rounded px-2 py-1 bg-white/5"
                />
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-center">
            <div className="text-sm font-bold text-white">Purpose of Signature</div>
            <div className="mt-1 text-sm font-semibold text-white/90 leading-relaxed">
              By signing below, you confirm that you have reviewed and agree to the Bill of Sale and all included terms, fees, and disclosures.
            </div>
          </div>

          <div className="mt-4 flex justify-center">
            <div
              ref={signatureBoxRef}
              className="max-w-full rounded-xl border-2 border-black bg-white overflow-hidden"
              style={{ width: '1100px', height: '320px', resize: 'both', overflow: 'hidden', boxShadow: '0 0 0 1px rgba(255,255,255,0.06) inset' }}
            >
              <canvas ref={canvasRef} className="w-full h-full touch-none" />
            </div>
          </div>

          <div className="mt-4 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={clear}
              disabled={saving}
              className="h-10 px-4 rounded-lg bg-white/10 text-white text-sm font-semibold hover:bg-white/15 border border-white/10"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="h-10 px-4 rounded-lg bg-[#118df0] text-white text-sm font-semibold hover:bg-[#0d6ebd] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>

      {saveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setSaveModalOpen(false)} />
          <div className="relative w-full max-w-md rounded-xl border border-white/10 bg-[#0b1220] shadow-[0_18px_60px_rgba(0,0,0,0.55)] p-5">
            <div className="text-sm font-extrabold text-white">
              {saveOk ? 'Successful' : 'Failed'}
            </div>
            <div className="mt-2 text-sm text-white/70 break-words whitespace-pre-wrap">{saveMessage}</div>
            <div className="mt-4 flex justify-end">
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function DealsSignaturePage() {
  return (
    <Suspense fallback={null}>
      <DealsSignaturePageInner />
    </Suspense>
  )
}
