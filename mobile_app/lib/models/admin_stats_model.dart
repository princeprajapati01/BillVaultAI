class AdminDashboardStats {
  final int totalUsers;
  final int premiumUsers;
  final int totalBillsProcessed;
  final double monthlyRevenue;
  final String systemHealth;
  final int apiRequests;
  final String storageUsed;
  final List<dynamic> uploadTrends;
  final List<dynamic> revenueTrends;
  final List<dynamic> accuracyTrends;
  final List<dynamic> recentActivities;

  AdminDashboardStats({
    required this.totalUsers,
    required this.premiumUsers,
    required this.totalBillsProcessed,
    required this.monthlyRevenue,
    required this.systemHealth,
    required this.apiRequests,
    required this.storageUsed,
    required this.uploadTrends,
    required this.revenueTrends,
    required this.accuracyTrends,
    required this.recentActivities,
  });

  factory AdminDashboardStats.fromJson(Map<String, dynamic> json) {
    return AdminDashboardStats(
      totalUsers: json['total_users'] ?? 0,
      premiumUsers: json['premium_users'] ?? 0,
      totalBillsProcessed: json['total_bills_processed'] ?? 0,
      monthlyRevenue: (json['monthly_revenue'] ?? 0.0).toDouble(),
      systemHealth: json['system_health'] ?? 'Operational',
      apiRequests: json['api_requests'] ?? 0,
      storageUsed: json['storage_used'] ?? '0.00 GB',
      uploadTrends: json['upload_trends'] ?? [],
      revenueTrends: json['revenue_trends'] ?? [],
      accuracyTrends: json['accuracy_trends'] ?? [],
      recentActivities: json['recent_activities'] ?? [],
    );
  }
}

class SystemHealthStats {
  final String uptime;
  final String cpuUsage;
  final String cpuStatus;
  final String memory;
  final String memoryPercent;
  final String memoryStatus;
  final String apiLatency;
  final String apiStatus;
  final List<dynamic> cpuData;
  final List<dynamic> memoryData;
  final List<dynamic> systemAlerts;

  SystemHealthStats({
    required this.uptime,
    required this.cpuUsage,
    required this.cpuStatus,
    required this.memory,
    required this.memoryPercent,
    required this.memoryStatus,
    required this.apiLatency,
    required this.apiStatus,
    required this.cpuData,
    required this.memoryData,
    required this.systemAlerts,
  });

  factory SystemHealthStats.fromJson(Map<String, dynamic> json) {
    return SystemHealthStats(
      uptime: json['uptime'] ?? '99.9%',
      cpuUsage: json['cpu_usage'] ?? '0%',
      cpuStatus: json['cpu_status'] ?? 'Optimal',
      memory: json['memory'] ?? '0 GB',
      memoryPercent: json['memory_percent'] ?? '0%',
      memoryStatus: json['memory_status'] ?? 'Normal',
      apiLatency: json['api_latency'] ?? '0ms',
      apiStatus: json['api_status'] ?? 'Excellent',
      cpuData: json['cpu_data'] ?? [],
      memoryData: json['memory_data'] ?? [],
      systemAlerts: json['system_alerts'] ?? [],
    );
  }
}
