'use client'

import { motion } from 'framer-motion'
import { 
  LayoutDashboard, 
  Users, 
  FileText, 
  ScanLine, 
  Brain, 
  Database, 
  CreditCard, 
  Crown, 
  MessageSquare, 
  Bell, 
  Settings, 
  Activity, 
  Code,
  ChevronLeft,
  ChevronRight,
  Zap
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSidebarStore } from '@/store/useStore'
import { cn } from '@/lib/utils'

const menuItems = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/', color: 'text-emerald-400' },
  { icon: Users, label: 'Users', href: '/users', color: 'text-blue-400' },
  { icon: FileText, label: 'Invoice Analytics', href: '/invoices', color: 'text-purple-400' },
  { icon: ScanLine, label: 'OCR Processing', href: '/ocr', color: 'text-cyan-400' },
  { icon: Brain, label: 'AI Extraction', href: '/ai-extraction', color: 'text-pink-400' },
  { icon: Database, label: 'Storage', href: '/storage', color: 'text-orange-400' },
  { icon: CreditCard, label: 'Payments', href: '/payments', color: 'text-green-400' },
  { icon: Crown, label: 'Subscriptions', href: '/subscriptions', color: 'text-yellow-400' },
  { icon: MessageSquare, label: 'Feedback', href: '/feedback', color: 'text-indigo-400' },
  { icon: Bell, label: 'Notifications', href: '/notifications', color: 'text-red-400' },
  { icon: Settings, label: 'Settings', href: '/settings', color: 'text-slate-400' },
  { icon: Activity, label: 'System Health', href: '/system', color: 'text-teal-400' },
  { icon: Code, label: 'API Monitor', href: '/api', color: 'text-violet-400' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const { isCollapsed, toggleSidebar } = useSidebarStore()

  return (
    <motion.aside
      initial={false}
      animate={{ width: isCollapsed ? 80 : 280 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className="fixed left-0 top-0 h-screen bg-slate-950 border-r border-slate-800 z-50 flex flex-col"
    >
      {/* Logo */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800">
        <motion.div
          initial={false}
          animate={{ opacity: isCollapsed ? 0 : 1 }}
          className="flex items-center gap-2"
        >
          <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center overflow-hidden border border-slate-800">
            <img 
              src="/logo.png" 
              alt="BillVault AI Logo" 
              className="w-full h-full object-cover" 
            />
          </div>
          {!isCollapsed && (
            <span className="font-bold text-lg bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
              BillVault AI
            </span>
          )}
        </motion.div>
        <button
          onClick={toggleSidebar}
          className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center transition-colors"
        >
          {isCollapsed ? (
            <ChevronRight className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronLeft className="w-4 h-4 text-slate-400" />
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
        {menuItems.map((item) => {
          const isActive = pathname === item.href
          const Icon = item.icon

          return (
            <Link key={item.href} href={item.href}>
              <motion.div
                whileHover={{ scale: 1.02, x: 4 }}
                whileTap={{ scale: 0.98 }}
                className={cn(
                  'relative flex items-center gap-3 px-3 py-3 rounded-lg transition-all cursor-pointer group',
                  isActive
                    ? 'bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border border-emerald-500/30'
                    : 'hover:bg-slate-800/50'
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 rounded-lg"
                    transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <Icon
                  className={cn(
                    'w-5 h-5 relative z-10 transition-colors',
                    isActive ? item.color : 'text-slate-400 group-hover:text-slate-200'
                  )}
                />
                {!isCollapsed && (
                  <span
                    className={cn(
                      'text-sm font-medium relative z-10 transition-colors',
                      isActive ? 'text-slate-100' : 'text-slate-400 group-hover:text-slate-200'
                    )}
                  >
                    {item.label}
                  </span>
                )}
                {isActive && !isCollapsed && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="ml-auto w-2 h-2 rounded-full bg-emerald-400 shadow-lg shadow-emerald-400/50"
                  />
                )}
              </motion.div>
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-slate-800">
        <div className={cn(
          'flex items-center gap-3 px-3 py-2 rounded-lg bg-slate-800/50',
          isCollapsed && 'justify-center'
        )}>
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-white text-sm font-bold">
            A
          </div>
          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-200 truncate">Admin</p>
              <p className="text-xs text-slate-500 truncate">admin@billvaultai.com</p>
            </div>
          )}
        </div>
      </div>
    </motion.aside>
  )
}
