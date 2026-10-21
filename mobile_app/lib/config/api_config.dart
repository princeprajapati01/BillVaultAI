/// BillVaultAI API Configuration & Route Constants
class ApiConfig {
  /// Base API URL for local development.
  /// 10.0.2.2 is used for Android Emulator to connect to host localhost.
  /// For physical devices, update this to your PC's local WiFi IP (e.g. http://192.168.1.5:8000).
  static const String baseUrl = 'http://10.0.2.2:8000';
  
  /// Auth Endpoints
  static const String login = '$baseUrl/api/auth/login';
  static const String register = '$baseUrl/api/auth/register';
  static const String forgotPassword = '$baseUrl/api/auth/forgot-password';
  static const String resetPassword = '$baseUrl/api/auth/reset-password';
  static const String me = '$baseUrl/api/auth/me';
  static const String upgradePlan = '$baseUrl/api/auth/upgrade';

  /// Document Processing & Bills Endpoints
  static const String processDocument = '$baseUrl/process/document';
  static const String bills = '$baseUrl/api/bills';
  static String billDetail(int id) => '$baseUrl/api/bills/$id';
  static String updateBill(int id) => '$baseUrl/api/bills/$id';
  static String deleteBill(int id) => '$baseUrl/api/bills/$id';
  static const String feedback = '$baseUrl/api/feedback';

  /// Admin Endpoints
  static const String adminDashboard = '$baseUrl/api/admin/dashboard';
  static const String adminSystemHealth = '$baseUrl/api/admin/system-health';
  static const String adminUsers = '$baseUrl/api/admin/users';
  static const String adminBills = '$baseUrl/api/admin/bills';
  static const String adminOcrJobs = '$baseUrl/api/admin/ocr-jobs';
  static String updateUserStatus(int id) => '$baseUrl/api/admin/users/$id/status';
  static String updateUserPlan(int id) => '$baseUrl/api/admin/users/$id/plan';
}
