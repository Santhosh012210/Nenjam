import { useState } from 'react'
import { motion } from 'framer-motion'
import { Lock, ShieldCheck } from 'lucide-react'
import { useAuthStore } from '../stores/authStore'
import { useEncryptionStore } from '../stores/encryptionStore'

type Step = 'choose' | 'create_pin' | 'confirm_pin' | 'enter_pin'

export default function SetupPinPage() {
  const { user, partner, signOut } = useAuthStore()
  const { hasStoredKey, setupNewKeys, unlockWithPin } = useEncryptionStore()

  const [step, setStep] = useState<Step>(hasStoredKey ? 'enter_pin' : 'choose')
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handlePinInput = (val: string, max = 6) => val.replace(/\D/g, '').slice(0, max)

  const handleCreate = async () => {
    if (pin.length < 4) { setError('PIN must be at least 4 digits'); return }
    if (pin !== confirmPin) { setError('PINs do not match'); return }
    setLoading(true)
    await setupNewKeys(pin, user!.id)
    setLoading(false)
  }

  const handleUnlock = async () => {
    if (pin.length < 4) { setError('Enter your PIN'); return }
    setLoading(true)
    const ok = await unlockWithPin(pin, partner?.public_key ?? null)
    if (!ok) {
      setError('Wrong PIN. Try again.')
      setPin('')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-cream-50 dark:bg-gray-950 flex flex-col items-center justify-center px-6 safe-top">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-rose-100 dark:bg-rose-900/30 rounded-2xl mb-4">
            {hasStoredKey ? <Lock size={32} className="text-rose-600" /> : <ShieldCheck size={32} className="text-rose-600" />}
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            {hasStoredKey ? 'Enter your PIN' : 'Protect with a PIN'}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            {hasStoredKey
              ? 'Your encryption keys are locked behind your PIN.'
              : 'Your messages and photos are end-to-end encrypted. Set a PIN to protect your key.'}
          </p>
        </div>

        {/* Enter existing PIN */}
        {step === 'enter_pin' && (
          <div className="space-y-4">
            <PinDots value={pin} />
            <NumPad
              value={pin}
              onChange={(v) => { setPin(handlePinInput(v)); setError(null) }}
              onSubmit={handleUnlock}
              loading={loading}
            />
            {error && <p className="text-sm text-red-500 text-center">{error}</p>}
            <button onClick={signOut} className="btn-ghost w-full text-sm text-gray-400">
              Sign out
            </button>
          </div>
        )}

        {/* Step 1: enter new PIN */}
        {step === 'create_pin' && (
          <div className="space-y-4">
            <PinDots value={pin} />
            <NumPad
              value={pin}
              onChange={(v) => { setPin(handlePinInput(v)); setError(null) }}
              onSubmit={() => { if (pin.length >= 4) setStep('confirm_pin') }}
              loading={false}
              submitLabel="Next"
            />
          </div>
        )}

        {/* Step 2: confirm PIN */}
        {step === 'confirm_pin' && (
          <div className="space-y-4">
            <p className="text-center text-sm text-gray-500 dark:text-gray-400">Confirm your PIN</p>
            <PinDots value={confirmPin} />
            <NumPad
              value={confirmPin}
              onChange={(v) => { setConfirmPin(handlePinInput(v)); setError(null) }}
              onSubmit={handleCreate}
              loading={loading}
              submitLabel="Confirm"
            />
            {error && <p className="text-sm text-red-500 text-center">{error}</p>}
          </div>
        )}

        {/* Step choose */}
        {step === 'choose' && (
          <button className="btn-primary w-full" onClick={() => setStep('create_pin')}>
            Create PIN
          </button>
        )}
      </motion.div>
    </div>
  )
}

function PinDots({ value }: { value: string }) {
  return (
    <div className="flex justify-center gap-3 my-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className={`w-3.5 h-3.5 rounded-full transition-all duration-150 ${
            i < value.length
              ? 'bg-rose-500 scale-110'
              : 'bg-gray-200 dark:bg-gray-700'
          }`}
        />
      ))}
    </div>
  )
}

function NumPad({
  value,
  onChange,
  onSubmit,
  loading,
  submitLabel = 'Unlock',
}: {
  value: string
  onChange: (v: string) => void
  onSubmit: () => void
  loading: boolean
  submitLabel?: string
}) {
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫']

  const press = (k: string) => {
    if (k === '⌫') onChange(value.slice(0, -1))
    else if (k && value.length < 6) onChange(value + k)
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        {keys.map((k, i) => (
          <button
            key={i}
            onClick={() => press(k)}
            disabled={!k && k !== '0'}
            className={`h-14 rounded-xl text-xl font-medium transition-all active:scale-95 ${
              k
                ? 'bg-white dark:bg-gray-800 shadow-sm text-gray-900 dark:text-white hover:bg-rose-50 dark:hover:bg-gray-700'
                : 'invisible'
            }`}
          >
            {k}
          </button>
        ))}
      </div>
      <button
        onClick={onSubmit}
        disabled={loading || value.length < 4}
        className="btn-primary w-full"
      >
        {loading ? (
          <span className="inline-block w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
        ) : (
          submitLabel
        )}
      </button>
    </div>
  )
}
