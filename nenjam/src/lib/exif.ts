import exifr from 'exifr'

export interface PhotoMeta {
  lat: number | null
  lng: number | null
  takenAt: Date | null
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

    const takenAt = rawDate ? new Date(rawDate) : null

    return {
      lat: typeof lat === 'number' ? lat : null,
      lng: typeof lng === 'number' ? lng : null,
      takenAt: takenAt && !isNaN(takenAt.getTime()) ? takenAt : null,
    }
  } catch {
    return { lat: null, lng: null, takenAt: null }
  }
}
