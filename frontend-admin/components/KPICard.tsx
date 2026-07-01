'use client'

import { motion } from 'framer-motion'
import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { cn, formatNumber, formatCurrency, formatPercentage } from '@/lib/utils'

interface KPICardProps {
  title: string
  value: string | number
  change?: number
  icon: LucideIcon
  color: string
  format?: 'number' | 'currency' | 'percentage' | 'text'
  trend?: 'up' | 'down'
  delay?: number
}

export default function KPICard({
  title,
  value,
  change,
  icon: Icon,
  color,
  format = 'number',
  trend,
  delay = 0,
}: KPICardProps) {
  const formatValue = (val: string | number) => {
    if (typeof val === 'string') return val
    
    switch (format) {
      case 'currency':
        return formatCurrency(val)
      case 'percentage':
        return formatPercentage(val)
      case 'number':
        return formatNumber(val)
      default:
        return val
    }
  }

  const isPositive = change && change > 0
  const isNegative = change && change < 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      whileHover={{ scale: 1.02, y: -4 }}
    >
      <Card className="relative overflow-hidden group">
        {/* Gradient overlay */}
        <div className={cn(
          'absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500',
          `bg-gradient-to-br ${color} opacity-5`
        )} />
        
        {/* Glow effect */}
        <div className={cn(
          'absolute -inset-1 opacity-0 group-hover:opacity-20 blur-xl transition-opacity duration-500',
          `bg-gradient-to-br ${color}`
        )} />

        <CardContent className="p-6 relative z-10">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-400 mb-2">{title}</p>
              <motion.h3
                initial={{ scale: 0.5 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200, delay: delay + 0.2 }}
                className="text-3xl font-bold text-slate-100 mb-2"
              >
                {formatValue(value)}
              </motion.h3>
              {change !== undefined && (
                <div className="flex items-center gap-1">
                  {isPositive && <TrendingUp className="w-4 h-4 text-green-400" />}
                  {isNegative && <TrendingDown className="w-4 h-4 text-red-400" />}
                  <span className={cn(
                    'text-sm font-medium',
                    isPositive && 'text-green-400',
                    isNegative && 'text-red-400',
                    !isPositive && !isNegative && 'text-slate-400'
                  )}>
                    {change > 0 && '+'}{change}%
                  </span>
                  <span className="text-xs text-slate-500 ml-1">vs last month</span>
                </div>
              )}
            </div>
            <motion.div
              whileHover={{ rotate: 360 }}
              transition={{ duration: 0.6 }}
              className={cn(
                'w-12 h-12 rounded-xl flex items-center justify-center',
                `bg-gradient-to-br ${color} shadow-lg`
              )}
            >
              <Icon className="w-6 h-6 text-white" />
            </motion.div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
