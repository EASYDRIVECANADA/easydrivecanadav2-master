'use client'

import { useEffect, useMemo, useState } from 'react'

export default function WorksheetTab({
  dealMode = 'RTL',
  dealType = 'Cash',
  dealDate,
}: {
  dealMode?: 'RTL' | 'WHL'
  dealType?: 'Cash' | 'Finance'
  dealDate?: string
}) {
  const [worksheetSaving, setWorksheetSaving] = useState(false)
  const [worksheetSaveError, setWorksheetSaveError] = useState<string | null>(null)
  const [purchasePrice, setPurchasePrice] = useState('0')
  const [discount, setDiscount] = useState('0')
  type TaxCode = 'HST' | 'RST' | 'GST' | 'PST' | 'EXEMPT' | 'QST'
  const [taxCode, setTaxCode] = useState<TaxCode>('HST')
  const [taxMenuOpen, setTaxMenuOpen] = useState(false)
  const taxRate = useMemo(() => {
    switch (taxCode) {
      case 'HST':
        return 0.13
      case 'RST':
        return 0.08
      case 'GST':
        return 0.05
      case 'PST':
        return 0.06
      case 'QST':
        return 0.09975
      case 'EXEMPT':
      default:
        return 0
    }
  }, [taxCode])
  const [taxOverride, setTaxOverride] = useState(false)
  const [taxManual, setTaxManual] = useState('0')
  const [licenseFee, setLicenseFee] = useState('')
  const [tradeValue, setTradeValue] = useState('0')
  const [actualCashValue, setActualCashValue] = useState('0')
  const [lienPayout, setLienPayout] = useState('0')
  const [newPlates, setNewPlates] = useState(false)
  const [renewalOnly, setRenewalOnly] = useState(false)
  const [financeOverride, setFinanceOverride] = useState(false)
  const [financeRate, setFinanceRate] = useState('') // annual %
  const [financeTermMonths, setFinanceTermMonths] = useState('')
  const [paymentType, setPaymentType] = useState<'Weekly' | 'Bi-Weekly' | 'Semi-Monthly' | 'Monthly'>('Bi-Weekly')
  const [firstPaymentDate, setFirstPaymentDate] = useState('')
  const [lienHolder, setLienHolder] = useState('')
  const [financeRateType, setFinanceRateType] = useState<'VAR' | 'FXD'>('VAR')
  const [financeCommission, setFinanceCommission] = useState('')
  const [commissionOpen, setCommissionOpen] = useState(false)
  const [feeSearch, setFeeSearch] = useState('')
  const [fees, setFees] = useState<Array<{ id: string; name: string; desc?: string; amount: number }>>([])
  const [feeDraft, setFeeDraft] = useState<{ name: string; desc: string; amount: string } | null>(null)
  const [editingFeeId, setEditingFeeId] = useState<string | null>(null)
  const [editingDraft, setEditingDraft] = useState<{ name: string; desc: string; amount: string } | null>(null)
  const [feeDetailsOpen, setFeeDetailsOpen] = useState(false)
  const [feeDetailsForId, setFeeDetailsForId] = useState<string | null>(null)
  const [feeTaxMenuOpen, setFeeTaxMenuOpen] = useState(false)
  const [feeTaxSelected, setFeeTaxSelected] = useState<Record<string, boolean>>({ 'Default Tax 0 %': true })
  const [feeTaxOverride, setFeeTaxOverride] = useState(false)
  const [feeShowTaxDetails, setFeeShowTaxDetails] = useState(false)
  const [feeTaxValues, setFeeTaxValues] = useState<Record<string, string>>({})
  const feeDetailsFee = useMemo(() => fees.find((x) => x.id === feeDetailsForId) || null, [fees, feeDetailsForId])
  const getFeeTaxRate = (label: string) => {
    const l = label.toLowerCase()
    if (l.includes('hst')) return 0.13
    if (l.includes('rst')) return 0.08
    if (l.includes('gst')) return 0.05
    if (l.includes('pst')) return 0.06
    if (l.includes('qst')) return 0.09975
    // exempt or default
    return 0
  }
  const [payments, setPayments] = useState<Array<{ id: string; amount: number; type: string; desc?: string; category: string }>>([])
  const [paymentDrafts, setPaymentDrafts] = useState<Array<{ id: string; amount: string; type: string; desc: string; category: string }>>([])
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null)
  const [editingPaymentDraft, setEditingPaymentDraft] = useState<{ amount: string; type: string; desc: string } | null>(null)
  const [accessorySearch, setAccessorySearch] = useState('')
  const [accessories, setAccessories] = useState<Array<{ id: string; name: string; desc?: string; price: number }>>([])
  const [accessoryDraft, setAccessoryDraft] = useState<{ name: string; desc: string; price: string } | null>(null)
  const [editingAccessoryId, setEditingAccessoryId] = useState<string | null>(null)
  const [editingAccessoryDraft, setEditingAccessoryDraft] = useState<{ name: string; desc: string; price: string } | null>(null)
  const [accDetailsOpen, setAccDetailsOpen] = useState(false)
  const [accDetailsForId, setAccDetailsForId] = useState<string | null>(null)
  const [accVehicleType, setAccVehicleType] = useState('')
  const [accTaxMenuOpen, setAccTaxMenuOpen] = useState(false)
  const [accTaxSelected, setAccTaxSelected] = useState<Record<string, boolean>>({ 'HST 13 %': true })
  const [accTaxOverride, setAccTaxOverride] = useState(false)
  const [accShowTaxDetails, setAccShowTaxDetails] = useState(false)
  const [accTaxValues, setAccTaxValues] = useState<Record<string, string>>({})
  const accDetailsItem = useMemo(() => accessories.find((x) => x.id === accDetailsForId) || null, [accessories, accDetailsForId])
  const [warrantySearch, setWarrantySearch] = useState('')
  const [warranties, setWarranties] = useState<Array<{ id: string; name: string; desc?: string; amount: number }>>([])
  const [warrantyDraft, setWarrantyDraft] = useState<{ name: string; desc: string; amount: string } | null>(null)
  const [editingWarrantyId, setEditingWarrantyId] = useState<string | null>(null)
  const [editingWarrantyDraft, setEditingWarrantyDraft] = useState<{ name: string; desc: string; amount: string } | null>(null)
  const [warDetailsOpen, setWarDetailsOpen] = useState(false)
  const [warDetailsForId, setWarDetailsForId] = useState<string | null>(null)
  const [warDuration, setWarDuration] = useState('')
  const [warDistance, setWarDistance] = useState('')
  const [warDealerGuaranty, setWarDealerGuaranty] = useState(false)
  const [warTaxMenuOpen, setWarTaxMenuOpen] = useState(false)
  const [warTaxSelected, setWarTaxSelected] = useState<Record<string, boolean>>({ 'HST 13 %': true })
  const [warTaxOverride, setWarTaxOverride] = useState(false)
  const [warShowTaxDetails, setWarShowTaxDetails] = useState(false)
  const [warTaxValues, setWarTaxValues] = useState<Record<string, string>>({})
  const warDetailsItem = useMemo(() => warranties.find((x) => x.id === warDetailsForId) || null, [warranties, warDetailsForId])
  const [insuranceSearch, setInsuranceSearch] = useState('')
  const [insurances, setInsurances] = useState<Array<{ id: string; name: string; desc?: string; amount: number }>>([])
  const [insuranceDraft, setInsuranceDraft] = useState<{ name: string; desc: string; amount: string } | null>(null)
  const [editingInsuranceId, setEditingInsuranceId] = useState<string | null>(null)
  const [editingInsuranceDraft, setEditingInsuranceDraft] = useState<{ name: string; desc: string; amount: string } | null>(null)
  const [insDetailsOpen, setInsDetailsOpen] = useState(false)
  const [insDetailsForId, setInsDetailsForId] = useState<string | null>(null)
  const [insDeductible, setInsDeductible] = useState('0')
  const [insDuration, setInsDuration] = useState('')
  const [insType, setInsType] = useState('')
  const [insTaxMenuOpen, setInsTaxMenuOpen] = useState(false)
  const [insTaxSelected, setInsTaxSelected] = useState<Record<string, boolean>>({ 'HST 13 %': true })
  const [insTaxOverride, setInsTaxOverride] = useState(false)
  const [insShowTaxDetails, setInsShowTaxDetails] = useState(false)
  const [insTaxValues, setInsTaxValues] = useState<Record<string, string>>({})
  const insDetailsItem = useMemo(() => insurances.find((x) => x.id === insDetailsForId) || null, [insurances, insDetailsForId])

  type WorksheetCardKey = 'fees' | 'accessories' | 'warranties' | 'insurances' | 'payments'
  const [cardsOrder, setCardsOrder] = useState<WorksheetCardKey[]>(['fees', 'accessories', 'warranties', 'insurances', 'payments'])
  const [draggingCard, setDraggingCard] = useState<WorksheetCardKey | null>(null)
  const reorderCards = (from: WorksheetCardKey, to: WorksheetCardKey) => {
    if (from === to) return
    setCardsOrder((prev) => {
      const next = prev.filter((k) => k !== from)
      const idx = next.indexOf(to)
      if (idx < 0) return prev
      next.splice(idx, 0, from)
      return next
    })
  }

  const resetWorksheet = () => {
    setWorksheetSaveError(null)

    setPurchasePrice('0')
    setDiscount('0')
    setTaxCode('HST')
    setTaxMenuOpen(false)
    setTaxOverride(false)
    setTaxManual('0')
    setLicenseFee('')
    setTradeValue('0')
    setActualCashValue('0')
    setLienPayout('0')
    setNewPlates(false)
    setRenewalOnly(false)

    setFinanceOverride(false)
    setFinanceRate('')
    setFinanceTermMonths('')
    setPaymentType('Bi-Weekly')
    setFirstPaymentDate('')
    setLienHolder('')
    setFinanceRateType('VAR')
    setFinanceCommission('')
    setCommissionOpen(false)

    setFeeSearch('')
    setFees([])
    setFeeDraft(null)
    setEditingFeeId(null)
    setEditingDraft(null)
    setFeeDetailsOpen(false)
    setFeeDetailsForId(null)
    setFeeTaxMenuOpen(false)
    setFeeTaxSelected({ 'Default Tax 0 %': true })
    setFeeTaxOverride(false)
    setFeeShowTaxDetails(false)
    setFeeTaxValues({})

    setPayments([])
    setPaymentDrafts([])
    setEditingPaymentId(null)
    setEditingPaymentDraft(null)

    setAccessorySearch('')
    setAccessories([])
    setAccessoryDraft(null)
    setEditingAccessoryId(null)
    setEditingAccessoryDraft(null)
    setAccDetailsOpen(false)
    setAccDetailsForId(null)
    setAccVehicleType('')
    setAccTaxMenuOpen(false)
    setAccTaxSelected({ 'HST 13 %': true })
    setAccTaxOverride(false)
    setAccShowTaxDetails(false)
    setAccTaxValues({})

    setWarrantySearch('')
    setWarranties([])
    setWarrantyDraft(null)
    setEditingWarrantyId(null)
    setEditingWarrantyDraft(null)
    setWarDetailsOpen(false)
    setWarDetailsForId(null)
    setWarDuration('')
    setWarDistance('')
    setWarDealerGuaranty(false)
    setWarTaxMenuOpen(false)
    setWarTaxSelected({ 'HST 13 %': true })
    setWarTaxOverride(false)
    setWarShowTaxDetails(false)
    setWarTaxValues({})

    setInsuranceSearch('')
    setInsurances([])
    setInsuranceDraft(null)
    setEditingInsuranceId(null)
    setEditingInsuranceDraft(null)
    setInsDetailsOpen(false)
    setInsDetailsForId(null)
    setInsDeductible('0')
    setInsDuration('')
    setInsType('')
    setInsTaxMenuOpen(false)
    setInsTaxSelected({ 'HST 13 %': true })
    setInsTaxOverride(false)
    setInsShowTaxDetails(false)
    setInsTaxValues({})

    setCardsOrder(['fees', 'accessories', 'warranties', 'insurances', 'payments'])
    setDraggingCard(null)
  }

  const parseMoney = (v: string) => {
    if (!v) return 0
    const n = parseFloat(String(v).replace(/,/g, ''))
    return Number.isNaN(n) ? 0 : n
  }
  const fmtMoney = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const stripLeadingZeros = (v: string) => {
    if (!v) return v
    // Preserve a single leading 0 only for decimals like 0.5
    if (v.startsWith('0') && v.length > 1 && v[1] !== '.') {
      return v.replace(/^0+(?=\d)/, '')
    }
    return v
  }

  const addPaymentDraft = (category: string) => {
    const id = `pay_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
    setPaymentDrafts((prev) => [{ id, amount: '0', type: 'Cash', desc: '', category }, ...prev])
  }
  const updatePaymentDraft = (id: string, field: 'amount' | 'type' | 'desc', value: string) => {
    setPaymentDrafts((prev) =>
      prev.map((d) => (d.id === id ? { ...d, [field]: field === 'amount' ? value.replace(/[^0-9.]/g, '') : value } : d))
    )
  }
  const commitPaymentDraft = (id: string) => {
    const d = paymentDrafts.find((x) => x.id === id)
    if (!d) return
    const amt = parseMoney(d.amount)
    setPayments((prev) => [{ id, amount: amt, type: d.type, desc: d.desc, category: d.category }, ...prev])
    setPaymentDrafts((prev) => prev.filter((x) => x.id !== id))
  }

  const startEditPayment = (p: { id: string; amount: number; type: string; desc?: string }) => {
    setEditingPaymentId(p.id)
    setEditingPaymentDraft({ amount: String(p.amount ?? 0), type: p.type, desc: p.desc ?? '' })
  }
  const commitEditPayment = () => {
    if (!editingPaymentId || !editingPaymentDraft) return
    const amt = parseMoney(editingPaymentDraft.amount)
    setPayments((prev) => prev.map((x) => (x.id === editingPaymentId ? { ...x, amount: amt, type: editingPaymentDraft.type, desc: editingPaymentDraft.desc } : x)))
    setEditingPaymentId(null)
    setEditingPaymentDraft(null)
  }

  const subtotal = useMemo(() => {
    return Math.max(0, parseMoney(purchasePrice) - parseMoney(discount))
  }, [purchasePrice, discount])

  const netDifference = useMemo(() => Math.max(0, subtotal - parseMoney(tradeValue)), [subtotal, tradeValue])

  const tradeEquity = useMemo(() => parseMoney(actualCashValue) - parseMoney(tradeValue), [actualCashValue, tradeValue])

  const computedTax = useMemo(() => netDifference * taxRate, [netDifference, taxRate])
  const totalTax = taxOverride ? parseMoney(taxManual) : computedTax

  const totalBalanceDue = useMemo(
    () => netDifference + totalTax + parseMoney(licenseFee) + parseMoney(lienPayout) - tradeEquity,
    [netDifference, totalTax, licenseFee, lienPayout, tradeEquity]
  )

  const financedAmount = useMemo(() => totalBalanceDue, [totalBalanceDue])
  const periodsPerYear = useMemo(() => {
    switch (paymentType) {
      case 'Weekly':
        return 52
      case 'Bi-Weekly':
        return 26
      case 'Semi-Monthly':
        return 24
      case 'Monthly':
      default:
        return 12
    }
  }, [paymentType])
  const financeCalc = useMemo(() => {
    const P = financedAmount || 0
    const termMonths = parseMoney(financeTermMonths)
    const n = Math.max(1, Math.round((termMonths / 12) * periodsPerYear))
    const apr = parseMoney(financeRate) / 100
    const r = apr / periodsPerYear
    if (n <= 0) return { payment: 0, interest: 0 }
    let pmnt = 0
    if (r > 0) {
      pmnt = P * (r / (1 - Math.pow(1 + r, -n)))
    } else {
      pmnt = P / n
    }
    const totalPaid = pmnt * n
    const interest = Math.max(0, totalPaid - P)
    return { payment: pmnt, interest }
  }, [financedAmount, financeTermMonths, periodsPerYear, financeRate])

  const feesTotal = useMemo(() => fees.reduce((s, f) => s + (Number(f.amount) || 0), 0), [fees])
  const paymentsTotal = useMemo(() => payments.reduce((s, p) => s + (Number(p.amount) || 0), 0), [payments])
  const filteredFees = useMemo(
    () =>
      fees.filter((f) =>
        feeSearch.trim() ? `${f.name} ${f.desc ?? ''}`.toLowerCase().includes(feeSearch.trim().toLowerCase()) : true
      ),
    [fees, feeSearch]
  )

  const addFeeFromSearch = () => {
    const name = (feeSearch || '').trim() || 'New Fee'
    setFeeDraft({ name, desc: '', amount: '0' })
    setFeeSearch('')
  }
  const commitFeeDraft = () => {
    if (!feeDraft) return
    const id = `fee_${Date.now()}`
    const amountNum = parseMoney(feeDraft.amount)
    setFees((prev) => [{ id, name: feeDraft.name || 'New Fee', desc: feeDraft.desc, amount: amountNum }, ...prev])
    setFeeDraft(null)
  }

  const startEditFee = (f: { id: string; name: string; desc?: string; amount: number }) => {
    setEditingFeeId(f.id)
    setEditingDraft({ name: f.name, desc: f.desc ?? '', amount: String(f.amount ?? 0) })
  }
  const commitEditFee = () => {
    if (!editingFeeId || !editingDraft) return
    const amt = parseMoney(editingDraft.amount)
    setFees((prev) => prev.map((x) => (x.id === editingFeeId ? { ...x, name: editingDraft.name, desc: editingDraft.desc, amount: amt } : x)))
    setEditingFeeId(null)
    setEditingDraft(null)
  }
  const accessoriesTotal = useMemo(() => accessories.reduce((s, a) => s + (Number(a.price) || 0), 0), [accessories])
  const warrantiesTotal = useMemo(() => warranties.reduce((s, w) => s + (Number(w.amount) || 0), 0), [warranties])
  const insurancesTotal = useMemo(() => insurances.reduce((s, i) => s + (Number(i.amount) || 0), 0), [insurances])
  const filteredAccessories = useMemo(
    () =>
      accessories.filter((a) =>
        accessorySearch.trim()
          ? `${a.name} ${a.desc ?? ''}`.toLowerCase().includes(accessorySearch.trim().toLowerCase())
          : true
      ),
    [accessories, accessorySearch]
  )
  const filteredWarranties = useMemo(
    () =>
      warranties.filter((w) =>
        warrantySearch.trim()
          ? `${w.name} ${w.desc ?? ''}`.toLowerCase().includes(warrantySearch.trim().toLowerCase())
          : true
      ),
    [warranties, warrantySearch]
  )
  const filteredInsurances = useMemo(
    () =>
      insurances.filter((i) =>
        insuranceSearch.trim()
          ? `${i.name} ${i.desc ?? ''}`.toLowerCase().includes(insuranceSearch.trim().toLowerCase())
          : true
      ),
    [insurances, insuranceSearch]
  )

  const submitWorksheet = async () => {
    const norm = (v: any) => {
      if (v === undefined || v === null) return null
      if (typeof v === 'string') {
        const t = v.trim()
        return t === '' ? null : t
      }
      return v
    }

    const payload = {
      dealMode: norm(dealMode),
      dealType: norm(dealType),
      dealDate: norm(dealDate),
      // Deal Breakdown fields (stringified numbers to keep consistency)
      purchasePrice: norm(purchasePrice),
      discount: norm(discount),
      subtotal: norm(String(subtotal ?? 0)),
      tradeValue: norm(tradeValue),
      actualCashValue: norm(actualCashValue),
      netDifference: norm(String(netDifference ?? 0)),
      taxCode: norm(taxCode),
      taxRate: norm(String(taxRate ?? 0)),
      taxOverride: norm(taxOverride),
      taxManual: norm(taxManual),
      totalTax: norm(String(totalTax ?? 0)),
      lienPayout: norm(lienPayout),
      tradeEquity: norm(String(tradeEquity ?? 0)),
      licenseFee: norm(licenseFee),
      newPlates: norm(newPlates),
      renewalOnly: norm(renewalOnly),
      totalBalanceDue: norm(String(totalBalanceDue ?? 0)),

      // Financing
      financing: {
        financedAmount: norm(String(financedAmount ?? 0)),
        financeOverride: norm(financeOverride),
        financeRate: norm(financeRate),
        financeTermMonths: norm(financeTermMonths),
        paymentType: norm(paymentType),
        financeInterest: norm(String(financeCalc.interest ?? 0)),
        payment: norm(String(financeCalc.payment ?? 0)),
        firstPaymentDate: norm(firstPaymentDate),
        lienHolder: norm(lienHolder),
        financeRateType: norm(financeRateType),
        financeCommission: norm(financeCommission),
      },

      // Arrays for all line items (empty arrays if none)
      fees: (fees || []).map((f) => ({ id: norm(f.id), name: norm(f.name), desc: norm(f.desc), amount: norm(String(f.amount ?? 0)) })),
      accessories: (accessories || []).map((a) => ({ id: norm(a.id), name: norm(a.name), desc: norm(a.desc), price: norm(String(a.price ?? 0)) })),
      warranties: (warranties || []).map((w) => ({ id: norm(w.id), name: norm(w.name), desc: norm(w.desc), amount: norm(String(w.amount ?? 0)) })),
      insurances: (insurances || []).map((i) => ({ id: norm(i.id), name: norm(i.name), desc: norm(i.desc), amount: norm(String(i.amount ?? 0)) })),
      payments: (payments || []).map((p) => ({ id: norm(p.id), amount: norm(String(p.amount ?? 0)), type: norm(p.type), desc: norm(p.desc), category: norm(p.category) })),

      sections: (cardsOrder || []).map((k) => {
        if (k === 'fees') {
          return {
            key: 'fees',
            label: 'Fees',
            total: norm(String(feesTotal ?? 0)),
            rows: (fees || []).map((f) => ({ id: norm(f.id), name: norm(f.name), desc: norm(f.desc), amount: norm(String(f.amount ?? 0)) })),
          }
        }
        if (k === 'accessories') {
          return {
            key: 'accessories',
            label: 'Accessories',
            total: norm(String(accessoriesTotal ?? 0)),
            rows: (accessories || []).map((a) => ({ id: norm(a.id), name: norm(a.name), desc: norm(a.desc), price: norm(String(a.price ?? 0)) })),
          }
        }
        if (k === 'warranties') {
          return {
            key: 'warranties',
            label: 'Warranties',
            total: norm(String(warrantiesTotal ?? 0)),
            rows: (warranties || []).map((w) => ({ id: norm(w.id), name: norm(w.name), desc: norm(w.desc), amount: norm(String(w.amount ?? 0)) })),
          }
        }
        if (k === 'insurances') {
          return {
            key: 'insurances',
            label: 'Insurances',
            total: norm(String(insurancesTotal ?? 0)),
            rows: (insurances || []).map((i) => ({ id: norm(i.id), name: norm(i.name), desc: norm(i.desc), amount: norm(String(i.amount ?? 0)) })),
          }
        }
        return {
          key: 'payments',
          label: 'Payments',
          total: norm(String(paymentsTotal ?? 0)),
          rows: (payments || []).map((p) => ({ id: norm(p.id), amount: norm(String(p.amount ?? 0)), type: norm(p.type), desc: norm(p.desc), category: norm(p.category) })),
        }
      }),

      uiState: {
        cardsOrder: cardsOrder,

        feeDraft: feeDraft
          ? { name: norm(feeDraft.name), desc: norm(feeDraft.desc), amount: norm(feeDraft.amount) }
          : null,
        editingFeeId: norm(editingFeeId),
        editingFeeDraft: editingDraft
          ? { name: norm(editingDraft.name), desc: norm(editingDraft.desc), amount: norm(editingDraft.amount) }
          : null,
        feeDetailsOpen: norm(feeDetailsOpen),
        feeDetailsForId: norm(feeDetailsForId),
        feeTaxMenuOpen: norm(feeTaxMenuOpen),
        feeTaxSelected: feeTaxSelected,
        feeTaxOverride: norm(feeTaxOverride),
        feeShowTaxDetails: norm(feeShowTaxDetails),
        feeTaxValues: feeTaxValues,

        accessoryDraft: accessoryDraft
          ? { name: norm(accessoryDraft.name), desc: norm(accessoryDraft.desc), price: norm(accessoryDraft.price) }
          : null,
        editingAccessoryId: norm(editingAccessoryId),
        editingAccessoryDraft: editingAccessoryDraft
          ? { name: norm(editingAccessoryDraft.name), desc: norm(editingAccessoryDraft.desc), price: norm(editingAccessoryDraft.price) }
          : null,
        accDetailsOpen: norm(accDetailsOpen),
        accDetailsForId: norm(accDetailsForId),
        accVehicleType: norm(accVehicleType),
        accTaxMenuOpen: norm(accTaxMenuOpen),
        accTaxSelected: accTaxSelected,
        accTaxOverride: norm(accTaxOverride),
        accShowTaxDetails: norm(accShowTaxDetails),
        accTaxValues: accTaxValues,

        warrantyDraft: warrantyDraft
          ? { name: norm(warrantyDraft.name), desc: norm(warrantyDraft.desc), amount: norm(warrantyDraft.amount) }
          : null,
        editingWarrantyId: norm(editingWarrantyId),
        editingWarrantyDraft: editingWarrantyDraft
          ? { name: norm(editingWarrantyDraft.name), desc: norm(editingWarrantyDraft.desc), amount: norm(editingWarrantyDraft.amount) }
          : null,
        warDetailsOpen: norm(warDetailsOpen),
        warDetailsForId: norm(warDetailsForId),
        warDuration: norm(warDuration),
        warDistance: norm(warDistance),
        warDealerGuaranty: norm(warDealerGuaranty),
        warTaxMenuOpen: norm(warTaxMenuOpen),
        warTaxSelected: warTaxSelected,
        warTaxOverride: norm(warTaxOverride),
        warShowTaxDetails: norm(warShowTaxDetails),
        warTaxValues: warTaxValues,

        insuranceDraft: insuranceDraft
          ? { name: norm(insuranceDraft.name), desc: norm(insuranceDraft.desc), amount: norm(insuranceDraft.amount) }
          : null,
        editingInsuranceId: norm(editingInsuranceId),
        editingInsuranceDraft: editingInsuranceDraft
          ? { name: norm(editingInsuranceDraft.name), desc: norm(editingInsuranceDraft.desc), amount: norm(editingInsuranceDraft.amount) }
          : null,
        insDetailsOpen: norm(insDetailsOpen),
        insDetailsForId: norm(insDetailsForId),
        insDeductible: norm(insDeductible),
        insDuration: norm(insDuration),
        insType: norm(insType),
        insTaxMenuOpen: norm(insTaxMenuOpen),
        insTaxSelected: insTaxSelected,
        insTaxOverride: norm(insTaxOverride),
        insShowTaxDetails: norm(insShowTaxDetails),
        insTaxValues: insTaxValues,

        editingPaymentId: norm(editingPaymentId),
        editingPaymentDraft: editingPaymentDraft
          ? { amount: norm(editingPaymentDraft.amount), type: norm(editingPaymentDraft.type), desc: norm(editingPaymentDraft.desc) }
          : null,
        paymentDrafts: (paymentDrafts || []).map((d) => ({
          id: norm(d.id),
          amount: norm(d.amount),
          type: norm(d.type),
          desc: norm(d.desc),
          category: norm(d.category),
        })),
      },
    }

    try {
      setWorksheetSaveError(null)
      setWorksheetSaving(true)

      const res = await fetch('https://primary-production-6722.up.railway.app/webhook/worksheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true,
      })

      const raw = await res.text().catch(() => '')
      if (!res.ok) {
        throw new Error(raw || `Save failed (${res.status})`)
      }
      const ok = raw.trim().toLowerCase() === 'done'
      if (!ok) {
        throw new Error(raw || 'Webhook did not confirm save. Expected "Done"')
      }

      resetWorksheet()
    } catch (err) {
      const msg = (err as any)?.message || 'Failed to submit worksheet'
      setWorksheetSaveError(msg)
      console.error('Failed to submit worksheet', err)
    } finally {
      setWorksheetSaving(false)
    }
  }

  // Accessories helpers
  const addAccessoryFromSearch = () => {
    const name = (accessorySearch || '').trim() || 'New Accessory'
    setAccessoryDraft({ name, desc: '', price: '0' })
    setAccessorySearch('')
  }
  const commitAccessoryDraft = () => {
    if (!accessoryDraft) return
    const id = `acc_${Date.now()}`
    const price = parseMoney(accessoryDraft.price)
    setAccessories((prev) => [{ id, name: accessoryDraft.name, desc: accessoryDraft.desc, price }, ...prev])
    setAccessoryDraft(null)
  }
  const startEditAccessory = (a: { id: string; name: string; desc?: string; price: number }) => {
    setEditingAccessoryId(a.id)
    setEditingAccessoryDraft({ name: a.name, desc: a.desc ?? '', price: String(a.price ?? 0) })
  }
  const commitEditAccessory = () => {
    if (!editingAccessoryId || !editingAccessoryDraft) return
    const price = parseMoney(editingAccessoryDraft.price)
    setAccessories((prev) => prev.map((x) => (x.id === editingAccessoryId ? { ...x, name: editingAccessoryDraft.name, desc: editingAccessoryDraft.desc, price } : x)))
    setEditingAccessoryId(null)
    setEditingAccessoryDraft(null)
  }

  // Warranties helpers
  const addWarrantyFromSearch = () => {
    const name = (warrantySearch || '').trim() || 'New Warranty'
    setWarrantyDraft({ name, desc: '', amount: '0' })
    setWarrantySearch('')
  }
  const commitWarrantyDraft = () => {
    if (!warrantyDraft) return
    const id = `war_${Date.now()}`
    const amount = parseMoney(warrantyDraft.amount)
    setWarranties((prev) => [{ id, name: warrantyDraft.name, desc: warrantyDraft.desc, amount }, ...prev])
    setWarrantyDraft(null)
  }
  const startEditWarranty = (w: { id: string; name: string; desc?: string; amount: number }) => {
    setEditingWarrantyId(w.id)
    setEditingWarrantyDraft({ name: w.name, desc: w.desc ?? '', amount: String(w.amount ?? 0) })
  }
  const commitEditWarranty = () => {
    if (!editingWarrantyId || !editingWarrantyDraft) return
    const amount = parseMoney(editingWarrantyDraft.amount)
    setWarranties((prev) => prev.map((x) => (x.id === editingWarrantyId ? { ...x, name: editingWarrantyDraft.name, desc: editingWarrantyDraft.desc, amount } : x)))
    setEditingWarrantyId(null)
    setEditingWarrantyDraft(null)
  }

  // Insurances helpers
  const addInsuranceFromSearch = () => {
    const name = (insuranceSearch || '').trim() || 'New Insurance'
    setInsuranceDraft({ name, desc: '', amount: '0' })
    setInsuranceSearch('')
  }
  const commitInsuranceDraft = () => {
    if (!insuranceDraft) return
    const id = `ins_${Date.now()}`
    const amount = parseMoney(insuranceDraft.amount)
    setInsurances((prev) => [{ id, name: insuranceDraft.name, desc: insuranceDraft.desc, amount }, ...prev])
    setInsuranceDraft(null)
  }
  const startEditInsurance = (i: { id: string; name: string; desc?: string; amount: number }) => {
    setEditingInsuranceId(i.id)
    setEditingInsuranceDraft({ name: i.name, desc: i.desc ?? '', amount: String(i.amount ?? 0) })
  }
  const commitEditInsurance = () => {
    if (!editingInsuranceId || !editingInsuranceDraft) return
    const amount = parseMoney(editingInsuranceDraft.amount)
    setInsurances((prev) => prev.map((x) => (x.id === editingInsuranceId ? { ...x, name: editingInsuranceDraft.name, desc: editingInsuranceDraft.desc, amount } : x)))
    setEditingInsuranceId(null)
    setEditingInsuranceDraft(null)
  }

  useEffect(() => {
    if (!taxOverride) setTaxManual(fmtMoney(computedTax))
  }, [computedTax, taxOverride])

  const feesCard = (
    <div className="border border-gray-200 bg-white">
      <div className="h-10 px-3 border-b border-gray-200 flex items-center justify-between cursor-move">
        <div className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-2.21 0-4 1.343-4 3s1.79 3 4 3 4 1.343 4 3-1.79 3-4 3m0-12V4"/></svg>
          Fees
        </div>
        <div className="h-6 px-2 rounded bg-green-600 text-white text-xs font-semibold flex items-center">Total: ${fmtMoney(feesTotal)}</div>
      </div>
      <div className="p-3">
        <div className="relative flex items-center">
          <input
            placeholder="search fees"
            className="flex-1 h-10 border border-gray-200 rounded bg-white pl-10 pr-3 text-sm shadow-sm"
            value={feeSearch}
            onChange={(e) => setFeeSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addFeeFromSearch()
              }
            }}
          />
          <svg
            className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-4.35-4.35m1.35-5.65a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <button
            type="button"
            onClick={addFeeFromSearch}
            className="ml-2 h-10 px-3 rounded bg-[#118df0] text-white text-xs font-semibold hover:bg-[#0d6ebd]"
            title="Add Fee"
          >
            +
          </button>
        </div>

        <div className="mt-3 border border-gray-200">
          <div className="grid grid-cols-[40px_1fr_1fr_140px_80px] text-[10px] font-semibold text-gray-600 bg-gray-50 border-b border-gray-200">
            <div className="p-2" />
            <div className="p-2">FEE NAME</div>
            <div className="p-2">FEE DESC.</div>
            <div className="p-2">FEE AMOUNT</div>
            <div className="p-2 text-center">MORE</div>
          </div>
          {feeDraft ? (
            <div className="grid grid-cols-[40px_1fr_1fr_140px_80px] text-xs">
              <div className="p-2" />
              <div className="p-2">
                <input
                  className="w-full h-8 px-2 border border-gray-200 rounded text-sm"
                  value={feeDraft.name}
                  onChange={(e) => setFeeDraft({ ...feeDraft, name: e.target.value })}
                />
              </div>
              <div className="p-2">
                <textarea
                  className="w-full h-8 px-2 border border-gray-200 rounded text-sm"
                  value={feeDraft.desc}
                  onChange={(e) => setFeeDraft({ ...feeDraft, desc: e.target.value })}
                />
              </div>
              <div className="p-2">
                <input
                  className="w-full h-8 px-2 border border-gray-200 rounded text-sm"
                  value={feeDraft.amount}
                  onChange={(e) => setFeeDraft({ ...feeDraft, amount: e.target.value.replace(/[^0-9.]/g, '') })}
                />
              </div>
              <div className="p-2 flex items-center justify-center">
                <button
                  type="button"
                  className="h-8 w-8 rounded bg-[#118df0] text-white text-xs font-semibold hover:bg-[#0d6ebd]"
                  title="Save"
                  onClick={commitFeeDraft}
                >
                  ✓
                </button>
              </div>
            </div>
          ) : null}
          {!feeDraft && filteredFees.length === 0 ? (
            <div className="h-12 flex items-center justify-center text-xs text-gray-500">No Fees</div>
          ) : null}
          {filteredFees.map((f) => (
            editingFeeId === f.id && editingDraft ? (
              <div key={f.id} className="grid grid-cols-[40px_1fr_1fr_140px_80px] text-xs">
                <div className="p-2" />
                <div className="p-2">
                  <input
                    className="w-full h-8 px-2 border border-gray-200 rounded text-sm"
                    value={editingDraft.name}
                    onChange={(e) => setEditingDraft({ ...editingDraft, name: e.target.value })}
                  />
                </div>
                <div className="p-2">
                  <textarea
                    className="w-full h-8 px-2 border border-gray-200 rounded text-sm"
                    value={editingDraft.desc}
                    onChange={(e) => setEditingDraft({ ...editingDraft, desc: e.target.value })}
                  />
                </div>
                <div className="p-2">
                  <input
                    className="w-full h-8 px-2 border border-gray-200 rounded text-sm"
                    value={editingDraft.amount}
                    onChange={(e) => setEditingDraft({ ...editingDraft, amount: e.target.value.replace(/[^0-9.]/g, '') })}
                  />
                </div>
                <div className="p-2 flex items-center justify-center">
                  <button
                    type="button"
                    className="h-8 w-8 rounded bg-[#118df0] text-white text-xs font-semibold hover:bg-[#0d6ebd]"
                    title="Save"
                    onClick={commitEditFee}
                  >
                    ✓
                  </button>
                </div>
              </div>
            ) : (
              <div key={f.id} className="grid grid-cols-[40px_1fr_1fr_140px_80px] text-xs">
                <div className="p-2 flex items-center gap-3">
                  <button type="button" className="text-gray-600 hover:text-gray-800 text-lg" title="Edit" onClick={() => startEditFee(f)}>✎</button>
                  <button
                    type="button"
                    className="text-red-600 hover:text-red-700 text-lg"
                    title="Delete"
                    onClick={() => setFees((prev) => prev.filter((x) => x.id !== f.id))}
                  >
                    🗑
                  </button>
                </div>
                <div className="p-2 flex items-center">{f.name}</div>
                <div className="p-2">{f.desc}</div>
                <div className="p-2">${fmtMoney(Number(f.amount || 0))}</div>
                <div className="p-2 text-center">
                  <button
                    type="button"
                    className="px-2 text-gray-600 hover:text-gray-800"
                    onClick={() => { setFeeDetailsForId(f.id); setFeeDetailsOpen(true) }}
                    title="More"
                  >
                    ...
                  </button>
                </div>
              </div>
            )
          ))}
        </div>
      </div>
    </div>
  )

  const paymentsCard = (
    <div className="border border-gray-200 bg-white">
      <div className="h-10 px-3 border-b border-gray-200 flex items-center justify-between cursor-move">
        <div className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-2.21 0-4 1.343-4 3s1.79 3 4 3 4 1.343 4 3-1.79 3-4 3m0-12V4"/></svg>
          Payments
        </div>
        <div className="h-6 px-2 rounded bg-green-600 text-white text-xs font-semibold flex items-center">Total: ${fmtMoney(paymentsTotal)}</div>
      </div>

      <div className="p-3">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => addPaymentDraft('Deposit')} className="h-7 px-3 rounded bg-[#118df0] text-white text-xs font-semibold hover:bg-[#0d6ebd]">
            + Deposit
          </button>
          <button type="button" onClick={() => addPaymentDraft('Down Payment')} className="h-7 px-3 rounded bg-[#118df0] text-white text-xs font-semibold hover:bg-[#0d6ebd]">
            + Down Payment
          </button>
          <button type="button" onClick={() => addPaymentDraft('Security Deposit')} className="h-7 px-3 rounded bg-[#118df0] text-white text-xs font-semibold hover:bg-[#0d6ebd]">
            + Security Deposit
          </button>
        </div>

        <div className="mt-3 border border-gray-200">
          <div className="grid grid-cols-[40px_140px_140px_1fr_140px_50px] text-[10px] font-semibold text-gray-600 bg-gray-50 border-b border-gray-200">
            <div className="p-2" />
            <div className="p-2">AMOUNT</div>
            <div className="p-2">TYPE</div>
            <div className="p-2">DESCRIPTION</div>
            <div className="p-2">CATEGORY</div>
            <div className="p-2" />
          </div>

          {paymentDrafts.map((d) => (
            <div key={d.id} className="grid grid-cols-[40px_140px_140px_1fr_140px_50px] text-xs">
              <div className="p-2" />
              <div className="p-2">
                <input className="w-full h-8 px-2 border border-gray-200 rounded text-sm" value={d.amount} onChange={(e) => updatePaymentDraft(d.id, 'amount', e.target.value)} />
              </div>
              <div className="p-2">
                <select className="w-full h-8 px-2 border border-gray-200 rounded text-sm" value={d.type} onChange={(e) => updatePaymentDraft(d.id, 'type', e.target.value)}>
                  <option value="Cash">Cash</option>
                  <option value="Credit Card">Credit Card</option>
                  <option value="Debit">Debit</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Cheque">Cheque</option>
                </select>
              </div>
              <div className="p-2">
                <textarea className="w-full h-8 px-2 border border-gray-200 rounded text-sm" value={d.desc} onChange={(e) => updatePaymentDraft(d.id, 'desc', e.target.value)} />
              </div>
              <div className="p-2 flex items-center">
                <span className="inline-block px-2 h-6 leading-6 rounded bg-blue-100 text-blue-700 text-[11px] font-semibold">{d.category}</span>
              </div>
              <div className="p-2 flex items-center justify-center">
                <button type="button" className="h-8 w-8 rounded bg-[#118df0] text-white text-xs font-semibold hover:bg-[#0d6ebd]" title="Save" onClick={() => commitPaymentDraft(d.id)}>✓</button>
              </div>
            </div>
          ))}

          {paymentDrafts.length === 0 && payments.length === 0 ? (
            <div className="h-12 flex items-center justify-center text-xs text-gray-500">No Payments</div>
          ) : null}

          {payments.map((p) => (
            editingPaymentId === p.id && editingPaymentDraft ? (
              <div key={p.id} className="grid grid-cols-[40px_140px_140px_1fr_140px_50px] text-xs">
                <div className="p-2" />
                <div className="p-2"><input className="w-full h-8 px-2 border border-gray-200 rounded text-sm" value={editingPaymentDraft.amount} onChange={(e) => setEditingPaymentDraft({ ...editingPaymentDraft, amount: e.target.value.replace(/[^0-9.]/g, '') })} /></div>
                <div className="p-2"><select className="w-full h-8 px-2 border border-gray-200 rounded text-sm" value={editingPaymentDraft.type} onChange={(e) => setEditingPaymentDraft({ ...editingPaymentDraft, type: e.target.value })}>
                  <option value="Cash">Cash</option>
                  <option value="Credit Card">Credit Card</option>
                  <option value="Debit">Debit</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Cheque">Cheque</option>
                </select></div>
                <div className="p-2"><textarea className="w-full h-8 px-2 border border-gray-200 rounded text-sm" value={editingPaymentDraft.desc} onChange={(e) => setEditingPaymentDraft({ ...editingPaymentDraft, desc: e.target.value })} /></div>
                <div className="p-2 flex items-center"><span className="inline-block px-2 h-6 leading-6 rounded bg-blue-100 text-blue-700 text-[11px] font-semibold">{p.category}</span></div>
                <div className="p-2 flex items-center justify-center"><button type="button" className="h-8 w-8 rounded bg-[#118df0] text-white text-xs font-semibold hover:bg-[#0d6ebd]" onClick={commitEditPayment}>✓</button></div>
              </div>
            ) : (
              <div key={p.id} className="grid grid-cols-[40px_140px_140px_1fr_140px_50px] text-xs">
                <div className="p-2 flex items-center justify-center gap-3">
                  <button type="button" className="text-gray-600 hover:text-gray-800 text-lg" title="Edit" onClick={() => startEditPayment(p)}>✎</button>
                  <button type="button" className="text-red-600 hover:text-red-700 text-lg" title="Delete" onClick={() => setPayments((prev) => prev.filter((x) => x.id !== p.id))}>🗑</button>
                </div>
                <div className="p-2">${fmtMoney(p.amount)}</div>
                <div className="p-2">{p.type}</div>
                <div className="p-2">{p.desc}</div>
                <div className="p-2 flex items-center"><span className="inline-block px-2 h-6 leading-6 rounded bg-blue-100 text-blue-700 text-[11px] font-semibold">{p.category}</span></div>
                <div />
              </div>
            )
          ))}
        </div>
      </div>
    </div>
  )

  const accessoriesCard = dealMode === 'WHL' ? null : (
    <div className="border border-gray-200 bg-white">
      <div className="h-10 px-3 border-b border-gray-200 flex items-center justify-between cursor-move">
        <div className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6M9 12h6m-7 5h8"/></svg>
          Accessories
        </div>
        <div className="h-6 px-2 rounded bg-green-600 text-white text-xs font-semibold flex items-center">Total: ${fmtMoney(accessoriesTotal)}</div>
      </div>
      <div className="p-3">
        <div className="relative flex items-center">
          <input
            placeholder="search accessories"
            className="flex-1 h-10 border border-gray-200 rounded bg-white pl-10 pr-3 text-sm shadow-sm"
            value={accessorySearch}
            onChange={(e) => setAccessorySearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addAccessoryFromSearch()
              }
            }}
          />
          <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35m1.35-5.65a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <button type="button" onClick={addAccessoryFromSearch} className="ml-2 h-10 px-3 rounded bg-[#118df0] text-white text-xs font-semibold hover:bg-[#0d6ebd]">+</button>
        </div>

        <div className="mt-3 border border-gray-200">
          <div className="grid grid-cols-[40px_1fr_1fr_140px_80px] text-[10px] font-semibold text-gray-600 bg-gray-50 border-b border-gray-200">
            <div className="p-2" />
            <div className="p-2">ACCESSORY NAME</div>
            <div className="p-2">ACCESSORY DESC.</div>
            <div className="p-2">ACCESSORY PRICE</div>
            <div className="p-2 text-center">MORE</div>
          </div>
          {accessoryDraft ? (
            <div className="grid grid-cols-[40px_1fr_1fr_140px_80px] text-xs">
              <div className="p-2" />
              <div className="p-2"><input className="w-full h-8 px-2 border border-gray-200 rounded text-sm" value={accessoryDraft.name} onChange={(e) => setAccessoryDraft({ ...accessoryDraft, name: e.target.value })} /></div>
              <div className="p-2"><textarea className="w-full h-8 px-2 border border-gray-200 rounded text-sm" value={accessoryDraft.desc} onChange={(e) => setAccessoryDraft({ ...accessoryDraft, desc: e.target.value })} /></div>
              <div className="p-2"><input className="w-full h-8 px-2 border border-gray-200 rounded text-sm" value={accessoryDraft.price} onChange={(e) => setAccessoryDraft({ ...accessoryDraft, price: e.target.value.replace(/[^0-9.]/g, '') })} /></div>
              <div className="p-2 flex items-center justify-center"><button type="button" className="h-8 w-8 rounded bg-[#118df0] text-white text-xs font-semibold hover:bg-[#0d6ebd]" onClick={commitAccessoryDraft}>✓</button></div>
            </div>
          ) : null}
          {!accessoryDraft && filteredAccessories.length === 0 ? (
            <div className="h-12 flex items-center justify-center text-xs text-gray-500">No Accessories</div>
          ) : null}
          {filteredAccessories.map((a) => (
            editingAccessoryId === a.id && editingAccessoryDraft ? (
              <div key={a.id} className="grid grid-cols-[40px_1fr_1fr_140px_80px] text-xs">
                <div className="p-2" />
                <div className="p-2"><input className="w-full h-8 px-2 border border-gray-200 rounded text-sm" value={editingAccessoryDraft.name} onChange={(e) => setEditingAccessoryDraft({ ...editingAccessoryDraft, name: e.target.value })} /></div>
                <div className="p-2"><textarea className="w-full h-8 px-2 border border-gray-200 rounded text-sm" value={editingAccessoryDraft.desc} onChange={(e) => setEditingAccessoryDraft({ ...editingAccessoryDraft, desc: e.target.value })} /></div>
                <div className="p-2"><input className="w-full h-8 px-2 border border-gray-200 rounded text-sm" value={editingAccessoryDraft.price} onChange={(e) => setEditingAccessoryDraft({ ...editingAccessoryDraft, price: e.target.value.replace(/[^0-9.]/g, '') })} /></div>
                <div className="p-2 flex items-center justify-center"><button type="button" className="h-8 w-8 rounded bg-[#118df0] text-white text-xs font-semibold hover:bg-[#0d6ebd]" onClick={commitEditAccessory}>✓</button></div>
              </div>
            ) : (
              <div key={a.id} className="grid grid-cols-[40px_1fr_1fr_140px_80px] text-xs">
                <div className="p-2 flex items-center justify-center gap-3">
                  <button type="button" className="text-gray-600 hover:text-gray-800 text-lg" title="Edit" onClick={() => startEditAccessory(a)}>✎</button>
                  <button type="button" className="text-red-600 hover:text-red-700 text-lg" title="Delete" onClick={() => setAccessories((prev) => prev.filter((x) => x.id !== a.id))}>🗑</button>
                </div>
                <div className="p-2 flex items-center">{a.name}</div>
                <div className="p-2">{a.desc}</div>
                <div className="p-2">${fmtMoney(Number(a.price || 0))}</div>
                <div className="p-2 text-center">
                  <button type="button" className="px-2 text-gray-600 hover:text-gray-800" onClick={() => { setAccDetailsForId(a.id); setAccDetailsOpen(true) }} title="More">...</button>
                </div>
              </div>
            )
          ))}
        </div>
      </div>
    </div>
  )

  const warrantiesCard = dealMode === 'WHL' ? null : (
    <div className="border border-gray-200 bg-white">
      <div className="h-10 px-3 border-b border-gray-200 flex items-center justify-between cursor-move">
        <div className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4l8 4v6a8 8 0 11-16 0V8l8-4z"/></svg>
          Warranties
        </div>
        <div className="h-6 px-2 rounded bg-green-600 text-white text-xs font-semibold flex items-center">Total: ${fmtMoney(warrantiesTotal)}</div>
      </div>
      <div className="p-3">
        <div className="relative flex items-center">
          <input
            placeholder="search warranties"
            className="flex-1 h-10 border border-gray-200 rounded bg-white pl-10 pr-3 text-sm shadow-sm"
            value={warrantySearch}
            onChange={(e) => setWarrantySearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addWarrantyFromSearch()
              }
            }}
          />
          <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35m1.35-5.65a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <button type="button" onClick={addWarrantyFromSearch} className="ml-2 h-10 px-3 rounded bg-[#118df0] text-white text-xs font-semibold hover:bg-[#0d6ebd]">+</button>
        </div>

        <div className="mt-3 border border-gray-200">
          <div className="grid grid-cols-[40px_1fr_1fr_140px_80px] text-[10px] font-semibold text-gray-600 bg-gray-50 border-b border-gray-200">
            <div className="p-2" />
            <div className="p-2">WARRANTY NAME</div>
            <div className="p-2">WARRANTY DESC.</div>
            <div className="p-2">WARRANTY AMOUNT</div>
            <div className="p-2 text-center">MORE</div>
          </div>
          {warrantyDraft ? (
            <div className="grid grid-cols-[40px_1fr_1fr_140px_80px] text-xs">
              <div className="p-2" />
              <div className="p-2"><input className="w-full h-8 px-2 border border-gray-200 rounded text-sm" value={warrantyDraft.name} onChange={(e) => setWarrantyDraft({ ...warrantyDraft, name: e.target.value })} /></div>
              <div className="p-2"><textarea className="w-full h-8 px-2 border border-gray-200 rounded text-sm" value={warrantyDraft.desc} onChange={(e) => setWarrantyDraft({ ...warrantyDraft, desc: e.target.value })} /></div>
              <div className="p-2"><input className="w-full h-8 px-2 border border-gray-200 rounded text-sm" value={warrantyDraft.amount} onChange={(e) => setWarrantyDraft({ ...warrantyDraft, amount: e.target.value.replace(/[^0-9.]/g, '') })} /></div>
              <div className="p-2 flex items-center justify-center"><button type="button" className="h-8 w-8 rounded bg-[#118df0] text-white text-xs font-semibold hover:bg-[#0d6ebd]" onClick={commitWarrantyDraft}>✓</button></div>
            </div>
          ) : null}
          {!warrantyDraft && filteredWarranties.length === 0 ? (
            <div className="h-12 flex items-center justify-center text-xs text-gray-500">No Warranties</div>
          ) : null}
          {filteredWarranties.map((w) => (
            editingWarrantyId === w.id && editingWarrantyDraft ? (
              <div key={w.id} className="grid grid-cols-[40px_1fr_1fr_140px_80px] text-xs">
                <div className="p-2" />
                <div className="p-2"><input className="w-full h-8 px-2 border border-gray-200 rounded text-sm" value={editingWarrantyDraft.name} onChange={(e) => setEditingWarrantyDraft({ ...editingWarrantyDraft, name: e.target.value })} /></div>
                <div className="p-2"><textarea className="w-full h-8 px-2 border border-gray-200 rounded text-sm" value={editingWarrantyDraft.desc} onChange={(e) => setEditingWarrantyDraft({ ...editingWarrantyDraft, desc: e.target.value })} /></div>
                <div className="p-2"><input className="w-full h-8 px-2 border border-gray-200 rounded text-sm" value={editingWarrantyDraft.amount} onChange={(e) => setEditingWarrantyDraft({ ...editingWarrantyDraft, amount: e.target.value.replace(/[^0-9.]/g, '') })} /></div>
                <div className="p-2 flex items-center justify-center"><button type="button" className="h-8 w-8 rounded bg-[#118df0] text-white text-xs font-semibold hover:bg-[#0d6ebd]" onClick={commitEditWarranty}>✓</button></div>
              </div>
            ) : (
              <div key={w.id} className="grid grid-cols-[40px_1fr_1fr_140px_80px] text-xs">
                <div className="p-2 flex items-center justify-center gap-3">
                  <button type="button" className="text-gray-600 hover:text-gray-800 text-lg" title="Edit" onClick={() => startEditWarranty(w)}>✎</button>
                  <button type="button" className="text-red-600 hover:text-red-700 text-lg" title="Delete" onClick={() => setWarranties((prev) => prev.filter((x) => x.id !== w.id))}>🗑</button>
                </div>
                <div className="p-2 flex items-center">{w.name}</div>
                <div className="p-2">{w.desc}</div>
                <div className="p-2">${fmtMoney(Number(w.amount || 0))}</div>
                <div className="p-2 text-center">
                  <button type="button" className="px-2 text-gray-600 hover:text-gray-800" onClick={() => { setWarDetailsForId(w.id); setWarDetailsOpen(true) }} title="More">...</button>
                </div>
              </div>
            )
          ))}
        </div>
      </div>
    </div>
  )

  const insurancesCard = dealMode === 'WHL' ? null : (
    <div className="border border-gray-200 bg-white">
      <div className="h-10 px-3 border-b border-gray-200 flex items-center justify-between cursor-move">
        <div className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 15c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
          Insurances
        </div>
        <div className="h-6 px-2 rounded bg-green-600 text-white text-xs font-semibold flex items-center">Total: ${fmtMoney(insurancesTotal)}</div>
      </div>
      <div className="p-3">
        <div className="relative flex items-center">
          <input
            placeholder="search insurances"
            className="flex-1 h-10 border border-gray-200 rounded bg-white pl-10 pr-3 text-sm shadow-sm"
            value={insuranceSearch}
            onChange={(e) => setInsuranceSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addInsuranceFromSearch()
              }
            }}
          />
          <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35m1.35-5.65a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <button type="button" onClick={addInsuranceFromSearch} className="ml-2 h-10 px-3 rounded bg-[#118df0] text-white text-xs font-semibold hover:bg-[#0d6ebd]">+</button>
        </div>

        <div className="mt-3 border border-gray-200">
          <div className="grid grid-cols-[40px_1fr_1fr_140px_80px] text-[10px] font-semibold text-gray-600 bg-gray-50 border-b border-gray-200">
            <div className="p-2" />
            <div className="p-2">INSURANCE NAME</div>
            <div className="p-2">INSURANCE DESC.</div>
            <div className="p-2">INSURANCE AMOUNT</div>
            <div className="p-2 text-center">MORE</div>
          </div>
          {insuranceDraft ? (
            <div className="grid grid-cols-[40px_1fr_1fr_140px_80px] text-xs">
              <div className="p-2" />
              <div className="p-2"><input className="w-full h-8 px-2 border border-gray-200 rounded text-sm" value={insuranceDraft.name} onChange={(e) => setInsuranceDraft({ ...insuranceDraft, name: e.target.value })} /></div>
              <div className="p-2"><textarea className="w-full h-8 px-2 border border-gray-200 rounded text-sm" value={insuranceDraft.desc} onChange={(e) => setInsuranceDraft({ ...insuranceDraft, desc: e.target.value })} /></div>
              <div className="p-2"><input className="w-full h-8 px-2 border border-gray-200 rounded text-sm" value={insuranceDraft.amount} onChange={(e) => setInsuranceDraft({ ...insuranceDraft, amount: e.target.value.replace(/[^0-9.]/g, '') })} /></div>
              <div className="p-2 flex items-center justify-center"><button type="button" className="h-8 w-8 rounded bg-[#118df0] text-white text-xs font-semibold hover:bg-[#0d6ebd]" onClick={commitInsuranceDraft}>✓</button></div>
            </div>
          ) : null}
          {!insuranceDraft && filteredInsurances.length === 0 ? (
            <div className="h-12 flex items-center justify-center text-xs text-gray-500">No Insurances</div>
          ) : null}
          {filteredInsurances.map((i) => (
            editingInsuranceId === i.id && editingInsuranceDraft ? (
              <div key={i.id} className="grid grid-cols-[40px_1fr_1fr_140px_80px] text-xs">
                <div className="p-2" />
                <div className="p-2"><input className="w-full h-8 px-2 border border-gray-200 rounded text-sm" value={editingInsuranceDraft.name} onChange={(e) => setEditingInsuranceDraft({ ...editingInsuranceDraft, name: e.target.value })} /></div>
                <div className="p-2"><textarea className="w-full h-8 px-2 border border-gray-200 rounded text-sm" value={editingInsuranceDraft.desc} onChange={(e) => setEditingInsuranceDraft({ ...editingInsuranceDraft, desc: e.target.value })} /></div>
                <div className="p-2"><input className="w-full h-8 px-2 border border-gray-200 rounded text-sm" value={editingInsuranceDraft.amount} onChange={(e) => setEditingInsuranceDraft({ ...editingInsuranceDraft, amount: e.target.value.replace(/[^0-9.]/g, '') })} /></div>
                <div className="p-2 flex items-center justify-center"><button type="button" className="h-8 w-8 rounded bg-[#118df0] text-white text-xs font-semibold hover:bg-[#0d6ebd]" onClick={commitEditInsurance}>✓</button></div>
              </div>
            ) : (
              <div key={i.id} className="grid grid-cols-[40px_1fr_1fr_140px_80px] text-xs">
                <div className="p-2 flex items-center justify-center gap-3">
                  <button type="button" className="text-gray-600 hover:text-gray-800 text-lg" title="Edit" onClick={() => startEditInsurance(i)}>✎</button>
                  <button type="button" className="text-red-600 hover:text-red-700 text-lg" title="Delete" onClick={() => setInsurances((prev) => prev.filter((x) => x.id !== i.id))}>🗑</button>
                </div>
                <div className="p-2 flex items-center">{i.name}</div>
                <div className="p-2">{i.desc}</div>
                <div className="p-2">${fmtMoney(Number(i.amount || 0))}</div>
                <div className="p-2 text-center">
                  <button type="button" className="px-2 text-gray-600 hover:text-gray-800" onClick={() => { setInsDetailsForId(i.id); setInsDetailsOpen(true) }} title="More">...</button>
                </div>
              </div>
            )
          ))}
        </div>
      </div>
    </div>
  )

  const cardContent: Record<WorksheetCardKey, JSX.Element | null> = {
    fees: feesCard,
    accessories: accessoriesCard,
    warranties: warrantiesCard,
    insurances: insurancesCard,
    payments: paymentsCard,
  }

  return (
    <div className="w-full">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="border border-gray-200 bg-white">
          <div className="h-10 px-3 border-b border-gray-200 flex items-center justify-between">
            <div className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-2.21 0-4 1.343-4 3s1.79 3 4 3 4 1.343 4 3-1.79 3-4 3m0-12V4"/></svg>
              Deal Breakdown
            </div>
            <button type="button" className="text-gray-400 hover:text-gray-600" aria-label="Info">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="9" strokeWidth={2} />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11v5" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8h.01" />
              </svg>
            </button>
          </div>

          <div className="p-4 space-y-4">
            <div>
              <div className="text-xs text-gray-700 mb-1">Purchase Price</div>
              <div className="flex items-stretch border border-gray-200 rounded bg-white shadow-sm overflow-hidden w-60">
                <div className="w-10 flex items-center justify-center bg-gray-100 text-gray-600 border-r border-gray-200">$
                </div>
                <input className="flex-1 h-10 px-3 text-sm outline-none" value={purchasePrice} onChange={(e) => setPurchasePrice(stripLeadingZeros(e.target.value))} />
              </div>
            </div>

            <div>
              <div className="text-xs text-gray-700 mb-1">Discount</div>
              <div className="flex items-stretch border border-gray-200 rounded bg-white shadow-sm overflow-hidden w-60">
                <div className="w-10 flex items-center justify-center bg-gray-100 text-gray-600 border-r border-gray-200">$
                </div>
                <input className="flex-1 h-10 px-3 text-sm outline-none" value={discount} onChange={(e) => setDiscount(stripLeadingZeros(e.target.value))} />
              </div>
            </div>

            <div>
              <div className="text-xs text-gray-700 mb-1">Subtotal</div>
              <div className="flex items-stretch border border-gray-200 rounded bg-gray-100 overflow-hidden w-60">
                <div className="w-10 flex items-center justify-center text-gray-600 border-r border-gray-200">$
                </div>
                <input className="flex-1 h-10 px-3 text-sm outline-none bg-gray-100" value={fmtMoney(subtotal)} readOnly />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <div className="text-xs text-gray-700 mb-1">Trade Value</div>
                <div className="flex items-stretch border border-gray-200 rounded bg-white overflow-hidden w-60">
                  <div className="w-10 flex items-center justify-center bg-gray-100 text-gray-600 border-r border-gray-200">$
                  </div>
                  <input className="flex-1 h-10 px-3 text-sm outline-none" value={tradeValue} onChange={(e) => setTradeValue(stripLeadingZeros(e.target.value))} />
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-700 mb-1">Actual Cash Value</div>
                <div className="flex items-stretch border border-gray-200 rounded bg-white overflow-hidden w-60">
                  <div className="w-10 flex items-center justify-center bg-gray-100 text-gray-600 border-r border-gray-200">$
                  </div>
                  <input className="flex-1 h-10 px-3 text-sm outline-none" value={actualCashValue} onChange={(e) => setActualCashValue(stripLeadingZeros(e.target.value))} />
                </div>
              </div>
            </div>

            <div>
              <div className="text-xs text-gray-700 mb-1">Net Difference</div>
              <div className="flex items-stretch border border-gray-200 rounded bg-gray-100 overflow-hidden w-60">
                <div className="w-10 flex items-center justify-center text-gray-600 border-r border-gray-200">$
                </div>
                <input className="flex-1 h-10 px-3 text-sm outline-none bg-gray-100" value={fmtMoney(netDifference)} readOnly />
              </div>
            </div>

            <div className="relative">
              <div className="text-xs text-gray-700 mb-1">Select Tax Rates</div>
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => setTaxMenuOpen((v) => !v)}
                  className="h-9 px-3 border border-gray-200 rounded bg-white text-sm"
                >
                  {taxCode} {(taxRate * 100).toFixed(2)}%
                </button>
                <div className="text-xs text-gray-600">Rate: {(taxRate * 100).toFixed(2)}%</div>
              </div>
              {taxMenuOpen ? (
                <div className="absolute z-10 mt-2 w-44 rounded border border-gray-200 bg-white shadow">
                  {([
                    { code: 'HST' as TaxCode, label: 'HST 13 %' },
                    { code: 'RST' as TaxCode, label: 'RST 8 %' },
                    { code: 'GST' as TaxCode, label: 'GST 5 %' },
                    { code: 'PST' as TaxCode, label: 'PST 6 %' },
                    { code: 'EXEMPT' as TaxCode, label: 'Exempt 0 %' },
                    { code: 'QST' as TaxCode, label: 'QST 9.975 %' },
                  ]).map((opt) => (
                    <label key={opt.code} className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 cursor-pointer">
                      <input
                        type="radio"
                        name="tax-code"
                        checked={taxCode === opt.code}
                        onChange={() => {
                          setTaxCode(opt.code)
                          setTaxMenuOpen(false)
                        }}
                      />
                      <span>{opt.label}</span>
                    </label>
                  ))}
                  <div className="p-2">
                    <button type="button" className="w-full h-8 bg-[#118df0] text-white text-xs rounded" onClick={() => setTaxMenuOpen(false)}>
                      Close
                    </button>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="flex items-center gap-3">
              <div>
                <div className="text-xs text-gray-700 mb-1">Tax Rate</div>
                <div className="flex items-stretch border border-gray-200 rounded bg-gray-100 overflow-hidden w-60">
                  <input className="flex-1 h-10 px-3 text-sm outline-none bg-gray-100" value={`${(taxRate * 100).toFixed(2)}%`} readOnly />
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs text-gray-700 mt-5">
                <input type="checkbox" className="h-4 w-4" checked={taxOverride} onChange={(e) => setTaxOverride(e.target.checked)} />
                Tax Override
              </label>
            </div>

            <div>
              <div className="text-xs text-gray-700 mb-1">Total Tax</div>
              <div className="flex items-stretch border border-gray-200 rounded bg-white shadow-sm overflow-hidden w-60">
                <div className="w-10 flex items-center justify-center bg-gray-100 text-gray-600 border-r border-gray-200">$
                </div>
                <input
                  className={`flex-1 h-10 px-3 text-sm outline-none ${taxOverride ? '' : 'bg-gray-100'}`}
                  value={taxOverride ? taxManual : fmtMoney(totalTax)}
                  onChange={(e) => setTaxManual(stripLeadingZeros(e.target.value))}
                  readOnly={!taxOverride}
                />
                <div className="w-10 flex items-center justify-center bg-gray-100 text-gray-600 border-l border-gray-200">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="9" strokeWidth={2} />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11v5" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8h.01" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <div className="text-xs text-gray-700 mb-1">Lien Payout</div>
                <div className="flex items-stretch border border-gray-200 rounded bg-white shadow-sm overflow-hidden w-60">
                  <div className="w-10 flex items-center justify-center bg-gray-100 text-gray-600 border-r border-gray-200">$
                  </div>
                  <input className="flex-1 h-10 px-3 text-sm outline-none" value={lienPayout} onChange={(e) => setLienPayout(stripLeadingZeros(e.target.value))} />
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-700 mb-1">Trade Equity</div>
                <div className="flex items-stretch border border-gray-200 rounded bg-gray-100 overflow-hidden w-60">
                  <div className="w-10 flex items-center justify-center text-gray-600 border-r border-gray-200">$
                  </div>
                  <input className="flex-1 h-10 px-3 text-sm outline-none bg-gray-100" value={fmtMoney(tradeEquity)} readOnly />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 mt-2">
              <div>
                <div className="text-xs text-gray-700 mb-1">License Fee</div>
                <div className="flex items-stretch border border-gray-200 rounded bg-white shadow-sm overflow-hidden w-60">
                  <div className="w-10 flex items-center justify-center bg-gray-100 text-gray-600 border-r border-gray-200">$
                  </div>
                  <input className="flex-1 h-10 px-3 text-sm outline-none" value={licenseFee} onChange={(e) => setLicenseFee(stripLeadingZeros(e.target.value))} />
                </div>
              </div>
              <div className="flex items-center gap-6 mt-5">
                <label className="flex items-center gap-2 text-xs text-gray-700">
                  <input type="checkbox" className="h-4 w-4" checked={newPlates} onChange={(e) => setNewPlates(e.target.checked)} />
                  New Plates
                </label>
                <label className="flex items-center gap-2 text-xs text-gray-700">
                  <input type="checkbox" className="h-4 w-4" checked={renewalOnly} onChange={(e) => setRenewalOnly(e.target.checked)} />
                  Renewal Only
                </label>
              </div>
            </div>

            <div>
              <div className="text-xs text-gray-700 mb-1">Total Balance Due</div>
              <div className="flex items-stretch border border-gray-200 rounded bg-gray-100 overflow-hidden w-60">
                <div className="w-10 flex items-center justify-center text-gray-600 border-r border-gray-200">$
                </div>
                <input className="flex-1 h-10 px-3 text-sm outline-none bg-gray-100" value={fmtMoney(totalBalanceDue)} readOnly />
              </div>
            </div>
            {/* Financing */}
            {dealType === 'Finance' && (
            <div className="mt-4 border border-gray-200 bg-white">
              <div className="h-10 px-3 border-b border-gray-200 flex items-center justify-between">
                <div className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-2.21 0-4 1.343-4 3s1.79 3 4 3 4 1.343 4 3-1.79 3-4 3m0-12V4"/></svg>
                  Financing
                </div>
                <label className="flex items-center gap-2 text-xs text-gray-700">
                  <input type="checkbox" className="h-4 w-4" checked={financeOverride} onChange={(e) => setFinanceOverride(e.target.checked)} />
                  Override?
                </label>
              </div>
              <div className="p-3 space-y-4">
                <div>
                  <div className="text-xs text-gray-700 mb-1 w-60">Total Financed Amount</div>
                  <div className="relative flex items-center gap-2 w-60">
                    <div className="flex-1 flex items-stretch border border-gray-200 rounded bg-gray-100 overflow-hidden">
                      <div className="w-10 flex items-center justify-center text-gray-600 border-r border-gray-200">$</div>
                      <input className="flex-1 h-10 px-3 text-sm outline-none bg-gray-100" value={fmtMoney(financedAmount)} readOnly />
                    </div>
                    <button
                      type="button"
                      className="h-8 w-8 flex items-center justify-center rounded border border-gray-300 text-gray-500 hover:text-gray-700 bg-white"
                      onMouseEnter={() => setCommissionOpen(true)}
                      onMouseLeave={() => setCommissionOpen(false)}
                      title="Finance Commission"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10l9-6 9 6v8a2 2 0 01-2 2H5a2 2 0 01-2-2v-8z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 22V12h6v10" />
                      </svg>
                    </button>
                    {commissionOpen ? (
                      <div className="absolute left-full ml-2 -top-2 z-10 bg-white border border-gray-200 rounded shadow p-2 w-52" onMouseEnter={() => setCommissionOpen(true)} onMouseLeave={() => setCommissionOpen(false)}>
                        <div className="text-xs font-semibold text-gray-700 mb-1">Finance Commission</div>
                        <div className="flex items-stretch border border-gray-200 rounded bg-white overflow-hidden">
                          <div className="w-8 flex items-center justify-center bg-gray-100 text-gray-600 border-r border-gray-200">$</div>
                          <input
                            className="flex-1 h-8 px-2 text-sm outline-none"
                            value={financeCommission}
                            onChange={(e) => setFinanceCommission(e.target.value.replace(/[^0-9.]/g, ''))}
                          />
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-700 mb-1 flex items-center justify-between w-60">
                    <span>Finance Rate</span>
                    <button
                      type="button"
                      onClick={() => setFinanceRateType((v) => (v === 'VAR' ? 'FXD' : 'VAR'))}
                      className={`h-6 w-[58px] px-2 rounded-full border relative ${financeRateType === 'FXD' ? 'border-[#118df0] text-[#118df0]' : 'border-[#118df0] text-[#118df0]'}`}
                      title="Toggle VAR/FXD"
                    >
                      <span className="text-[10px] font-semibold leading-6 select-none">{financeRateType}</span>
                      <span className={`absolute top-0.5 ${financeRateType === 'FXD' ? 'right-0.5' : 'left-0.5'} h-5 w-5 rounded-full bg-[#118df0]`} />
                    </button>
                  </div>
                  <div className="flex items-stretch border border-gray-200 rounded bg-white overflow-hidden w-60">
                    <div className="w-10 flex items-center justify-center text-gray-600 border-r border-gray-200">%</div>
                    <input className="flex-1 h-10 px-3 text-sm outline-none" value={financeRate} onChange={(e) => setFinanceRate(stripLeadingZeros(e.target.value.replace(/[^0-9.]/g, '')))} />
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-700 mb-1">Finance Term</div>
                  <input className="h-10 border border-gray-200 rounded w-60 px-3" value={financeTermMonths} onChange={(e) => setFinanceTermMonths(e.target.value.replace(/[^0-9]/g, ''))} />
                </div>
                <div>
                  <div className="text-xs text-gray-700 mb-1">Payment Type</div>
                  <select className="h-10 border border-gray-200 rounded w-60 px-2" value={paymentType} onChange={(e) => setPaymentType(e.target.value as any)}>
                    <option>Weekly</option>
                    <option>Bi-Weekly</option>
                    <option>Semi-Monthly</option>
                    <option>Monthly</option>
                  </select>
                </div>
                <div>
                  <div className="text-xs text-gray-700 mb-1">Finance Interest</div>
                  <div className="flex items-stretch border border-gray-200 rounded bg-gray-100 overflow-hidden w-60">
                    <div className="w-10 flex items-center justify-center text-gray-600 border-r border-gray-200">$</div>
                    <input className="flex-1 h-10 px-3 text-sm outline-none bg-gray-100" value={fmtMoney(financeCalc.interest)} readOnly />
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-700 mb-1">Payment</div>
                  <div className="flex items-stretch border border-gray-200 rounded bg-gray-100 overflow-hidden w-60">
                    <div className="w-10 flex items-center justify-center text-gray-600 border-r border-gray-200">$</div>
                    <input className="flex-1 h-10 px-3 text-sm outline-none bg-gray-100" value={fmtMoney(financeCalc.payment)} readOnly />
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-700 mb-1">First Payment</div>
                  <input type="date" className="h-10 border border-gray-200 rounded w-60 px-2" value={firstPaymentDate} onChange={(e) => setFirstPaymentDate(e.target.value)} />
                </div>
                <div>
                  <div className="text-xs text-gray-700 mb-1">Lien Holder</div>
                  <input className="h-10 border border-gray-200 rounded w-60 px-3" value={lienHolder} onChange={(e) => setLienHolder(e.target.value)} />
                </div>
              </div>
            </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          {cardsOrder.map((key) => {
            const content = cardContent[key]
            if (!content) return null
            return (
              <div
                key={key}
                draggable
                onDragStart={() => setDraggingCard(key)}
                onDragEnd={() => setDraggingCard(null)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (!draggingCard) return
                  reorderCards(draggingCard, key)
                  setDraggingCard(null)
                }}
                className={draggingCard === key ? 'opacity-80' : ''}
              >
                {content}
              </div>
            )
          })}
        </div>
      </div>

      {worksheetSaveError ? (
        <div className="mt-6 rounded border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm">
          {worksheetSaveError}
        </div>
      ) : null}

      <div className="mt-6 flex items-center justify-end">
        <button
          type="button"
          onClick={submitWorksheet}
          disabled={worksheetSaving}
          className="h-10 px-6 rounded bg-[#118df0] text-white text-sm font-semibold hover:bg-[#0d6ebd] disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {worksheetSaving ? 'Saving…' : 'Save'}
        </button>
      </div>

      {feeDetailsOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => setFeeDetailsOpen(false)} />
          <div className="relative w-[820px] max-w-[95vw] bg-white border border-gray-200 shadow-lg">
            <div className="h-10 px-4 border-b border-gray-200 flex items-center justify-between">
              <div className="text-sm font-semibold text-gray-700">Fee Details</div>
              <button className="text-gray-500 hover:text-gray-700" onClick={() => setFeeDetailsOpen(false)}>✕</button>
            </div>
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-[#118df0] text-sm font-semibold cursor-pointer relative">
                  <button type="button" onClick={() => setFeeTaxMenuOpen((v) => !v)}>
                    {Object.keys(feeTaxSelected).filter((k) => feeTaxSelected[k]).join(', ') || 'Default Tax 0 %'} ▾
                  </button>
                  {feeTaxMenuOpen ? (
                    <div className="absolute mt-2 w-56 bg-white border border-gray-200 rounded shadow p-2 z-10">
                      {['HST 13 %','RST 8 %','GST 5 %','PST 6 %','QST 9.975 %','Exempt 0 %','Default Tax 0 %'].map((code) => (
                        <label key={code} className="flex items-center gap-2 py-1 text-sm">
                          <input type="checkbox" checked={!!feeTaxSelected[code]} onChange={(e) => setFeeTaxSelected((prev) => ({ ...prev, [code]: e.target.checked }))} />
                          {code}
                        </label>
                      ))}
                      <div className="pt-2">
                        <button type="button" className="w-full h-8 bg-[#118df0] text-white text-xs rounded" onClick={() => setFeeTaxMenuOpen(false)}>Close</button>
                      </div>
                    </div>
                  ) : null}
                </div>
                <button type="button" className="text-[#118df0] text-sm font-semibold" onClick={() => setFeeShowTaxDetails((v) => !v)}>
                  {feeShowTaxDetails ? 'Hide Tax Details ▾' : 'Show Tax Details ▾'}
                </button>
              </div>

              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" className="h-4 w-4" checked={feeTaxOverride} onChange={(e) => setFeeTaxOverride(e.target.checked)} />
                Tax Override
              </label>

              {feeShowTaxDetails ? (
                <div className="space-y-3">
                  {Object.keys(feeTaxSelected).filter((k) => feeTaxSelected[k]).map((k) => (
                    <div key={k}>
                      <div className="text-xs text-gray-700 mb-1">{k}</div>
                      <div className={`flex items-stretch border border-gray-200 rounded overflow-hidden w-60 ${feeTaxOverride ? 'bg-white' : 'bg-gray-100'}`}>
                        <div className="w-10 flex items-center justify-center text-gray-600 border-r border-gray-200">$</div>
                        <input
                          className={`flex-1 h-10 px-3 text-sm outline-none ${feeTaxOverride ? '' : 'bg-gray-100'}`}
                          value={feeTaxOverride ? (feeTaxValues[k] ?? '0') : fmtMoney((feeDetailsFee?.amount || 0) * getFeeTaxRate(k))}
                          onChange={(e) => setFeeTaxValues((prev) => ({ ...prev, [k]: e.target.value.replace(/[^0-9.]/g, '') }))}
                          readOnly={!feeTaxOverride}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="pt-2 border-t border-dashed" />
              <div className="text-sm text-gray-700">QuickBooks Product/Service</div>

              <div className="flex justify-end pt-2">
                <button type="button" className="h-9 px-4 rounded bg-[#118df0] text-white text-sm font-semibold hover:bg-[#0d6ebd]" onClick={() => setFeeDetailsOpen(false)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {warDetailsOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => setWarDetailsOpen(false)} />
          <div className="relative w-[900px] max-w-[95vw] bg-white border border-gray-200 shadow-lg">
            <div className="h-10 px-4 border-b border-gray-200 flex items-center justify-between">
              <div className="text-sm font-semibold text-gray-700">Warranty Details</div>
              <button className="text-gray-500 hover:text-gray-700" onClick={() => setWarDetailsOpen(false)}>✕</button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <div className="text-xs text-gray-700 mb-1">Duration</div>
                <input className="h-10 border border-gray-200 rounded w-full px-3 max-w-xl" value={warDuration} onChange={(e) => setWarDuration(e.target.value)} />
              </div>
              <div>
                <div className="text-xs text-gray-700 mb-1">Distance</div>
                <input className="h-10 border border-gray-200 rounded w-full px-3 max-w-xl" value={warDistance} onChange={(e) => setWarDistance(e.target.value)} />
              </div>
              <div className="flex items-center gap-3">
                <div className="text-xs text-gray-700">Is Dealer Guaranty</div>
                <label className="inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={warDealerGuaranty} onChange={(e) => setWarDealerGuaranty(e.target.checked)} />
                  <div className="w-10 h-5 bg-gray-200 rounded-full peer-checked:bg-[#118df0] relative">
                    <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition peer-checked:translate-x-5" />
                  </div>
                </label>
              </div>

              <div className="flex items-center justify-between">
                <div className="text-[#118df0] text-sm font-semibold cursor-pointer relative">
                  <button type="button" onClick={() => setWarTaxMenuOpen((v) => !v)}>{Object.keys(warTaxSelected).filter((k) => warTaxSelected[k]).join(', ') || 'HST 13 %'} ▾</button>
                  {warTaxMenuOpen ? (
                    <div className="absolute mt-2 w-56 bg-white border border-gray-200 rounded shadow p-2 z-10">
                      {['HST 13 %','RST 8 %','GST 5 %','PST 6 %','QST 9.975 %','Exempt 0 %','Default Tax 0 %'].map((code) => (
                        <label key={code} className="flex items-center gap-2 py-1 text-sm">
                          <input type="checkbox" checked={!!warTaxSelected[code]} onChange={(e) => setWarTaxSelected((prev) => ({ ...prev, [code]: e.target.checked }))} />
                          {code}
                        </label>
                      ))}
                      <div className="pt-2"><button type="button" className="w-full h-8 bg-[#118df0] text-white text-xs rounded" onClick={() => setWarTaxMenuOpen(false)}>Close</button></div>
                    </div>
                  ) : null}
                </div>
                <button type="button" className="text-[#118df0] text-sm font-semibold" onClick={() => setWarShowTaxDetails((v) => !v)}>
                  {warShowTaxDetails ? 'Hide Tax Details ▾' : 'Show Tax Details ▾'}
                </button>
              </div>

              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" className="h-4 w-4" checked={warTaxOverride} onChange={(e) => setWarTaxOverride(e.target.checked)} />
                Tax Override
              </label>

              {warShowTaxDetails ? (
                <div className="space-y-3">
                  {Object.keys(warTaxSelected).filter((k) => warTaxSelected[k]).map((k) => (
                    <div key={k}>
                      <div className="text-xs text-gray-700 mb-1">{k}</div>
                      <div className={`flex items-stretch border border-gray-200 rounded overflow-hidden w-60 ${warTaxOverride ? 'bg-white' : 'bg-gray-100'}`}>
                        <div className="w-10 flex items-center justify-center text-gray-600 border-r border-gray-200">$</div>
                        <input className={`flex-1 h-10 px-3 text-sm outline-none ${warTaxOverride ? '' : 'bg-gray-100'}`} value={warTaxOverride ? (warTaxValues[k] ?? '0') : fmtMoney((warDetailsItem?.amount || 0) * getFeeTaxRate(k))} onChange={(e) => setWarTaxValues((prev) => ({ ...prev, [k]: e.target.value.replace(/[^0-9.]/g, '') }))} readOnly={!warTaxOverride} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="pt-2 border-t border-dashed" />
              <div className="text-sm text-gray-700">QuickBooks Product/Service</div>

              <div className="flex justify-end pt-2">
                <button type="button" className="h-9 px-4 rounded bg-[#118df0] text-white text-sm font-semibold hover:bg-[#0d6ebd]" onClick={() => setWarDetailsOpen(false)}>Close</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {insDetailsOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => setInsDetailsOpen(false)} />
          <div className="relative w-[900px] max-w-[95vw] bg-white border border-gray-200 shadow-lg">
            <div className="h-10 px-4 border-b border-gray-200 flex items-center justify-between">
              <div className="text-sm font-semibold text-gray-700">Insurance Details</div>
              <button className="text-gray-500 hover:text-gray-700" onClick={() => setInsDetailsOpen(false)}>✕</button>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-6 max-w-3xl">
                <div>
                  <div className="text-xs text-gray-700 mb-1">Insurance Deductible</div>
                  <div className="flex items-stretch border border-gray-200 rounded bg-white overflow-hidden">
                    <div className="w-10 flex items-center justify-center bg-gray-100 text-gray-600 border-r border-gray-200">$</div>
                    <input className="flex-1 h-10 px-3 text-sm outline-none" value={insDeductible} onChange={(e) => setInsDeductible(e.target.value.replace(/[^0-9.]/g, ''))} />
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-700 mb-1">Type</div>
                  <select className="h-10 border border-gray-200 rounded w-full px-2" value={insType} onChange={(e) => setInsType(e.target.value)}>
                    <option value="">Select...</option>
                    <option value="Life">Life</option>
                    <option value="Disability">Disability</option>
                    <option value="Gap">Gap</option>
                    <option value="Income">Income</option>
                    <option value="Other">Other</option>
                    <option value="Walkaway">Walkaway</option>
                    <option value="Sickness or Injury">Sickness or Injury</option>
                  </select>
                </div>
                <div>
                  <div className="text-xs text-gray-700 mb-1">Insurance Duration</div>
                  <input className="h-10 border border-gray-200 rounded w-full px-3" value={insDuration} onChange={(e) => setInsDuration(e.target.value)} />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="text-[#118df0] text-sm font-semibold cursor-pointer relative">
                  <button type="button" onClick={() => setInsTaxMenuOpen((v) => !v)}>{Object.keys(insTaxSelected).filter((k) => insTaxSelected[k]).join(', ') || 'HST 13 %'} ▾</button>
                  {insTaxMenuOpen ? (
                    <div className="absolute mt-2 w-56 bg-white border border-gray-200 rounded shadow p-2 z-10">
                      {['HST 13 %','RST 8 %','GST 5 %','PST 6 %','QST 9.975 %','Exempt 0 %','Default Tax 0 %'].map((code) => (
                        <label key={code} className="flex items-center gap-2 py-1 text-sm">
                          <input type="checkbox" checked={!!insTaxSelected[code]} onChange={(e) => setInsTaxSelected((prev) => ({ ...prev, [code]: e.target.checked }))} />
                          {code}
                        </label>
                      ))}
                      <div className="pt-2"><button type="button" className="w-full h-8 bg-[#118df0] text-white text-xs rounded" onClick={() => setInsTaxMenuOpen(false)}>Close</button></div>
                    </div>
                  ) : null}
                </div>
                <button type="button" className="text-[#118df0] text-sm font-semibold" onClick={() => setInsShowTaxDetails((v) => !v)}>
                  {insShowTaxDetails ? 'Hide Tax Details ▾' : 'Show Tax Details ▾'}
                </button>
              </div>

              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" className="h-4 w-4" checked={insTaxOverride} onChange={(e) => setInsTaxOverride(e.target.checked)} />
                Tax Override
              </label>

              {insShowTaxDetails ? (
                <div className="space-y-3">
                  {Object.keys(insTaxSelected).filter((k) => insTaxSelected[k]).map((k) => (
                    <div key={k}>
                      <div className="text-xs text-gray-700 mb-1">{k}</div>
                      <div className={`flex items-stretch border border-gray-200 rounded overflow-hidden w-60 ${insTaxOverride ? 'bg-white' : 'bg-gray-100'}`}>
                        <div className="w-10 flex items-center justify-center text-gray-600 border-r border-gray-200">$</div>
                        <input className={`flex-1 h-10 px-3 text-sm outline-none ${insTaxOverride ? '' : 'bg-gray-100'}`} value={insTaxOverride ? (insTaxValues[k] ?? '0') : fmtMoney((insDetailsItem?.amount || 0) * getFeeTaxRate(k))} onChange={(e) => setInsTaxValues((prev) => ({ ...prev, [k]: e.target.value.replace(/[^0-9.]/g, '') }))} readOnly={!insTaxOverride} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="pt-2 border-t border-dashed" />
              <div className="text-sm text-gray-700">QuickBooks Product/Service</div>

              <div className="flex justify-end pt-2">
                <button type="button" className="h-9 px-4 rounded bg-[#118df0] text-white text-sm font-semibold hover:bg-[#0d6ebd]" onClick={() => setInsDetailsOpen(false)}>Close</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {accDetailsOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => setAccDetailsOpen(false)} />
          <div className="relative w-[820px] max-w-[95vw] bg-white border border-gray-200 shadow-lg">
            <div className="h-10 px-4 border-b border-gray-200 flex items-center justify-between">
              <div className="text-sm font-semibold text-gray-700">Accessory Details</div>
              <button className="text-gray-500 hover:text-gray-700" onClick={() => setAccDetailsOpen(false)}>✕</button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <div className="text-xs text-gray-700 mb-1">Vehicle Type</div>
                <select className="h-10 border border-gray-200 rounded w-60 px-2" value={accVehicleType} onChange={(e) => setAccVehicleType(e.target.value)}>
                  <option value="">Select...</option>
                  <option value="Car">Car</option>
                  <option value="Truck">Truck</option>
                  <option value="SUV">SUV</option>
                </select>
              </div>

              <div className="flex items-center justify-between">
                <div className="text-[#118df0] text-sm font-semibold cursor-pointer relative">
                  <button type="button" onClick={() => setAccTaxMenuOpen((v) => !v)}> {Object.keys(accTaxSelected).filter((k) => accTaxSelected[k]).join(', ') || 'HST 13 %'} ▾</button>
                  {accTaxMenuOpen ? (
                    <div className="absolute mt-2 w-56 bg-white border border-gray-200 rounded shadow p-2 z-10">
                      {['HST 13 %','RST 8 %','GST 5 %','PST 6 %','QST 9.975 %','Exempt 0 %','Default Tax 0 %'].map((code) => (
                        <label key={code} className="flex items-center gap-2 py-1 text-sm">
                          <input type="checkbox" checked={!!accTaxSelected[code]} onChange={(e) => setAccTaxSelected((prev) => ({ ...prev, [code]: e.target.checked }))} />
                          {code}
                        </label>
                      ))}
                      <div className="pt-2">
                        <button type="button" className="w-full h-8 bg-[#118df0] text-white text-xs rounded" onClick={() => setAccTaxMenuOpen(false)}>Close</button>
                      </div>
                    </div>
                  ) : null}
                </div>
                <button type="button" className="text-[#118df0] text-sm font-semibold" onClick={() => setAccShowTaxDetails((v) => !v)}>
                  {accShowTaxDetails ? 'Hide Tax Details ▾' : 'Show Tax Details ▾'}
                </button>
              </div>

              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" className="h-4 w-4" checked={accTaxOverride} onChange={(e) => setAccTaxOverride(e.target.checked)} />
                Tax Override
              </label>

              {accShowTaxDetails ? (
                <div className="space-y-3">
                  {Object.keys(accTaxSelected).filter((k) => accTaxSelected[k]).map((k) => (
                    <div key={k}>
                      <div className="text-xs text-gray-700 mb-1">{k}</div>
                      <div className={`flex items-stretch border border-gray-200 rounded overflow-hidden w-60 ${accTaxOverride ? 'bg-white' : 'bg-gray-100'}`}>
                        <div className="w-10 flex items-center justify-center text-gray-600 border-r border-gray-200">$</div>
                        <input
                          className={`flex-1 h-10 px-3 text-sm outline-none ${accTaxOverride ? '' : 'bg-gray-100'}`}
                          value={accTaxOverride ? (accTaxValues[k] ?? '0') : fmtMoney((accDetailsItem?.price || 0) * getFeeTaxRate(k))}
                          onChange={(e) => setAccTaxValues((prev) => ({ ...prev, [k]: e.target.value.replace(/[^0-9.]/g, '') }))}
                          readOnly={!accTaxOverride}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="pt-2 border-t border-dashed" />
              <div className="text-sm text-gray-700">QuickBooks Product/Service</div>

              <div className="flex justify-end pt-2">
                <button type="button" className="h-9 px-4 rounded bg-[#118df0] text-white text-sm font-semibold hover:bg-[#0d6ebd]" onClick={() => setAccDetailsOpen(false)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
