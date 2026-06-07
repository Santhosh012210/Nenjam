import imageCompression from 'browser-image-compression'

export async function compressPhoto(file: File): Promise<File> {
  // First pass: max 1MB, 1920px, quality 0.92
  const compressed = await imageCompression(file, {
    maxSizeMB: 1,
    maxWidthOrHeight: 1920,
    useWebWorker: true,
    fileType: 'image/jpeg',
    initialQuality: 0.92,
  })
  // If result < 800KB but original had enough data, retry at higher resolution/quality
  if (compressed.size < 800 * 1024 && file.size > 800 * 1024) {
    const retry = await imageCompression(file, {
      maxSizeMB: 1,
      maxWidthOrHeight: 2560,
      useWebWorker: true,
      fileType: 'image/jpeg',
      initialQuality: 0.95,
    })
    return retry.size <= 1024 * 1024 ? retry : compressed
  }
  return compressed
}

export function getCroppedImage(
  imageSrc: string,
  pixelCrop: { x: number; y: number; width: number; height: number },
  fileName = 'cropped.jpg'
): Promise<File> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width  = pixelCrop.width
      canvas.height = pixelCrop.height
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(image, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, pixelCrop.width, pixelCrop.height)
      canvas.toBlob(blob => {
        if (!blob) { reject(new Error('Canvas crop failed')); return }
        resolve(new File([blob], fileName, { type: 'image/jpeg' }))
      }, 'image/jpeg', 0.95)
    }
    image.onerror = reject
    image.src = imageSrc
  })
}

export async function fileToUint8Array(file: File): Promise<Uint8Array> {
  const buf = await file.arrayBuffer()
  return new Uint8Array(buf)
}

export function uint8ArrayToObjectUrl(data: Uint8Array, mimeType = 'image/jpeg'): string {
  // new Uint8Array(data) ensures ArrayBuffer (not ArrayBufferLike) for Blob constructor
  const blob = new Blob([new Uint8Array(data)], { type: mimeType })
  return URL.createObjectURL(blob)
}

export async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export function revokeObjectUrl(url: string) {
  if (url.startsWith('blob:')) URL.revokeObjectURL(url)
}
