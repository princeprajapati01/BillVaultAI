import 'dart:convert';
import '../config/api_config.dart';
import '../models/admin_stats_model.dart';
import 'api_service.dart';

class AdminService {
  final ApiService _api = ApiService();

  Future<AdminDashboardStats> getDashboardStats() async {
    final response = await _api.get(ApiConfig.adminDashboard);
    if (response.statusCode == 200) {
      return AdminDashboardStats.fromJson(jsonDecode(response.body));
    } else {
      throw Exception('Failed to load admin dashboard stats.');
    }
  }

  Future<SystemHealthStats> getSystemHealth() async {
    final response = await _api.get(ApiConfig.adminSystemHealth);
    if (response.statusCode == 200) {
      return SystemHealthStats.fromJson(jsonDecode(response.body));
    } else {
      throw Exception('Failed to load system health.');
    }
  }

  Future<List<dynamic>> getUsers() async {
    final response = await _api.get(ApiConfig.adminUsers);
    if (response.statusCode == 200) {
      return jsonDecode(response.body);
    } else {
      throw Exception('Failed to load users list.');
    }
  }

  Future<void> updateUserStatus(int userId, String status) async {
    final response = await _api.put(
      ApiConfig.updateUserStatus(userId),
      body: {'status': status},
    );
    if (response.statusCode != 200) {
      throw Exception('Failed to update user status.');
    }
  }

  Future<void> updateUserPlan(int userId, String plan) async {
    final response = await _api.put(
      ApiConfig.updateUserPlan(userId),
      body: {'plan': plan},
    );
    if (response.statusCode != 200) {
      throw Exception('Failed to update user plan.');
    }
  }
}
