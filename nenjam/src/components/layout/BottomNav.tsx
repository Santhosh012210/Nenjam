import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { Heart, Map, Play, Film, MessageCircle, MoreHorizontal } from 'lucide-react'
import { motion } from 'framer-motion'
import MoreSheet from './MoreSheet'

const TABS = [
  { to: '/',         icon: Heart,          label: 'Home'     },
  { to: '/map',      icon: Map,            label: 'Map'      },
  { to: '/reel',     icon: Play,           label: 'Reel'     },
  { to: '/timeline', icon: Film,           label: 'Timeline' },
  { to: '/chat',     icon: MessageCircle,  label: 'Chat'     },
]

export default function BottomNav() {
  const [showMore, setShowMore] = useState(false)
  const { pathname } = useLocation()
  const isMoreActive = pathname.startsWith('/more')

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md border-t border-rose-100 dark:border-gray-800 bottom-nav">
        <div className="flex items-center justify-around px-1 pt-2">
          {TABS.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl transition-colors min-w-0 ${
                  isActive ? 'text-rose-600' : 'text-gray-400 dark:text-gray-500'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <motion.div
                    className="relative"
                    animate={{ scale: isActive ? 1.15 : 1 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="nav-blob"
                        className="absolute inset-0 bg-rose-100 dark:bg-rose-900/30 rounded-xl -z-10"
                      />
                    )}
                    <Icon size={20} strokeWidth={isActive ? 2.5 : 1.8} />
                  </motion.div>
                  <span className="text-[9px] font-medium">{label}</span>
                </>
              )}
            </NavLink>
          ))}

          {/* ⋯ More button */}
          <button
            onClick={() => setShowMore(true)}
            className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl transition-colors min-w-0 ${
              isMoreActive ? 'text-rose-600' : 'text-gray-400 dark:text-gray-500'
            }`}
          >
            <motion.div
              animate={{ scale: isMoreActive ? 1.15 : 1 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            >
              <MoreHorizontal size={20} strokeWidth={isMoreActive ? 2.5 : 1.8} />
            </motion.div>
            <span className="text-[9px] font-medium">More</span>
          </button>
        </div>
      </nav>

      <MoreSheet open={showMore} onClose={() => setShowMore(false)} />
    </>
  )
}
