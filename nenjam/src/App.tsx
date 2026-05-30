import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { Toaster } from 'sonner'
import { useAuthStore } from './stores/authStore'
import { useEncryptionStore } from './stores/encryptionStore'
import { useAppStore } from './stores/appStore'
import { ReelMusicProvider } from './contexts/ReelMusicContext'
import Layout from './components/layout/Layout'
import LoginPage from './pages/LoginPage'
import SetupPinPage from './pages/SetupPinPage'
import HomePage from './pages/HomePage'
import ChatPage from './pages/ChatPage'
import MapPage from './pages/MapPage'
import TimelinePage from './pages/TimelinePage'
import MorePage from './pages/MorePage'
import ReelPage from './pages/ReelPage'

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-cream-50 dark:bg-gray-950 flex items-center justify-center">
      <div className="text-center">
        <div className="text-5xl mb-3 animate-pulse">🌸</div>
        <p className="text-rose-400 font-medium">Nenjam</p>
      </div>
    </div>
  )
}

export default function App() {
  const { user, loading, init } = useAuthStore()
  const { keysReady, checkForStoredKey, refreshSharedKey } = useEncryptionStore()
  const { loadAppSettings, updateStreak } = useAppStore()

  useEffect(() => {
    init()
    checkForStoredKey()

    // Dark mode: follow system preference
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    if (mq.matches) document.documentElement.classList.add('dark')
    mq.addEventListener('change', (e) => {
      document.documentElement.classList.toggle('dark', e.matches)
    })
  }, [])

  useEffect(() => {
    if (user && keysReady) {
      refreshSharedKey(user.id)
      loadAppSettings(user.id)
      updateStreak(user.id)
    }
  }, [user, keysReady])

  if (loading) return <LoadingScreen />

  if (!user) {
    return (
      <Routes>
        <Route path="*" element={<LoginPage />} />
      </Routes>
    )
  }

  if (!keysReady) {
    return (
      <Routes>
        <Route path="*" element={<SetupPinPage />} />
      </Routes>
    )
  }

  return (
    <ReelMusicProvider>
      <Layout>
        <Toaster position="top-center" richColors />
        <AnimatePresence mode="wait">
          <Routes>
            <Route path="/"         element={<HomePage />} />
            <Route path="/chat"     element={<ChatPage />} />
            <Route path="/map"      element={<MapPage />} />
            <Route path="/reel"     element={<ReelPage />} />
            <Route path="/timeline" element={<TimelinePage />} />
            <Route path="/more/*"   element={<MorePage />} />
            <Route path="*"         element={<Navigate to="/" replace />} />
          </Routes>
        </AnimatePresence>
      </Layout>
    </ReelMusicProvider>
  )
}
