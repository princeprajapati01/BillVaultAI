import 'package:flutter/material.dart';
import '../models/admin_stats_model.dart';
import '../services/admin_service.dart';

class AdminProvider with ChangeNotifier {
  final AdminService _adminService = AdminService();

  AdminDashboardStats? _dashboardStats;
  SystemHealthStats? _healthStats;
  List<dynamic> _users = [];
  bool _isLoading = false;
  String? _errorMessage;

  AdminDashboardStats? get dashboardStats => _dashboardStats;
  SystemHealthStats? get healthStats => _healthStats;
  List<dynamic> get users => _users;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;

  Future<void> fetchDashboardStats() async {
    _isLoading = true;
    notifyListeners();

    try {
      _dashboardStats = await _adminService.getDashboardStats();
      _isLoading = false;
      notifyListeners();
    } catch (e) {
      _errorMessage = e.toString().replaceAll('Exception: ', '');
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> fetchSystemHealth() async {
    try {
      _healthStats = await _adminService.getSystemHealth();
      notifyListeners();
    } catch (e) {
      _errorMessage = e.toString().replaceAll('Exception: ', '');
      notifyListeners();
    }
  }

  Future<void> fetchUsers() async {
    _isLoading = true;
    notifyListeners();

    try {
      _users = await _adminService.getUsers();
      _isLoading = false;
      notifyListeners();
    } catch (e) {
      _errorMessage = e.toString().replaceAll('Exception: ', '');
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> updateUserStatus(int userId, String status) async {
    try {
      await _adminService.updateUserStatus(userId, status);
      await fetchUsers();
    } catch (e) {
      rethrow;
    }
  }

  Future<void> updateUserPlan(int userId, String plan) async {
    try {
      await _adminService.updateUserPlan(userId, plan);
      await fetchUsers();
    } catch (e) {
      rethrow;
    }
  }
}
