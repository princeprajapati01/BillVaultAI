'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Mail, Lock, Eye, EyeOff, Sparkles, Chrome, Apple, User } from 'lucide-react'
import { API_URL } from '@/lib/api'


export default function LoginScreen() {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [isLogin, setIsLogin] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Forgot Password System States
  const [isForgotPassword, setIsForgotPassword] = useState(false)
  const [forgotStep, setForgotStep] = useState(1) // 1: enter email, 2: enter OTP & new password
  const [otpCode, setOtpCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const passwordCriteria = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  }
  const isPasswordValid = Object.values(passwordCriteria).every(Boolean)

  const newPasswordCriteria = {
    length: newPassword.length >= 8,
    uppercase: /[A-Z]/.test(newPassword),
    lowercase: /[a-z]/.test(newPassword),
    number: /[0-9]/.test(newPassword),
    special: /[^A-Za-z0-9]/.test(newPassword),
  }
  const isNewPasswordValid = Object.values(newPasswordCriteria).every(Boolean)

  const handleRequestOTP = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccessMessage(null)
    setLoading(true)

    try {
      const response = await fetch(`${API_URL}/api/auth/forgot-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.detail || 'Failed to request OTP. Email may not be registered.')
      }

      const data = await response.json()
      setSuccessMessage(data.message || 'OTP code sent successfully to your email.')
      setForgotStep(2)
    } catch (err: any) {
      setError(err.message || 'An error occurred requesting OTP.')
    } finally {
      setLoading(false)
    }
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccessMessage(null)

    if (!isNewPasswordValid) {
      setError('Please satisfy all password complexity requirements.')
      return
    }

    setLoading(true)

    try {
      const response = await fetch(`${API_URL}/api/auth/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          otp_code: otpCode,
          new_password: newPassword
        }),
      })


      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.detail || 'Password reset failed. Please check the OTP code.')
      }

      setSuccessMessage('Password reset successfully! You can now log in.')
      setPassword(newPassword) // prefill password for login convenience
      setIsForgotPassword(false)
      setIsLogin(true)
      setForgotStep(1)
      setOtpCode('')
      setNewPassword('')
    } catch (err: any) {
      setError(err.message || 'An error occurred during password reset.')
    } finally {
      setLoading(false)
    }
  }

  // Google OAuth configuration & state
  const [showMockPopup, setShowMockPopup] = useState(false)
  const [customMockEmail, setCustomMockEmail] = useState('')

  const handleGoogleLogin = async () => {
    setError(null)
    const clientID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ''

    if (!clientID || clientID === 'YOUR_GOOGLE_CLIENT_ID' || clientID === 'placeholder') {
      setShowMockPopup(true)
      return
    }

    try {
      if (typeof window === 'undefined' || !(window as any).google) {
        throw new Error('Google client library is not loaded. Please wait a moment.')
      }

      setLoading(true)

      const client = (window as any).google.accounts.oauth2.initTokenClient({
        client_id: clientID,
        scope: 'openid email profile',
        callback: async (tokenResponse: any) => {
          if (tokenResponse.error) {
            setError(tokenResponse.error_description || 'Google Authentication failed.')
            setLoading(false)
            return
          }

          if (tokenResponse.access_token) {
            await submitGoogleToken(tokenResponse.access_token)
          } else {
            setError('No access token returned from Google.')
            setLoading(false)
          }
        },
      })

      client.requestAccessToken()
    } catch (err: any) {
      setError(err.message || 'An error occurred initializing Google login.')
      setLoading(false)
    }
  }

  const submitGoogleToken = async (accessToken: string) => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`${API_URL}/api/auth/google`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ access_token: accessToken }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.detail || 'Failed to authenticate with Google.')
      }

      const data = await response.json()
      localStorage.setItem('auth_token', data.access_token)
      localStorage.setItem('user_info', JSON.stringify(data.user))
      
      router.push('/dashboard')
    } catch (err: any) {
      setError(err.message || 'An error occurred during Google sign-in.')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    if (!isLogin && !isPasswordValid) {
      setError('Password does not meet complexity requirements.')
      setLoading(false)
      return
    }

    try {
      const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register'
      const payload = isLogin 
        ? { email, password }
        : { name: name || email.split('@')[0], email, password }

      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })


      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.detail || 'Authentication failed. Please verify credentials.')
      }

      const data = await response.json()
      // Store token and user details in localStorage
      localStorage.setItem('auth_token', data.access_token)
      localStorage.setItem('user_info', JSON.stringify(data.user))
      
      router.push('/dashboard')
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'An error occurred during authentication.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-primary-50 to-cyan-50 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated Background Blobs */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          className="absolute -top-40 -right-40 w-80 h-80 bg-primary-200/30 rounded-full blur-3xl"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        <motion.div
          className="absolute -bottom-40 -left-40 w-80 h-80 bg-cyan-200/30 rounded-full blur-3xl"
          animate={{
            scale: [1.2, 1, 1.2],
            opacity: [0.5, 0.3, 0.5],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
      </div>

      {/* Login Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative w-full max-w-md"
      >
        {/* Glass Card */}
        <div className="glass bg-white/70 backdrop-blur-xl rounded-3xl shadow-premium p-8 border border-white/50">
          {/* Logo */}
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-glow overflow-hidden border border-gray-100">
                <img 
                  src="/logo.png" 
                  alt="BillVault AI Logo" 
                  className="w-full h-full object-cover" 
                />
              </div>
              <motion.div
                className="absolute -inset-1 bg-gradient-emerald rounded-2xl opacity-20 blur-lg"
                animate={{
                  scale: [1, 1.1, 1],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                }}
              />
            </div>
          </div>

          {/* Title */}
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-2">
            {isForgotPassword 
              ? 'Reset Password' 
              : (isLogin ? 'Welcome Back' : 'Create Account')}
          </h2>
          <p className="text-center text-gray-600 mb-6">
            {isForgotPassword
              ? (forgotStep === 1 ? 'Enter your email to receive an OTP' : 'Enter the OTP and your new password')
              : (isLogin ? 'Sign in to your BillVault AI' : 'Start managing bills with AI')}
          </p>

          {/* Success Message */}
          {successMessage && (
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-600 rounded-xl text-sm font-medium">
              {successMessage}
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-xl text-sm font-medium">
              {error}
            </div>
          )}

          {/* Forgot Password Flow */}
          {isForgotPassword ? (
            <div className="space-y-4">
              {forgotStep === 1 ? (
                <form onSubmit={handleRequestOTP} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 bg-white/50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all text-gray-900"
                        placeholder="you@example.com"
                        required
                      />
                    </div>
                  </div>

                  <motion.button
                    type="submit"
                    disabled={loading}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full py-3 bg-gradient-emerald text-white font-semibold rounded-xl shadow-glow hover:shadow-glow-lg transition-all flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      'Send OTP Code'
                    )}
                  </motion.button>
                </form>
              ) : (
                <form onSubmit={handleResetPassword} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-300" />
                      <input
                        type="email"
                        value={email}
                        disabled
                        className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-gray-400 cursor-not-allowed"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      6-Digit OTP Code
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                      className="w-full px-4 py-3 bg-white/50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-center font-bold tracking-widest text-lg text-gray-900"
                      placeholder="000000"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      New Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full pl-12 pr-12 py-3 bg-white/50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all text-gray-900"
                        placeholder="••••••••"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                    {/* New Password Checklist */}
                    {newPassword && (
                      <div className="mt-2 space-y-1.5 p-3 bg-slate-50 border border-slate-100 rounded-xl">
                        <p className="text-xs font-semibold text-gray-500 mb-1">New Password Requirements:</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-2 gap-y-1 text-xs">
                          <div className={`flex items-center gap-1.5 ${newPasswordCriteria.length ? 'text-emerald-600 font-medium' : 'text-gray-400'}`}>
                            <span>{newPasswordCriteria.length ? '✅' : '❌'}</span>
                            <span>Min 8 characters</span>
                          </div>
                          <div className={`flex items-center gap-1.5 ${newPasswordCriteria.uppercase ? 'text-emerald-600 font-medium' : 'text-gray-400'}`}>
                            <span>{newPasswordCriteria.uppercase ? '✅' : '❌'}</span>
                            <span>1 uppercase letter</span>
                          </div>
                          <div className={`flex items-center gap-1.5 ${newPasswordCriteria.lowercase ? 'text-emerald-600 font-medium' : 'text-gray-400'}`}>
                            <span>{newPasswordCriteria.lowercase ? '✅' : '❌'}</span>
                            <span>1 lowercase letter</span>
                          </div>
                          <div className={`flex items-center gap-1.5 ${newPasswordCriteria.number ? 'text-emerald-600 font-medium' : 'text-gray-400'}`}>
                            <span>{newPasswordCriteria.number ? '✅' : '❌'}</span>
                            <span>1 number (0-9)</span>
                          </div>
                          <div className={`flex items-center gap-1.5 ${newPasswordCriteria.special ? 'text-emerald-600 font-medium' : 'text-gray-400'}`}>
                            <span>{newPasswordCriteria.special ? '✅' : '❌'}</span>
                            <span>1 special character</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <motion.button
                    type="submit"
                    disabled={loading}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full py-3 bg-gradient-emerald text-white font-semibold rounded-xl shadow-glow hover:shadow-glow-lg transition-all flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      'Update Password'
                    )}
                  </motion.button>
                </form>
              )}

              <button
                type="button"
                onClick={() => {
                  setIsForgotPassword(false)
                  setForgotStep(1)
                  setError(null)
                  setSuccessMessage(null)
                }}
                className="w-full text-center text-sm font-semibold text-gray-500 hover:text-gray-700 mt-4 block font-medium"
              >
                Back to Login
              </button>
            </div>
          ) : (
            <>
              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Full Name Input (Register Only) */}
                {!isLogin && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Full Name
                    </label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 bg-white/50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all text-gray-900"
                        placeholder="Alex Johnson"
                        required
                      />
                    </div>
                  </div>
                )}

                {/* Email Input */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-12 pr-4 py-3 bg-white/50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all text-gray-900"
                      placeholder="you@example.com"
                      required
                    />
                  </div>
                </div>

                {/* Password Input */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-12 pr-12 py-3 bg-white/50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all text-gray-900"
                      placeholder="••••••••"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  {/* Signup Password Requirements Checklist */}
                  {!isLogin && password && (
                    <div className="mt-2 space-y-1.5 p-3 bg-slate-50 border border-slate-100 rounded-xl animate-fadeIn">
                      <p className="text-xs font-semibold text-gray-500 mb-1">Password Requirements:</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-2 gap-y-1 text-xs">
                        <div className={`flex items-center gap-1.5 ${passwordCriteria.length ? 'text-emerald-600 font-medium' : 'text-gray-400'}`}>
                          <span>{passwordCriteria.length ? '✅' : '❌'}</span>
                          <span>Min 8 characters</span>
                        </div>
                        <div className={`flex items-center gap-1.5 ${passwordCriteria.uppercase ? 'text-emerald-600 font-medium' : 'text-gray-400'}`}>
                          <span>{passwordCriteria.uppercase ? '✅' : '❌'}</span>
                          <span>1 uppercase letter</span>
                        </div>
                        <div className={`flex items-center gap-1.5 ${passwordCriteria.lowercase ? 'text-emerald-600 font-medium' : 'text-gray-400'}`}>
                          <span>{passwordCriteria.lowercase ? '✅' : '❌'}</span>
                          <span>1 lowercase letter</span>
                        </div>
                        <div className={`flex items-center gap-1.5 ${passwordCriteria.number ? 'text-emerald-600 font-medium' : 'text-gray-400'}`}>
                          <span>{passwordCriteria.number ? '✅' : '❌'}</span>
                          <span>1 number (0-9)</span>
                        </div>
                        <div className={`flex items-center gap-1.5 ${passwordCriteria.special ? 'text-emerald-600 font-medium' : 'text-gray-400'}`}>
                          <span>{passwordCriteria.special ? '✅' : '❌'}</span>
                          <span>1 special character</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Forgot Password */}
                {isLogin && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setIsForgotPassword(true)
                        setError(null)
                        setSuccessMessage(null)
                      }}
                      className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                    >
                      Forgot password?
                    </button>
                  </div>
                )}

                {/* Submit Button */}
                <motion.button
                  type="submit"
                  disabled={loading}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full py-3 bg-gradient-emerald text-white font-semibold rounded-xl shadow-glow hover:shadow-glow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    isLogin ? 'Sign In' : 'Create Account'
                  )}
                </motion.button>
              </form>

              {/* Divider */}
              <div className="flex items-center gap-4 my-6">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-sm text-gray-500">or continue with</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>

              {/* Social Login */}
              <div className="grid grid-cols-2 gap-3">
                <motion.button
                  type="button"
                  onClick={handleGoogleLogin}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex items-center justify-center gap-2 py-3 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-all"
                >
                  <Chrome className="w-5 h-5 text-gray-500" />
                  <span className="font-medium text-gray-700">Google</span>
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex items-center justify-center gap-2 py-3 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-all"
                >
                  <Apple className="w-5 h-5 text-gray-500" />
                  <span className="font-medium text-gray-700">Apple</span>
                </motion.button>
              </div>

              {/* Toggle Login/Signup */}
              <p className="text-center text-sm text-gray-600 mt-6">
                {isLogin ? "Don't have an account? " : "Already have an account? "}
                <button
                  type="button"
                  onClick={() => {
                    setIsLogin(!isLogin)
                    setError(null)
                    setSuccessMessage(null)
                  }}
                  className="text-primary-600 hover:text-primary-700 font-semibold"
                >
                  {isLogin ? 'Sign up' : 'Sign in'}
                </button>
              </p>
            </>
          )}
        </div>

        {/* Mock Google Login Popup */}
        {showMockPopup && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-gray-100"
            >
              <div className="flex items-center gap-2 mb-4">
                <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
                  <Chrome className="w-5 h-5 text-red-500" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Developer Google Sign-In</h3>
                  <p className="text-xs text-gray-500">Google Client ID is not configured. Testing flow simulation.</p>
                </div>
              </div>

              <p className="text-sm text-gray-600 mb-4">
                Select one of the mock Google Accounts below to test the authentication and user registration pipeline:
              </p>

              <div className="space-y-3 mb-6">
                {[
                  { name: 'Alex Johnson', email: 'alex.google@example.com' },
                  { name: 'Sarah Connor', email: 'sarah.google@example.com' },
                  { name: 'David Miller', email: 'david.google@example.com' },
                ].map((acc) => (
                  <button
                    key={acc.email}
                    type="button"
                    onClick={() => {
                      setShowMockPopup(false)
                      submitGoogleToken(`mock_google_token_${acc.email}`)
                    }}
                    className="w-full text-left p-3 border border-gray-100 hover:border-emerald-500/30 hover:bg-emerald-50/50 rounded-xl transition-all flex items-center justify-between group"
                  >
                    <div>
                      <p className="font-semibold text-gray-800 text-sm group-hover:text-emerald-600">{acc.name}</p>
                      <p className="text-xs text-gray-500">{acc.email}</p>
                    </div>
                    <span className="text-xs font-semibold text-gray-400 bg-gray-50 px-2 py-1 rounded-md group-hover:text-emerald-600 group-hover:bg-emerald-50">
                      Sign In
                    </span>
                  </button>
                ))}
              </div>

              <div className="border-t border-gray-100 pt-4">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Or enter a custom email:
                </label>
                <div className="flex gap-2">
                  <input
                    type="email"
                    placeholder="name@example.com"
                    value={customMockEmail}
                    onChange={(e) => setCustomMockEmail(e.target.value)}
                    className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (customMockEmail) {
                        setShowMockPopup(false)
                        submitGoogleToken(`mock_google_token_${customMockEmail}`)
                      }
                    }}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-sm transition-all"
                  >
                    Go
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowMockPopup(false)}
                className="mt-6 w-full text-center text-sm font-semibold text-gray-500 hover:text-gray-700 py-2"
              >
                Cancel
              </button>
            </motion.div>
          </div>
        )}

        {/* Premium Illustration */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="absolute -z-10 -bottom-20 -right-20 w-64 h-64 bg-gradient-to-br from-primary-400/20 to-cyan-400/20 rounded-full blur-3xl"
        />
      </motion.div>
    </div>
  )
}
