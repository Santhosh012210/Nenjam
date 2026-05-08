import { create } from 'zustand'
import { downloadEncryptedPhoto } from '../lib/r2'
import { decryptBinary } from '../lib/encryption'
import { uint8ArrayToObjectUrl } from '../lib/imageProcessing'

interface TimelineStore {
  // Decrypted blob URL cache — keyed by R2 key. Survives page navigation.
  blobCache: Record<string, string>

  // Fetch, decrypt, and cache a single photo by its R2 key.
  // Returns the blob URL (from cache if already decrypted).
  getOrDecrypt: (
    r2Key: string,
    encKey: Uint8Array
  ) => Promise<string | null>

  // Clear the cache (e.g. on sign-out).
  clearCache: () => void
}

export const useTimelineStore = create<TimelineStore>((set, get) => ({
  blobCache: {},

  getOrDecrypt: async (r2Key, encKey) => {
    const cached = get().blobCache[r2Key]
    if (cached) return cached

    try {
      const { encrypted, nonce } = await downloadEncryptedPhoto(r2Key)
      const decrypted = decryptBinary(encrypted, nonce, encKey)
      if (!decrypted) return null
      const url = uint8ArrayToObjectUrl(decrypted)
      set((state) => ({ blobCache: { ...state.blobCache, [r2Key]: url } }))
      return url
    } catch (err) {
      console.error('Timeline photo decrypt failed:', r2Key, err)
      return null
    }
  },

  clearCache: () => {
    // Revoke object URLs to free memory before clearing
    const cache = get().blobCache
    Object.values(cache).forEach((url) => {
      if (url.startsWith('blob:')) URL.revokeObjectURL(url)
    })
    set({ blobCache: {} })
  },
}))
