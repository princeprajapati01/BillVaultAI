'use client'

import { motion } from 'framer-motion'
import { Crown, Check, Zap, TrendingUp, Users } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils'
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

const plans = [
  {
    name: 'Free',
    price: 0,
    users: 0,
    revenue: 0,
    features: ['10 uploads/month', 'Basic OCR', 'Email support'],
    color: 'from-slate-500 to-slate-600',
    growth: 0
  },
  {
    name: 'Basic',
    price: 499,
    users: 0,
    revenue: 0,
    features: ['100 uploads/month', 'Advanced OCR', 'Priority support', 'API access'],
    color: 'from-green-500 to-emerald-500',
    growth: 0
  },
  {
    name: 'Pro',
    price: 1499,
    users: 0,
    revenue: 0,
    features: ['Unlimited uploads', 'AI extraction', '24/7 support', 'Advanced API', 'Custom integrations'],
    color: 'from-cyan-500 to-blue-500',
    growth: 0
  },
  {
    name: 'Enterprise',
    price: 4999,
    users: 0,
    revenue: 0,
    features: ['Everything in Pro', 'Dedicated support', 'Custom AI models', 'SLA guarantee', 'White-label'],
    color: 'from-purple-500 to-pink-500',
    growth: 0
  },
]

const revenueData: { month: string; revenue: number }[] = []

const conversionData: { month: string; free: number; paid: number }[] = []

export default function SubscriptionsPage() {
  const totalRevenue = plans.reduce((sum, plan) => sum + plan.revenue, 0)
  const totalUsers = plans.reduce((sum, plan) => sum + plan.users, 0)
  const paidUsers = plans.filter(p => p.price > 0).reduce((sum, plan) => sum + plan.users, 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-4xl font-bold bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent mb-2">
          Subscription Management
        </h1>
        <p className="text-slate-400">Manage pricing plans and revenue analytics</p>
      </motion.div>

      {/* Revenue Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'Monthly Revenue', value: formatCurrency(totalRevenue), change: '0%', icon: TrendingUp },
          { label: 'Total Subscribers', value: totalUsers.toLocaleString(), change: '0%', icon: Users },
          { label: 'Paid Users', value: paidUsers.toLocaleString(), change: '0%', icon: Crown },
          { label: 'Conversion Rate', value: '0%', change: '0%', icon: Zap },
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
                    <Icon className="w-5 h-5 text-emerald-400" />
                  </div>
                  <h3 className="text-3xl font-bold text-slate-100 mb-2">{stat.value}</h3>
                  <Badge variant="success">{stat.change}</Badge>
                </CardContent>
              </Card>
            </motion.div>
          )
        })}
      </div>

      {/* Pricing Plans */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {plans.map((plan, index) => (
          <motion.div
            key={plan.name}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 + index * 0.1 }}
          >
            <Card className="relative overflow-hidden group hover:scale-105 transition-transform">
              <div className={`absolute inset-0 bg-gradient-to-br ${plan.color} opacity-5 group-hover:opacity-10 transition-opacity`} />
              <CardHeader className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <CardTitle>{plan.name}</CardTitle>
                  {plan.name === 'Enterprise' && (
                    <Crown className="w-5 h-5 text-yellow-400" />
                  )}
                </div>
                <div className="mb-4">
                  <span className="text-4xl font-bold text-slate-100">
                    {plan.price === 0 ? 'Free' : `₹${plan.price}`}
                  </span>
                  {plan.price > 0 && <span className="text-slate-400">/month</span>}
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">Users</span>
                    <span className="font-medium text-slate-200">{plan.users.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">Revenue</span>
                    <span className="font-medium text-slate-200">{formatCurrency(plan.revenue)}</span>
                  </div>
                  <Badge variant="success" className="w-full justify-center">
                    <TrendingUp className="w-3 h-3 mr-1" />
                    +{plan.growth}% growth
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="relative z-10">
                <ul className="space-y-3 mb-6">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                      <Check className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button className="w-full" variant={plan.name === 'Enterprise' ? 'default' : 'outline'}>
                  Manage Plan
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Revenue Chart */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.8 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-400" />
              Revenue Growth
            </CardTitle>
            <CardDescription>Monthly recurring revenue trends</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={revenueData}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
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
                  formatter={(value) => formatCurrency(Number(value))}
                />
                <Area type="monotone" dataKey="revenue" stroke="#10b981" fillOpacity={1} fill="url(#colorRevenue)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </motion.div>

      {/* Conversion Funnel */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.9 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-emerald-400" />
              Free to Paid Conversion
            </CardTitle>
            <CardDescription>User upgrade patterns over time</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={conversionData}>
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
                <Bar dataKey="free" fill="#64748b" radius={[8, 8, 0, 0]} />
                <Bar dataKey="paid" fill="#10b981" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
