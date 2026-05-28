export type DriverLicensePhotoSide = 'front' | 'back'

export type DriverLicensePhoto = {
  side: DriverLicensePhotoSide
  title: string
  src: string
}

const sideLabel = (side: DriverLicensePhotoSide) => side === 'front' ? 'Front' : 'Back'

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case '&': return '&amp;'
      case '<': return '&lt;'
      case '>': return '&gt;'
      case '"': return '&quot;'
      case "'": return '&#39;'
      default: return char
    }
  })

export function normalizeDriverLicensePhoto(side: DriverLicensePhotoSide, src: unknown): DriverLicensePhoto | null {
  const cleanSrc = String(src || '').trim()
  if (!cleanSrc) return null
  return {
    side,
    title: `Driver's License ${sideLabel(side)}`,
    src: cleanSrc,
  }
}

export function getDriverLicenseDownloadName(side: DriverLicensePhotoSide, idNumber: unknown): string {
  const suffix = String(idNumber || '')
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `drivers-license-${side}${suffix ? `-${suffix}` : ''}.jpg`
}

export function buildDriverLicensePrintHtml(photo: Pick<DriverLicensePhoto, 'title' | 'src'>): string {
  const title = escapeHtml(photo.title)
  const src = escapeHtml(photo.src)
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${title}</title>
    <style>
      @page { margin: 12mm; }
      body { margin: 0; font-family: Arial, sans-serif; color: #111827; }
      h1 { font-size: 16px; margin: 0 0 12px; }
      img { max-width: 100%; max-height: 90vh; object-fit: contain; }
    </style>
  </head>
  <body>
    <h1>${title}</h1>
    <img src="${src}" alt="${title}" />
    <script>
      window.addEventListener('load', function () {
        window.focus();
        window.print();
      });
    </script>
  </body>
</html>`
}

