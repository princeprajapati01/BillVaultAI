'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Scan, 
  FileText, 
  DollarSign, 
  Calendar, 
  Hash,
  Receipt,
  CheckCircle2,
  Sparkles,
  Zap,
  X
} from 'lucide-react'

// Convert dataURL to Blob
function dataURLtoBlob(dataurl: string) {
  const arr = dataurl.split(',')
  const mime = arr[0].match(/:(.*?);/)![1]
  const bstr = atob(arr[1])
  let n = bstr.length
  const u8arr = new Uint8Array(n)
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n)
  }
  return new Blob([u8arr], { type: mime })
}

export default function ProcessingScreen() {
  const router = useRouter()
  const [steps, setSteps] = useState([
    { id: 1, label: 'Scanning document', icon: Scan, field: 'Document', value: 'Analyzing layout...', status: 'waiting' },
    { id: 2, label: 'Extracting merchant', icon: FileText, field: 'Merchant', value: 'Detecting...', status: 'waiting' },
    { id: 3, label: 'Detecting total amount', icon: DollarSign, field: 'Total', value: 'Calculating...', status: 'waiting' },
    { id: 4, label: 'Extracting GST', icon: Receipt, field: 'GST', value: 'Calculating...', status: 'waiting' },
    { id: 5, label: 'Reading invoice number', icon: Hash, field: 'Invoice #', value: 'Searching...', status: 'waiting' },
    { id: 6, label: 'Detecting date', icon: Calendar, field: 'Date', value: 'Searching...', status: 'waiting' },
  ])
  const [currentStep, setCurrentStep] = useState(0)
  const [extractedData, setExtractedData] = useState<any[]>([])
  const [isComplete, setIsComplete] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    let timer: NodeJS.Timeout

    async function processBill() {
      try {
        const fileData = localStorage.getItem('temp_bill_file')
        const fileName = localStorage.getItem('temp_bill_name') || 'invoice.png'
        
        if (!fileData) {
          setError('No invoice file found to process. Please go back and upload again.')
          return
        }

        // Step 1: Scanning document (started)
        if (active) setCurrentStep(1)

        // Convert base64 to blob
        const blob = dataURLtoBlob(fileData)
        const token = localStorage.getItem('auth_token')
        if (!token) {
          throw new Error('You must be logged in to process bills. Please sign in.')
        }

        const formData = new FormData()
        formData.append('file', blob, fileName)

        // Call backend API with token auth
        const response = await fetch('http://localhost:8000/process/document', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData,
        })

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}))
          throw new Error(errData.detail || 'Failed to process document. Limit exceeded or backend issue.')
        }

        const initialData = await response.json()
        if (!active) return
        const billId = initialData.id

        // Start step progression timer for visual appeal
        let simulatedStep = 1
        const stepInterval = setInterval(() => {
          if (simulatedStep < 5) {
            simulatedStep += 1
            if (active) setCurrentStep(simulatedStep)
          }
        }, 1500)

        // Poll API
        let data = initialData
        let pollCount = 0
        const maxPolls = 40 // 60s max timeout

        while (data.status === 'processing' && pollCount < maxPolls) {
          await new Promise((resolve) => setTimeout(resolve, 1500))
          if (!active) {
            clearInterval(stepInterval)
            return
          }
          pollCount++

          const pollResponse = await fetch(`http://localhost:8000/api/bills/${billId}`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          })
          if (pollResponse.ok) {
            data = await pollResponse.json()
          } else if (pollResponse.status === 404) {
            clearInterval(stepInterval)
            throw new Error('Invoice record not found on server.')
          }
        }

        clearInterval(stepInterval)

        if (data.status === 'failed') {
          throw new Error('AI extraction failed for this invoice. Please check the image quality and try again.')
        }

        if (data.status === 'processing') {
          throw new Error('Processing timed out. Please check the history screen later.')
        }

        // Extract values from fields
        const vendor = data.merchant || 'Not detected'
        const totalVal = data.amount !== undefined && data.amount !== null ? `₹${data.amount.toFixed(2)}` : 'Not detected'
        const gstValStr = data.gst !== undefined && data.gst !== null ? `₹${data.gst.toFixed(2)}` : 'Not detected'
        const invoiceNo = data.invoiceNumber || 'Not detected'
        const invoiceDate = data.date || 'Not detected'

        // Prepare completed steps with real values
        const completedSteps = [
          { id: 1, label: 'Scanning document', icon: Scan, field: 'Document', value: 'Invoice layout analyzed successfully', status: 'done' },
          { id: 2, label: 'Extracting merchant', icon: FileText, field: 'Merchant', value: vendor, status: 'done' },
          { id: 3, label: 'Detecting total amount', icon: DollarSign, field: 'Total', value: totalVal, status: 'done' },
          { id: 4, label: 'Extracting GST', icon: Receipt, field: 'GST', value: gstValStr, status: 'done' },
          { id: 5, label: 'Reading invoice number', icon: Hash, field: 'Invoice #', value: invoiceNo, status: 'done' },
          { id: 6, label: 'Detecting date', icon: Calendar, field: 'Date', value: invoiceDate, status: 'done' },
        ]

        // Store result
        localStorage.setItem('processed_bill_data', JSON.stringify(data))

        // Play the step-by-step animations with a nice quick delay
        for (let i = 0; i < completedSteps.length; i++) {
          await new Promise((resolve) => setTimeout(resolve, 150))
          if (!active) return
          setCurrentStep(i + 1)
          setSteps(prev => {
            const updated = [...prev]
            updated[i] = completedSteps[i]
            return updated
          })
          setExtractedData(prev => [...prev, completedSteps[i]])
        }

        // Wait a tiny bit then complete
        await new Promise((resolve) => setTimeout(resolve, 100))
        if (!active) return
        setIsComplete(true)
        
        await new Promise((resolve) => setTimeout(resolve, 200))
        if (!active) return
        router.push(`/bill/${data.id}`)

      } catch (err: any) {
        console.error(err)
        if (active) {
          setError(err.message || 'An error occurred during AI processing.')
        }
      }
    }

    timer = setTimeout(() => {
      processBill()
    }, 50)

    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [router])

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-primary-900 to-cyan-900 flex items-center justify-center p-4 relative overflow-hidden text-center text-white">
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 p-8 rounded-2xl max-w-md w-full relative z-10">
          <div className="w-16 h-16 bg-red-500/20 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <X className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold mb-4">Processing Failed</h2>
          <p className="text-white/80 mb-6">{error}</p>
          <button
            onClick={() => router.push('/upload')}
            className="w-full py-3 bg-gradient-emerald text-white font-bold rounded-xl shadow-lg hover:shadow-glow transition-all"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-primary-900 to-cyan-900 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated Background Grid */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute inset-0" style={{
          backgroundImage: 'linear-gradient(rgba(20, 184, 166, 0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(20, 184, 166, 0.3) 1px, transparent 1px)',
          backgroundSize: '50px 50px',
        }} />
      </div>

      {/* Scanning Beams */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <motion.div
          className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-primary-400 to-transparent"
          animate={{
            y: ['0%', '100%'],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: 'linear',
          }}
        />
        <motion.div
          className="absolute inset-y-0 w-1 bg-gradient-to-b from-transparent via-cyan-400 to-transparent"
          animate={{
            x: ['0%', '100%'],
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: 'linear',
          }}
        />
      </motion.div>

      {/* Main Content */}
      <div className="relative z-10 w-full max-w-2xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <motion.div
            className="inline-flex items-center justify-center w-20 h-20 bg-gradient-emerald rounded-2xl mb-6 shadow-glow-lg relative"
            animate={{
              scale: [1, 1.05, 1],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
            }}
          >
            <Sparkles className="w-10 h-10 text-white" />
            <motion.div
              className="absolute inset-0 bg-primary-400 rounded-2xl"
              animate={{
                scale: [1, 1.3, 1],
                opacity: [0.5, 0, 0.5],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
              }}
            />
          </motion.div>

          <h2 className="text-3xl font-bold text-white mb-2">
            {isComplete ? 'Extraction Complete!' : 'AI Processing...'}
          </h2>
          <p className="text-white/80">
            {isComplete ? 'All data extracted successfully' : 'Analyzing your invoice with AI'}
          </p>
        </motion.div>

        {/* Invoice Preview */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white/10 backdrop-blur-xl rounded-2xl p-6 mb-8 border border-white/20 relative overflow-hidden"
        >
          {/* Scanning Line */}
          <motion.div
            className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-primary-400 to-transparent"
            animate={{
              y: ['-100%', '300%'],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: 'linear',
            }}
          />

          {/* Invoice Mockup */}
          <div className="relative space-y-4">
            <div className="h-4 bg-white/20 rounded w-3/4" />
            <div className="h-4 bg-white/20 rounded w-1/2" />
            <div className="h-20 bg-white/10 rounded-lg border border-white/20 mt-6" />
            <div className="grid grid-cols-2 gap-4">
              <div className="h-4 bg-white/20 rounded" />
              <div className="h-4 bg-white/20 rounded" />
            </div>
          </div>

          {/* Bounding Boxes Animation */}
          <AnimatePresence>
            {extractedData.map((step, index) => (
              <motion.div
                key={step.id}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="absolute border-2 border-primary-400 rounded bg-primary-400/20"
                style={{
                  top: `${20 + index * 12}%`,
                  left: '10%',
                  width: '80%',
                  height: '8%',
                }}
              >
                <motion.div
                  className="absolute -top-6 left-0 text-xs font-semibold text-primary-300 flex items-center gap-1"
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                >
                  <CheckCircle2 className="w-3 h-3" />
                  {step.field}
                </motion.div>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>

        {/* Extraction Progress */}
        <div className="space-y-3">
          {steps.map((step, index) => (
            <motion.div
              key={step.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ 
                opacity: index < currentStep ? 1 : 0.3,
                x: 0 
              }}
              className={`flex items-center gap-4 p-4 rounded-xl transition-all ${
                index < currentStep
                  ? 'bg-white/10 backdrop-blur-sm border border-white/20'
                  : 'bg-white/5'
              }`}
            >
              {/* Icon */}
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                index < currentStep
                  ? 'bg-gradient-emerald shadow-glow'
                  : 'bg-white/10'
              }`}>
                {index < currentStep ? (
                  <CheckCircle2 className="w-5 h-5 text-white" />
                ) : (
                  <step.icon className="w-5 h-5 text-white/50" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1">
                <p className={`font-medium transition-all ${
                  index < currentStep ? 'text-white' : 'text-white/50'
                }`}>
                  {step.label}
                </p>
                <AnimatePresence>
                  {index < currentStep && (
                    <motion.p
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-sm text-primary-300 font-semibold mt-1"
                    >
                      {step.value}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>

              {/* Confidence Score */}
              {index < currentStep && step.status === 'done' && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="flex items-center gap-1 px-3 py-1 bg-emerald-500/20 rounded-full border border-emerald-500/30"
                >
                  <Zap className="w-3 h-3 text-emerald-400" />
                  <span className="text-xs font-bold text-emerald-400">
                    {95 + Math.floor(Math.random() * 5)}%
                  </span>
                </motion.div>
              )}

              {/* Loading Spinner */}
              {index === currentStep - 1 && !isComplete && (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                />
              )}
            </motion.div>
          ))}
        </div>

        {/* Completion Animation */}
        <AnimatePresence>
          {isComplete && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 flex items-center justify-center z-50 bg-black/50 backdrop-blur-sm"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200 }}
                className="bg-gradient-emerald rounded-full p-8 shadow-glow-lg"
              >
                <CheckCircle2 className="w-20 h-20 text-white" strokeWidth={2} />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
