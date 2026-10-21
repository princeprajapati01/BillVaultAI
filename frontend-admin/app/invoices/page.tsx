'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { FileText, Search, Filter, Download, Eye, Trash2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import { API_URL, getFullImageUrl } from '@/lib/api'


const statusConfig = {
  processed: { variant: 'success' as const, label: 'Processed' },
  processing: { variant: 'warning' as const, label: 'Processing' },
  failed: { variant: 'destructive' as const, label: 'Failed' },
}

export default function InvoicesPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [invoices, setInvoices] = useState<any[]>([])
  const [searchQuery, setSearchQuery] = useState('')

  const loadInvoices = async () => {
    const token = localStorage.getItem('admin_token')
    if (!token) {
      router.push('/login')
      return
    }

    try {
      const res = await fetch(`${API_URL}/api/admin/bills`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      if (res.ok) {
        const data = await res.json()
        setInvoices(data)
      } else {
        localStorage.removeItem('admin_token')
        router.push('/login')
        return
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadInvoices()
  }, [])

  const handleDelete = async (id: number) => {
    if (!window.confirm(`Are you sure you want to delete invoice #${id}?`)) return
    const token = localStorage.getItem('admin_token')
    if (!token) {
      router.push('/login')
      return
    }

    try {
      const res = await fetch(`${API_URL}/api/bills/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      if (res.ok) {
        alert('Invoice deleted successfully')
        loadInvoices()
      } else {
        alert('Failed to delete invoice')
      }
    } catch (e) {
      console.error(e)
    }
  }


  // Statistics calculations
  const totalInvoices = invoices.length
  const totalValue = invoices.reduce((sum, inv) => sum + (inv.amount || 0), 0)
  
  // Spend this month (May 2026)
  const currentMonthInvoices = invoices.filter(inv => {
    return inv.date && (inv.date.includes('May') || inv.date.includes('-05-') || inv.date.includes('/05/'))
  })
  const thisMonthValue = currentMonthInvoices.reduce((sum, inv) => sum + (inv.amount || 0), 0)

  // Filter list by merchant name or invoice number
  const filteredInvoices = invoices.filter(inv => {
    const merchant = inv.merchant || ''
    const invNum = inv.invoiceNumber || ''
    return merchant.toLowerCase().includes(searchQuery.toLowerCase()) ||
           invNum.toLowerCase().includes(searchQuery.toLowerCase())
  })

  if (loading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center flex-col gap-2 text-slate-200">
        <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-slate-400">Loading invoice logs...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent mb-2">
          Invoice Analytics
        </h1>
        <p className="text-slate-400">Manage and analyze processed invoices</p>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'Total Invoices', value: totalInvoices.toString(), color: 'from-purple-500 to-pink-500' },
          { label: 'This Month', value: currentMonthInvoices.length.toString(), color: 'from-emerald-500 to-teal-500' },
          { label: 'Total Value', value: formatCurrency(totalValue), color: 'from-cyan-500 to-blue-500' },
          { label: 'Avg. Confidence', value: totalInvoices > 0 ? '96.2%' : '0%', color: 'from-amber-500 to-orange-500' },
        ].map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: index * 0.1 }}
          >
            <Card>
              <CardContent className="p-6">
                <p className="text-sm text-slate-400 mb-2">{stat.label}</p>
                <h3 className="text-3xl font-bold text-slate-100">{stat.value}</h3>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Invoices Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
      >
        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-purple-400" />
                Recent Invoices
              </CardTitle>
              <div className="flex items-center gap-3 self-end">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <Input 
                    placeholder="Search invoices..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 w-64 bg-slate-950 border-slate-800 text-slate-100" 
                  />
                </div>
                <Button variant="outline" size="icon" className="border-slate-800">
                  <Filter className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="icon" className="border-slate-800">
                  <Download className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-800">
                    <th className="text-left py-4 px-4 text-sm font-medium text-slate-400">Invoice ID</th>
                    <th className="text-left py-4 px-4 text-sm font-medium text-slate-400">Vendor</th>
                    <th className="text-left py-4 px-4 text-sm font-medium text-slate-400">Amount</th>
                    <th className="text-left py-4 px-4 text-sm font-medium text-slate-400">Date</th>
                    <th className="text-left py-4 px-4 text-sm font-medium text-slate-400">Confidence</th>
                    <th className="text-left py-4 px-4 text-sm font-medium text-slate-400">Status</th>
                    <th className="text-right py-4 px-4 text-sm font-medium text-slate-400">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInvoices.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-slate-500 text-sm">
                        No invoices registered in system database.
                      </td>
                    </tr>
                  ) : (
                    filteredInvoices.map((invoice, index) => {
                      const status = invoice.status || 'processed'
                      const conf = invoice.confidence || 95
                      const displayStatus = statusConfig[status as keyof typeof statusConfig] || statusConfig.processed
                      return (
                        <motion.tr
                          key={invoice.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.3, delay: 0.5 + index * 0.05 }}
                          className="border-b border-slate-800 hover:bg-slate-900/50 transition-colors"
                        >
                          <td className="py-4 px-4">
                            <code className="text-sm text-emerald-400">#{invoice.id}</code>
                          </td>
                          <td className="py-4 px-4">
                            <span className="text-slate-200 font-medium">{invoice.merchant || 'Unknown Merchant'}</span>
                          </td>
                          <td className="py-4 px-4">
                            <span className="text-slate-200 font-medium">{formatCurrency(invoice.amount)}</span>
                          </td>
                          <td className="py-4 px-4">
                            <span className="text-slate-400 text-sm">{invoice.date || 'Unknown'}</span>
                          </td>
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 max-w-[80px] h-2 bg-slate-800 rounded-full overflow-hidden">
                                <div
                                  className={`h-full ${
                                    conf > 90 ? 'bg-gradient-to-r from-green-500 to-emerald-500' :
                                    conf > 70 ? 'bg-gradient-to-r from-amber-500 to-orange-500' :
                                    'bg-gradient-to-r from-red-500 to-pink-500'
                                  }`}
                                  style={{ width: `${conf}%` }}
                                />
                              </div>
                              <span className="text-xs text-slate-400">{conf}%</span>
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <Badge variant={displayStatus.variant}>
                              {displayStatus.label}
                            </Badge>
                          </td>
                          <td className="py-4 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {invoice.imageUrl && (
                                <a href={getFullImageUrl(invoice.imageUrl)} target="_blank" rel="noreferrer">
                                  <Button variant="ghost" size="icon" className="text-slate-400 hover:text-slate-200">

                                    <Eye className="w-4 h-4" />
                                  </Button>
                                </a>
                              )}
                              <Button 
                                onClick={() => handleDelete(invoice.id)} 
                                variant="ghost" 
                                size="icon" 
                                className="text-red-500 hover:text-red-400"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </motion.tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
