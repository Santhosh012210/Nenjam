import { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import BottomNav from './BottomNav'

export default function Layout({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  const isMap = pathname === '/map'
  return (
    <div className={isMap ? 'overflow-hidden' : 'min-h-screen bg-cream-50 dark:bg-gray-950'}>
      <main className={isMap ? '' : 'pb-20'}>{children}</main>
      <BottomNav />
    </div>
  )
}
