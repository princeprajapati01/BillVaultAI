'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  User,
  Mail,
  Bell,
  Shield,
  CreditCard,
  HelpCircle,
  LogOut,
  ChevronRight,
  Crown,
  Zap,
  CheckCircle2,
  Camera,
  FileText,
  TrendingUp,
  Sparkles,
  Plus,
  BarChart3
} from 'lucide-react'

const premiumFeatures = [
  'Unlimited bill uploads',
  'Advanced AI analytics',
  'Export to accounting software',
  'Priority support',
  'Custom categories',
  'Team collaboration',
]

const menuItems = [
  { icon: User, label: 'Account Settings', href: '/settings/account' },
  //{ icon: Bell, label: 'Notifications', href: '/settings/notifications' },
  { icon: Shield, label: 'Privacy & Security', href: '/settings/privacy' },
  { icon: CreditCard, label: 'Payment Methods', href: '/settings/payment' },
  { icon: HelpCircle, label: 'Help & Support', href: '/feedback' },
]

export default function ProfileScreen() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [userProfile, setUserProfile] = useState<any>(null)
  const [billsStats, setBillsStats] = useState({ count: 0, totalSpent: 0 })

  const loadProfileData = async () => {
    const token = localStorage.getItem('auth_token')
    if (!token) {
      router.push('/login')
      return
    }

    try {
      // 1. Fetch User details from backend
      const meRes = await fetch('http://localhost:8000/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      if (!meRes.ok) {
        throw new Error('Session expired')
      }
      const meData = await meRes.json()
      setUserProfile(meData)

      // 2. Fetch User Bills to calculate spent stats
      const billsRes = await fetch('http://localhost:8000/api/bills', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      if (billsRes.ok) {
        const bills = await billsRes.json()
        const spent = bills.reduce((sum: number, b: any) => sum + b.amount, 0)
        setBillsStats({
          count: bills.length,
          totalSpent: spent
        })
      }
    } catch (err) {
      console.error(err)
      localStorage.removeItem('auth_token')
      localStorage.removeItem('user_info')
      router.push('/login')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadProfileData()
  }, [router])

  const handleUpgrade = async () => {
    const token = localStorage.getItem('auth_token')
    if (!token) return

    try {
      setLoading(true)
      const res = await fetch('http://localhost:8000/api/auth/upgrade', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      if (res.ok) {
        const data = await res.json()
        alert('Plan upgraded to Pro successfully!')

        // Update local user info cache
        const localUser = localStorage.getItem('user_info')
        if (localUser) {
          const parsed = JSON.parse(localUser)
          parsed.plan = 'Pro'
          localStorage.setItem('user_info', JSON.stringify(parsed))
        }

        await loadProfileData()
      } else {
        alert('Failed to upgrade plan.')
      }
    } catch (e) {
      console.error(e)
      alert('Error communicating with backend.')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('user_info')
    router.push('/login')
  }

  if (loading && !userProfile) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center flex-col gap-2">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-gray-500">Loading user profile...</span>
      </div>
    )
  }

  const uploadsLimit = userProfile?.uploads_limit || 10
  const uploadsUsed = userProfile?.uploads_used || 0
  const isPremium = userProfile?.plan !== 'Free'

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-primary-50 pb-24">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/dashboard')}
              className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-all"
            >
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Profile</h1>
              <p className="text-sm text-gray-600 mt-1">Manage your account</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Profile Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden"
        >
          <div className="bg-gradient-emerald h-24" />
          <div className="px-6 pb-6">
            <div className="flex items-end gap-4 -mt-12 mb-4">
              <div className="relative">
                <div className="w-24 h-24 bg-white rounded-2xl flex items-center justify-center text-3xl font-bold text-teal-600 shadow-lg border-4 border-white">
                  {userProfile?.name ? userProfile.name[0].toUpperCase() : 'U'}
                </div>
                <button className="absolute bottom-0 right-0 w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center shadow-lg hover:bg-primary-600 transition-all">
                  <Camera className="w-4 h-4 text-white" />
                </button>
              </div>
              <div className="flex-1 mb-2">
                <h2 className="text-2xl font-bold text-gray-900">{userProfile?.name || 'User Name'}</h2>
                <p className="text-gray-600">{userProfile?.email || 'user@example.com'}</p>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-3 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl">
                <FileText className="w-5 h-5 text-blue-600 mx-auto mb-1" />
                <p className="text-xl font-bold text-blue-900">{billsStats.count}</p>
                <p className="text-xs text-blue-700">Bills</p>
              </div>
              <div className="text-center p-3 bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl">
                <TrendingUp className="w-5 h-5 text-emerald-600 mx-auto mb-1" />
                <p className="text-xl font-bold text-emerald-900">₹{(billsStats.totalSpent / 1000).toFixed(1)}k</p>
                <p className="text-xs text-emerald-700">Spent</p>
              </div>
              <div className="text-center p-3 bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl">
                <Sparkles className="w-5 h-5 text-purple-600 mx-auto mb-1" />
                <p className="text-xl font-bold text-purple-900">98%</p>
                <p className="text-xs text-purple-700">AI Score</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Current Plan */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-bold text-gray-900">Current Plan</h3>
              <p className="text-sm text-gray-600 mt-1">{userProfile?.plan || 'Free'} Plan</p>
            </div>
            <div className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl font-semibold">
              {userProfile?.plan || 'Free'}
            </div>
          </div>

          {/* Usage Bar */}
          <div className="mb-4">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-600">Uploads this month</span>
              <span className="font-semibold text-gray-900">
                {uploadsUsed} / {isPremium ? 'Unlimited' : uploadsLimit}
              </span>
            </div>
            <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: isPremium ? '10%' : `${(uploadsUsed / uploadsLimit) * 100}%` }}
                transition={{ duration: 1, delay: 0.3 }}
                className="h-full bg-gradient-emerald"
              />
            </div>
            <p className="text-xs text-gray-600 mt-2">
              {isPremium ? 'Unlimited uploads enabled' : `${uploadsLimit - uploadsUsed} uploads remaining`}
            </p>
          </div>
        </motion.div>

        {/* Premium Upgrade Card (Show only if user is Free) */}
        {!isPremium && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-gradient-to-br from-amber-500 via-orange-500 to-pink-500 rounded-2xl shadow-lg overflow-hidden relative"
          >
            {/* Decorative Elements */}
            <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -mr-20 -mt-20" />
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/10 rounded-full -ml-16 -mb-16" />

            <div className="relative p-6">
              <div className="flex items-start gap-4 mb-6">
                <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                  <Crown className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-white mb-2">Upgrade to Pro</h3>
                  <p className="text-white/90 text-sm">
                    Unlock unlimited uploads and advanced AI features
                  </p>
                </div>
              </div>

              {/* Features */}
              <div className="space-y-2 mb-6">
                {premiumFeatures.map((feature, index) => (
                  <motion.div
                    key={feature}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + index * 0.05 }}
                    className="flex items-center gap-2 text-white"
                  >
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                    <span className="text-sm">{feature}</span>
                  </motion.div>
                ))}
              </div>

              {/* Pricing */}
              <div className="flex items-end gap-2 mb-4">
                <span className="text-4xl font-bold text-white">₹799</span>
                <span className="text-white/80 mb-1">/month</span>
              </div>

              {/* Upgrade Button */}
              <motion.button
                onClick={handleUpgrade}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full py-3 bg-white text-orange-600 font-bold rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2"
              >
                <Zap className="w-5 h-5" />
                Upgrade Now
              </motion.button>
            </div>
          </motion.div>
        )}

        {/* Menu Items */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden"
        >
          {menuItems.map((item, index) => (
            <button
              key={item.label}
              onClick={() => router.push(item.href)}
              className="w-full flex items-center gap-4 p-4 hover:bg-gray-50 transition-all border-b border-gray-100 last:border-b-0"
            >
              <div className="w-10 h-10 bg-gradient-to-br from-primary-100 to-cyan-100 rounded-xl flex items-center justify-center">
                <item.icon className="w-5 h-5 text-primary-600" />
              </div>
              <span className="flex-1 text-left font-medium text-gray-900">{item.label}</span>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </button>
          ))}
        </motion.div>

        {/* Logout Button */}
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 p-4 bg-white border-2 border-red-200 text-red-600 font-semibold rounded-xl hover:bg-red-50 transition-all"
        >
          <LogOut className="w-5 h-5" />
          Sign Out
        </motion.button>
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-6 py-3 z-40">
        <div className="max-w-7xl mx-auto flex items-center justify-around">
          <button
            onClick={() => router.push('/dashboard')}
            className="flex flex-col items-center gap-1 text-gray-400 hover:text-gray-600"
          >
            <BarChart3 className="w-6 h-6" />
            <span className="text-xs font-medium">Dashboard</span>
          </button>
          <button
            onClick={() => router.push('/history')}
            className="flex flex-col items-center gap-1 text-gray-400 hover:text-gray-600"
          >
            <FileText className="w-6 h-6" />
            <span className="text-xs font-medium">History</span>
          </button>
          <button
            onClick={() => router.push('/upload')}
            className="relative flex items-center justify-center -mt-8 w-14 h-14 bg-gradient-to-br from-emerald-400 to-teal-600 text-white rounded-full shadow-lg shadow-emerald-500/30 hover:scale-110 hover:shadow-emerald-500/50 active:scale-95 transition-all duration-300 z-50 border-4 border-white"
            title="Upload Invoice"
          >
            <Plus className="w-7 h-7" strokeWidth={3} />
            <span className="absolute -inset-1 rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 opacity-40 blur-sm animate-pulse -z-10" />
          </button>
          <button 
            onClick={() => router.push('/analytics')}
            className="flex flex-col items-center gap-1 text-gray-400 hover:text-gray-600"
          >
            <TrendingUp className="w-6 h-6" />
            <span className="text-xs font-medium">Unpaid</span>
          </button>
          <button className="flex flex-col items-center gap-1 text-primary-600">
            <div className="w-6 h-6 bg-gradient-emerald rounded-full flex items-center justify-center text-[10px] font-bold text-white bg-gradient-emerald">
              {userProfile?.name ? userProfile.name[0].toUpperCase() : 'U'}
            </div>
            <span className="text-xs font-medium">Profile</span>
          </button>
        </div>
      </div>
    </div>
  )
}
