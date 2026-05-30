import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  BookOpen, Calendar, StickyNote, Lock, Music, HelpCircle,
  CheckSquare, Moon, X, LogOut, KeyRound, ChevronRight,
} from 'lucide-react'
import { useAuthStore } from '../../stores/authStore'
import { useEncryptionStore } from '../../stores/encryptionStore'

const FEATURES = [
  { path: '/more/journal',    icon: BookOpen,     label: 'Private Journal', desc: 'Your personal encrypted diary',  color: 'bg-rose-100 text-rose-600' },
  { path: '/more/key-dates',  icon: Calendar,     label: 'Key Dates',       desc: 'Anniversaries & countdowns',     color: 'bg-pink-100 text-pink-600' },
  { path: '/more/notes',      icon: StickyNote,   label: 'Shared Notes',    desc: 'Collaborative space',            color: 'bg-purple-100 text-purple-600' },
  { path: '/more/capsule',    icon: Lock,         label: 'Time Capsule',    desc: 'Messages from the past',         color: 'bg-amber-100 text-amber-600' },
  { path: '/more/song',       icon: Music,        label: 'Our Song',        desc: 'The song that is us',            color: 'bg-teal-100 text-teal-600' },
  { path: '/more/quiz',       icon: HelpCircle,   label: 'Couple Quiz',     desc: 'How well do you know me?',      color: 'bg-indigo-100 text-indigo-600' },
  { path: '/more/bucket',     icon: CheckSquare,  label: 'Bucket List',     desc: 'Things to do together',         color: 'bg-green-100 text-green-600' },
  { path: '/more/goodnight',  icon: Moon,         label: 'Good Night',      desc: 'Notes before sleep',            color: 'bg-blue-100 text-blue-600' },
]

export default function MoreSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate()
  const { signOut, profile } = useAuthStore()
  const { lock } = useEncryptionStore()

  const go = (path: string) => { onClose(); navigate(path) }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[200]"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-black/50" onClick={onClose} />
          <motion.div
            className="absolute bottom-0 left-0 right-0 bg-white dark:bg-gray-900 rounded-t-3xl flex flex-col"
            style={{ maxHeight: 'min(88dvh, 88vh)' }}
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          >
            {/* Handle + header */}
            <div className="flex-none px-5 pt-3 pb-4 border-b border-gray-100 dark:border-gray-800">
              <div className="w-10 h-1 bg-gray-200 dark:bg-gray-700 rounded-full mx-auto mb-4" />
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-bold text-gray-900 dark:text-white text-lg">More</h2>
                  <p className="text-xs text-gray-400">Everything for just the two of you</p>
                </div>
                <button onClick={onClose} className="p-2 rounded-xl text-gray-400 hover:text-gray-600">
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Scrollable list */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2 pb-10">
              {FEATURES.map(({ path, icon: Icon, label, desc, color }) => (
                <button
                  key={path}
                  onClick={() => go(path)}
                  className="w-full bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-rose-100 dark:border-gray-700 p-4 flex items-center gap-4 hover:shadow-md transition-shadow active:scale-[0.98] text-left"
                >
                  <div className={`p-2.5 rounded-xl ${color}`}><Icon size={20} /></div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 dark:text-white text-sm">{label}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
                  </div>
                  <ChevronRight size={16} className="text-gray-300 flex-none" />
                </button>
              ))}

              <div className="pt-2">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-1 mb-2">Account</p>
                <button
                  onClick={() => { lock(); onClose() }}
                  className="w-full bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-rose-100 dark:border-gray-700 p-4 flex items-center gap-4 hover:shadow-md transition-shadow active:scale-[0.98] text-left"
                >
                  <div className="p-2.5 rounded-xl bg-gray-100 text-gray-500"><KeyRound size={20} /></div>
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900 dark:text-white text-sm">Lock app</p>
                    <p className="text-xs text-gray-400">Require PIN to re-enter</p>
                  </div>
                </button>
                <button
                  onClick={() => { signOut(); onClose() }}
                  className="w-full mt-2 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-rose-100 dark:border-gray-700 p-4 flex items-center gap-4 hover:shadow-md transition-shadow active:scale-[0.98] text-left"
                >
                  <div className="p-2.5 rounded-xl bg-red-100 text-red-500"><LogOut size={20} /></div>
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900 dark:text-white text-sm">Sign out</p>
                    <p className="text-xs text-gray-400">Signed in as {profile?.display_name}</p>
                  </div>
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
