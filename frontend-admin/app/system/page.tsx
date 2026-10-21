'use client'

import { motion } from 'framer-motion'
import { Activity, Cpu, HardDrive, Zap, Server, Database, Clock, AlertTriangle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { API_URL } from '@/lib/api'

export default function SystemHealthPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)

  const [data, setData] = useState<any>({
    uptime: '100%',
    cpu_usage: '0%',
    cpu_status: 'Idle',
    memory: '0 GB / 16 GB',
    memory_percent: '0%',
    memory_status: 'Idle',
    api_latency: '0ms',
    api_status: 'Good',
    cpu_data: [],
    memory_data: [],
    api_latency_list: [],
    system_alerts: []
  })

  const loadSystemHealth = async () => {
    const token = localStorage.getItem('admin_token')
    if (!token) {
      router.push('/login')
      return
    }

    try {
      const res = await fetch(`${API_URL}/api/admin/system-health`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      if (res.ok) {
        const resData = await res.json()
        setData(resData)
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
    loadSystemHealth()
    const interval = setInterval(loadSystemHealth, 5000)
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center flex-col gap-2 text-slate-200 bg-slate-950 rounded-2xl border border-slate-800">
        <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-slate-400">Connecting to system monitor...</span>
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
        <h1 className="text-4xl font-bold bg-gradient-to-r from-teal-400 to-cyan-400 bg-clip-text text-transparent mb-2">
          System Health Monitor
        </h1>
        <p className="text-slate-400">Real-time infrastructure and performance monitoring</p>
      </motion.div>

      {/* System Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'Server Uptime', value: data.uptime, icon: Activity, color: 'from-green-500 to-emerald-500', status: 'Healthy', statusVariant: 'success' },
          { label: 'CPU Usage', value: data.cpu_usage, icon: Cpu, color: 'from-cyan-500 to-blue-500', status: data.cpu_status, statusVariant: data.cpu_status === 'Optimal' ? 'success' : 'warning' },
          { label: 'Memory', value: data.memory, icon: HardDrive, color: 'from-purple-500 to-pink-500', status: data.memory_status, statusVariant: data.memory_status === 'Normal' ? 'success' : 'warning' },
          { label: 'API Latency', value: data.api_latency, icon: Zap, color: 'from-amber-500 to-orange-500', status: data.api_status, statusVariant: 'success' },
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
                  <Badge variant={stat.statusVariant as any}>{stat.status}</Badge>
                </CardContent>
              </Card>
            </motion.div>
          )
        })}
      </div>

      {/* Performance Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CPU Usage */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Cpu className="w-5 h-5 text-teal-400" />
                CPU Usage (24h)
              </CardTitle>
              <CardDescription>Server processing load over time</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={data.cpu_data}>
                  <defs>
                    <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="time" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1e293b', 
                      border: '1px solid #334155',
                      borderRadius: '8px'
                    }}
                  />
                  <Area type="monotone" dataKey="usage" stroke="#06b6d4" fillOpacity={1} fill="url(#colorCpu)" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        {/* Memory Usage */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HardDrive className="w-5 h-5 text-teal-400" />
                Memory Usage (24h)
              </CardTitle>
              <CardDescription>RAM consumption patterns</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={data.memory_data}>
                  <defs>
                    <linearGradient id="colorMemory" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="time" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1e293b', 
                      border: '1px solid #334155',
                      borderRadius: '8px'
                    }}
                  />
                  <Area type="monotone" dataKey="used" stroke="#8b5cf6" fillOpacity={1} fill="url(#colorMemory)" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* API Performance */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.6 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="w-5 h-5 text-teal-400" />
              API Endpoint Performance
            </CardTitle>
            <CardDescription>Response times and request volumes</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data.api_latency_list.length === 0 ? (
                <p className="text-slate-500 text-center py-4 text-sm">No API traffic recorded.</p>
              ) : (
                data.api_latency_list.map((api: any, index: number) => (
                  <motion.div
                    key={api.endpoint}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: 0.7 + index * 0.05 }}
                    className="p-4 rounded-lg bg-slate-900/50 border border-slate-800"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <code className="text-sm text-emerald-400">{api.endpoint}</code>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-slate-500" />
                          <span className="text-sm text-slate-300">{api.latency}ms</span>
                        </div>
                        <Badge variant="secondary">{api.requests.toLocaleString()} total calls</Badge>
                      </div>
                    </div>
                    <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${
                          api.latency < 100 ? 'bg-gradient-to-r from-green-500 to-emerald-500' :
                          api.latency < 300 ? 'bg-gradient-to-r from-cyan-500 to-blue-500' :
                          'bg-gradient-to-r from-amber-500 to-orange-500'
                        }`}
                        style={{ width: `${Math.min((api.latency / 500) * 100, 100)}%` }}
                      />
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* System Alerts */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.8 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-teal-400" />
              System Alerts
            </CardTitle>
            <CardDescription>Recent system events and notifications</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.system_alerts.length === 0 ? (
                <p className="text-slate-500 text-center py-4 text-sm">No recent system alerts.</p>
              ) : (
                data.system_alerts.map((alert: any, index: number) => (
                  <motion.div
                    key={alert.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: 0.9 + index * 0.05 }}
                    className="flex items-start gap-4 p-4 rounded-lg bg-slate-900/50 border border-slate-800"
                  >
                    <div className={`w-2 h-2 rounded-full mt-2 ${
                      alert.type === 'warning' ? 'bg-amber-400' :
                      alert.type === 'success' ? 'bg-green-400' :
                      'bg-blue-400'
                    }`} />
                    <div className="flex-1">
                      <p className="text-sm text-slate-200">{alert.message}</p>
                      <p className="text-xs text-slate-500 mt-1">{alert.time}</p>
                    </div>
                    <Badge variant={
                      alert.severity === 'medium' ? 'warning' : 'secondary'
                    }>
                      {alert.severity}
                    </Badge>
                  </motion.div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
