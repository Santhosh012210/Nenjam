import { supabase } from './supabase'

const BUCKET = 'photos'

export async function uploadEncryptedPhoto(
  key: string,
  encryptedData: Uint8Array,
  nonce: Uint8Array
): Promise<string> {
  const combined = new Uint8Array(nonce.length + encryptedData.length)
  combined.set(nonce, 0)
  combined.set(encryptedData, nonce.length)

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(key, combined, { contentType: 'application/octet-stream', upsert: true })

  if (error) throw new Error(`Storage upload failed: ${error.message}`)
  return key
}

export async function downloadEncryptedPhoto(
  key: string
): Promise<{ encrypted: Uint8Array; nonce: Uint8Array }> {
  const { data, error } = await supabase.storage.from(BUCKET).download(key)
  if (error) throw new Error(`Storage download failed: ${error.message}`)
  if (!data) throw new Error('Empty response from storage')

  const buf = await data.arrayBuffer()
  const arr = new Uint8Array(buf)
  return { nonce: arr.slice(0, 24), encrypted: arr.slice(24) }
}

export async function deletePhoto(key: string): Promise<void> {
  await supabase.storage.from(BUCKET).remove([key])
}

export function generatePhotoKey(userId: string): string {
  const ts = Date.now()
  const rand = Math.random().toString(36).slice(2, 8)
  return `${userId}/${ts}-${rand}.enc`
}
