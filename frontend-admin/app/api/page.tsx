'use client'

import { motion } from 'framer-motion'
import { useState, useEffect } from 'react'
import { Server, Activity, Database, Key, Copy, Check, BookOpen, Terminal, Code, Cpu, ShieldAlert } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

export default function APIManagementPage() {
  const [loading, setLoading] = useState(true)
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState<string>('all')
  const [selectedEndpoint, setSelectedEndpoint] = useState<number>(0)
  const [data, setData] = useState<any>({
    total_requests: 0,
    average_response_time: '0ms',
    error_rate: '0%',
    active_keys: 0,
    endpoints: [],
    requests_chart: []
  })

  const loadAPIData = async () => {
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
        const res = await fetch('http://localhost:8000/api/admin/api-analytics', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
        if (res.ok) {
          const resData = await res.json()
          setData(resData)
        }
      } catch (e) {
        console.error(e)
      }
    }
    setLoading(false)
  }

  useEffect(() => {
    loadAPIData()
  }, [])

  const handleCopyCurl = (endpoint: any, index: number) => {
    const headerStr = endpoint.headers.map((h: any) => `-H "${h.key}: ${h.value}"`).join(' ')
    let bodyStr = ''
    if (endpoint.body && endpoint.body.length > 0) {
      if (endpoint.headers.some((h: any) => h.value.includes('json'))) {
        const jsonBody = endpoint.body.reduce((acc: any, b: any) => {
          acc[b.field] = b.type.includes('Integer') ? 5 : 'sample_value'
          return acc
        }, {})
        bodyStr = `-d '${JSON.stringify(jsonBody)}'`
      } else {
        bodyStr = endpoint.body.map((b: any) => `-F "${b.field}=@file.pdf"`).join(' ')
      }
    }
    const curl = `curl -X ${endpoint.method} "http://localhost:8000${endpoint.path}" ${headerStr} ${bodyStr}`
    navigator.clipboard.writeText(curl)
    setCopiedIndex(index)
    setTimeout(() => setCopiedIndex(null), 2000)
  }

  if (loading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center flex-col gap-2 text-slate-200 bg-slate-950 rounded-2xl border border-slate-800">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-slate-400">Loading API requirement schemas & telemetry...</span>
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
        <h1 className="text-4xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent mb-2">
          API Monitor & Documentation
        </h1>
        <p className="text-slate-400">Real-time API telemetry, route requirements, and schema testing</p>
      </motion.div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'Total API Requests', value: data.total_requests.toLocaleString(), sub: 'Last 7 days', icon: Activity, color: 'from-emerald-500 to-teal-500' },
          { label: 'Avg. Latency', value: data.average_response_time, sub: 'Response speed', icon: Cpu, color: 'from-cyan-500 to-blue-500' },
          { label: 'API Error Rate', value: data.error_rate, sub: 'Request success', icon: ShieldAlert, color: 'from-red-500 to-pink-500' },
          { label: 'Developer Accounts', value: data.active_keys.toString(), sub: 'Registered users', icon: Key, color: 'from-purple-500 to-pink-500' },
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
                  <h3 className="text-3xl font-bold text-slate-100 mb-1">{stat.value}</h3>
                  <p className="text-xs text-slate-500">{stat.sub}</p>
                </CardContent>
              </Card>
            </motion.div>
          )
        })}
      </div>

      {/* API Traffic Telemetry */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="w-5 h-5 text-emerald-400" />
              API Requests Volume
            </CardTitle>
            <CardDescription>Daily endpoint execution counters</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={data.requests_chart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="date" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1e293b', 
                    border: '1px solid #334155',
                    borderRadius: '8px'
                  }}
                />
                <Line type="monotone" dataKey="requests" name="Total Calls" stroke="#10b981" strokeWidth={3} dot={{ fill: '#10b981', r: 5 }} />
                <Line type="monotone" dataKey="errors" name="Failed Calls" stroke="#f43f5e" strokeWidth={2} dot={{ fill: '#f43f5e', r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </motion.div>

      {/* Interactive Docs & Schema */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Endpoints List */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="lg:col-span-1"
        >
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-emerald-400" />
                Registered Endpoints
              </CardTitle>
              <CardDescription>AURA Gateway routers</CardDescription>
            </CardHeader>
            <CardContent className="p-2 space-y-1">
              {data.endpoints.map((ep: any, index: number) => (
                <button
                  key={ep.path}
                  onClick={() => setSelectedEndpoint(index)}
                  className={`w-full text-left p-4 rounded-xl flex items-center justify-between border transition-all ${
                    selectedEndpoint === index
                      ? 'bg-slate-900 border-emerald-500/50 shadow-md shadow-emerald-950/20'
                      : 'border-transparent hover:bg-slate-900/50'
                  }`}
                >
                  <div className="space-y-1.5 overflow-hidden">
                    <div className="flex items-center gap-2">
                      <Badge variant={ep.method === 'POST' ? 'success' : 'secondary'}>
                        {ep.method}
                      </Badge>
                      <code className="text-xs font-mono text-slate-300 truncate block">
                        {ep.path}
                      </code>
                    </div>
                    <p className="text-xs text-slate-400 truncate">{ep.description}</p>
                  </div>
                </button>
              ))}
            </CardContent>
          </Card>
        </motion.div>

        {/* Selected Endpoint Requirements Schema Details */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="lg:col-span-2"
        >
          {data.endpoints[selectedEndpoint] && (
            <Card className="h-full">
              <CardHeader className="border-b border-slate-900 pb-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <Badge variant={data.endpoints[selectedEndpoint].method === 'POST' ? 'success' : 'secondary'} className="text-sm px-2.5 py-0.5">
                        {data.endpoints[selectedEndpoint].method}
                      </Badge>
                      <code className="text-lg font-mono text-emerald-400">
                        {data.endpoints[selectedEndpoint].path}
                      </code>
                    </div>
                    <p className="text-sm text-slate-400">{data.endpoints[selectedEndpoint].description}</p>
                  </div>
                  <Button 
                    onClick={() => handleCopyCurl(data.endpoints[selectedEndpoint], selectedEndpoint)}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white shrink-0 self-start md:self-auto gap-2"
                    size="sm"
                  >
                    {copiedIndex === selectedEndpoint ? (
                      <>
                        <Check className="w-4 h-4 animate-bounce" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        Copy cURL
                      </>
                    )}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-6 space-y-6">
                {/* Headers Table */}
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-emerald-500" />
                    Header Parameters
                  </h4>
                  <div className="overflow-hidden border border-slate-800 rounded-lg bg-slate-950">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-800 bg-slate-900/50">
                          <th className="p-3 text-xs font-semibold text-slate-400 font-mono">Field Key</th>
                          <th className="p-3 text-xs font-semibold text-slate-400">Type</th>
                          <th className="p-3 text-xs font-semibold text-slate-400 text-right">Required</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.endpoints[selectedEndpoint].headers.map((h: any) => (
                          <tr key={h.key} className="border-b border-slate-900 text-sm">
                            <td className="p-3 font-mono text-slate-300">{h.key}</td>
                            <td className="p-3 text-slate-400 font-mono text-xs">{h.value}</td>
                            <td className="p-3 text-right">
                              <Badge variant={h.required ? 'destructive' : 'secondary'} className="text-[10px]">
                                {h.required ? 'Yes' : 'No'}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Body Table */}
                {data.endpoints[selectedEndpoint].body && data.endpoints[selectedEndpoint].body.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                      <Code className="w-4 h-4 text-emerald-500" />
                      Request Body Requirement Fields
                    </h4>
                    <div className="overflow-hidden border border-slate-800 rounded-lg bg-slate-950">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-800 bg-slate-900/50">
                            <th className="p-3 text-xs font-semibold text-slate-400 font-mono">Field Name</th>
                            <th className="p-3 text-xs font-semibold text-slate-400">Type</th>
                            <th className="p-3 text-xs font-semibold text-slate-400">Description</th>
                            <th className="p-3 text-xs font-semibold text-slate-400 text-right">Required</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.endpoints[selectedEndpoint].body.map((b: any) => (
                            <tr key={b.field} className="border-b border-slate-900 text-sm">
                              <td className="p-3 font-mono text-emerald-400 font-medium">{b.field}</td>
                              <td className="p-3 text-slate-400 font-mono text-xs">{b.type}</td>
                              <td className="p-3 text-slate-400 text-xs">{b.description}</td>
                              <td className="p-3 text-right">
                                <Badge variant={b.required ? 'destructive' : 'secondary'} className="text-[10px]">
                                  {b.required ? 'Yes' : 'No'}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Response Block */}
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-emerald-500" />
                    Response Payload Model
                  </h4>
                  <pre className="p-4 rounded-lg bg-slate-950 border border-slate-900 font-mono text-xs text-emerald-500 overflow-x-auto whitespace-pre-wrap">
                    {data.endpoints[selectedEndpoint].response}
                  </pre>
                </div>
              </CardContent>
            </Card>
          )}
        </motion.div>
      </div>
    </div>
  )
}
