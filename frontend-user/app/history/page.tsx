'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { 
  ArrowLeft, 
  Search, 
  Filter, 
  Calendar,
  CheckCircle2,
  Clock,
  AlertCircle,
  ChevronRight,
  TrendingUp,
  FileText,
  IndianRupee,
  Plus,
  BarChart3
} from 'lucide-react'
import { API_URL } from '@/lib/api'

const categories = ['All', 'Office', 'Travel', 'Food', 'Others']
const statusFilters = ['All', 'Processed', 'Processing', 'Failed']

export default function HistoryScreen() {
  const router = useRouter()
  const [bills, setBills] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [selectedStatus, setSelectedStatus] = useState('All')
  const [showFilters, setShowFilters] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem('auth_token')
    if (!token) {
      router.push('/login')
      return
    }

    async function loadHistory(isPoll = false) {
      try {
        const res = await fetch(`${API_URL}/api/bills`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })

        if (!res.ok) {
          throw new Error('Failed to load history')
        }
        const data = await res.json()
        setBills(data)
        return data
      } catch (err) {
        console.error(err)
      } finally {
        if (!isPoll) {
          setLoading(false)
        }
      }
    }

    let active = true
    let pollInterval: NodeJS.Timeout

    async function init() {
      const data = await loadHistory(false)
      if (!active) return

      const hasProcessing = data && data.some((b: any) => b.status === 'processing')
      if (hasProcessing) {
        pollInterval = setInterval(async () => {
          const updated = await loadHistory(true)
          const stillProcessing = updated && updated.some((b: any) => b.status === 'processing')
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

  const filteredBills = bills.filter(bill => {
    const matchesSearch = bill.merchant.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = selectedCategory === 'All' || bill.category === selectedCategory
    const matchesStatus = selectedStatus === 'All' || bill.status === selectedStatus.toLowerCase()
    return matchesSearch && matchesCategory && matchesStatus
  })

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'processed':
        return <CheckCircle2 className="w-4 h-4 text-emerald-500" />
      case 'processing':
        return <Clock className="w-4 h-4 text-amber-500 animate-spin" style={{ animationDuration: '3s' }} />
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-red-500" />
      default:
        return null
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'processed':
        return 'text-emerald-600'
      case 'processing':
        return 'text-amber-600 animate-pulse'
      case 'failed':
        return 'text-red-600'
      default:
        return 'text-gray-600'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center flex-col gap-2">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-gray-500">Loading history...</span>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-primary-50 pb-24">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={() => router.push('/dashboard')}
              className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-all"
            >
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Bill History</h1>
              <p className="text-sm text-gray-600 mt-1">{filteredBills.length} bills found</p>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search bills..."
              className="w-full pl-10 pr-12 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
            />
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-lg transition-all ${
                showFilters ? 'bg-primary-100 text-primary-600' : 'hover:bg-gray-100'
              }`}
            >
              <Filter className="w-5 h-5" />
            </button>
          </div>

          {/* Filters */}
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="space-y-3 mb-4"
            >
              {/* Category Filter */}
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Category</p>
                <div className="flex gap-2 flex-wrap">
                  {categories.map((category) => (
                    <button
                      key={category}
                      onClick={() => setSelectedCategory(category)}
                      className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                        selectedCategory === category
                          ? 'bg-gradient-emerald text-white shadow-lg'
                          : 'bg-white border border-gray-200 text-gray-700 hover:border-primary-300'
                      }`}
                    >
                      {category}
                    </button>
                  ))}
                </div>
              </div>

              {/* Status Filter */}
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Status</p>
                <div className="flex gap-2 flex-wrap">
                  {statusFilters.map((status) => (
                    <button
                      key={status}
                      onClick={() => setSelectedStatus(status)}
                      className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                        selectedStatus === status
                          ? 'bg-gradient-emerald text-white shadow-lg'
                          : 'bg-white border border-gray-200 text-gray-700 hover:border-primary-300'
                      }`}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-3">
              <FileText className="w-5 h-5 text-blue-600 mb-1" />
              <p className="text-lg font-bold text-blue-900">{bills.length}</p>
              <p className="text-xs text-blue-700">Total Bills</p>
            </div>
            <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl p-3">
              <IndianRupee className="w-5 h-5 text-emerald-600 mb-1" />
              <p className="text-lg font-bold text-emerald-900">
                ₹{bills.reduce((sum, bill) => sum + bill.amount, 0).toFixed(2)}
              </p>
              <p className="text-xs text-emerald-700">Total Amount</p>
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-3">
              <TrendingUp className="w-5 h-5 text-purple-600 mb-1" />
              <p className="text-lg font-bold text-purple-900">
                ₹{bills.length > 0 ? (bills.reduce((sum, bill) => sum + bill.amount, 0) / bills.length).toFixed(2) : '0.00'}
              </p>
              <p className="text-xs text-purple-700">Average</p>
            </div>
          </div>
        </div>
      </div>

      {/* Bills List */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {filteredBills.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-12"
          >
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText className="w-10 h-10 text-gray-400" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">No bills found</h3>
            <p className="text-gray-600">Try adjusting your search or filters</p>
          </motion.div>
        ) : (
          <div className="space-y-3">
            {filteredBills.map((bill, index) => (
              <motion.div
                key={bill.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => router.push(`/bill/${bill.id}`)}
                className="bg-white rounded-2xl p-4 shadow-lg border border-gray-100 hover:shadow-xl hover:border-primary-200 cursor-pointer transition-all active:scale-[0.98]"
              >
                <div className="flex items-center gap-4">
                  {/* Thumbnail */}
                  <div className="w-14 h-14 bg-gradient-to-br from-primary-100 to-cyan-100 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">
                    {bill.thumbnail}
                  </div>

                  {/* Bill Info */}
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-gray-900 truncate mb-1">{bill.merchant}</h4>
                    <div className="flex items-center gap-2">
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
                    <p className="font-bold text-gray-900 text-lg mb-1">
                      ₹{bill.amount.toFixed(2)}
                    </p>
                    <div className="flex items-center gap-1 justify-end">
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
                        <span className="text-xs text-red-600 font-medium flex items-center gap-1 bg-red-50 px-2 py-0.5 rounded-full border border-red-100">
                          <AlertCircle className="w-3 h-3 text-red-500" />
                          Failed
                        </span>
                      ) : (
                        <span className="text-xs text-amber-600 font-medium flex items-center gap-1 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100 animate-pulse">
                          <Clock className="w-3.5 h-3.5 text-amber-500 animate-spin" style={{ animationDuration: '3s' }} />
                          Processing
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Arrow */}
                  <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Load More */}
        {filteredBills.length > 0 && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="w-full mt-6 py-3 bg-white border-2 border-gray-200 text-gray-700 font-semibold rounded-xl hover:border-primary-300 hover:shadow-lg transition-all"
          >
            Load More
          </motion.button>
        )}
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
          <button className="flex flex-col items-center gap-1 text-primary-600">
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
              H
            </div>
            <span className="text-xs font-medium">Profile</span>
          </button>
        </div>
      </div>
    </div>
  )
}
