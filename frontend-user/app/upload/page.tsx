'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Upload, 
  Camera, 
  Image as ImageIcon, 
  X, 
  Scan,
  CheckCircle2,
  ArrowLeft,
  Sparkles,
  FileText
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

export default function UploadScreen() {
  const router = useRouter()
  const [dragActive, setDragActive] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [isUploading, setIsUploading] = useState(false)
  const [uploadSuccess, setUploadSuccess] = useState(false)
  const [queuedBillId, setQueuedBillId] = useState<number | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0])
    }
  }

  const handleFile = (file: File) => {
    setSelectedFile(file)
    const reader = new FileReader()
    reader.onloadend = () => {
      setPreview(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0])
    }
  }

  const handleUpload = async () => {
    if (!selectedFile) return
    setIsUploading(true)
    setUploadError(null)

    try {
      const token = localStorage.getItem('auth_token')
      if (!token) {
        throw new Error('You must be logged in to process bills. Please sign in.')
      }

      const formData = new FormData()
      formData.append('file', selectedFile, selectedFile.name)

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

      const data = await response.json()
      
      // Save info in local storage so that /processing page can use it
      localStorage.setItem('temp_bill_file', preview || '')
      localStorage.setItem('temp_bill_name', selectedFile.name)
      localStorage.setItem('temp_bill_size', selectedFile.size.toString())
      localStorage.setItem('processed_bill_data', JSON.stringify(data))

      setQueuedBillId(data.id)
      setUploadSuccess(true)
      setTimeout(() => {
        router.push('/dashboard')
      }, 1500)
    } catch (err: any) {
      console.error(err)
      setUploadError(err.message || 'An error occurred during upload.')
    } finally {
      setIsUploading(false)
    }
  }

  if (uploadSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-primary-950 to-cyan-950 flex items-center justify-center p-4 relative overflow-hidden text-center text-white">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary-500/10 rounded-full filter blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-500/10 rounded-full filter blur-3xl" />
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white/10 backdrop-blur-xl border border-white/20 p-8 rounded-2xl max-w-md w-full relative z-10 space-y-6 shadow-2xl"
        >
          <div className="w-20 h-20 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto shadow-glow">
            <CheckCircle2 className="w-10 h-10 animate-bounce" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-white">Invoice Queued!</h2>
            <p className="text-white/80 text-sm">
              Your invoice is now processing in the background.
            </p>
          </div>
          <div className="flex items-center justify-center gap-2 text-xs text-primary-300 animate-pulse font-medium">
            <div className="w-4 h-4 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
            Returning to dashboard...
          </div>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-primary-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/dashboard')}
              className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-all"
            >
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Upload Bill</h1>
              <p className="text-sm text-gray-600 mt-1">AI will extract data automatically</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-2xl mx-auto px-4 py-8">
        <AnimatePresence mode="wait">
          {!preview ? (
            <motion.div
              key="upload"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* Drag & Drop Area */}
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                className={`relative border-2 border-dashed rounded-3xl p-12 transition-all ${
                  dragActive
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-gray-300 bg-white'
                }`}
              >
                {/* Scanning Frame Animation */}
                <motion.div
                  className="absolute inset-8 border-2 border-primary-400 rounded-2xl opacity-0"
                  animate={dragActive ? {
                    opacity: [0, 1, 0],
                    scale: [0.95, 1, 0.95],
                  } : {}}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                  }}
                />

                <div className="text-center relative z-10">
                  <motion.div
                    animate={dragActive ? { scale: 1.1 } : { scale: 1 }}
                    className="inline-flex items-center justify-center w-20 h-20 bg-gradient-emerald rounded-2xl mb-6 shadow-glow"
                  >
                    <Upload className="w-10 h-10 text-white" />
                  </motion.div>

                  <h3 className="text-xl font-bold text-gray-900 mb-2">
                    {dragActive ? 'Drop your bill here' : 'Upload Invoice or Bill'}
                  </h3>
                  <p className="text-gray-600 mb-6">
                    Drag and drop or click to browse
                  </p>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={handleFileInput}
                    className="hidden"
                  />

                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-6 py-3 bg-gradient-emerald text-white font-semibold rounded-xl shadow-lg hover:shadow-glow transition-all"
                  >
                    Browse Files
                  </button>

                  <p className="text-sm text-gray-500 mt-4">
                    Supports: JPG, PNG, PDF (Max 10MB)
                  </p>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="grid grid-cols-2 gap-4">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex items-center gap-3 p-4 bg-white rounded-2xl border border-gray-200 hover:border-primary-300 hover:shadow-lg transition-all"
                >
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
                    <Camera className="w-6 h-6 text-white" />
                  </div>
                  <div className="text-left">
                    <p className="font-semibold text-gray-900">Take Photo</p>
                    <p className="text-xs text-gray-600">Use camera</p>
                  </div>
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-3 p-4 bg-white rounded-2xl border border-gray-200 hover:border-primary-300 hover:shadow-lg transition-all"
                >
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-50 to-purple-600 rounded-xl flex items-center justify-center">
                    <ImageIcon className="w-6 h-6 text-white" />
                  </div>
                  <div className="text-left">
                    <p className="font-semibold text-gray-900">From Gallery</p>
                    <p className="text-xs text-gray-600">Choose image</p>
                  </div>
                </motion.button>
              </div>

              {/* AI Features Info */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="bg-gradient-to-br from-primary-500 to-cyan-500 rounded-2xl p-6 text-white"
              >
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold mb-2">AI-Powered Extraction</h4>
                    <ul className="space-y-1 text-sm text-white/90">
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4" />
                        Automatic data extraction
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4" />
                        Smart field detection
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4" />
                        GST & tax calculation
                      </li>
                    </ul>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          ) : (
            <motion.div
              key="preview"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* Preview Card */}
              <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-200">
                <div className="relative">
                  {/* Document/Image Preview */}
                  {selectedFile?.type === 'application/pdf' || selectedFile?.name.toLowerCase().endsWith('.pdf') ? (
                    <div className="w-full h-96 bg-slate-900 flex flex-col items-center justify-center p-6 text-center">
                      <div className="w-20 h-20 bg-red-500/10 text-red-500 rounded-2xl flex items-center justify-center mb-4 border border-red-500/20 shadow-glow animate-pulse">
                        <FileText className="w-10 h-10" />
                      </div>
                      <h4 className="text-lg font-bold text-white mb-1">PDF Document</h4>
                      <p className="text-sm text-slate-400 max-w-xs truncate">{selectedFile?.name}</p>
                      <p className="text-xs text-slate-500 mt-1">
                        {selectedFile && (selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                      </p>
                      <div className="mt-4 px-3 py-1 bg-red-500/20 text-red-300 rounded-full text-xs font-semibold uppercase tracking-wider">
                        PDF Format Ready
                      </div>
                    </div>
                  ) : (
                    <img
                      src={preview || ''}
                      alt="Bill preview"
                      className="w-full h-96 object-contain bg-gray-50"
                    />
                  )}

                  {/* Scanning Overlay */}
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-b from-transparent via-primary-500/20 to-transparent"
                    initial={{ y: '-100%' }}
                    animate={{ y: '200%' }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: 'linear',
                    }}
                  />

                  {/* Corner Frames */}
                  <div className="absolute inset-4 pointer-events-none">
                    <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary-500 rounded-tl-lg" />
                    <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary-500 rounded-tr-lg" />
                    <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-primary-500 rounded-bl-lg" />
                    <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary-500 rounded-br-lg" />
                  </div>

                  {/* Remove Button */}
                  <button
                    onClick={() => {
                      setSelectedFile(null)
                      setPreview(null)
                    }}
                    className="absolute top-4 right-4 w-10 h-10 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center shadow-lg transition-all"
                  >
                    <X className="w-5 h-5 text-white" />
                  </button>
                </div>

                {/* File Info */}
                <div className="p-6 border-t border-gray-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-gray-900">{selectedFile?.name}</p>
                      <p className="text-sm text-gray-600 mt-1">
                        {selectedFile && (selectedFile.size / 1024).toFixed(2)} KB
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-emerald-600">
                      <CheckCircle2 className="w-5 h-5" />
                      <span className="text-sm font-medium">Ready</span>
                    </div>
                  </div>
                </div>
              </div>

              {uploadError && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-600 text-sm font-semibold">
                  {uploadError}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-4">
                <button
                  onClick={() => {
                    setSelectedFile(null)
                    setPreview(null)
                  }}
                  className="flex-1 py-4 bg-white border-2 border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-all"
                >
                  Cancel
                </button>
                <motion.button
                  whileHover={!isUploading ? { scale: 1.02 } : {}}
                  whileTap={!isUploading ? { scale: 0.98 } : {}}
                  onClick={handleUpload}
                  disabled={isUploading}
                  className="flex-1 py-4 bg-gradient-emerald text-white font-semibold rounded-xl shadow-glow hover:shadow-glow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isUploading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Uploading to Queue...
                    </>
                  ) : (
                    <>
                      <Scan className="w-5 h-5" />
                      Process with AI
                    </>
                  )}
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
