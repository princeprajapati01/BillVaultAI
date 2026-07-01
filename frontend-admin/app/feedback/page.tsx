'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { MessageSquare, Star, Trash2, Calendar, User, Search, Filter } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function FeedbackPage() {
  const [loading, setLoading] = useState(true)
  const [feedbackList, setFeedbackList] = useState<any[]>([])
  const [searchQuery, setSearchQuery] = useState('')

  const loadFeedback = async () => {
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
        const res = await fetch('http://localhost:8000/api/admin/feedback', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
        if (res.ok) {
          const data = await res.json()
          setFeedbackList(data)
        }
      } catch (e) {
        console.error(e)
      }
    }
    setLoading(false)
  }

  useEffect(() => {
    loadFeedback()
  }, [])

  // Calculate aggregated stats
  const totalFeedback = feedbackList.length
  const avgRating = totalFeedback > 0 
    ? (feedbackList.reduce((sum, f) => sum + f.rating, 0) / totalFeedback).toFixed(1) 
    : '0.0'
  const positiveFeedbacks = feedbackList.filter(f => f.rating >= 4).length
  const positivePercentage = totalFeedback > 0 
    ? Math.round((positiveFeedbacks / totalFeedback) * 100) 
    : 0
  const criticalFeedbacks = feedbackList.filter(f => f.rating <= 2).length

  // Filter items
  const filteredFeedback = feedbackList.filter(f => {
    const name = f.user_name || ''
    const email = f.user_email || ''
    const comment = f.comment || ''
    const query = searchQuery.toLowerCase()
    return name.toLowerCase().includes(query) ||
           email.toLowerCase().includes(query) ||
           comment.toLowerCase().includes(query)
  })

  if (loading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center flex-col gap-2 text-slate-200">
        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-slate-400">Loading user feedback...</span>
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
        <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent mb-2">
          Feedback & Support
        </h1>
        <p className="text-slate-400">User reviews, rating breakdown, and feature suggestions</p>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'Total Feedbacks', value: totalFeedback.toString(), change: 'Received', color: 'from-blue-500 to-indigo-500' },
          { label: 'Avg Rating', value: `${avgRating} / 5.0`, change: 'Out of 5', color: 'from-amber-500 to-orange-500' },
          { label: 'Positive (4★+)', value: `${positivePercentage}%`, change: `${positiveFeedbacks} reviews`, color: 'from-green-500 to-emerald-500' },
          { label: 'Critical Issues', value: criticalFeedbacks.toString(), change: 'Requires attention', color: 'from-red-500 to-pink-500' },
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
                <div className="flex items-end justify-between">
                  <h3 className="text-3xl font-bold text-slate-100">{stat.value}</h3>
                  <Badge variant="secondary" className="text-xs">{stat.change}</Badge>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Feedback List */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
      >
        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-indigo-400" />
                  Recent User Reviews
                </CardTitle>
                <CardDescription>Live database feed of user submissions</CardDescription>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <Input
                    placeholder="Search reviews..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 w-64 bg-slate-950 border-slate-800 text-slate-100"
                  />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {filteredFeedback.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-sm">
                  No feedback items found matching your search.
                </div>
              ) : (
                filteredFeedback.map((item, index) => {
                  const initial = item.user_name ? item.user_name[0].toUpperCase() : 'U'
                  
                  return (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.05 }}
                      className="p-6 rounded-xl border border-slate-800 bg-slate-900/50 hover:border-slate-700 transition-colors"
                    >
                      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                        <div className="flex items-start gap-4">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
                            {initial}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <h4 className="font-semibold text-slate-100">{item.user_name}</h4>
                              <span className="text-xs text-slate-500">•</span>
                              <span className="text-xs text-slate-400">{item.user_email}</span>
                            </div>
                            
                            {/* Star Rating Display */}
                            <div className="flex gap-0.5 my-2">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <Star
                                  key={star}
                                  className={`w-4 h-4 ${
                                    star <= item.rating
                                      ? 'fill-amber-400 text-amber-400'
                                      : 'text-slate-700'
                                  }`}
                                />
                              ))}
                            </div>

                            <p className="text-sm text-slate-300 mt-2 whitespace-pre-wrap leading-relaxed">
                              {item.comment}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-500 self-start md:self-auto">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>{item.date}</span>
                        </div>
                      </div>
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
