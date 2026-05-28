export type WarrantyTerms = {
  duration: string
  distance: string
}

const mileageRangePattern = /\b\d[\d,]*(?:\s*(?:-|–|—|to)\s*\d[\d,]*)?\s*(?:km|kms|kilometers|kilometres)\b/i

const cleanTermText = (value: unknown) =>
  String(value || '')
    .replace(/\s+/g, ' ')
    .trim()

const cleanDurationAfterMileageRemoval = (value: string, mileage: string) =>
  value
    .replace(mileage, ' ')
    .replace(/\s*[:|]\s*/g, ' ')
    .replace(/\s+-\s*$/g, '')
    .replace(/^\s*-\s+/g, '')
    .replace(/\s*\/\s*$/g, '')
    .replace(/\s+/g, ' ')
    .trim()

export function normalizeWarrantyTerms(input: Partial<WarrantyTerms>): WarrantyTerms {
  const duration = cleanTermText(input.duration)
  const distance = cleanTermText(input.distance)
  const mileageMatch = duration.match(mileageRangePattern)

  if (!mileageMatch) {
    return { duration, distance }
  }

  return {
    duration: cleanDurationAfterMileageRemoval(duration, mileageMatch[0]),
    distance: distance || mileageMatch[0].replace(/\s*(?:-|–|—|to)\s*/i, ' - '),
  }
}
