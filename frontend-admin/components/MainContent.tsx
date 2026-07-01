'use client'

import { useSidebarStore } from '@/store/useStore'
import { motion } from 'framer-motion'

export default function MainContent({ children }: { children: React.ReactNode }) {
  const { isCollapsed } = useSidebarStore()

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
