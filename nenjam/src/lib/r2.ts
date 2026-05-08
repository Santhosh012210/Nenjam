import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const accountId      = import.meta.env.VITE_R2_ACCOUNT_ID as string
const accessKeyId    = import.meta.env.VITE_R2_ACCESS_KEY_ID as string
const secretAccessKey = import.meta.env.VITE_R2_SECRET_ACCESS_KEY as string
const bucket         = import.meta.env.VITE_R2_BUCKET_NAME as string

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId, secretAccessKey },
})

export async function uploadEncryptedPhoto(
  key: string,
  encryptedData: Uint8Array,
  nonce: Uint8Array
): Promise<string> {
  const combined = new Uint8Array(nonce.length + encryptedData.length)
  combined.set(nonce, 0)
  combined.set(encryptedData, nonce.length)

  // Use a presigned PUT URL so the browser can upload directly without
  // sending AWS auth headers (those trigger CORS preflight failures).
  const url = await getSignedUrl(
    s3,
    new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: 'application/octet-stream' }),
    { expiresIn: 300 }
  )
  const res = await fetch(url, {
    method: 'PUT',
    body: combined,
    headers: { 'Content-Type': 'application/octet-stream' },
  })
  if (!res.ok) throw new Error(`R2 upload failed: ${res.status} ${res.statusText}`)
  return key
}

export async function downloadEncryptedPhoto(
  key: string
): Promise<{ encrypted: Uint8Array; nonce: Uint8Array }> {
  const url = await getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: bucket, Key: key }),
    { expiresIn: 3600 }
  )
  const res = await fetch(url)
  if (!res.ok) throw new Error(`R2 download failed: ${res.status} ${res.statusText}`)
  const arr = new Uint8Array(await res.arrayBuffer())
  return { nonce: arr.slice(0, 24), encrypted: arr.slice(24) }
}

export async function deletePhoto(key: string): Promise<void> {
  const url = await getSignedUrl(
    s3,
    new DeleteObjectCommand({ Bucket: bucket, Key: key }),
    { expiresIn: 60 }
  )
  const res = await fetch(url, { method: 'DELETE' })
  // R2 returns 204 on success; treat any 2xx as ok
  if (!res.ok && res.status !== 204) {
    throw new Error(`R2 delete failed: ${res.status} ${res.statusText}`)
  }
}

export function generatePhotoKey(userId: string): string {
  const ts   = Date.now()
  const rand = Math.random().toString(36).slice(2, 8)
  return `photos/${userId}/${ts}-${rand}.enc`
}
