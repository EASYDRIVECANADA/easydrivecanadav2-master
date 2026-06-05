const asNumber = (value) => {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : null
}

export function formatCadPrice(value) {
  const number = asNumber(value)
  if (number == null) return ''
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    minimumFractionDigits: 0,
  }).format(number)
}

export function buildDealerPriceDisplay({ price, retailPrice, financePrice } = {}) {
  const basePrice = asNumber(price) || 0
  const retail = asNumber(retailPrice)
  const finance = asNumber(financePrice)
  const dealerPrice = retail || basePrice

  return {
    dealerPrice,
    dealerPriceLabel: 'Cash Price',
    dealerPriceFormatted: formatCadPrice(dealerPrice),
    retailPrice: retail,
    retailPriceFormatted: formatCadPrice(retail),
    financePrice: finance,
    financePriceLabel: 'Finance Price',
    financePriceFormatted: formatCadPrice(finance),
    hasRetailComparison: false,
    hasFinancePrice: finance != null,
  }
}
