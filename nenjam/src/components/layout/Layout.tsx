import { ReactNode } from 'react'
import BottomNav from './BottomNav'

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-cream-50 dark:bg-gray-950">
      <main className="pb-20">{children}</main>
      <BottomNav />
    </div>
  )
}
