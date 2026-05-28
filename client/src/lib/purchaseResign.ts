type OrderData = Record<string, unknown>

const text = (value: unknown) => String(value ?? '').trim()

export function hasOnlinePurchaseSignatures(orderData: unknown): boolean {
  const order = orderData && typeof orderData === 'object' ? orderData as OrderData : {}
  const signatures = order.signatures && typeof order.signatures === 'object' ? order.signatures as OrderData : {}
  const carfax = order.carfax && typeof order.carfax === 'object' ? order.carfax as OrderData : {}
  const billOfSaleCustomer = signatures.billOfSaleCustomer && typeof signatures.billOfSaleCustomer === 'object' ? signatures.billOfSaleCustomer as OrderData : {}
  const dealerGuaranteeCustomer = signatures.dealerGuaranteeCustomer && typeof signatures.dealerGuaranteeCustomer === 'object' ? signatures.dealerGuaranteeCustomer as OrderData : {}

  return Boolean(
    text(billOfSaleCustomer.typedName) ||
    text(billOfSaleCustomer.drawnDataUrl) ||
    text(dealerGuaranteeCustomer.typedName) ||
    text(dealerGuaranteeCustomer.drawnDataUrl) ||
    text(carfax.typedInitials) ||
    text(carfax.initialDataUrl)
  )
}

export function clearOnlinePurchaseSignatures(orderData: unknown, adminEmail = '', now = new Date().toISOString()): OrderData {
  const order = orderData && typeof orderData === 'object' && !Array.isArray(orderData)
    ? { ...(orderData as OrderData) }
    : {}

  const currentSignatures = order.signatures && typeof order.signatures === 'object'
    ? { ...(order.signatures as OrderData) }
    : {}
  const currentCarfax = order.carfax && typeof order.carfax === 'object'
    ? { ...(order.carfax as OrderData) }
    : {}
  const currentEvents = Array.isArray(order.events) ? order.events : []

  return {
    ...order,
    status: 'resign_required',
    signatures: {
      ...currentSignatures,
      billOfSaleCustomer: null,
      dealerGuaranteeCustomer: null,
    },
    carfax: {
      ...currentCarfax,
      typedInitials: null,
      initialDataUrl: null,
      acknowledgedAt: null,
    },
    events: [
      ...currentEvents,
      {
        at: now,
        type: 'signature_reset_for_resign',
        actor: 'admin',
        note: text(adminEmail),
      },
    ],
  }
}
