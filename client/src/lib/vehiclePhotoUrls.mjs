const clean = (value) => String(value ?? '').trim()

export const normalizeVehicleImageList = (value) => {
  if (!value) return []
  if (Array.isArray(value)) return value.map(clean).filter(Boolean)
  if (typeof value !== 'string') return []

  const text = value.trim()
  if (!text) return []
  try {
    const parsed = JSON.parse(text)
    if (Array.isArray(parsed)) return parsed.map(clean).filter(Boolean)
  } catch {
    // Fall back to comma-separated image text.
  }

  return text.split(',').map(clean).filter(Boolean)
}

export const buildVehiclePhotoUrls = (vehicleId, files, publicUrlForPath) => {
  const id = clean(vehicleId)
  if (!id || !Array.isArray(files)) return []

  return files
    .map((file) => clean(file?.name))
    .filter((name) => name && !name.endsWith('/'))
    .map((name) => publicUrlForPath(`${id}/${name}`))
    .map(clean)
    .filter(Boolean)
}
