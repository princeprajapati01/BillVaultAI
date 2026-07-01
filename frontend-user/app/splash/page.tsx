'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Scan, FileText, Sparkles } from 'lucide-react'

export default function SplashScreen() {
  const router = useRouter()

  useEffect(() => {
    const timer = setTimeout(() => {
      router.push('/login')
    }, 3000)
    return () => clearTimeout(timer)
  }, [router])

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-600 via-primary-500 to-cyan-500 flex items-center justify-center overflow-hidden relative">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          className="absolute top-20 left-10 w-32 h-32 bg-white/10 rounded-3xl rotate-12"
          animate={{
            y: [0, -20, 0],
            rotate: [12, 18, 12],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        <motion.div
          className="absolute bottom-32 right-16 w-40 h-40 bg-white/10 rounded-3xl -rotate-12"
          animate={{
            y: [0, 20, 0],
            rotate: [-12, -18, -12],
          }}
          transition={{
            duration: 3.5,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        <motion.div
          className="absolute top-1/2 right-1/4 w-24 h-24 bg-white/10 rounded-2xl"
          animate={{
            y: [0, -30, 0],
            x: [0, 10, 0],
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
      </div>

      {/* Main Content */}
      <div className="relative z-10 flex flex-col items-center">
        {/* Logo Container with Scan Effect */}
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="relative mb-8"
        >
          {/* Outer Glow Ring */}
          <motion.div
            className="absolute inset-0 rounded-full bg-white/20"
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.5, 0, 0.5],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
          
          {/* Logo Circle */}
          <div className="relative w-32 h-32 bg-white rounded-full flex items-center justify-center shadow-glow-lg overflow-hidden border-4 border-white">
            <img 
              src="/logo.png" 
              alt="BillVault AI Logo" 
              className="w-full h-full object-cover" 
            />
          </div>

          {/* Scanning Line Effect */}
          <motion.div
            className="absolute inset-0 overflow-hidden rounded-full"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            <motion.div
              className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-white to-transparent"
              animate={{
                y: ['-100%', '200%'],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "linear"
              }}
            />
          </motion.div>
        </motion.div>

        {/* App Name */}
        <motion.h1
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="text-4xl font-bold text-white mb-3 tracking-tight"
        >
          BillVault AI
        </motion.h1>

        {/* Tagline */}
        <motion.p
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="text-white/90 text-lg font-medium mb-12"
        >
          Smart AI Bill Management
        </motion.p>

        {/* Floating Invoice Cards */}
        <div className="flex gap-4 mb-8">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{
                delay: 0.7 + i * 0.1,
                duration: 0.5,
              }}
            >
              <motion.div
                className="w-16 h-20 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center border border-white/30"
                animate={{
                  y: [0, -10, 0],
                }}
                transition={{
                  duration: 2 + i * 0.3,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: i * 0.2,
                }}
              >
                <FileText className="w-8 h-8 text-white/80" />
              </motion.div>
            </motion.div>
          ))}
        </div>

        {/* Loading Animation */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="flex gap-2"
        >
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-2 h-2 bg-white rounded-full"
              animate={{
                scale: [1, 1.5, 1],
                opacity: [0.5, 1, 0.5],
              }}
              transition={{
                duration: 1,
                repeat: Infinity,
                delay: i * 0.2,
              }}
            />
          ))}
        </motion.div>
      </div>
    </div>
  )
}
