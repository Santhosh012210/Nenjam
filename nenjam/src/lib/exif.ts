import exifr from 'exifr'

export interface PhotoMeta {
  lat: number | null
  lng: number | null
  takenAt: Date | null
}

function parseExifDate(raw: unknown): Date | null {
  if (!raw) return null

  // exifr already parsed it to a Date
  if (raw instanceof Date) return isNaN(raw.getTime()) ? null : raw

  if (typeof raw === 'string') {
    // EXIF format is "YYYY:MM:DD HH:MM:SS" — replace first two colons with dashes
    const normalized = raw.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3')
    // Treat as local time (no Z suffix) to avoid UTC-vs-local day shift
    const d = new Date(normalized)
    return isNaN(d.getTime()) ? null : d
  }

  return null
}

export async function extractPhotoMeta(file: File): Promise<PhotoMeta> {
  try {
    const data = await exifr.parse(file, {
      gps: true,
      exif: true,
      tiff: true,
      translateKeys: true,
    })

    if (!data) return { lat: null, lng: null, takenAt: null }

    const lat = data.latitude ?? data.GPSLatitude ?? null
    const lng = data.longitude ?? data.GPSLongitude ?? null

    const rawDate =
      data.DateTimeOriginal ??
      data.CreateDate ??
      data.ModifyDate ??
      null

    const takenAt = parseExifDate(rawDate)

    return {
      lat: typeof lat === 'number' ? lat : null,
      lng: typeof lng === 'number' ? lng : null,
      takenAt,
    }
  } catch {
    return { lat: null, lng: null, takenAt: null }
  }
}
