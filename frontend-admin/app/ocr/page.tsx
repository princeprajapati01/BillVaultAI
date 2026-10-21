'use client'

import { motion } from 'framer-motion'
import { useState, useEffect } from 'react'
import { ScanLine, CheckCircle2, XCircle, Clock, AlertTriangle, Eye, Download, RefreshCw } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'

import { useRouter } from 'next/navigation'
import { API_URL } from '@/lib/api'


const statusConfig = {
  processing: { 
    icon: Clock, 
    color: 'processing', 
    label: 'Processing',
    bgColor: 'bg-cyan-500/10',
    borderColor: 'border-cyan-500/30'
  },
  success: { 
    icon: CheckCircle2, 
    color: 'success', 
    label: 'Success',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/30'
  },
  failed: { 
    icon: XCircle, 
    color: 'destructive', 
    label: 'Failed',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30'
  },
  review: { 
    icon: AlertTriangle, 
    color: 'warning', 
    label: 'Manual Review',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/30'
  },
} as const

export default function OCRPage() {
  const router = useRouter()
  const [selectedJob, setSelectedJob] = useState<string | null>(null)
  const [jobs, setJobs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const loadJobs = async () => {
    const token = localStorage.getItem('admin_token')
    if (!token) {
      router.push('/login')
      return
    }

    try {
      const res = await fetch(`${API_URL}/api/admin/ocr-jobs`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      if (res.ok) {
        const data = await res.json()
        setJobs(data)
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
    loadJobs()
  }, [])

  // Calculate statistics
  const processingQueueCount = jobs.filter(j => j.status === 'processing').length
  const successJobs = jobs.filter(j => j.status === 'success')
  const successRate = jobs.length > 0 ? Math.round((successJobs.length / jobs.length) * 100) + '%' : '100%'
  const avgConfidence = jobs.length > 0 ? Math.round(jobs.reduce((sum, j) => sum + (j.confidence || 0), 0) / jobs.length) + '%' : '98%'
  const manualReviewCount = jobs.filter(j => j.status === 'success' && j.confidence < 80).length

  if (loading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center flex-col gap-2 text-slate-200 bg-slate-950 rounded-2xl border border-slate-800">
        <div className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-slate-400">Syncing OCR processes...</span>
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
        <h1 className="text-4xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent mb-2">
          OCR Processing Center
        </h1>
        <p className="text-slate-400">Real-time optical character recognition monitoring</p>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'Processing Queue', value: processingQueueCount.toString(), icon: Clock, color: 'from-cyan-500 to-blue-500' },
          { label: 'Success Rate', value: successRate, icon: CheckCircle2, color: 'from-green-500 to-emerald-500' },
          { label: 'Avg. Confidence', value: avgConfidence, icon: ScanLine, color: 'from-purple-500 to-pink-500' },
          { label: 'Manual Review', value: manualReviewCount.toString(), icon: AlertTriangle, color: 'from-amber-500 to-orange-500' },
        ].map((stat, index) => {
          const Icon = stat.icon
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-sm text-slate-400">{stat.label}</p>
                    <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${stat.color} flex items-center justify-center`}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                  </div>
                  <h3 className="text-3xl font-bold text-slate-100">{stat.value}</h3>
                </CardContent>
              </Card>
            </motion.div>
          )
        })}
      </div>

      {/* OCR Jobs */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
      >
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <ScanLine className="w-5 h-5 text-cyan-400" />
                  Live OCR Processing
                </CardTitle>
                <CardDescription>Real-time invoice processing status</CardDescription>
              </div>
              <Button onClick={() => loadJobs()} variant="outline" size="sm">
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {jobs.length === 0 ? (
                <p className="text-slate-500 text-center py-8 text-sm">No OCR jobs run yet.</p>
              ) : (
                jobs.map((job, index) => {
                  // Determine review vs success
                  const actualStatus = job.status === 'success' && job.confidence < 80 ? 'review' : job.status
                  const config = statusConfig[actualStatus as keyof typeof statusConfig] || statusConfig.success
                  const StatusIcon = config.icon
                
                return (
                  <motion.div
                    key={job.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: 0.5 + index * 0.05 }}
                    className={`p-6 rounded-xl border ${config.borderColor} ${config.bgColor} hover:scale-[1.01] transition-all cursor-pointer`}
                    onClick={() => setSelectedJob(job.id)}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-start gap-4">
                        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${
                          job.status === 'processing' ? 'from-cyan-500 to-blue-500' :
                          job.status === 'success' ? 'from-green-500 to-emerald-500' :
                          job.status === 'failed' ? 'from-red-500 to-pink-500' :
                          'from-amber-500 to-orange-500'
                        } flex items-center justify-center ${job.status === 'processing' ? 'animate-pulse' : ''}`}>
                          <StatusIcon className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <div className="flex items-center gap-3 mb-2">
                            <h4 className="font-semibold text-slate-100">{job.invoice}</h4>
                            <Badge variant={config.color}>{config.label}</Badge>
                          </div>
                          <p className="text-sm text-slate-400 mb-1">Job ID: {job.id}</p>
                          <p className="text-sm text-slate-500">User: {job.user} • {job.timestamp}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon">
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon">
                          <Download className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    {job.status === 'processing' && (
                      <div className="mb-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-slate-400">Processing...</span>
                          <span className="text-sm font-medium text-cyan-400">{job.progress}%</span>
                        </div>
                        <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${job.progress}%` }}
                            transition={{ duration: 0.5 }}
                            className="h-full bg-gradient-to-r from-cyan-500 to-blue-500"
                          />
                        </div>
                      </div>
                    )}

                    {/* Confidence & Fields */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-slate-500 mb-2">Extraction Confidence</p>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${
                                job.confidence > 90 ? 'bg-gradient-to-r from-green-500 to-emerald-500' :
                                job.confidence > 70 ? 'bg-gradient-to-r from-amber-500 to-orange-500' :
                                'bg-gradient-to-r from-red-500 to-pink-500'
                              }`}
                              style={{ width: `${job.confidence}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium text-slate-200">{job.confidence}%</span>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 mb-2">Fields Extracted</p>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-slate-200">
                            {job.fields.extracted} / {job.fields.total}
                          </span>
                          <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
                              style={{ width: `${(job.fields.extracted / job.fields.total) * 100}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* AI Scan Animation */}
                    {job.status === 'processing' && (
                      <div className="mt-4 relative h-1 bg-slate-800 rounded-full overflow-hidden">
                        <motion.div
                          className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-cyan-400 to-transparent"
                          animate={{ x: ['-100%', '300%'] }}
                          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                        />
                      </div>
                    )}
                  </motion.div>
                )
              }))}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
