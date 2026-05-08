import nacl from 'tweetnacl'
import { encodeUTF8, decodeUTF8, encodeBase64, decodeBase64 } from 'tweetnacl-util'

// tweetnacl-util naming (counterintuitive):
//   decodeUTF8(string)  → Uint8Array   (string  → bytes)
//   encodeUTF8(Uint8Array) → string    (bytes   → string)
//   decodeBase64(string) → Uint8Array  (base64  → bytes)
//   encodeBase64(Uint8Array) → string  (bytes   → base64)

// TS 5.3+ made Uint8Array generic. Web Crypto expects Uint8Array<ArrayBuffer>
// but library functions return Uint8Array<ArrayBufferLike>.
// new Uint8Array(x) where x is ArrayLike<number> always returns Uint8Array<ArrayBuffer>.
const u8 = (x: Uint8Array): Uint8Array<ArrayBuffer> => new Uint8Array(x)

// ─── Key pair ────────────────────────────────────────────────────────────────

export function generateKeyPair(): nacl.BoxKeyPair {
  return nacl.box.keyPair()
}

export function exportPublicKey(kp: nacl.BoxKeyPair): string {
  return encodeBase64(kp.publicKey)
}

// ─── Shared (couple) key via Diffie-Hellman ──────────────────────────────────

export function deriveSharedKey(myPrivateKey: Uint8Array, theirPublicKey: Uint8Array): Uint8Array {
  return nacl.box.before(theirPublicKey, myPrivateKey)
}

// ─── Shared encryption (chat, shared notes, photos) ──────────────────────────

export function encryptShared(
  plaintext: string,
  sharedKey: Uint8Array
): { encrypted: string; nonce: string } {
  const nonce = nacl.randomBytes(nacl.box.nonceLength)
  const msgBytes = u8(decodeUTF8(plaintext))          // string → Uint8Array<ArrayBuffer>
  const encrypted = nacl.box.after(msgBytes, nonce, sharedKey)
  return { encrypted: encodeBase64(encrypted), nonce: encodeBase64(nonce) }
}

export function decryptShared(
  encrypted: string,
  nonce: string,
  sharedKey: Uint8Array
): string | null {
  try {
    const decrypted = nacl.box.open.after(
      u8(decodeBase64(encrypted)),
      u8(decodeBase64(nonce)),
      sharedKey
    )
    return decrypted ? encodeUTF8(decrypted) : null  // Uint8Array → string
  } catch {
    return null
  }
}

// ─── Private encryption (journal — only the author can decrypt) ───────────────

export function encryptPrivate(
  plaintext: string,
  secretKey: Uint8Array
): { encrypted: string; nonce: string } {
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength)
  const msgBytes = u8(decodeUTF8(plaintext))
  const encrypted = nacl.secretbox(msgBytes, nonce, secretKey)
  return { encrypted: encodeBase64(encrypted), nonce: encodeBase64(nonce) }
}

export function decryptPrivate(
  encrypted: string,
  nonce: string,
  secretKey: Uint8Array
): string | null {
  try {
    const decrypted = nacl.secretbox.open(
      u8(decodeBase64(encrypted)),
      u8(decodeBase64(nonce)),
      secretKey
    )
    return decrypted ? encodeUTF8(decrypted) : null
  } catch {
    return null
  }
}

// ─── Binary encryption (photos) ───────────────────────────────────────────────

export function encryptBinary(
  data: Uint8Array,
  sharedKey: Uint8Array
): { encrypted: Uint8Array; nonce: Uint8Array } {
  const nonce = nacl.randomBytes(nacl.box.nonceLength)
  const encrypted = nacl.box.after(u8(data), nonce, sharedKey)
  return { encrypted, nonce }
}

export function decryptBinary(
  encrypted: Uint8Array,
  nonce: Uint8Array,
  sharedKey: Uint8Array
): Uint8Array | null {
  return nacl.box.open.after(u8(encrypted), u8(nonce), sharedKey)
}

// ─── PIN-protected key storage (PBKDF2 + AES-GCM) ───────────────────────────

async function pinToAesKey(pin: string, salt: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  const pinBuf = new TextEncoder().encode(pin)
  const keyMaterial = await crypto.subtle.importKey('raw', pinBuf, 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 250_000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

interface StoredKey { salt: string; iv: string; ciphertext: string }

export async function encryptKeyWithPin(
  privateKey: Uint8Array,
  pin: string
): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))  // Uint8Array<ArrayBuffer>
  const iv   = crypto.getRandomValues(new Uint8Array(12))
  const aesKey = await pinToAesKey(pin, salt)
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, u8(privateKey))
  const stored: StoredKey = {
    salt: encodeBase64(salt),
    iv: encodeBase64(iv),
    ciphertext: encodeBase64(new Uint8Array(ciphertext)),
  }
  return JSON.stringify(stored)
}

export async function decryptKeyWithPin(
  storedJson: string,
  pin: string
): Promise<Uint8Array> {
  const { salt, iv, ciphertext }: StoredKey = JSON.parse(storedJson)
  const aesKey = await pinToAesKey(pin, u8(decodeBase64(salt)))
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: u8(decodeBase64(iv)) },
    aesKey,
    u8(decodeBase64(ciphertext))
  )
  return new Uint8Array(plaintext)
}

// ─── localStorage helpers ─────────────────────────────────────────────────────

const KEY_PRIVATE = 'nenjam_priv'
const KEY_PUBLIC  = 'nenjam_pub'

export function saveEncryptedPrivateKey(encrypted: string) {
  localStorage.setItem(KEY_PRIVATE, encrypted)
}
export function loadEncryptedPrivateKey(): string | null {
  return localStorage.getItem(KEY_PRIVATE)
}
export function savePublicKeyLocally(pubKey: string) {
  localStorage.setItem(KEY_PUBLIC, pubKey)
}
export function loadPublicKeyLocally(): string | null {
  return localStorage.getItem(KEY_PUBLIC)
}
export function clearKeys() {
  localStorage.removeItem(KEY_PRIVATE)
  localStorage.removeItem(KEY_PUBLIC)
}
