import React from 'react'
import { motion } from 'framer-motion'
import { useAuthStore } from '../stores/authStore'
import { useAppStore } from '../stores/appStore'
import LoveStreak from '../components/home/LoveStreak'
import MoodCheckin from '../components/home/MoodCheckin'
import MontageCard from '../components/home/MontageCard'
import OurSongPlayer from '../components/home/OurSongPlayer'
import { differenceInDays, parseISO, format } from 'date-fns'
import { useNavigate } from 'react-router-dom'
import { BookOpen, Clock, MessageCircle } from 'lucide-react'

export default function HomePage() {
  const { profile, partner } = useAuthStore()
  const { streakCount, relationshipStart, daysTogther } = useAppStore()
  const navigate = useNavigate()

  const today = format(new Date(), 'EEEE, MMMM d')

  return (
    <div className="min-h-screen bg-gradient-to-b from-rose-50 to-cream-50 dark:from-gray-950 dark:to-gray-950 safe-top">
      <div className="max-w-md mx-auto px-4 pt-6 pb-4 space-y-4">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div>
            <p className="text-xs text-rose-400 font-medium uppercase tracking-widest">{today}</p>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mt-0.5">
              Hi, {profile?.display_name?.split(' ')[0]} 🌸
            </h1>
          </div>
          {partner && (
            <div className="flex flex-col items-end">
              <span className="text-xs text-gray-400">with</span>
              <span className="font-semibold text-rose-600 text-sm">
                {partner.display_name?.split(' ')[0]}
              </span>
            </div>
          )}
        </motion.div>

        {/* Days Together Banner */}
        {daysTogther > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="card p-4 bg-gradient-to-r from-rose-500 to-pink-400 border-none text-white"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/80 text-xs font-medium uppercase tracking-wider">Together</p>
                <p className="text-4xl font-bold mt-0.5">{daysTogther}</p>
                <p className="text-white/80 text-sm">days of love 💕</p>
              </div>
              <div className="text-right">
                <p className="text-white/70 text-xs">Streak</p>
                <div className="flex items-center gap-1 justify-end">
                  <span className="text-2xl font-bold">{streakCount}</span>
                  <span className="text-lg">🔥</span>
                </div>
                <p className="text-white/70 text-xs">days in a row</p>
              </div>
            </div>
          </motion.div>
        )}

        <LoveStreak streakCount={streakCount} />

        {/* Our Song */}
        <OurSongPlayer />

        {/* Mood Check-in */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <MoodCheckin />
        </motion.div>

        {/* Montage Card */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <MontageCard />
        </motion.div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="grid grid-cols-3 gap-3"
        >
          <QuickAction
            icon={<BookOpen size={22} className="text-rose-500" />}
            label="Journal"
            onClick={() => navigate('/more/journal')}
          />
          <QuickAction
            icon={<MessageCircle size={22} className="text-rose-500" />}
            label="Chat"
            onClick={() => navigate('/chat')}
          />
          <QuickAction
            icon={<Clock size={22} className="text-rose-500" />}
            label="Time Capsule"
            onClick={() => navigate('/more/capsule')}
          />
        </motion.div>

      </div>
    </div>
  )
}

function QuickAction({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="card p-4 flex flex-col items-center gap-2 hover:shadow-md transition-shadow active:scale-95"
    >
      {icon}
      <span className="text-xs font-medium text-gray-600 dark:text-gray-300">{label}</span>
    </button>
  )
}
