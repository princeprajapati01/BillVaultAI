import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  Alert,
  Modal,
  Image,
  FlatList,
  Dimensions,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { API_ENDPOINTS, BASE_URL } from './src/config/apiConfig';

const { width } = Dimensions.get('window');

export default function App() {
  // Navigation & Session State
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'history' | 'upload' | 'analytics' | 'profile' | 'admin'>('dashboard');
  const [authScreen, setAuthScreen] = useState<'splash' | 'login' | 'register' | 'forgot'>('splash');
  const [loading, setLoading] = useState<boolean>(false);

  // Notifications & Toast
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [toast, setToast] = useState<any>(null);

  // Auth Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Data States
  const [bills, setBills] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('All');
  const [selectedBillDetail, setSelectedBillDetail] = useState<any | null>(null);
  const [fullImageModal, setFullImageModal] = useState<string | null>(null);
  const [isEditingBill, setIsEditingBill] = useState(false);
  const [showRawOcr, setShowRawOcr] = useState(false);
  const [showMetadata, setShowMetadata] = useState(false);

  // Upload State
  const [uploadFile, setUploadFile] = useState<any>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  // Feedback State
  const [feedbackType, setFeedbackType] = useState('general');
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

  // Admin Operations State
  const [adminStats, setAdminStats] = useState<any>(null);
  const [adminUsers, setAdminUsers] = useState<any[]>([]);
  const [adminHealth, setAdminHealth] = useState<any>(null);

  // Auto-redirect Splash
  useEffect(() => {
    if (authScreen === 'splash') {
      const timer = setTimeout(() => {
        setAuthScreen('login');
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [authScreen]);

  // Load User Data & Bills
  const fetchUserDataAndBills = async (jwtToken: string) => {
    setLoading(true);
    try {
      // 1. Fetch User Info
      const meRes = await fetch(API_ENDPOINTS.me, {
        headers: { Authorization: `Bearer ${jwtToken}` },
      });
      if (meRes.ok) {
        const userData = await meRes.json();
        setUser(userData);
        if (userData.is_admin) {
          fetchAdminData(jwtToken);
        }
      }

      // 2. Fetch Bills
      const billsRes = await fetch(API_ENDPOINTS.bills, {
        headers: { Authorization: `Bearer ${jwtToken}` },
      });
      if (billsRes.ok) {
        const data = await billsRes.json();
        setBills(data);
      }
    } catch (e) {
      console.log('Error fetching user data/bills:', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchAdminData = async (jwtToken: string) => {
    try {
      const [dashRes, usersRes, healthRes] = await Promise.all([
        fetch(API_ENDPOINTS.adminDashboard, { headers: { Authorization: `Bearer ${jwtToken}` } }),
        fetch(API_ENDPOINTS.adminUsers, { headers: { Authorization: `Bearer ${jwtToken}` } }),
        fetch(API_ENDPOINTS.adminSystemHealth, { headers: { Authorization: `Bearer ${jwtToken}` } }),
      ]);
      if (dashRes.ok) setAdminStats(await dashRes.json());
      if (usersRes.ok) setAdminUsers(await usersRes.json());
      if (healthRes.ok) setAdminHealth(await healthRes.json());
    } catch (e) {
      console.log('Admin fetch error:', e);
    }
  };

  // Helper fetch with timeout
  const fetchWithTimeout = async (url: string, options: any = {}, timeoutMs = 10000) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(id);
      return response;
    } catch (err) {
      clearTimeout(id);
      throw err;
    }
  };

  // Auth Operations
  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Required', 'Please enter your email address and password');
      return;
    }
    setLoading(true);
    try {
      const res = await fetchWithTimeout(API_ENDPOINTS.login, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      setLoading(false);
      if (res.ok) {
        setToken(data.access_token);
        setUser(data.user);
        fetchUserDataAndBills(data.access_token);
      } else {
        Alert.alert('Sign In Error', data.detail || 'Invalid credentials');
      }
    } catch (e: any) {
      setLoading(false);
      const msg = e.name === 'AbortError' ? 'Connection timed out. Ensure phone is on same Wi-Fi' : 'Cannot connect to BillVaultAI server';
      Alert.alert('Connection Error', msg);
    }
  };

  const handleRegister = async () => {
    if (!name || !email || !password) {
      Alert.alert('Required', 'Please fill in all fields');
      return;
    }
    setLoading(true);
    try {
      const res = await fetchWithTimeout(API_ENDPOINTS.register, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      setLoading(false);
      if (res.ok) {
        setToken(data.access_token);
        setUser(data.user);
        fetchUserDataAndBills(data.access_token);
      } else {
        Alert.alert('Registration Failed', data.detail || 'Failed to create account');
      }
    } catch (e: any) {
      setLoading(false);
      const msg = e.name === 'AbortError' ? 'Connection timed out. Ensure phone is on same Wi-Fi' : 'Cannot connect to server';
      Alert.alert('Connection Error', msg);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      Alert.alert('Required', 'Please enter your registered email address');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(API_ENDPOINTS.forgotPassword, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      setLoading(false);
      if (res.ok) {
        setOtpSent(true);
        Alert.alert('OTP Sent', data.message || 'OTP verification code sent to your email');
      } else {
        Alert.alert('Error', data.detail || 'Failed to send OTP code');
      }
    } catch (e) {
      setLoading(false);
      Alert.alert('Error', 'Server connection failed');
    }
  };

  const handleResetPassword = async () => {
    if (!otpCode || !newPassword) {
      Alert.alert('Required', 'Please enter OTP code and new password');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(API_ENDPOINTS.resetPassword, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp_code: otpCode, new_password: newPassword }),
      });
      const data = await res.json();
      setLoading(false);
      if (res.ok) {
        Alert.alert('Success', 'Password reset successfully! Please sign in.');
        setAuthScreen('login');
      } else {
        Alert.alert('Error', data.detail || 'Invalid OTP code');
      }
    } catch (e) {
      setLoading(false);
      Alert.alert('Error', 'Server connection failed');
    }
  };

  // Image & Document Pickers
  const pickCameraImage = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission Denied', 'Camera permission is required');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setUploadFile({
        uri: result.assets[0].uri,
        name: `camera_${Date.now()}.jpg`,
        type: 'image/jpeg',
      });
    }
  };

  const pickGalleryImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setUploadFile({
        uri: result.assets[0].uri,
        name: result.assets[0].fileName || `gallery_${Date.now()}.jpg`,
        type: 'image/jpeg',
      });
    }
  };

  const pickPdfDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/pdf'],
      });
      if (!result.canceled && result.assets[0]) {
        setUploadFile({
          uri: result.assets[0].uri,
          name: result.assets[0].name,
          type: result.assets[0].mimeType || 'application/pdf',
        });
      }
    } catch (e) {
      console.log('Doc picker error:', e);
    }
  };

  // Document Processing Upload
  const handleUploadDocument = async () => {
    if (!uploadFile || !token) return;
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', {
        uri: uploadFile.uri,
        name: uploadFile.name,
        type: uploadFile.type,
      } as any);

      const res = await fetch(API_ENDPOINTS.processDocument, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
        body: formData,
      });

      setIsUploading(false);
      if (res.ok) {
        const data = await res.json();
        setUploadSuccess(true);
        setTimeout(() => {
          setUploadSuccess(false);
          setUploadFile(null);
          setActiveTab('dashboard');
          fetchUserDataAndBills(token);
        }, 1800);
      } else {
        const errData = await res.json().catch(() => ({}));
        Alert.alert('Upload Failed', errData.detail || 'Limit reached or backend issue');
      }
    } catch (e) {
      setIsUploading(false);
      Alert.alert('Upload Error', 'Failed to upload document');
    }
  };

  // Mark Bill as Paid
  const handleMarkAsPaid = async (billId: number, currentBill: any) => {
    if (!token) return;
    try {
      const res = await fetch(API_ENDPOINTS.updateBill(billId), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          merchant_name: currentBill.merchant,
          invoice_number: currentBill.invoiceNumber,
          invoice_date: currentBill.date,
          invoice_total: currentBill.amount,
          tax_amount: currentBill.gst,
          payment_status: 'PAID',
          balance_due: 0,
          amount_paid: currentBill.amount,
          status_reason: 'Marked as Paid manually from Unpaid Registry',
        }),
      });
      if (res.ok) {
        Alert.alert('Success', 'Invoice marked as PAID!');
        if (selectedBillDetail) {
          setSelectedBillDetail({ ...selectedBillDetail, paymentStatus: 'PAID', balanceDue: 0, amountPaid: currentBill.amount });
        }
        fetchUserDataAndBills(token);
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to update payment status');
    }
  };

  // Get absolute URL for document/invoice image
  const getFullImageUrl = (rawUrl: string | null) => {
    if (!rawUrl) return null;
    if (rawUrl.startsWith('http://localhost:8000')) {
      return rawUrl.replace('http://localhost:8000', BASE_URL);
    }
    if (rawUrl.startsWith('http://127.0.0.1:8000')) {
      return rawUrl.replace('http://127.0.0.1:8000', BASE_URL);
    }
    if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
      return rawUrl;
    }
    return `${BASE_URL}${rawUrl.startsWith('/') ? '' : '/'}${rawUrl}`;
  };

  // Delete Invoice
  const handleDeleteBill = async (billId: number) => {
    if (!token) return;
    Alert.alert(
      'Delete Invoice',
      'Are you sure you want to delete this invoice permanently?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await fetch(API_ENDPOINTS.deleteBill(billId), {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
              });
              if (res.ok) {
                Alert.alert('Deleted', 'Invoice deleted successfully');
                setSelectedBillDetail(null);
                fetchUserDataAndBills(token);
              } else {
                Alert.alert('Error', 'Failed to delete bill');
              }
            } catch (e) {
              Alert.alert('Error', 'Server connection error');
            }
          },
        },
      ]
    );
  };

  // Upgrade Plan
  const handleUpgradePlan = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/api/auth/upgrade`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      setLoading(false);
      if (res.ok) {
        Alert.alert('Plan Upgraded', 'Your account has been upgraded to Pro Plan!');
        fetchUserDataAndBills(token);
      } else {
        Alert.alert('Failed', 'Upgrade failed');
      }
    } catch (e) {
      setLoading(false);
      Alert.alert('Error', 'Server connection failed');
    }
  };

  // Submit Feedback
  const handleSubmitFeedback = async () => {
    if (!token || !feedbackComment) {
      Alert.alert('Required', 'Please enter your feedback comments');
      return;
    }
    try {
      const res = await fetch(API_ENDPOINTS.feedback, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          rating: feedbackRating,
          comment: `[${feedbackType.toUpperCase()}] ${feedbackComment}`,
        }),
      });
      if (res.ok) {
        setFeedbackSubmitted(true);
        setTimeout(() => {
          setFeedbackSubmitted(false);
          setFeedbackComment('');
          setActiveTab('dashboard');
        }, 2000);
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to submit feedback');
    }
  };

  // Calculating Financial Metrics
  const totalAmount = bills.reduce((acc, b) => acc + (b.amount || 0), 0);
  const paidAmount = bills
    .filter((b) => b.paymentStatus === 'PAID')
    .reduce((acc, b) => acc + (b.amount || 0), 0);
  const unpaidAmount = bills
    .filter((b) => ['UNPAID', 'PARTIALLY_PAID', 'OVERDUE'].includes(b.paymentStatus || ''))
    .reduce((acc, b) => acc + (b.balanceDue || b.amount || 0), 0);
  const overdueAmount = bills
    .filter((b) => b.paymentStatus === 'OVERDUE')
    .reduce((acc, b) => acc + (b.balanceDue || b.amount || 0), 0);

  // Category Filtered Bills
  const filteredBills = bills.filter((b) => {
    const matchesSearch =
      (b.merchant || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (b.invoiceNumber || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || (b.category || 'Office') === selectedCategory;
    const matchesStatus =
      selectedStatusFilter === 'All' ||
      (b.paymentStatus || 'UNKNOWN').toUpperCase() === selectedStatusFilter.toUpperCase();
    return matchesSearch && matchesCategory && matchesStatus;
  });

  // 1. Splash Screen View
  if (authScreen === 'splash') {
    return (
      <SafeAreaView style={[styles.container, styles.centerContent]}>
        <StatusBar barStyle="light-content" />
        <View style={styles.splashLogoContainer}>
          <View style={styles.splashGlowRing} />
          <View style={styles.logoBadgeLarge}>
            <Text style={styles.logoBadgeTextLarge}>⚡</Text>
          </View>
        </View>
        <Text style={styles.splashTitle}>BillVaultAI</Text>
        <Text style={styles.splashSubtitle}>Aura Intelligent Invoice & Billing Suite</Text>
        <ActivityIndicator size="large" color="#06B6D4" style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  // 2. Authentication Flow View
  if (!token || !user) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" />
        <ScrollView contentContainerStyle={styles.authContainer}>
          <View style={styles.logoContainer}>
            <View style={styles.logoBadge}>
              <Text style={styles.logoBadgeText}>⚡</Text>
            </View>
            <Text style={styles.title}>BillVaultAI</Text>
            <Text style={styles.subtitle}>Aura Intelligent Billing Suite</Text>
          </View>

          <View style={styles.glassCard}>
            <Text style={styles.cardHeader}>
              {authScreen === 'login'
                ? 'Sign In'
                : authScreen === 'register'
                ? 'Create Account'
                : 'Password Recovery'}
            </Text>

            {authScreen === 'register' && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Full Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="John Doe"
                  placeholderTextColor="#64748B"
                  value={name}
                  onChangeText={setName}
                />
              </View>
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email Address</Text>
              <TextInput
                style={styles.input}
                placeholder="user@company.com"
                placeholderTextColor="#64748B"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            {authScreen !== 'forgot' && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Password</Text>
                <View style={{ position: 'relative' }}>
                  <TextInput
                    style={styles.input}
                    placeholder="••••••••"
                    placeholderTextColor="#64748B"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                  />
                  <TouchableOpacity
                    style={styles.eyeBtn}
                    onPress={() => setShowPassword(!showPassword)}
                  >
                    <Text style={{ color: '#94A3B8', fontSize: 12 }}>
                      {showPassword ? 'HIDE' : 'SHOW'}
                    </Text>
                  </TouchableOpacity>
                </View>
                {authScreen === 'register' && (
                  <Text style={{ color: '#94A3B8', fontSize: 11, marginTop: 4 }}>
                    Password must be 8+ chars with Uppercase, Lowercase, Number & Special character (e.g. Pass123!).
                  </Text>
                )}
              </View>
            )}

            {authScreen === 'forgot' && otpSent && (
              <>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>6-Digit Verification Code</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="123456"
                    placeholderTextColor="#64748B"
                    value={otpCode}
                    onChangeText={setOtpCode}
                    keyboardType="number-pad"
                  />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>New Password</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Min 8 characters"
                    placeholderTextColor="#64748B"
                    value={newPassword}
                    onChangeText={setNewPassword}
                    secureTextEntry
                  />
                </View>
              </>
            )}

            {authScreen === 'login' && (
              <TouchableOpacity
                onPress={() => setAuthScreen('forgot')}
                style={styles.forgotBtn}
              >
                <Text style={styles.forgotText}>Forgot Password?</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={
                authScreen === 'login'
                  ? handleLogin
                  : authScreen === 'register'
                  ? handleRegister
                  : otpSent
                  ? handleResetPassword
                  : handleForgotPassword
              }
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.primaryBtnText}>
                  {authScreen === 'login'
                    ? 'Sign In to Vault'
                    : authScreen === 'register'
                    ? 'Create Account'
                    : otpSent
                    ? 'Update Password'
                    : 'Send Verification OTP'}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                setAuthScreen(authScreen === 'login' ? 'register' : 'login');
                setOtpSent(false);
              }}
              style={styles.switchBtn}
            >
              <Text style={styles.switchText}>
                {authScreen === 'login'
                  ? "Don't have an account? Register"
                  : 'Already have an account? Sign In'}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // 3. Main Authenticated Application
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* App Top Header Bar */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.avatar}
            onPress={() => setActiveTab('profile')}
          >
            <Text style={styles.avatarText}>
              {user.name ? user.name[0].toUpperCase() : 'U'}
            </Text>
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>Welcome, {user.name}</Text>
            <Text style={styles.headerSub}>{user.plan} Member • BillVaultAI</Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {/* Notifications Bell */}
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => setShowNotifications(!showNotifications)}
          >
            <Text style={{ fontSize: 16 }}>🔔</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              setToken(null);
              setUser(null);
            }}
            style={styles.logoutBtn}
          >
            <Text style={styles.logoutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Notifications Dropdown Panel */}
      {showNotifications && (
        <View style={styles.notificationsPanel}>
          <Text style={styles.notifHeader}>Notifications & Alerts</Text>
          <View style={styles.notifItem}>
            <Text style={styles.notifTitle}>🎉 Welcome to BillVaultAI!</Text>
            <Text style={styles.notifBody}>Your account is initialized with full OCR extraction.</Text>
          </View>
          {overdueAmount > 0 && (
            <View style={[styles.notifItem, { borderColor: '#F43F5E' }]}>
              <Text style={[styles.notifTitle, { color: '#F43F5E' }]}>⚠️ Overdue Invoice Alert</Text>
              <Text style={styles.notifBody}>
                You have ₹{overdueAmount.toFixed(2)} in overdue liabilities.
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Body Content Router */}
      <ScrollView contentContainerStyle={styles.contentBody}>
        {/* DASHBOARD TAB */}
        {activeTab === 'dashboard' && (
          <View>
            {/* Top KPI Cards Grid */}
            <View style={styles.kpiGrid}>
              <View style={[styles.kpiTile, { borderColor: '#3B82F6' }]}>
                <Text style={styles.kpiTileLbl}>TOTAL INVOICES</Text>
                <Text style={styles.kpiTileVal}>{bills.length}</Text>
                <Text style={styles.kpiTileSub}>All-time count</Text>
              </View>
              <View style={[styles.kpiTile, { borderColor: '#A855F7' }]}>
                <Text style={styles.kpiTileLbl}>BILLED VOLUME</Text>
                <Text style={styles.kpiTileVal}>₹{totalAmount.toFixed(0)}</Text>
                <Text style={styles.kpiTileSub}>Gross total</Text>
              </View>
              <View style={[styles.kpiTile, { borderColor: '#10B981' }]}>
                <Text style={styles.kpiTileLbl}>TOTAL SETTLED</Text>
                <Text style={[styles.kpiTileVal, { color: '#10B981' }]}>₹{paidAmount.toFixed(0)}</Text>
                <Text style={styles.kpiTileSub}>Paid in full</Text>
              </View>
              <View style={[styles.kpiTile, { borderColor: '#F59E0B' }]}>
                <Text style={styles.kpiTileLbl}>OUTSTANDING</Text>
                <Text style={[styles.kpiTileVal, { color: '#F59E0B' }]}>₹{unpaidAmount.toFixed(0)}</Text>
                <Text style={styles.kpiTileSub}>Awaiting payment</Text>
              </View>
            </View>

            {/* AI Insight Card */}
            <View style={styles.aiInsightCard}>
              <View style={styles.aiHeaderRow}>
                <Text style={{ fontSize: 20 }}>⚡</Text>
                <Text style={styles.aiTitle}>AI Spatial Insight</Text>
              </View>
              <Text style={styles.aiBody}>
                {bills.length > 0
                  ? `Your BillVault AI processed ₹${totalAmount.toFixed(2)}. Outstanding due balance is ₹${unpaidAmount.toFixed(2)} across ${bills.filter((b) => b.paymentStatus !== 'PAID').length} invoices.`
                  : 'Welcome! Tap the + Floating button below to upload your first bill and activate real-time AI insights.'}
              </Text>
            </View>

            {/* Search Bar */}
            <View style={styles.searchRow}>
              <TextInput
                style={styles.searchInput}
                placeholder="Search merchant or invoice #..."
                placeholderTextColor="#64748B"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>

            {/* Recent Bills List */}
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionHeader}>Recent Invoices ({filteredBills.length})</Text>
              <TouchableOpacity onPress={() => setActiveTab('history')}>
                <Text style={styles.linkText}>View All ›</Text>
              </TouchableOpacity>
            </View>

            {filteredBills.slice(0, 6).map((b, idx) => (
              <TouchableOpacity
                key={idx}
                style={styles.billCard}
                onPress={() => setSelectedBillDetail(b)}
              >
                <View style={styles.billRow}>
                  <Text style={styles.merchantText}>
                    {b.merchant || b.merchant_name || 'Merchant'}
                  </Text>
                  <Text style={styles.amountText}>
                    ₹{(b.amount || b.invoice_total || 0).toFixed(2)}
                  </Text>
                </View>
                <View style={styles.billRow}>
                  <Text style={styles.dateText}>
                    Inv #{b.invoiceNumber || b.invoice_number || 'N/A'} • {b.date || b.invoice_date || 'Today'}
                  </Text>
                  <View
                    style={[
                      styles.statusPill,
                      b.paymentStatus === 'PAID'
                        ? styles.statusPaid
                        : b.paymentStatus === 'OVERDUE'
                        ? styles.statusOverdue
                        : styles.statusUnpaid,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusPillTxt,
                        b.paymentStatus === 'PAID'
                          ? styles.statusPaidTxt
                          : b.paymentStatus === 'OVERDUE'
                          ? styles.statusOverdueTxt
                          : styles.statusUnpaidTxt,
                      ]}
                    >
                      {(b.paymentStatus || 'UNPAID').toUpperCase()}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* UPLOAD / SCAN TAB */}
        {activeTab === 'upload' && (
          <View>
            <Text style={styles.sectionHeader}>AI Ingestion & Upload</Text>

            {uploadSuccess ? (
              <View style={styles.successBox}>
                <Text style={{ fontSize: 48, marginBottom: 12 }}>🎉</Text>
                <Text style={styles.successTitle}>Invoice Queued!</Text>
                <Text style={styles.successBody}>
                  Your invoice is now processing in the background with YOLOv8 & PaddleOCR.
                </Text>
              </View>
            ) : (
              <View>
                {/* Upload Method Buttons */}
                <View style={styles.uploadOptionsGrid}>
                  <TouchableOpacity style={styles.uploadTile} onPress={pickCameraImage}>
                    <Text style={{ fontSize: 28, marginBottom: 6 }}>📷</Text>
                    <Text style={styles.uploadTileTitle}>Take Photo</Text>
                    <Text style={styles.uploadTileSub}>Use camera</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.uploadTile} onPress={pickGalleryImage}>
                    <Text style={{ fontSize: 28, marginBottom: 6 }}>🖼️</Text>
                    <Text style={styles.uploadTileTitle}>Gallery</Text>
                    <Text style={styles.uploadTileSub}>Choose image</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.uploadTile} onPress={pickPdfDocument}>
                    <Text style={{ fontSize: 28, marginBottom: 6 }}>📄</Text>
                    <Text style={styles.uploadTileTitle}>PDF Document</Text>
                    <Text style={styles.uploadTileSub}>Pick file</Text>
                  </TouchableOpacity>
                </View>

                {/* Selected File Preview Box */}
                {uploadFile && (
                  <View style={styles.previewBox}>
                    <Text style={styles.previewTitle}>Selected File for AI Extraction:</Text>
                    <Text style={styles.previewName}>{uploadFile.name}</Text>
                    {uploadFile.type.includes('image') && (
                      <Image source={{ uri: uploadFile.uri }} style={styles.previewImage} />
                    )}

                    <TouchableOpacity
                      style={styles.primaryBtn}
                      onPress={handleUploadDocument}
                      disabled={isUploading}
                    >
                      {isUploading ? (
                        <ActivityIndicator color="#FFF" />
                      ) : (
                        <Text style={styles.primaryBtnText}>Process with AI Engine</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}
          </View>
        )}

        {/* HISTORY / VAULT TAB */}
        {activeTab === 'history' && (
          <View>
            <Text style={styles.sectionHeader}>Invoice History ({filteredBills.length})</Text>

            {/* Category Filter Chips */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              {['All', 'Office', 'Travel', 'Food', 'Utilities', 'Medical', 'Electronics'].map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.chip, selectedCategory === cat && styles.chipActive]}
                  onPress={() => setSelectedCategory(cat)}
                >
                  <Text style={[styles.chipTxt, selectedCategory === cat && styles.chipTxtActive]}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {filteredBills.map((b, idx) => (
              <TouchableOpacity
                key={idx}
                style={styles.billCard}
                onPress={() => setSelectedBillDetail(b)}
              >
                <View style={styles.billRow}>
                  <Text style={styles.merchantText}>{b.merchant || b.merchant_name || 'Merchant'}</Text>
                  <Text style={styles.amountText}>₹{(b.amount || b.invoice_total || 0).toFixed(2)}</Text>
                </View>
                <Text style={styles.dateText}>
                  Inv #{b.invoiceNumber || b.invoice_number || 'N/A'} • {b.date || b.invoice_date} • Category: {b.category || 'Office'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* UNPAID / ANALYTICS REGISTRY TAB */}
        {activeTab === 'analytics' && (
          <View>
            <Text style={styles.sectionHeader}>Unpaid Invoices Registry</Text>

            {/* Overdue Alert Banner */}
            {overdueAmount > 0 && (
              <View style={styles.alertCard}>
                <Text style={styles.alertTitle}>⚠️ Overdue Liability: ₹{overdueAmount.toFixed(2)}</Text>
                <Text style={styles.alertBody}>
                  Review and settle overdue invoices below to maintain vendor relationships.
                </Text>
              </View>
            )}

            {/* Unpaid Bills Table List */}
            {bills
              .filter((b) => ['UNPAID', 'PARTIALLY_PAID', 'OVERDUE'].includes((b.paymentStatus || '').toUpperCase()))
              .map((b, idx) => (
                <View key={idx} style={styles.billCard}>
                  <View style={styles.billRow}>
                    <View>
                      <Text style={styles.merchantText}>{b.merchant || 'Vendor'}</Text>
                      <Text style={styles.dateText}>Due: {b.dueDate || b.date || 'Immediate'}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[styles.amountText, { color: '#F59E0B' }]}>
                        ₹{(b.balanceDue || b.amount || 0).toFixed(2)}
                      </Text>
                      <TouchableOpacity
                        style={styles.payBtn}
                        onPress={() => handleMarkAsPaid(b.id, b)}
                      >
                        <Text style={styles.payBtnTxt}>✓ PAY NOW</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ))}
          </View>
        )}

        {/* PROFILE & SUBSCRIPTION TAB */}
        {activeTab === 'profile' && (
          <View>
            <View style={styles.glassCard}>
              <View style={styles.profileRow}>
                <View style={styles.avatarLarge}>
                  <Text style={styles.avatarTxtLarge}>
                    {user.name ? user.name[0].toUpperCase() : 'U'}
                  </Text>
                </View>
                <View>
                  <Text style={styles.profileName}>{user.name}</Text>
                  <Text style={styles.profileEmail}>{user.email}</Text>
                  <Text style={styles.planBadge}>{user.plan || 'Free'} Plan Member</Text>
                </View>
              </View>
            </View>

            {/* Usage Quota Card */}
            <View style={styles.glassCard}>
              <Text style={styles.cardHeader}>Monthly Upload Quota</Text>
              <Text style={styles.dateText}>
                {user.uploads_used || 0} of {user.uploads_limit || 10} uploads used
              </Text>
            </View>

            {/* Upgrade Card */}
            {user.plan === 'Free' && (
              <View style={styles.upgradeCard}>
                <Text style={styles.upgradeTitle}>Upgrade to Pro Tier</Text>
                <Text style={styles.upgradeBody}>
                  Unlock unlimited uploads, export to PDF forms, and priority processing.
                </Text>
                <TouchableOpacity style={styles.upgradeBtn} onPress={handleUpgradePlan}>
                  <Text style={styles.upgradeBtnTxt}>Upgrade for ₹799/mo</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* ADMIN TAB */}
        {activeTab === 'admin' && adminStats && (
          <View>
            <Text style={styles.sectionHeader}>Admin Operations Console</Text>

            <View style={styles.kpiGrid}>
              <View style={styles.adminCard}>
                <Text style={styles.adminVal}>{adminStats.total_users || 0}</Text>
                <Text style={styles.adminLbl}>Total Accounts</Text>
              </View>
              <View style={styles.adminCard}>
                <Text style={styles.adminVal}>{adminStats.total_bills_processed || 0}</Text>
                <Text style={styles.adminLbl}>OCR Bills</Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Bill Detail Inspector Modal */}
      {selectedBillDetail && (
        <Modal visible animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              {/* Modal Header */}
              <View style={styles.modalHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalTitle} numberOfLines={1}>
                    {selectedBillDetail.merchant || 'Invoice Details'}
                  </Text>
                  <Text style={styles.modalSubTitle}>
                    Inv #{selectedBillDetail.invoiceNumber || 'N/A'} • {selectedBillDetail.category || 'Office'}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.closeCircleBtn}
                  onPress={() => setSelectedBillDetail(null)}
                >
                  <Text style={styles.closeBtn}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
                {/* 1. Document / Invoice Image Preview Section */}
                <View style={styles.imageCardContainer}>
                  <View style={styles.imageCardHeader}>
                    <Text style={styles.imageCardHeaderTxt}>📷 ORIGINAL INVOICE DOCUMENT</Text>
                    {selectedBillDetail.imageUrl && (
                      <TouchableOpacity
                        onPress={() =>
                          setFullImageModal(getFullImageUrl(selectedBillDetail.imageUrl))
                        }
                      >
                        <Text style={styles.expandImgBtnTxt}>🔍 Expand</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {selectedBillDetail.imageUrl ? (
                    <TouchableOpacity
                      activeOpacity={0.9}
                      onPress={() =>
                        setFullImageModal(getFullImageUrl(selectedBillDetail.imageUrl))
                      }
                      style={styles.imagePreviewTouchable}
                    >
                      <Image
                        source={{ uri: getFullImageUrl(selectedBillDetail.imageUrl) || '' }}
                        style={styles.invoiceDetailImage}
                        resizeMode="contain"
                      />
                      <View style={styles.zoomHintOverlay}>
                        <Text style={styles.zoomHintTxt}>🔍 Tap to View Full Screen Document</Text>
                      </View>
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.noImagePlaceholder}>
                      <Text style={{ fontSize: 36, marginBottom: 6 }}>📄</Text>
                      <Text style={styles.noImageTxt}>Document image preview not available</Text>
                    </View>
                  )}
                </View>

                {/* 2. Key Amount & Status Banner */}
                <View style={styles.amountBanner}>
                  <View>
                    <Text style={styles.amountBannerLbl}>TOTAL BILLED AMOUNT</Text>
                    <Text style={styles.amountBannerVal}>
                      ₹{(selectedBillDetail.amount || 0).toFixed(2)}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.statusPillLarge,
                      selectedBillDetail.paymentStatus === 'PAID'
                        ? styles.statusPaid
                        : selectedBillDetail.paymentStatus === 'OVERDUE'
                        ? styles.statusOverdue
                        : styles.statusUnpaid,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusPillTxtLarge,
                        selectedBillDetail.paymentStatus === 'PAID'
                          ? styles.statusPaidTxt
                          : selectedBillDetail.paymentStatus === 'OVERDUE'
                          ? styles.statusOverdueTxt
                          : styles.statusUnpaidTxt,
                      ]}
                    >
                      {(selectedBillDetail.paymentStatus || 'UNPAID').toUpperCase()}
                    </Text>
                  </View>
                </View>

                {/* 3. Breakdown Grid Cards */}
                <View style={styles.detailGrid}>
                  <View style={styles.detailGridTile}>
                    <Text style={styles.detailGridLbl}>Subtotal</Text>
                    <Text style={styles.detailGridVal}>
                      ₹{(selectedBillDetail.subtotal || 0).toFixed(2)}
                    </Text>
                  </View>

                  <View style={styles.detailGridTile}>
                    <Text style={styles.detailGridLbl}>Tax / GST</Text>
                    <Text style={styles.detailGridVal}>
                      ₹{(selectedBillDetail.gst || 0).toFixed(2)}
                    </Text>
                  </View>

                  <View style={styles.detailGridTile}>
                    <Text style={styles.detailGridLbl}>Balance Due</Text>
                    <Text style={[styles.detailGridVal, { color: '#F59E0B' }]}>
                      ₹{(selectedBillDetail.balanceDue || 0).toFixed(2)}
                    </Text>
                  </View>

                  <View style={styles.detailGridTile}>
                    <Text style={styles.detailGridLbl}>Amount Paid</Text>
                    <Text style={[styles.detailGridVal, { color: '#10B981' }]}>
                      ₹{(selectedBillDetail.amountPaid || 0).toFixed(2)}
                    </Text>
                  </View>
                </View>

                {/* 4. Metadata Details Section */}
                <View style={styles.metadataCard}>
                  <Text style={styles.metadataSectionTitle}>Extraction Metadata</Text>

                  <View style={styles.metaRow}>
                    <Text style={styles.metaKey}>Invoice Date</Text>
                    <Text style={styles.metaVal}>{selectedBillDetail.date || 'N/A'}</Text>
                  </View>

                  <View style={styles.metaRow}>
                    <Text style={styles.metaKey}>Due Date</Text>
                    <Text style={styles.metaVal}>{selectedBillDetail.dueDate || 'N/A'}</Text>
                  </View>

                  <View style={styles.metaRow}>
                    <Text style={styles.metaKey}>Vendor GSTIN</Text>
                    <Text style={styles.metaVal}>{selectedBillDetail.gstNumber || 'Not detected'}</Text>
                  </View>

                  <View style={styles.metaRow}>
                    <Text style={styles.metaKey}>Payment Method</Text>
                    <Text style={styles.metaVal}>{selectedBillDetail.paymentMethod || 'Not specified'}</Text>
                  </View>

                  <View style={styles.metaRow}>
                    <Text style={styles.metaKey}>Transaction ID</Text>
                    <Text style={styles.metaVal}>{selectedBillDetail.transactionId || 'N/A'}</Text>
                  </View>

                  {selectedBillDetail.paymentTerms && (
                    <View style={styles.metaRow}>
                      <Text style={styles.metaKey}>Payment Terms</Text>
                      <Text style={styles.metaVal}>{selectedBillDetail.paymentTerms}</Text>
                    </View>
                  )}

                  {selectedBillDetail.notes && (
                    <View style={styles.metaRow}>
                      <Text style={styles.metaKey}>Notes</Text>
                      <Text style={styles.metaVal}>{selectedBillDetail.notes}</Text>
                    </View>
                  )}

                  {/* AI Confidence Score Meter */}
                  <View style={{ marginTop: 12 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text style={styles.metaKey}>AI Extraction Confidence</Text>
                      <Text style={{ color: '#06B6D4', fontWeight: 'bold', fontSize: 12 }}>
                        {selectedBillDetail.confidence || 95}%
                      </Text>
                    </View>
                    <View style={styles.confMeterTrack}>
                      <View
                        style={[
                          styles.confMeterFill,
                          { width: `${Math.min(100, selectedBillDetail.confidence || 95)}%` },
                        ]}
                      />
                    </View>
                  </View>
                </View>

                {/* 5. Collapsible Raw OCR Accordion */}
                <TouchableOpacity
                  style={styles.accordionToggleBtn}
                  onPress={() => setShowRawOcr(!showRawOcr)}
                >
                  <Text style={styles.accordionToggleTxt}>
                    {showRawOcr ? '▼ Hide Raw OCR Text' : '▶ Show Raw OCR Text'}
                  </Text>
                </TouchableOpacity>

                {showRawOcr && (
                  <View style={styles.ocrBox}>
                    <ScrollView nestedScrollEnabled style={{ maxHeight: 150 }}>
                      <Text style={styles.ocrTxt}>
                        {selectedBillDetail.rawOCR || 'No raw OCR text available.'}
                      </Text>
                    </ScrollView>
                  </View>
                )}

                {/* 6. Action Toolbar */}
                <View style={styles.modalActionRow}>
                  {selectedBillDetail.paymentStatus !== 'PAID' && (
                    <TouchableOpacity
                      style={styles.markPaidActionBtn}
                      onPress={() => handleMarkAsPaid(selectedBillDetail.id, selectedBillDetail)}
                    >
                      <Text style={styles.markPaidActionTxt}>✓ Mark as Paid</Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    style={styles.deleteActionBtn}
                    onPress={() => handleDeleteBill(selectedBillDetail.id)}
                  >
                    <Text style={styles.deleteActionTxt}>🗑️ Delete</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}

      {/* Full-Screen Zoom Image Preview Modal */}
      {fullImageModal && (
        <Modal visible animationType="fade" transparent>
          <SafeAreaView style={styles.fullScreenImageOverlay}>
            <TouchableOpacity
              style={styles.fullScreenCloseBtn}
              onPress={() => setFullImageModal(null)}
            >
              <Text style={styles.fullScreenCloseTxt}>✕ CLOSE PREVIEW</Text>
            </TouchableOpacity>
            <Image
              source={{ uri: fullImageModal }}
              style={styles.fullScreenImage}
              resizeMode="contain"
            />
          </SafeAreaView>
        </Modal>
      )}

      {/* Bottom Floating Navigation Bar */}
      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('dashboard')}>
          <Text style={[styles.navText, activeTab === 'dashboard' && styles.navActive]}>Dashboard</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('history')}>
          <Text style={[styles.navText, activeTab === 'history' && styles.navActive]}>History</Text>
        </TouchableOpacity>

        {/* Floating Plus Upload Button */}
        <TouchableOpacity
          style={styles.fabBtn}
          onPress={() => setActiveTab('upload')}
        >
          <Text style={styles.fabBtnTxt}>+</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('analytics')}>
          <Text style={[styles.navText, activeTab === 'analytics' && styles.navActive]}>Unpaid</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('profile')}>
          <Text style={[styles.navText, activeTab === 'profile' && styles.navActive]}>Profile</Text>
        </TouchableOpacity>

        {user.is_admin && (
          <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('admin')}>
            <Text style={[styles.navText, activeTab === 'admin' && styles.navActive]}>Admin</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0F17',
  },
  centerContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  splashLogoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  splashGlowRing: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(6, 182, 212, 0.2)',
  },
  logoBadgeLarge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#06B6D4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoBadgeTextLarge: {
    fontSize: 44,
  },
  splashTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#F8FAFC',
  },
  splashSubtitle: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 6,
  },
  authContainer: {
    padding: 24,
    justifyContent: 'center',
    minHeight: '100%',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 28,
  },
  logoBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#06B6D4',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  logoBadgeText: {
    fontSize: 32,
    color: '#FFF',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#F8FAFC',
  },
  subtitle: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 4,
  },
  glassCard: {
    backgroundColor: 'rgba(22, 31, 48, 0.8)',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#2A3852',
    marginBottom: 16,
  },
  cardHeader: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#F8FAFC',
    marginBottom: 14,
  },
  inputGroup: {
    marginBottom: 14,
  },
  label: {
    fontSize: 13,
    color: '#94A3B8',
    marginBottom: 6,
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#0B0F17',
    borderWidth: 1,
    borderColor: '#2A3852',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#F8FAFC',
    fontSize: 15,
  },
  eyeBtn: {
    position: 'absolute',
    right: 14,
    top: 14,
  },
  forgotBtn: {
    alignSelf: 'flex-end',
    marginBottom: 16,
  },
  forgotText: {
    color: '#06B6D4',
    fontSize: 13,
  },
  primaryBtn: {
    backgroundColor: '#06B6D4',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryBtnText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  switchBtn: {
    marginTop: 16,
    alignItems: 'center',
  },
  switchText: {
    color: '#94A3B8',
    fontSize: 13,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#2A3852',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#06B6D4',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 18,
  },
  headerTitle: {
    color: '#F8FAFC',
    fontWeight: 'bold',
    fontSize: 15,
  },
  headerSub: {
    color: '#94A3B8',
    fontSize: 11,
  },
  iconBtn: {
    padding: 8,
    backgroundColor: '#161F30',
    borderRadius: 8,
  },
  logoutBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(244, 63, 94, 0.15)',
  },
  logoutText: {
    color: '#F43F5E',
    fontSize: 12,
    fontWeight: 'bold',
  },
  notificationsPanel: {
    backgroundColor: '#161F30',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2A3852',
  },
  notifHeader: {
    color: '#F8FAFC',
    fontWeight: 'bold',
    fontSize: 14,
    marginBottom: 8,
  },
  notifItem: {
    padding: 10,
    backgroundColor: '#0B0F17',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#06B6D4',
    marginBottom: 6,
  },
  notifTitle: {
    color: '#F8FAFC',
    fontWeight: 'bold',
    fontSize: 12,
  },
  notifBody: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2,
  },
  contentBody: {
    padding: 20,
    paddingBottom: 100,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  kpiTile: {
    width: '48%',
    backgroundColor: '#161F30',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  kpiTileLbl: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: 'bold',
  },
  kpiTileVal: {
    color: '#F8FAFC',
    fontSize: 20,
    fontWeight: 'bold',
    marginVertical: 4,
  },
  kpiTileSub: {
    color: '#64748B',
    fontSize: 10,
  },
  aiInsightCard: {
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#06B6D4',
    marginBottom: 16,
  },
  aiHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  aiTitle: {
    color: '#06B6D4',
    fontWeight: 'bold',
    fontSize: 14,
  },
  aiBody: {
    color: '#F8FAFC',
    fontSize: 12,
    lineHeight: 18,
  },
  searchRow: {
    marginBottom: 16,
  },
  searchInput: {
    backgroundColor: '#161F30',
    borderWidth: 1,
    borderColor: '#2A3852',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#F8FAFC',
    fontSize: 13,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionHeader: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  linkText: {
    color: '#06B6D4',
    fontSize: 12,
    fontWeight: 'bold',
  },
  billCard: {
    backgroundColor: '#161F30',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#2A3852',
  },
  billRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  merchantText: {
    color: '#F8FAFC',
    fontWeight: 'bold',
    fontSize: 15,
  },
  amountText: {
    color: '#10B981',
    fontWeight: 'bold',
    fontSize: 15,
  },
  dateText: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 4,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  statusPillTxt: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  statusPaid: { backgroundColor: 'rgba(16, 185, 129, 0.15)' },
  statusPaidTxt: { color: '#10B981' },
  statusOverdue: { backgroundColor: 'rgba(244, 63, 94, 0.15)' },
  statusOverdueTxt: { color: '#F43F5E' },
  statusUnpaid: { backgroundColor: 'rgba(245, 158, 11, 0.15)' },
  statusUnpaidTxt: { color: '#F59E0B' },
  uploadOptionsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  uploadTile: {
    width: '31%',
    backgroundColor: '#161F30',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2A3852',
  },
  uploadTileTitle: {
    color: '#F8FAFC',
    fontWeight: 'bold',
    fontSize: 12,
  },
  uploadTileSub: {
    color: '#64748B',
    fontSize: 10,
    marginTop: 2,
  },
  previewBox: {
    backgroundColor: '#161F30',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#06B6D4',
  },
  previewTitle: {
    color: '#06B6D4',
    fontWeight: 'bold',
    fontSize: 13,
  },
  previewName: {
    color: '#F8FAFC',
    fontSize: 14,
    marginVertical: 8,
  },
  previewImage: {
    width: '100%',
    height: 180,
    borderRadius: 8,
    marginVertical: 12,
  },
  successBox: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#10B981',
  },
  successTitle: {
    color: '#10B981',
    fontSize: 20,
    fontWeight: 'bold',
  },
  successBody: {
    color: '#F8FAFC',
    textAlign: 'center',
    marginTop: 6,
    fontSize: 13,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#161F30',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#2A3852',
  },
  chipActive: {
    backgroundColor: '#06B6D4',
    borderColor: '#06B6D4',
  },
  chipTxt: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  chipTxtActive: {
    color: '#FFF',
  },
  alertCard: {
    backgroundColor: 'rgba(244, 63, 94, 0.15)',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#F43F5E',
    marginBottom: 16,
  },
  alertTitle: {
    color: '#F43F5E',
    fontWeight: 'bold',
    fontSize: 14,
  },
  alertBody: {
    color: '#F8FAFC',
    fontSize: 12,
    marginTop: 4,
  },
  payBtn: {
    backgroundColor: '#10B981',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    marginTop: 6,
  },
  payBtnTxt: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarLarge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#06B6D4',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  avatarTxtLarge: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: 'bold',
  },
  profileName: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: 'bold',
  },
  profileEmail: {
    color: '#94A3B8',
    fontSize: 13,
  },
  planBadge: {
    color: '#10B981',
    fontSize: 11,
    fontWeight: 'bold',
    marginTop: 4,
  },
  upgradeCard: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  upgradeTitle: {
    color: '#F59E0B',
    fontSize: 16,
    fontWeight: 'bold',
  },
  upgradeBody: {
    color: '#F8FAFC',
    fontSize: 12,
    marginVertical: 6,
  },
  upgradeBtn: {
    backgroundColor: '#F59E0B',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  upgradeBtnTxt: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 13,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#161F30',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalSubTitle: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
  },
  closeCircleBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#0B0F17',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtn: {
    color: '#94A3B8',
    fontSize: 16,
    fontWeight: 'bold',
  },
  imageCardContainer: {
    backgroundColor: '#0B0F17',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#2A3852',
    marginBottom: 16,
  },
  imageCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  imageCardHeaderTxt: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: 'bold',
  },
  expandImgBtnTxt: {
    color: '#06B6D4',
    fontSize: 11,
    fontWeight: 'bold',
  },
  imagePreviewTouchable: {
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#161F30',
  },
  invoiceDetailImage: {
    width: '100%',
    height: 220,
    borderRadius: 12,
  },
  zoomHintOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(11, 15, 23, 0.8)',
    paddingVertical: 6,
    alignItems: 'center',
  },
  zoomHintTxt: {
    color: '#F8FAFC',
    fontSize: 11,
    fontWeight: '600',
  },
  noImagePlaceholder: {
    height: 140,
    backgroundColor: '#161F30',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noImageTxt: {
    color: '#64748B',
    fontSize: 12,
  },
  amountBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(6, 182, 212, 0.12)',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#06B6D4',
    marginBottom: 16,
  },
  amountBannerLbl: {
    color: '#06B6D4',
    fontSize: 10,
    fontWeight: 'bold',
  },
  amountBannerVal: {
    color: '#F8FAFC',
    fontSize: 26,
    fontWeight: 'bold',
    marginTop: 2,
  },
  statusPillLarge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusPillTxtLarge: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  detailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  detailGridTile: {
    width: '48%',
    backgroundColor: '#0B0F17',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2A3852',
    marginBottom: 10,
  },
  detailGridLbl: {
    color: '#94A3B8',
    fontSize: 11,
  },
  detailGridVal: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: 'bold',
    marginTop: 4,
  },
  metadataCard: {
    backgroundColor: '#0B0F17',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2A3852',
    marginBottom: 16,
  },
  metadataSectionTitle: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(42, 56, 82, 0.5)',
  },
  metaKey: {
    color: '#94A3B8',
    fontSize: 12,
  },
  metaVal: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '600',
  },
  confMeterTrack: {
    height: 6,
    backgroundColor: '#161F30',
    borderRadius: 3,
    overflow: 'hidden',
  },
  confMeterFill: {
    height: '100%',
    backgroundColor: '#06B6D4',
    borderRadius: 3,
  },
  accordionToggleBtn: {
    backgroundColor: '#0B0F17',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2A3852',
    marginBottom: 10,
  },
  accordionToggleTxt: {
    color: '#06B6D4',
    fontSize: 12,
    fontWeight: 'bold',
  },
  ocrBox: {
    backgroundColor: '#0B0F17',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2A3852',
    marginBottom: 16,
  },
  ocrTxt: {
    color: '#94A3B8',
    fontSize: 11,
    lineHeight: 16,
  },
  modalActionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
  },
  markPaidActionBtn: {
    flex: 1,
    backgroundColor: '#10B981',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  markPaidActionTxt: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  deleteActionBtn: {
    flex: 1,
    backgroundColor: 'rgba(244, 63, 94, 0.15)',
    borderWidth: 1,
    borderColor: '#F43F5E',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  deleteActionTxt: {
    color: '#F43F5E',
    fontWeight: 'bold',
    fontSize: 14,
  },
  fullScreenImageOverlay: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenCloseBtn: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 99,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  fullScreenCloseTxt: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 12,
  },
  fullScreenImage: {
    width: '100%',
    height: '85%',
  },
  adminCard: {
    backgroundColor: '#161F30',
    borderRadius: 12,
    padding: 16,
    width: '48%',
    borderWidth: 1,
    borderColor: '#2A3852',
  },
  adminVal: {
    color: '#06B6D4',
    fontSize: 24,
    fontWeight: 'bold',
  },
  adminLbl: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 4,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    backgroundColor: '#161F30',
    borderTopWidth: 1,
    borderTopColor: '#2A3852',
    paddingVertical: 10,
    alignItems: 'center',
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
  },
  navText: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '600',
  },
  navActive: {
    color: '#06B6D4',
    fontWeight: 'bold',
  },
  fabBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#06B6D4',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -20,
    borderWidth: 3,
    borderColor: '#0B0F17',
  },
  fabBtnTxt: {
    color: '#FFF',
    fontSize: 26,
    fontWeight: 'bold',
    lineHeight: 28,
  },
});
