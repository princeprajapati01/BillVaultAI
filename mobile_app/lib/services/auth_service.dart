import 'dart:convert';
import '../config/api_config.dart';
import '../models/user_model.dart';
import 'api_service.dart';

class AuthService {
  final ApiService _api = ApiService();

  Future<UserModel> login(String email, String password) async {
    final response = await _api.post(
      ApiConfig.login,
      body: {'email': email, 'password': password},
    );

    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      final token = data['access_token'];
      if (token != null) {
        await _api.setToken(token);
      }
      return UserModel.fromJson(data['user']);
    } else {
      final error = jsonDecode(response.body);
      throw Exception(error['detail'] ?? 'Login failed. Please check credentials.');
    }
  }

  Future<UserModel> register(String name, String email, String password) async {
    final response = await _api.post(
      ApiConfig.register,
      body: {'name': name, 'email': email, 'password': password},
    );

    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      final token = data['access_token'];
      if (token != null) {
        await _api.setToken(token);
      }
      return UserModel.fromJson(data['user']);
    } else {
      final error = jsonDecode(response.body);
      throw Exception(error['detail'] ?? 'Registration failed.');
    }
  }

  Future<UserModel?> getProfile() async {
    final token = await _api.getToken();
    if (token == null || token.isEmpty) return null;

    final response = await _api.get(ApiConfig.me);
    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      return UserModel.fromJson(data);
    }
    return null;
  }

  Future<String> forgotPassword(String email) async {
    final response = await _api.post(
      ApiConfig.forgotPassword,
      body: {'email': email},
    );

    final data = jsonDecode(response.body);
    if (response.statusCode == 200) {
      return data['message'] ?? 'OTP code has been sent to your email.';
    } else {
      throw Exception(data['detail'] ?? 'Failed to process request.');
    }
  }

  Future<String> resetPassword(String email, String otpCode, String newPassword) async {
    final response = await _api.post(
      ApiConfig.resetPassword,
      body: {
        'email': email,
        'otp_code': otpCode,
        'new_password': newPassword,
      },
    );

    final data = jsonDecode(response.body);
    if (response.statusCode == 200) {
      return data['message'] ?? 'Password reset successful.';
    } else {
      throw Exception(data['detail'] ?? 'Invalid OTP or password requirement not met.');
    }
  }

  Future<void> logout() async {
    await _api.clearToken();
  }
}
