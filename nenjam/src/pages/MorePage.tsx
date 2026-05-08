import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  BookOpen, Calendar, StickyNote, Lock, Music, HelpCircle,
  CheckSquare, Moon, Settings, LogOut, ChevronRight, KeyRound
} from 'lucide-react'
import { useAuthStore } from '../stores/authStore'
import { useEncryptionStore } from '../stores/encryptionStore'
import Journal from '../components/more/Journal'
import KeyDates from '../components/more/KeyDates'
import SharedNotes from '../components/more/SharedNotes'
import TimeCapsule from '../components/more/TimeCapsule'
import OurSong from '../components/more/OurSong'
import CoupleQuiz from '../components/more/CoupleQuiz'
import BucketList from '../components/more/BucketList'
import GoodNightNote from '../components/more/GoodNightNote'

const FEATURES = [
  { path: 'journal', icon: BookOpen, label: 'Private Journal', desc: 'Your personal encrypted diary', color: 'bg-rose-100 text-rose-600' },
  { path: 'key-dates', icon: Calendar, label: 'Key Dates', desc: 'Anniversaries & countdowns', color: 'bg-pink-100 text-pink-600' },
  { path: 'notes', icon: StickyNote, label: 'Shared Notes', desc: 'Collaborative space', color: 'bg-purple-100 text-purple-600' },
  { path: 'capsule', icon: Lock, label: 'Time Capsule', desc: 'Messages from the past', color: 'bg-amber-100 text-amber-600' },
  { path: 'song', icon: Music, label: 'Our Song', desc: 'The song that is us', color: 'bg-teal-100 text-teal-600' },
  { path: 'quiz', icon: HelpCircle, label: 'Couple Quiz', desc: 'How well do you know me?', color: 'bg-indigo-100 text-indigo-600' },
  { path: 'bucket', icon: CheckSquare, label: 'Bucket List', desc: 'Things to do together', color: 'bg-green-100 text-green-600' },
  { path: 'goodnight', icon: Moon, label: 'Good Night', desc: 'Notes before sleep', color: 'bg-blue-100 text-blue-600' },
]

function MoreHome() {
  const navigate = useNavigate()
  const { signOut, profile } = useAuthStore()
  const { lock } = useEncryptionStore()

  const handleLock = () => {
    lock()
    // encryptionStore.keysReady will be false, App.tsx will show SetupPinPage
  }

  return (
    <div className="min-h-screen bg-cream-50 dark:bg-gray-950 safe-top">
      <div className="max-w-md mx-auto px-4 pt-6 pb-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">More</h1>
        <p className="text-sm text-gray-400 mb-6">Everything for just the two of you</p>

        <div className="space-y-2">
          {FEATURES.map(({ path, icon: Icon, label, desc, color }, i) => (
            <motion.button
              key={path}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04 }}
              onClick={() => navigate(`/more/${path}`)}
              className="w-full card p-4 flex items-center gap-4 hover:shadow-md transition-shadow active:scale-[0.98] text-left"
            >
              <div className={`p-2.5 rounded-xl ${color}`}>
                <Icon size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 dark:text-white text-sm">{label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
              </div>
              <ChevronRight size={16} className="text-gray-300 flex-none" />
            </motion.button>
          ))}
        </div>

        {/* Settings section */}
        <div className="mt-6 space-y-2">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-1 mb-2">Account</p>
          <button
            onClick={handleLock}
            className="w-full card p-4 flex items-center gap-4 hover:shadow-md transition-shadow active:scale-[0.98] text-left"
          >
            <div className="p-2.5 rounded-xl bg-gray-100 text-gray-500">
              <KeyRound size={20} />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-gray-900 dark:text-white text-sm">Lock app</p>
              <p className="text-xs text-gray-400">Require PIN to re-enter</p>
            </div>
          </button>
          <button
            onClick={signOut}
            className="w-full card p-4 flex items-center gap-4 hover:shadow-md transition-shadow active:scale-[0.98] text-left"
          >
            <div className="p-2.5 rounded-xl bg-red-100 text-red-500">
              <LogOut size={20} />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-gray-900 dark:text-white text-sm">Sign out</p>
              <p className="text-xs text-gray-400">Signed in as {profile?.display_name}</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  )
}

export default function MorePage() {
  return (
    <Routes>
      <Route index element={<MoreHome />} />
      <Route path="journal" element={<Journal />} />
      <Route path="key-dates" element={<KeyDates />} />
      <Route path="notes" element={<SharedNotes />} />
      <Route path="capsule" element={<TimeCapsule />} />
      <Route path="song" element={<OurSong />} />
      <Route path="quiz" element={<CoupleQuiz />} />
      <Route path="bucket" element={<BucketList />} />
      <Route path="goodnight" element={<GoodNightNote />} />
    </Routes>
  )
}
