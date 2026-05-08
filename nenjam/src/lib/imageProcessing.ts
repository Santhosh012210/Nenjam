import imageCompression from 'browser-image-compression'

export async function compressPhoto(file: File): Promise<File> {
  return imageCompression(file, {
    maxSizeMB: 2,
    maxWidthOrHeight: 1080,
    useWebWorker: true,
    fileType: 'image/jpeg',
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
