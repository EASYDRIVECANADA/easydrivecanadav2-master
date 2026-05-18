export type GoodBuyRecommendation =
  | 'Priority Research'
  | 'Worth Checking'
  | 'Strong Buy'
  | 'Good Buy'
  | 'Maybe'
  | 'Low Priority'
  | 'Avoid / Risk'
  | 'Avoid'
  | 'Missing Data'
  | 'Needs Manual Review'

export type ParsedFleetVehicle = {
  sourceRow: number
  stockNumber: string
  vin: string
  year: number
  make: string
  model: string
  trim: string
  mileage: number
  listedPrice: number
  raw: Record<string, unknown>
  validationFlags: string[]
}

export type MarketComp = {
  source?: string
  url?: string
  price: number
  mileage?: number
  region?: string
  confidence?: string
}

export type MarketStats = {
  count: number
  averagePrice?: number
  lowestPrice?: number
  highestPrice?: number
  averageMileage?: number
  priceDifference?: number
  marketPositionPercent?: number
  confidence?: string
}

export type GoodBuySettings = {
  region: string
  minimumProfitMargin: number
  maximumMileage: number
  preferredMakes: string[]
  excludedMakes: string[]
  scoringWeights: {
    priceBelowMarket: number
    mileageCondition: number
    margin: number
    demand: number
    vehicleAge: number
    riskFlags: number
  }
  sourceToggles: Record<string, boolean>
}

export type GoodBuyScore = {
  score: number
  recommendation: GoodBuyRecommendation
  suggestedMaxPurchasePrice: number
  estimatedResaleValue: number
  projectedProfit: number
  projectedMarginPercent: number
  marketPositionPercent: number
  reasons: string[]
  riskFlags: string[]
  factorScores?: Record<string, number>
}

export const defaultGoodBuySettings: GoodBuySettings
export function describeGoodBuyError(error: unknown, fallback?: string): string
export function normalizeVin(value: unknown): { vin: string; valid: boolean; flags: string[] }
export function parseFleetWorkbook(buffer: Buffer | ArrayBuffer | Uint8Array, fileName?: string): { vehicles: ParsedFleetVehicle[]; skipped: Array<{ row: number; reason: string }> }
export function calculateMarketStats(comps?: MarketComp[], vehicle?: Partial<ParsedFleetVehicle>): MarketStats
export function scoreShortlistVehicle(vehicle?: Partial<ParsedFleetVehicle> & { raw?: Record<string, unknown> }, settings?: Partial<GoodBuySettings>): GoodBuyScore
export function scoreGoodBuyVehicle(vehicle?: Partial<ParsedFleetVehicle> & { marketStats?: MarketStats }, settings?: Partial<GoodBuySettings>): GoodBuyScore
export function summarizeUpload(rows?: Array<Partial<GoodBuyScore>>): {
  total: number
  topRecommended: number
  highestProfitMargin: number
  lowestRiskVehicles: number
  overpricedVehicles: number
  manualReview: number
}
export function validateGoodBuyImportSelection(
  rows?: Array<Record<string, unknown>>,
  existingVehicles?: Array<Record<string, unknown>>
): {
  importableIds: string[]
  blocked: Array<{ id: string; vin: string; stockNumber: string; reason: string }>
  message: string
}
