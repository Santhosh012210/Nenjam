import { useState } from 'react'
import { motion } from 'framer-motion'
import { Heart, Eye, EyeOff } from 'lucide-react'
import { useAuthStore } from '../stores/authStore'

export default function LoginPage() {
  const { signIn } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const err = await signIn(email.trim().toLowerCase(), password)
    if (err) setError('Incorrect email or password.')
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-cream-50 dark:bg-gray-950 flex flex-col items-center justify-center px-6 safe-top">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="w-full max-w-sm"
      >
        {/* Logo */}
        <div className="text-center mb-10">
          <motion.div
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut' }}
            className="inline-block text-rose-500 mb-3"
          >
            <Heart size={52} fill="currentColor" />
          </motion.div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
            Nenjam
          </h1>
          <p className="text-sm text-gray-400 mt-1 font-tamil">நெஞ்சம்</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-field"
              autoComplete="email"
              required
            />
          </div>

          <div className="relative">
            <input
              type={showPw ? 'text' : 'password'}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field pr-12"
              autoComplete="current-password"
              required
            />
            <button
              type="button"
              onClick={() => setShowPw((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1"
            >
              {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {error && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-sm text-red-500 text-center bg-red-50 dark:bg-red-900/20 rounded-xl px-4 py-2"
            >
              {error}
            </motion.p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full flex items-center justify-center gap-2 mt-2"
          >
            {loading ? (
              <span className="inline-block w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Heart size={18} fill="currentColor" />
                Enter our space
              </>
            )}
          </button>
        </form>

        <p className="text-xs text-gray-400 text-center mt-8">
          Private. Encrypted. Just us two. 🌸
        </p>
      </motion.div>
    </div>
  )
}
