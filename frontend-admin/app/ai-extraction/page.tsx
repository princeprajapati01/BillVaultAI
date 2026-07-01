'use client'

import { motion } from 'framer-motion'
import { Brain, Target, TrendingUp, AlertCircle, CheckCircle2, Zap } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts'

import { useState, useEffect } from 'react'

export default function AIExtractionPage() {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<any>({
    overall_accuracy: '0%',
    avg_confidence: '0%',
    fields_extracted: '0',
    low_confidence: '0',
    field_accuracy: [],
    ai_performance: [],
    document_types: [],
    radar_data: []
  })

  const loadStats = async () => {
    let token = localStorage.getItem('admin_token')
    if (!token) {
      try {
        const authRes = await fetch('http://localhost:8000/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'admin@example.com', password: 'admin123' })
        })
        if (authRes.ok) {
          const authData = await authRes.json()
          const accessToken = authData.access_token
          if (accessToken) {
            token = accessToken
            localStorage.setItem('admin_token', accessToken)
          }
        }
      } catch (e) {
        console.error(e)
      }
    }

    if (token) {
      try {
        const res = await fetch('http://localhost:8000/api/admin/ai-extraction-stats', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
        if (res.ok) {
          const data = await res.json()
          setStats(data)
        }
      } catch (e) {
        console.error(e)
      }
    }
    setLoading(false)
  }

  useEffect(() => {
    loadStats()
  }, [])

  if (loading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center flex-col gap-2 text-slate-200 bg-slate-950 rounded-2xl border border-slate-800">
        <div className="w-8 h-8 border-4 border-pink-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-slate-400">Loading AI performance metrics...</span>
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
        <h1 className="text-4xl font-bold bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent mb-2">
          AI Extraction Analytics
        </h1>
        <p className="text-slate-400">Deep insights into AI model performance and accuracy</p>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'Overall Accuracy', value: stats.overall_accuracy, change: '+1.1%', icon: Target, color: 'from-emerald-500 to-teal-500' },
          { label: 'Avg. Confidence', value: stats.avg_confidence, change: '+0.8%', icon: Brain, color: 'from-purple-500 to-pink-500' },
          { label: 'Fields Extracted', value: stats.fields_extracted, change: '+14%', icon: Zap, color: 'from-cyan-500 to-blue-500' },
          { label: 'Low Confidence', value: stats.low_confidence, change: '-5%', icon: AlertCircle, color: 'from-amber-500 to-orange-500' },
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
                  <h3 className="text-3xl font-bold text-slate-100 mb-2">{stat.value}</h3>
                  <Badge variant={stat.change.startsWith('+') ? 'success' : 'destructive'}>
                    {stat.change} vs last month
                  </Badge>
                </CardContent>
              </Card>
            </motion.div>
          )
        })}
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Field Accuracy */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="w-5 h-5 text-pink-400" />
                Field Extraction Accuracy
              </CardTitle>
              <CardDescription>Performance by invoice field type</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {stats.field_accuracy.map((field: any, index: number) => (
                  <motion.div
                    key={field.field}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: 0.5 + index * 0.05 }}
                    className="space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-300">{field.field}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="success" className="text-xs">
                          <TrendingUp className="w-3 h-3 mr-1" />
                          +{field.trend}%
                        </Badge>
                        <span className="text-sm font-medium text-slate-200">{field.accuracy}%</span>
                      </div>
                    </div>
                    <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${field.accuracy}%` }}
                        transition={{ duration: 1, delay: 0.5 + index * 0.05 }}
                        className={`h-full ${
                          field.accuracy > 98 ? 'bg-gradient-to-r from-emerald-500 to-teal-500' :
                          field.accuracy > 95 ? 'bg-gradient-to-r from-cyan-500 to-blue-500' :
                          'bg-gradient-to-r from-amber-500 to-orange-500'
                        }`}
                      />
                    </div>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* AI Performance Trend */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="w-5 h-5 text-pink-400" />
                AI Performance Trends
              </CardTitle>
              <CardDescription>Accuracy and confidence over time</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={stats.ai_performance}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="month" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" domain={[90, 100]} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1e293b', 
                      border: '1px solid #334155',
                      borderRadius: '8px'
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="accuracy" 
                    stroke="#ec4899" 
                    strokeWidth={3}
                    dot={{ fill: '#ec4899', r: 6 }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="confidence" 
                    stroke="#8b5cf6" 
                    strokeWidth={3}
                    dot={{ fill: '#8b5cf6', r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Document Types */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="lg:col-span-2"
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-pink-400" />
                Accuracy by Document Type
              </CardTitle>
              <CardDescription>Performance across different invoice formats</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={stats.document_types}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="type" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" domain={[90, 100]} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1e293b', 
                      border: '1px solid #334155',
                      borderRadius: '8px'
                    }}
                  />
                  <Bar dataKey="accuracy" fill="url(#colorBar)" radius={[8, 8, 0, 0]} />
                  <defs>
                    <linearGradient id="colorBar" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ec4899" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.8}/>
                    </linearGradient>
                  </defs>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        {/* AI Capabilities Radar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.7 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-pink-400" />
                AI Capabilities
              </CardTitle>
              <CardDescription>Model performance matrix</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <RadarChart data={stats.radar_data}>
                  <PolarGrid stroke="#334155" />
                  <PolarAngleAxis dataKey="subject" stroke="#94a3b8" tick={{ fontSize: 11 }} />
                  <PolarRadiusAxis angle={90} domain={[0, 100]} stroke="#94a3b8" />
                  <Radar name="Performance" dataKey="A" stroke="#ec4899" fill="#ec4899" fillOpacity={0.3} />
                </RadarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}
