'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { 
  FileText, 
  TrendingUp, 
  Receipt, 
  Sparkles, 
  Plus, 
  Search,
  Filter,
  Calendar,
  DollarSign,
  CheckCircle2,
  Clock,
  ChevronRight,
  BarChart3,
  PieChart,
  Zap,
  LogOut,
  Bell
} from 'lucide-react'
import { PieChart as RechartsPie, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import { useRouter } from 'next/navigation'

export default function DashboardScreen() {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  
  // Dynamic stats & data state
  const [stats, setStats] = useState<any[]>([])
  const [recentBills, setRecentBills] = useState<any[]>([])
  const [barData, setBarData] = useState<any[]>([])
  const [pieData, setPieData] = useState<any[]>([])
  const [aiInsight, setAiInsight] = useState('')
  
  const [notifications, setNotifications] = useState<any[]>([])
  const [showNotifications, setShowNotifications] = useState(false)
  const [toast, setToast] = useState<any>(null)

  // Load initial notifications from localStorage
  useEffect(() => {
    const cached = localStorage.getItem('dashboard_notifications')
    if (cached) {
      try {
        setNotifications(JSON.parse(cached))
      } catch (e) {}
    }
  }, [])

  // Persist notifications to localStorage
  useEffect(() => {
    localStorage.setItem('dashboard_notifications', JSON.stringify(notifications))
  }, [notifications])

  // Auto-dismiss toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        setToast(null)
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [toast])

  useEffect(() => {
    const token = localStorage.getItem('auth_token')
    if (!token) {
      router.push('/login')
      return
    }

    async function loadDashboardData(isPoll = false) {
      try {
        if (!isPoll) {
          // 1. Fetch current user info
          const userRes = await fetch('http://localhost:8000/api/auth/me', {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          })
          if (!userRes.ok) {
            throw new Error('Session expired')
          }
          const userData = await userRes.json()
          setUser(userData)
        }

        // 2. Fetch user bills list
        const billsRes = await fetch('http://localhost:8000/api/bills', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
        if (!billsRes.ok) {
          throw new Error('Failed to load bills')
        }
        const billsData = await billsRes.json()

        // Calculations for Stats
        const totalBillsCount = billsData.length
        let totalAmount = 0
        let totalGst = 0
        let totalPaid = 0
        let amountDue = 0
        const categoriesMap: Record<string, number> = {}
        const monthlyMap: Record<string, number> = {}

        // Setup last 6 months list for charts
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
        const last6Months: string[] = []
        for (let i = 5; i >= 0; i--) {
          const d = new Date()
          d.setMonth(d.getMonth() - i)
          last6Months.push(months[d.getMonth()])
        }
        
        last6Months.forEach(m => {
          monthlyMap[m] = 0
        })

        billsData.forEach((bill: any) => {
          totalAmount += bill.amount
          totalGst += bill.gst

          // Accumulate paid and due metrics
          if (bill.paymentStatus === 'PAID') {
            totalPaid += bill.amount
          } else if (bill.paymentStatus === 'PARTIALLY_PAID') {
            const paid = bill.amount - (bill.balanceDue || 0)
            totalPaid += paid > 0 ? paid : 0
            amountDue += bill.balanceDue || 0
          } else if (bill.paymentStatus === 'UNPAID' || bill.paymentStatus === 'OVERDUE') {
            totalPaid += bill.amountPaid || 0
            amountDue += bill.balanceDue || bill.amount
          } else if (bill.paymentStatus === 'CANCELLED') {
            // Cancelled invoices do not count towards paid or outstanding
          } else {
            // UNKNOWN status fallback
            amountDue += bill.balanceDue || 0
            totalPaid += bill.amountPaid || 0
          }

          // Accumulate by category
          const category = bill.category || 'Office'
          categoriesMap[category] = (categoriesMap[category] || 0) + bill.amount

          // Accumulate by month
          let billMonth = ''
          try {
            const dateObj = new Date(bill.date)
            if (!isNaN(dateObj.getTime())) {
              billMonth = months[dateObj.getMonth()]
            }
          } catch (e) {}

          if (!billMonth) {
            const match = months.find(m => bill.date && bill.date.includes(m))
            if (match) billMonth = match
          }

          if (!billMonth) {
            billMonth = months[new Date().getMonth()]
          }

          if (monthlyMap[billMonth] !== undefined) {
            monthlyMap[billMonth] += bill.amount
          }
        })

        // Filter and top 5 recent bills
        setRecentBills(billsData.slice(0, 5))

        // Set bar chart monthly spending
        const monthlyChartData = last6Months.map(m => ({
          month: m,
          amount: Math.round(monthlyMap[m])
        }))
        setBarData(monthlyChartData)

        // Set pie chart category breakdown
        const colors = ['#14b8a6', '#3b82f6', '#a855f7', '#f59e0b', '#ef4444']
        const totalCatVal = Object.values(categoriesMap).reduce((a, b) => a + b, 0)
        const categoryChartData = Object.keys(categoriesMap).map((name, index) => {
          const val = categoriesMap[name]
          const percentage = totalCatVal > 0 ? Math.round((val / totalCatVal) * 100) : 0
          return {
            name,
            value: percentage,
            color: colors[index % colors.length]
          }
        })
        setPieData(categoryChartData.length > 0 ? categoryChartData : [{ name: 'No Data', value: 100, color: '#9ca3af' }])

        // Formulate personalized dynamic AI Insight
        if (totalBillsCount > 0) {
          const maxCat = Object.keys(categoriesMap).reduce((a, b) => categoriesMap[a] > categoriesMap[b] ? a : b, 'Office')
          setStats([
            { label: 'Total Invoices', value: totalBillsCount, change: '+100%', icon: FileText, color: 'from-blue-500 to-indigo-500' },
            { label: 'Total Amount', value: `₹${totalAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`, change: '+100%', icon: DollarSign, color: 'from-purple-500 to-pink-500' },
            { label: 'Total Paid', value: `₹${totalPaid.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`, change: '+100%', icon: CheckCircle2, color: 'from-emerald-500 to-teal-500' },
            { label: 'Amount Due', value: `₹${amountDue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`, change: '+100%', icon: Clock, color: 'from-amber-500 to-orange-500' }
          ])
          setAiInsight(`Your BillVault AI processed ₹${totalAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}. Outstanding due: ₹${amountDue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}. Most spending resides in '${maxCat}'.`)
        } else {
          setStats([
            { label: 'Total Invoices', value: '0', change: '0%', icon: FileText, color: 'from-blue-500 to-indigo-500' },
            { label: 'Total Amount', value: '₹0.00', change: '0%', icon: DollarSign, color: 'from-purple-500 to-pink-500' },
            { label: 'Total Paid', value: '₹0.00', change: '0%', icon: CheckCircle2, color: 'from-emerald-500 to-teal-500' },
            { label: 'Amount Due', value: '₹0.00', change: '0%', icon: Clock, color: 'from-amber-500 to-orange-500' }
          ])
          setAiInsight("Welcome! Upload your first bill using the floating button below to activate real-time AI spatial insights and metrics.")
        }

        // Check for state transitions to show notifications
        const prevBillsStr = localStorage.getItem('notified_bills_cache')
        let prevBills: Record<string, string> = {}
        try {
          if (prevBillsStr) prevBills = JSON.parse(prevBillsStr)
        } catch (e) {}

        const nextNotifiedCache = { ...prevBills }
        const newNotifications: any[] = []

        billsData.forEach((bill: any) => {
          const prevStatus = prevBills[bill.id]
          if (prevStatus === 'processing' && bill.status === 'processed') {
            const msg = `🎉 Invoice from ${bill.merchant || 'Merchant'} for ₹${bill.amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })} was processed successfully!`
            newNotifications.push({
              id: `${bill.id}-success-${Date.now()}`,
              message: msg,
              time: 'Just now',
              type: 'success',
              read: false
            })
            setToast({
              message: msg,
              type: 'success'
            })
          } else if (prevStatus === 'processing' && bill.status === 'failed') {
            const msg = `❌ Invoice upload failed to process.`
            newNotifications.push({
              id: `${bill.id}-failed-${Date.now()}`,
              message: msg,
              time: 'Just now',
              type: 'failed',
              read: false
            })
            setToast({
              message: msg,
              type: 'failed'
            })
          }
          nextNotifiedCache[bill.id] = bill.status
        })

        localStorage.setItem('notified_bills_cache', JSON.stringify(nextNotifiedCache))

        if (newNotifications.length > 0) {
          setNotifications(prev => [...newNotifications, ...prev])
        }

        return billsData

      } catch (err) {
        console.error(err)
        if (!isPoll) {
          localStorage.removeItem('auth_token')
          localStorage.removeItem('user_info')
          router.push('/login')
        }
      } finally {
        if (!isPoll) {
          setLoading(false)
        }
      }
    }

    let active = true
    let pollInterval: NodeJS.Timeout

    async function init() {
      const bills = await loadDashboardData(false)
      if (!active) return

      const hasProcessing = bills && bills.some((b: any) => b.status === 'processing')
      if (hasProcessing) {
        pollInterval = setInterval(async () => {
          const updatedBills = await loadDashboardData(true)
          const stillProcessing = updatedBills && updatedBills.some((b: any) => b.status === 'processing')
          if (!stillProcessing && pollInterval) {
            clearInterval(pollInterval)
          }
        }, 4000)
      }
    }

    init()

    return () => {
      active = false
      if (pollInterval) {
        clearInterval(pollInterval)
      }
    }
  }, [router])

  // Filter bills list matching search query
  const filteredRecentBills = recentBills.filter(bill => 
    bill.merchant.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (bill.invoiceNumber && bill.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  const handleLogout = () => {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('user_info')
    router.push('/login')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center flex-col gap-4">
        <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-600 font-semibold animate-pulse">Loading BillVault AI...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-primary-50">
      {/* Toast Notifications */}
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: -20, x: 20 }}
          animate={{ opacity: 1, y: 0, x: 0 }}
          exit={{ opacity: 0, y: -20, x: 20 }}
          className="fixed top-6 right-6 z-50 max-w-sm bg-white rounded-2xl p-4 shadow-2xl border border-gray-100 flex items-start gap-3"
        >
          <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
            toast.type === 'success' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'
          }`}>
            {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-bold text-gray-900">
              {toast.type === 'success' ? 'Processing Completed!' : 'Processing Failed'}
            </h4>
            <p className="text-xs text-gray-600 mt-1">{toast.message}</p>
          </div>
          <button 
            onClick={() => setToast(null)}
            className="text-gray-400 hover:text-gray-600 text-sm font-semibold flex-shrink-0 self-start"
          >
            ✕
          </button>
        </motion.div>
      )}

      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
              <p className="text-sm text-gray-600 mt-1">Welcome back, {user?.name || 'User'} 👋</p>
            </div>
            <div className="flex items-center gap-3">
              {/* Bell Icon & Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="w-10 h-10 bg-slate-50 text-gray-600 hover:bg-slate-100 rounded-xl flex items-center justify-center transition-all relative"
                  title="Notifications"
                >
                  <Bell className="w-5 h-5" />
                  {notifications.some(n => !n.read) && (
                    <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white animate-pulse" />
                  )}
                </button>

                {/* Notifications Dropdown Panel */}
                {showNotifications && (
                  <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 py-2 z-50 overflow-hidden text-left">
                    <div className="px-4 py-2 border-b border-gray-100 flex items-center justify-between">
                      <span className="font-bold text-gray-900 text-sm">Notifications</span>
                      {notifications.length > 0 && (
                        <button
                          onClick={() => setNotifications(prev => prev.map(n => ({ ...n, read: true })))}
                          className="text-xs text-primary-600 hover:text-primary-700 font-semibold"
                        >
                          Mark all read
                        </button>
                      )}
                    </div>
                    <div className="max-h-60 overflow-y-auto divide-y divide-gray-50">
                      {notifications.length === 0 ? (
                        <div className="px-4 py-8 text-center text-gray-500 text-xs">
                          No new notifications.
                        </div>
                      ) : (
                        notifications.map(n => (
                          <div 
                            key={n.id} 
                            onClick={() => {
                              setNotifications(prev => prev.map(item => item.id === n.id ? { ...item, read: true } : item))
                            }}
                            className={`p-3 transition-colors hover:bg-gray-50 cursor-pointer ${
                              !n.read ? 'bg-primary-50/30' : ''
                            }`}
                          >
                            <p className="text-xs text-gray-700 leading-normal">{n.message}</p>
                            <span className="text-[10px] text-gray-400 mt-1 block">{n.time}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              <button 
                onClick={() => router.push('/profile')}
                className="w-10 h-10 bg-gradient-emerald rounded-full flex items-center justify-center text-white font-semibold shadow-lg hover:scale-105 transition-transform"
              >
                {user?.name ? user.name[0].toUpperCase() : 'U'}
              </button>
              <button 
                onClick={handleLogout}
                className="w-10 h-10 bg-red-50 text-red-600 rounded-xl flex items-center justify-center hover:bg-red-100 transition-all"
                title="Sign Out"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-6 pb-24">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {stats.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-white rounded-2xl p-4 shadow-lg border border-gray-100 hover:shadow-xl transition-all"
            >
              <div className="flex items-start justify-between mb-3">
                <div className={`w-10 h-10 bg-gradient-to-br ${stat.color} rounded-xl flex items-center justify-center shadow-lg`}>
                  <stat.icon className="w-5 h-5 text-white" />
                </div>
                <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
                  {stat.change}
                </span>
              </div>
              <p className="text-2xl font-bold text-gray-900 mb-1">{stat.value}</p>
              <p className="text-xs text-gray-600">{stat.label}</p>
            </motion.div>
          ))}
        </div>

        {/* Charts Section */}
        <div className="grid lg:grid-cols-2 gap-6 mb-6">
          {/* Spending Chart */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Monthly Spending</h3>
                <p className="text-sm text-gray-600">Last 6 months</p>
              </div>
              <BarChart3 className="w-5 h-5 text-primary-600" />
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" stroke="#9ca3af" fontSize={12} />
                <YAxis stroke="#9ca3af" fontSize={12} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'white', 
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                  }}
                />
                <Bar dataKey="amount" fill="url(#colorGradient)" radius={[8, 8, 0, 0]} />
                <defs>
                  <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#14b8a6" />
                    <stop offset="100%" stopColor="#0d9488" />
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Category Breakdown */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Category Breakdown</h3>
                <p className="text-sm text-gray-600">All-time split</p>
              </div>
              <PieChart className="w-5 h-5 text-primary-600" />
            </div>
            <div className="flex items-center justify-center">
              <ResponsiveContainer width="100%" height={200}>
                <RechartsPie>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </RechartsPie>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-4">
              {pieData.map((item) => (
                <div key={item.name} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-sm text-gray-700">{item.name}</span>
                  <span className="text-sm font-semibold text-gray-900 ml-auto">{item.value}%</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* AI Insights Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-gradient-to-br from-primary-500 to-cyan-500 rounded-2xl p-6 shadow-lg mb-6 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full -ml-12 -mb-12" />
          <div className="relative flex items-start gap-4">
            <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-white mb-2">AI Insight</h3>
              <p className="text-white/90 text-sm leading-relaxed">
                {aiInsight}
              </p>
            </div>
          </div>
        </motion.div>

        {/* Recent Bills Section */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          {/* Section Header */}
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Recent Bills</h3>
              <button 
                onClick={() => router.push('/history')}
                className="text-sm text-primary-600 hover:text-primary-700 font-semibold flex items-center gap-1"
              >
                View All
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search bills..."
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all text-gray-900"
              />
              <button className="absolute right-3 top-1/2 -translate-y-1/2">
                <Filter className="w-5 h-5 text-gray-400 hover:text-gray-600" />
              </button>
            </div>
          </div>

          {/* Bills List */}
          <div className="divide-y divide-gray-100">
            {filteredRecentBills.length === 0 ? (
              <div className="p-8 text-center text-gray-500 text-sm">
                No recent bills found.
              </div>
            ) : (
              filteredRecentBills.map((bill, index) => (
                <motion.div
                  key={bill.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.7 + index * 0.05 }}
                  onClick={() => router.push(`/bill/${bill.id}`)}
                  className="p-4 hover:bg-gray-50 cursor-pointer transition-all active:bg-gray-100"
                >
                  <div className="flex items-center gap-4">
                    {/* Thumbnail */}
                    <div className="w-12 h-12 bg-gradient-to-br from-primary-100 to-cyan-100 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">
                      {bill.thumbnail || '📄'}
                    </div>

                    {/* Bill Info */}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-gray-900 truncate">{bill.merchant}</h4>
                      <div className="flex items-center gap-2 mt-1">
                        <Calendar className="w-3.5 h-3.5 text-gray-400" />
                        <span className="text-sm text-gray-600">{bill.date}</span>
                        <span className="text-xs text-gray-400">•</span>
                        <span className="text-xs px-2 py-0.5 bg-primary-50 text-primary-700 rounded-full font-medium">
                          {bill.category}
                        </span>
                      </div>
                    </div>

                    {/* Amount & Status */}
                    <div className="text-right flex-shrink-0">
                      <p className="font-bold text-gray-900">₹{bill.amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p>
                      <div className="flex items-center gap-1 mt-1 justify-end">
                        {bill.status === 'processed' ? (
                          (() => {
                            const status = bill.paymentStatus || 'UNKNOWN';
                            let bgColor = 'bg-gray-100 text-gray-700';
                            let iconColor = 'text-gray-500';
                            let label = 'Unknown';
                            if (status === 'PAID') {
                              bgColor = 'bg-emerald-50 text-emerald-700 border border-emerald-100';
                              iconColor = 'text-emerald-500';
                              label = 'Paid';
                            } else if (status === 'UNPAID') {
                              bgColor = 'bg-rose-50 text-rose-700 border border-rose-100';
                              iconColor = 'text-rose-500';
                              label = 'Unpaid';
                            } else if (status === 'PARTIALLY_PAID') {
                              bgColor = 'bg-amber-50 text-amber-700 border border-amber-100';
                              iconColor = 'text-amber-500';
                              label = 'Partially Paid';
                            } else if (status === 'OVERDUE') {
                              bgColor = 'bg-red-100 text-red-800 border border-red-200';
                              iconColor = 'text-red-600';
                              label = 'Overdue';
                            } else if (status === 'CANCELLED') {
                              bgColor = 'bg-slate-100 text-slate-600 border border-slate-200';
                              iconColor = 'text-slate-500';
                              label = 'Cancelled';
                            }
                            return (
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold flex items-center gap-1 ${bgColor}`}>
                                <CheckCircle2 className={`w-3 h-3 ${iconColor}`} />
                                {label}
                              </span>
                            );
                          })()
                        ) : bill.status === 'failed' ? (
                          <>
                            <div className="w-1.5 h-1.5 bg-red-500 rounded-full" />
                            <span className="text-xs text-red-600 font-medium">Failed</span>
                          </>
                        ) : (
                          <div className="flex items-center gap-1 animate-pulse">
                            <Clock className="w-3.5 h-3.5 text-amber-500 animate-spin" style={{ animationDuration: '3s' }} />
                            <span className="text-xs text-amber-600 font-medium">Processing</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>
      </div>



      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-6 py-3 z-40">
        <div className="max-w-7xl mx-auto flex items-center justify-around">
          <button className="flex flex-col items-center gap-1 text-primary-600">
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
          <button 
            onClick={() => router.push('/profile')}
            className="flex flex-col items-center gap-1 text-gray-400 hover:text-gray-600"
          >
            <div className="w-6 h-6 bg-gray-300 rounded-full flex items-center justify-center text-[10px] font-bold text-white bg-gradient-emerald">
              {user?.name ? user.name[0].toUpperCase() : 'U'}
            </div>
            <span className="text-xs font-medium">Profile</span>
          </button>
        </div>
      </div>
    </div>
  )
}
