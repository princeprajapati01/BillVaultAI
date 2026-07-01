'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { 
  Users, 
  Crown, 
  ScanLine, 
  DollarSign, 
  Target, 
  Activity, 
  Zap, 
  Database,
  TrendingUp,
  FileText,
  CheckCircle2,
  AlertCircle
} from 'lucide-react'
import KPICard from '@/components/KPICard'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

export default function Dashboard() {
  const [loading, setLoading] = useState(true)
  const [dashboardStats, setDashboardStats] = useState<any>(null)

  const [uploadData, setUploadData] = useState<any[]>([])
  const [revenueData, setRevenueData] = useState<any[]>([])
  const [accuracyData, setAccuracyData] = useState<any[]>([])
  const [subscriptionData, setSubscriptionData] = useState<any[]>([])
  const [recentActivity, setRecentActivity] = useState<any[]>([])

  useEffect(() => {
    async function getAdminToken() {
      let token = localStorage.getItem('admin_token')
      if (!token) {
        try {
          const res = await fetch('http://localhost:8000/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'admin@example.com', password: 'admin123' })
          })
          if (res.ok) {
            const data = await res.json()
            const accessToken = data.access_token
            if (accessToken) {
              token = accessToken
              localStorage.setItem('admin_token', accessToken)
            }
          }
        } catch (e) {
          console.error('Admin auto-login failed:', e)
        }
      }

      if (token) {
        try {
          const res = await fetch('http://localhost:8000/api/admin/dashboard', {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          })
          if (res.ok) {
            const data = await res.json()
            setDashboardStats(data)
            
            // Set chart data arrays
            setUploadData(data.upload_trends || [])
            setRevenueData(data.revenue_trends || [])
            setAccuracyData(data.accuracy_trends || [])
            setSubscriptionData(data.subscription_split || [])
            setRecentActivity(data.recent_activities || [])
          } else {
            // If session/token expired, clear it
            localStorage.removeItem('admin_token')
          }
        } catch (e) {
          console.error('Failed to load admin stats:', e)
        }
      }
      setLoading(false)
    }

    getAdminToken()
  }, [])

  if (loading) {
    return (
      <div className="min-h-[600px] flex items-center justify-center flex-col gap-4 text-slate-200 bg-slate-950 rounded-2xl border border-slate-800">
        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <p className="font-semibold text-slate-400 animate-pulse">Syncing Admin Metrics...</p>
      </div>
    )
  }

  // Calculate stats values
  const totalUsers = dashboardStats?.total_users || 0
  const premiumUsers = dashboardStats?.premium_users || 0
  const ocrProcessed = dashboardStats?.total_bills_processed || 0
  const monthlyRevenue = dashboardStats?.monthly_revenue || 0
  const apiRequests = dashboardStats?.api_requests || 0
  const storageUsed = dashboardStats?.storage_used || "0.0 GB"
  const systemHealth = dashboardStats?.system_health || "Offline"

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-4xl font-bold bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent mb-2">
          AI Intelligence Dashboard
        </h1>
        <p className="text-slate-400">Real-time insights into your invoice processing system</p>
      </motion.div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard
          title="Total Users"
          value={totalUsers}
          change={totalUsers > 0 ? 100 : 0}
          icon={Users}
          color="from-blue-500 to-cyan-500"
          format="number"
          delay={0}
        />
        <KPICard
          title="Premium Users"
          value={premiumUsers}
          change={premiumUsers > 0 ? 100 : 0}
          icon={Crown}
          color="from-purple-500 to-pink-500"
          format="number"
          delay={0.1}
        />
        <KPICard
          title="OCR Processed"
          value={ocrProcessed}
          change={ocrProcessed > 0 ? 100 : 0}
          icon={ScanLine}
          color="from-emerald-500 to-teal-500"
          format="number"
          delay={0.2}
        />
        <KPICard
          title="Monthly Revenue"
          value={monthlyRevenue}
          change={monthlyRevenue > 0 ? 100 : 0}
          icon={DollarSign}
          color="from-orange-500 to-red-500"
          format="currency"
          delay={0.3}
        />
        <KPICard
          title="AI Accuracy"
          value={ocrProcessed > 0 ? 98.5 : 0}
          change={0}
          icon={Target}
          color="from-green-500 to-emerald-500"
          format="percentage"
          delay={0.4}
        />
        <KPICard
          title="Server Health"
          value={systemHealth}
          icon={Activity}
          color="from-teal-500 to-cyan-500"
          format="text"
          delay={0.5}
        />
        <KPICard
          title="API Requests"
          value={apiRequests}
          change={0}
          icon={Zap}
          color="from-yellow-500 to-orange-500"
          format="number"
          delay={0.6}
        />
        <KPICard
          title="Storage Used"
          value={storageUsed}
          icon={Database}
          color="from-indigo-500 to-purple-500"
          format="text"
          delay={0.7}
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Invoice Uploads Chart */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.8 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-400" />
                Invoice Processing Trends
              </CardTitle>
              <CardDescription>Monthly upload and success rates</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={uploadData}>
                  <defs>
                    <linearGradient id="colorUploads" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorSuccess" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="month" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1e293b', 
                      border: '1px solid #334155',
                      borderRadius: '8px'
                    }}
                  />
                  <Legend />
                  <Area type="monotone" dataKey="uploads" stroke="#10b981" fillOpacity={1} fill="url(#colorUploads)" />
                  <Area type="monotone" dataKey="success" stroke="#06b6d4" fillOpacity={1} fill="url(#colorSuccess)" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        {/* Revenue Chart */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.9 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-400" />
                Revenue Analytics
              </CardTitle>
              <CardDescription>Monthly recurring revenue growth (INR)</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={revenueData}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.2}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="month" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1e293b', 
                      border: '1px solid #334155',
                      borderRadius: '8px'
                    }}
                  />
                  <Bar dataKey="revenue" fill="url(#colorRevenue)" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* AI Accuracy Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 1.0 }}
          className="lg:col-span-2"
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="w-5 h-5 text-emerald-400" />
                AI Extraction Accuracy by Field
              </CardTitle>
              <CardDescription>Field-level extraction performance metrics</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={accuracyData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis type="number" domain={[90, 100]} stroke="#94a3b8" />
                  <YAxis dataKey="category" type="category" stroke="#94a3b8" width={100} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1e293b', 
                      border: '1px solid #334155',
                      borderRadius: '8px'
                    }}
                  />
                  <Bar dataKey="accuracy" fill="#10b981" radius={[0, 8, 8, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        {/* Subscription Distribution */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 1.1 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Crown className="w-5 h-5 text-emerald-400" />
                Subscription Mix
              </CardTitle>
              <CardDescription>User distribution by plan</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={subscriptionData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {subscriptionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1e293b', 
                      border: '1px solid #334155',
                      borderRadius: '8px'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-4 space-y-2">
                {subscriptionData.map((item) => (
                  <div key={item.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-sm text-slate-400">{item.name}</span>
                    </div>
                    <span className="text-sm font-medium text-slate-200">{item.value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Recent Activity */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 1.2 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-emerald-400" />
              Real-Time Activity Feed
            </CardTitle>
            <CardDescription>Live system events and notifications</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivity.length === 0 ? (
                <p className="text-slate-500 text-sm">No recent activities available.</p>
              ) : (
                recentActivity.map((activity, index) => {
                  const type = activity.type || 'info'
                  return (
                    <motion.div
                      key={activity.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: 1.3 + index * 0.1 }}
                      className="flex items-start gap-4 p-4 rounded-lg bg-slate-900/50 border border-slate-800 hover:border-slate-700 transition-colors"
                    >
                      {type === 'success' && (
                        <CheckCircle2 className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                      )}
                      {type === 'warning' && (
                        <AlertCircle className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
                      )}
                      {type === 'error' && (
                        <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
                      )}
                      {type === 'info' && (
                        <Zap className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-200">{activity.message}</p>
                        <p className="text-xs text-slate-500 mt-1">{activity.time}</p>
                      </div>
                      <Badge variant={
                        type === 'success' ? 'success' : 
                        type === 'warning' ? 'warning' : 
                        type === 'error' ? 'destructive' :
                        'secondary'
                      }>
                        {type}
                      </Badge>
                    </motion.div>
                  )
                })
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
