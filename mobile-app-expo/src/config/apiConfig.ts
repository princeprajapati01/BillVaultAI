// BillVaultAI Mobile Expo API Config
// Your local PC Wi-Fi IP is: 10.133.174.192
// Use 'http://10.133.174.192:8000' for Expo Go on physical phones on Wi-Fi
// Use 'http://10.0.2.2:8000' for Android Studio emulator
// Use 'http://localhost:8000' for Web browser / iOS Simulator
export const BASE_URL = 'http://10.133.174.192:8000';

export const API_ENDPOINTS = {
  login: `${BASE_URL}/api/auth/login`,
  register: `${BASE_URL}/api/auth/register`,
  forgotPassword: `${BASE_URL}/api/auth/forgot-password`,
  resetPassword: `${BASE_URL}/api/auth/reset-password`,
  me: `${BASE_URL}/api/auth/me`,
  processDocument: `${BASE_URL}/process/document`,
  bills: `${BASE_URL}/api/bills`,
  billDetail: (id: number) => `${BASE_URL}/api/bills/${id}`,
  updateBill: (id: number) => `${BASE_URL}/api/bills/${id}`,
  deleteBill: (id: number) => `${BASE_URL}/api/bills/${id}`,
  feedback: `${BASE_URL}/api/feedback`,
  adminDashboard: `${BASE_URL}/api/admin/dashboard`,
  adminSystemHealth: `${BASE_URL}/api/admin/system-health`,
  adminUsers: `${BASE_URL}/api/admin/users`,
  updateUserStatus: (id: number) => `${BASE_URL}/api/admin/users/${id}/status`,
  updateUserPlan: (id: number) => `${BASE_URL}/api/admin/users/${id}/plan`,
};
