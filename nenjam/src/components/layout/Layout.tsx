import { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import BottomNav from './BottomNav'

export default function Layout({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  const isMap  = pathname === '/map'
  const isReel = pathname === '/reel'
  return (
    <div className={(isMap || isReel) ? 'overflow-hidden' : 'min-h-screen bg-cream-50 dark:bg-gray-950'}>
      <main className={(isMap || isReel) ? '' : 'pb-20'}>{children}</main>
      <BottomNav />
    </div>
  )
}
