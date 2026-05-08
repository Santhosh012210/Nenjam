import { motion } from 'framer-motion'
import { Flame } from 'lucide-react'

export default function LoveStreak({ streakCount }: { streakCount: number }) {
  if (streakCount < 2) return null
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="card p-4 flex items-center gap-3"
    >
      <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
        <Flame size={22} className="text-amber-500" fill="currentColor" />
      </div>
      <div>
        <p className="font-semibold text-gray-900 dark:text-white text-sm">
          {streakCount} day streak 🔥
        </p>
        <p className="text-xs text-gray-400">Both of you opened the app {streakCount} days in a row</p>
      </div>
    </motion.div>
  )
}
