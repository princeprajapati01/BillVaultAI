'use client'

import { useSidebarStore } from '@/store/useStore'
import { motion } from 'framer-motion'

import { usePathname } from 'next/navigation'

export default function MainContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { isCollapsed } = useSidebarStore()

  if (pathname === '/login') {
    return <main className="min-h-screen">{children}</main>
  }

  return (
    <motion.main
      initial={false}
      animate={{ marginLeft: isCollapsed ? '80px' : '280px' }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className="flex-1 p-6 transition-all"
    >
      {children}
    </motion.main>
  )
}

