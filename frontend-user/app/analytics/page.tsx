'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  TrendingUp,
  FileText,
  IndianRupee,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ChevronRight,
  Info,
  Calendar,
  Zap,
  BarChart3,
  Search,
  Filter,
  Plus,
  Eye,
  Download
} from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts'
import { API_URL } from '@/lib/api'


export default function AnalyticsScreen() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [bills, setBills] = useState<any[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL_UNPAID')
  const [removingItems, setRemovingItems] = useState<string[]>([])

  const handleMarkAsPaid = async (id: string, item: any) => {
    setRemovingItems(prev => [...prev, id])
    const token = localStorage.getItem('auth_token')
    if (!token) return

    try {
      const response = await fetch(`${API_URL}/api/bills/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },

        body: JSON.stringify({
          merchant_name: item.merchant,
          invoice_number: item.invoiceNumber,
          invoice_date: item.date,
          gst_number: item.gstNumber || '',
          subtotal: item.subtotal || 0,
          cgst_amount: item.cgst || 0,
          sgst_amount: item.sgst || 0,
          igst_amount: item.igst || 0,
          tax_amount: item.gst || 0,
          invoice_total: item.amount || 0,
          due_date: item.dueDate || '',
          payment_terms: item.paymentTerms || '',
          balance_due: 0,
          amount_paid: item.amount || 0,
          payment_status: 'PAID',
          status_reason: 'Marked as Paid manually from Unpaid Registry',
          payment_method: item.paymentMethod || 'Cash',
          transaction_id: item.transactionId || 'MANUAL-PAID',
          category: item.category || 'Office',
          notes: item.notes || ''
        })
      })

      if (!response.ok) {
        throw new Error('Failed to update status on server')
      }

      setTimeout(() => {
        setBills(prev => {
          const nextBills = prev.map(bill => bill.id === id ? {
            ...bill,
            paymentStatus: 'PAID',
            balanceDue: 0,
            amountPaid: bill.amount,
            statusReason: 'Marked as Paid manually from Unpaid Registry'
          } : bill);
          calculateMetrics(nextBills);
          return nextBills;
        });
        setRemovingItems(prev => prev.filter(x => x !== id))
      }, 500)
    } catch (e) {
      console.error(e)
      setRemovingItems(prev => prev.filter(x => x !== id))
    }
  }

  // Calculated Metrics
  const [metrics, setMetrics] = useState({
    totalInvoices: 0,
    totalVolume: 0,
    totalPaid: 0,
    totalOutstanding: 0,
    totalOverdue: 0
  })

  const [statusChartData, setStatusChartData] = useState<any[]>([])
  const [trendChartData, setTrendChartData] = useState<any[]>([])
  const [aiInsights, setAiInsights] = useState<string[]>([])

  useEffect(() => {
    const token = localStorage.getItem('auth_token')
    if (!token) {
      router.push('/login')
      return
    }

    async function loadData() {
      try {
        const res = await fetch(`${API_URL}/api/bills`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })

        if (!res.ok) throw new Error('Failed to fetch bills')
        const data = await res.json()
        setBills(data)
        calculateMetrics(data)
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [router])

  const calculateMetrics = (billsList: any[]) => {
    let volume = 0
    let paid = 0
    let outstanding = 0
    let overdue = 0

    const statusMap: Record<string, number> = {
      PAID: 0,
      UNPAID: 0,
      PARTIALLY_PAID: 0,
      OVERDUE: 0,
      CANCELLED: 0,
      UNKNOWN: 0
    }

    const monthlyMap: Record<string, { month: string, billed: number, paid: number, outstanding: number }> = {}
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

    // Initialize last 6 months
    for (let i = 5; i >= 0; i--) {
      const d = new Date()
      d.setMonth(d.getMonth() - i)
      const mName = months[d.getMonth()]
      monthlyMap[mName] = { month: mName, billed: 0, paid: 0, outstanding: 0 }
    }

    billsList.forEach((bill: any) => {
      const amt = bill.amount || 0
      volume += amt

      const status = (bill.paymentStatus || 'UNKNOWN').toUpperCase()
      if (statusMap[status] !== undefined) {
        statusMap[status] += 1
      } else {
        statusMap['UNKNOWN'] += 1
      }

      // Calculations
      let billPaid = 0
      let billOutstanding = 0

      if (status === 'PAID') {
        billPaid = amt
      } else if (status === 'PARTIALLY_PAID') {
        billOutstanding = bill.balanceDue || 0
        billPaid = amt - billOutstanding
      } else if (status === 'UNPAID') {
        billOutstanding = bill.balanceDue || amt
        billPaid = bill.amountPaid || 0
      } else if (status === 'OVERDUE') {
        billOutstanding = bill.balanceDue || amt
        billPaid = bill.amountPaid || 0
        overdue += billOutstanding
      } else if (status === 'CANCELLED') {
        // Ignored
      } else {
        billOutstanding = bill.balanceDue || 0
        billPaid = bill.amountPaid || 0
      }

      paid += billPaid
      outstanding += billOutstanding

      // Accumulate Monthly
      let mName = ''
      try {
        const dObj = new Date(bill.date)
        if (!isNaN(dObj.getTime())) {
          mName = months[dObj.getMonth()]
        }
      } catch(e) {}

      if (!mName) {
        const match = months.find(m => bill.date && bill.date.includes(m))
        mName = match || months[new Date().getMonth()]
      }

      if (monthlyMap[mName]) {
        monthlyMap[mName].billed += amt
        monthlyMap[mName].paid += billPaid
        monthlyMap[mName].outstanding += billOutstanding
      }
    })

    setMetrics({
      totalInvoices: billsList.length,
      totalVolume: volume,
      totalPaid: paid,
      totalOutstanding: outstanding,
      totalOverdue: overdue
    })

    // Pie Chart Data
    const colors = {
      PAID: '#10b981',
      UNPAID: '#f59e0b',
      PARTIALLY_PAID: '#6366f1',
      OVERDUE: '#ef4444',
      CANCELLED: '#6b7280',
      UNKNOWN: '#a855f7'
    }
    const pieData = Object.keys(statusMap)
      .map(k => ({
        name: k.replace('_', ' '),
        value: statusMap[k],
        color: (colors as any)[k] || '#9ca3af'
      }))
      .filter(item => item.value > 0)
    setStatusChartData(pieData.length > 0 ? pieData : [{ name: 'No Invoices', value: 1, color: '#e5e7eb' }])

    // Trend Chart Data
    setTrendChartData(Object.values(monthlyMap))

    // Formulate AI Insights & Action Items
    const insightsList = []
    if (overdue > 0) {
      insightsList.push(`⚠️ Critical: You have ₹${overdue.toLocaleString('en-IN')} overdue. Please review invoices in the Overdue registry immediately.`)
    }
    if (outstanding > 0) {
      insightsList.push(`💡 Tip: Setting up payment terms with auto-reminders can reduce your ₹${outstanding.toLocaleString('en-IN')} outstanding liability by up to 25%.`)
    }
    const unpaidCount = statusMap['UNPAID'] + statusMap['PARTIALLY_PAID'] + statusMap['OVERDUE']
    if (unpaidCount > 0) {
      insightsList.push(`📈 Invoice health: ${unpaidCount} invoice${unpaidCount > 1 ? 's are' : ' is'} awaiting payment settlement.`)
    } else {
      insightsList.push(`🎉 Perfect status! All processed invoices are settled in full.`)
    }
    setAiInsights(insightsList)
  }

  // Filter registry list
  const filteredRegistry = bills.filter((bill: any) => {
    const matchesSearch = bill.merchant.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (bill.invoiceNumber && bill.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()))
    
    const status = (bill.paymentStatus || 'UNKNOWN').toUpperCase()
    let matchesStatus = true
    if (statusFilter === 'ALL_UNPAID') {
      matchesStatus = ['UNPAID', 'PARTIALLY_PAID', 'OVERDUE'].includes(status)
    } else if (statusFilter !== 'ALL') {
      matchesStatus = status === statusFilter
    }

    return matchesSearch && matchesStatus
  })

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center flex-col gap-3">
        <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-gray-500 text-sm font-semibold">Generating Financial Insights...</span>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-primary-50 pb-20">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center gap-4">
          <button
            onClick={() => router.push('/dashboard')}
            className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-all"
            title="Go to Dashboard"
          >
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Unpaid Invoices</h1>
            <p className="text-sm text-gray-600 mt-0.5">Track and manage outstanding liabilities</p>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        
        {/* Dynamic Metrics Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-white rounded-2xl p-4 shadow-lg border border-gray-100 flex flex-col justify-between">
            <div className="w-8 h-8 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600 mb-3">
              <FileText className="w-4.5 h-4.5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{metrics.totalInvoices}</p>
              <p className="text-xs text-gray-600 font-medium">Total Invoices</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 shadow-lg border border-gray-100 flex flex-col justify-between">
            <div className="w-8 h-8 rounded-xl bg-purple-100 flex items-center justify-center text-purple-600 mb-3">
              <IndianRupee className="w-4.5 h-4.5" />
            </div>
            <div>
              <p className="text-xl font-bold text-gray-900">₹{metrics.totalVolume.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p>
              <p className="text-xs text-gray-600 font-medium">Billed Volume</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 shadow-lg border border-gray-100 flex flex-col justify-between">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600 mb-3">
              <CheckCircle2 className="w-4.5 h-4.5" />
            </div>
            <div>
              <p className="text-xl font-bold text-emerald-600">₹{metrics.totalPaid.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p>
              <p className="text-xs text-gray-600 font-medium">Total Settled</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 shadow-lg border border-gray-100 flex flex-col justify-between">
            <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600 mb-3">
              <Clock className="w-4.5 h-4.5" />
            </div>
            <div>
              <p className="text-xl font-bold text-amber-700">₹{metrics.totalOutstanding.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p>
              <p className="text-xs text-gray-600 font-medium">Outstanding Balance</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 shadow-lg border border-gray-100 col-span-2 lg:col-span-1 flex flex-col justify-between">
            <div className="w-8 h-8 rounded-xl bg-rose-100 flex items-center justify-center text-rose-600 mb-3">
              <AlertTriangle className="w-4.5 h-4.5" />
            </div>
            <div>
              <p className="text-xl font-bold text-rose-600">₹{metrics.totalOverdue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p>
              <p className="text-xs text-gray-600 font-medium">Overdue Liabilities</p>
            </div>
          </div>
        </div>

        {/* AI Recommendations Banner */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 rounded-2xl p-5 shadow-xl text-white relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16" />
          <div className="relative flex items-start gap-4">
            <div className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center flex-shrink-0">
              <Zap className="w-5 h-5 text-yellow-300" />
            </div>
            <div className="flex-1 space-y-2">
              <h3 className="font-bold text-lg">AI Financial Insights</h3>
              <div className="space-y-1 text-sm text-emerald-50/90 font-medium">
                {aiInsights.map((insight, idx) => (
                  <p key={idx} className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-yellow-300 rounded-full flex-shrink-0" />
                    {insight}
                  </p>
                ))}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Visual Charts Grid */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Chart 1: Payment Status Breakdown */}
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 lg:col-span-1 flex flex-col justify-between">
            <div>
              <h3 className="font-bold text-gray-900 text-lg">Invoice Status Ratio</h3>
              <p className="text-xs text-gray-600 mt-0.5">Share of processed counts</p>
            </div>
            <div className="h-48 my-4 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {statusChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [`${value} Invoices`, 'Count']} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {statusChartData.map((item) => (
                <div key={item.name} className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                  <span className="text-gray-700 capitalize font-medium">{item.name.toLowerCase()}</span>
                  <span className="text-gray-900 font-bold ml-auto">{item.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Chart 2: Billed vs Settled Trend */}
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 lg:col-span-2 flex flex-col justify-between">
            <div>
              <h3 className="font-bold text-gray-900 text-lg">Billing & Payments Trend</h3>
              <p className="text-xs text-gray-600 mt-0.5">Last 6 months liability vs settlement breakdown</p>
            </div>
            <div className="h-60 mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trendChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} />
                  <YAxis stroke="#94a3b8" fontSize={11} />
                  <Tooltip formatter={(value) => [`₹${value}`, 'Amount']} />
                  <Legend wrapperStyle={{ fontSize: '11px', marginTop: '10px' }} />
                  <Bar dataKey="billed" name="Billed Amount" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="paid" name="Settled Amount" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="outstanding" name="Outstanding" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Registry & Tracker */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-gray-900 text-lg">Invoice Payment Registry</h3>
              <p className="text-xs text-gray-600 mt-0.5">Track, audit, and verify payment states</p>
            </div>

            {/* Filter controls */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter merchant/no..."
                  className="pl-9 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs w-48 text-gray-950 font-medium"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs text-gray-700 font-semibold"
              >
                <option value="ALL_UNPAID">All Unpaid</option>
                <option value="ALL">All Statuses</option>
                <option value="PAID">Paid</option>
                <option value="UNPAID">Unpaid</option>
                <option value="PARTIALLY_PAID">Partially Paid</option>
                <option value="OVERDUE">Overdue</option>
                <option value="CANCELLED">Cancelled</option>
                <option value="UNKNOWN">Unknown</option>
              </select>
            </div>
          </div>

          {/* Table list */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-xs font-bold text-gray-600 uppercase">
                  <th className="p-4">Invoice Details</th>
                  <th className="p-4">Due Date</th>
                  <th className="p-4">Total Amount</th>
                  <th className="p-4">Outstanding</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm text-gray-700">
                {filteredRegistry.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-gray-500 font-medium">
                      No invoices matching the selected filters were found.
                    </td>
                  </tr>
                ) : (
                  filteredRegistry.map((item: any) => {
                    const status = (item.paymentStatus || 'UNKNOWN').toUpperCase()
                    const isClickable = ['UNPAID', 'PARTIALLY_PAID', 'OVERDUE'].includes(status)
                    const isRemoving = removingItems.includes(item.id)

                    let badgeBg = 'bg-gray-100 text-gray-700'
                    if (status === 'PAID') badgeBg = 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                    else if (status === 'UNPAID') badgeBg = 'bg-rose-50 text-rose-700 border border-rose-100'
                    else if (status === 'PARTIALLY_PAID') badgeBg = 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                    else if (status === 'OVERDUE') badgeBg = 'bg-red-100 text-red-800 border border-red-200'
                    else if (status === 'CANCELLED') badgeBg = 'bg-slate-100 text-slate-600 border border-slate-200'

                    return (
                      <tr 
                        key={item.id} 
                        className={`hover:bg-gray-50/50 transition-all duration-500 origin-center ${
                          isRemoving ? 'opacity-0 -translate-y-2 scale-y-95 pointer-events-none' : ''
                        }`}
                        style={{
                          height: isRemoving ? '0px' : 'auto',
                          overflow: 'hidden'
                        }}
                      >
                        <td className="p-4">
                          <p className="font-bold text-gray-900">{item.merchant || 'Unknown Vendor'}</p>
                          <p className="text-xs text-gray-600 font-medium">No: {item.invoiceNumber || 'Not detected'}</p>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-1.5 text-xs font-medium text-gray-600">
                            <Calendar className="w-3.5 h-3.5 text-gray-400" />
                            {item.dueDate || 'No due date'}
                          </div>
                          {item.paymentTerms && (
                            <span className="text-[10px] text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded-md mt-1 inline-block">
                              Terms: {item.paymentTerms}
                            </span>
                          )}
                        </td>
                        <td className="p-4 font-semibold text-gray-900">
                          ₹{(item.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-4 font-bold text-amber-700">
                          ₹{(item.balanceDue !== undefined ? item.balanceDue : (status === 'PAID' ? 0 : item.amount || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-4">
                          {isClickable ? (
                            <span 
                              onClick={() => handleMarkAsPaid(item.id, item)}
                              className={`group relative inline-flex items-center justify-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase transition-all duration-300 cursor-pointer overflow-hidden min-w-[85px] text-center ${badgeBg} hover:scale-105 active:scale-95`}
                              title="Click to mark as Paid"
                            >
                              <span className="group-hover:opacity-0 transition-opacity duration-200">
                                {status.replace('_', ' ')}
                              </span>
                              <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-emerald-600 text-white rounded-full font-bold">
                                ✓ PAY
                              </span>
                            </span>
                          ) : (
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${badgeBg}`}>
                              {status.replace('_', ' ')}
                            </span>
                          )}
                        </td>
                        <td className="p-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => router.push(`/bill/${item.id}`)}
                              className="p-1 text-gray-500 hover:text-emerald-600 transition-colors inline-flex items-center gap-0.5 font-bold"
                              title="View/Edit Details"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span className="text-xs">Review</span>
                            </button>
                            <button
                              onClick={() => router.push(`/bill/${item.id}?download=true`)}
                              className="p-1 text-gray-500 hover:text-primary-600 transition-colors inline-flex items-center gap-0.5 font-bold"
                              title="Download PDF"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span className="text-xs">Download</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

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
          <button className="flex flex-col items-center gap-1 text-emerald-600">
            <TrendingUp className="w-6 h-6" />
            <span className="text-xs font-medium">Unpaid</span>
          </button>
          <button 
            onClick={() => router.push('/profile')}
            className="flex flex-col items-center gap-1 text-gray-400 hover:text-gray-600"
          >
            <div className="w-6 h-6 bg-gray-300 rounded-full flex items-center justify-center text-[10px] font-bold text-white bg-gradient-emerald">
              A
            </div>
            <span className="text-xs font-medium">Profile</span>
          </button>
        </div>
      </div>

    </div>
  )
}
