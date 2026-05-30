import { create } from 'zustand'
import nacl from 'tweetnacl'
import { decodeBase64 } from 'tweetnacl-util'
import {
  generateKeyPair,
  exportPublicKey,
  deriveSharedKey,
  encryptKeyWithPin,
  decryptKeyWithPin,
  saveEncryptedPrivateKey,
  loadEncryptedPrivateKey,
  hasStoredKeyForUser,
  savePublicKeyLocally,
} from '../lib/encryption'
import { supabase } from '../lib/supabase'

interface EncryptionState {
  keysReady: boolean
  hasStoredKey: boolean
  privateKey: Uint8Array | null
  publicKey: Uint8Array | null
  sharedKey: Uint8Array | null  // derived after partner's pub key is known
  privateJournalKey: Uint8Array | null  // first 32 bytes of private key used as secretbox key

  checkForStoredKey: (userId: string) => void
  setupNewKeys: (pin: string, userId: string) => Promise<void>
  unlockWithPin: (userId: string, pin: string, partnerPublicKeyB64: string | null) => Promise<boolean>
  deriveAndSetSharedKey: (partnerPublicKeyB64: string) => void
  refreshSharedKey: (userId: string) => Promise<void>
  lock: () => void
}

export const useEncryptionStore = create<EncryptionState>((set, get) => ({
  keysReady: false,
  hasStoredKey: false,
  privateKey: null,
  publicKey: null,
  sharedKey: null,
  privateJournalKey: null,

  checkForStoredKey: (userId) => {
    set({ hasStoredKey: hasStoredKeyForUser(userId) })
  },

  setupNewKeys: async (pin, userId) => {
    const kp = generateKeyPair()
    const encryptedPriv = await encryptKeyWithPin(kp.secretKey, pin)
    saveEncryptedPrivateKey(userId, encryptedPriv)
    savePublicKeyLocally(userId, exportPublicKey(kp))

    // Save public key to Supabase so partner can see it
    await supabase
      .from('profiles')
      .update({ public_key: exportPublicKey(kp) })
      .eq('id', userId)

    set({
      privateKey: kp.secretKey,
      publicKey: kp.publicKey,
      privateJournalKey: kp.secretKey.slice(0, 32),
      keysReady: true,
      hasStoredKey: true,
    })
  },

  unlockWithPin: async (userId, pin, partnerPublicKeyB64) => {
    const storedJson = loadEncryptedPrivateKey(userId)
    if (!storedJson) return false
    try {
      const privKey = await decryptKeyWithPin(storedJson, pin)
      const kp = nacl.box.keyPair.fromSecretKey(privKey)

      let sharedKey: Uint8Array | null = null
      if (partnerPublicKeyB64) {
        sharedKey = deriveSharedKey(privKey, decodeBase64(partnerPublicKeyB64))
      }

      set({
        privateKey: privKey,
        publicKey: kp.publicKey,
        sharedKey,
        privateJournalKey: privKey.slice(0, 32),
        keysReady: true,
      })
      return true
    } catch {
      return false
    }
  },

  deriveAndSetSharedKey: (partnerPublicKeyB64) => {
    const { privateKey } = get()
    if (!privateKey) return
    const sharedKey = deriveSharedKey(privateKey, decodeBase64(partnerPublicKeyB64))
    set({ sharedKey })
  },

  refreshSharedKey: async (userId) => {
    const { privateKey } = get()
    if (!privateKey) return
    // Re-fetch partner's latest profile — their public key may have been added since login
    const { data: profile } = await supabase
      .from('profiles').select('partner_id').eq('id', userId).single()
    if (!profile?.partner_id) return
    const { data: partner } = await supabase
      .from('profiles').select('public_key').eq('id', profile.partner_id).single()
    if (!partner?.public_key) return
    set({ sharedKey: deriveSharedKey(privateKey, decodeBase64(partner.public_key)) })
  },

  lock: () => {
    set({
      privateKey: null,
      publicKey: null,
      sharedKey: null,
      privateJournalKey: null,
      keysReady: false,
    })
  },
}))
