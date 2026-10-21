import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class ApiService {
  static final ApiService _instance = ApiService._internal();
  factory ApiService() => _instance;
  ApiService._internal();

  final _secureStorage = const FlutterSecureStorage();
  String? _token;

  Future<void> setToken(String token) async {
    _token = token;
    await _secureStorage.write(key: 'jwt_token', value: token);
  }

  Future<String?> getToken() async {
    _token ??= await _secureStorage.read(key: 'jwt_token');
    return _token;
  }

  Future<void> clearToken() async {
    _token = null;
    await _secureStorage.delete(key: 'jwt_token');
  }

  Future<Map<String, String>> _getHeaders({bool isJson = true}) async {
    final token = await getToken();
    final Map<String, String> headers = {};
    if (isJson) {
      headers['Content-Type'] = 'application/json';
    }
    if (token != null && token.isNotEmpty) {
      headers['Authorization'] = 'Bearer $token';
    }
    return headers;
  }

  Future<http.Response> get(String url) async {
    final headers = await _getHeaders();
    return await http.get(Uri.parse(url), headers: headers);
  }

  Future<http.Response> post(String url, {dynamic body}) async {
    final headers = await _getHeaders();
    final encodedBody = body != null ? jsonEncode(body) : null;
    return await http.post(Uri.parse(url), headers: headers, body: encodedBody);
  }

  Future<http.Response> put(String url, {dynamic body}) async {
    final headers = await _getHeaders();
    final encodedBody = body != null ? jsonEncode(body) : null;
    return await http.put(Uri.parse(url), headers: headers, body: encodedBody);
  }

  Future<http.Response> delete(String url) async {
    final headers = await _getHeaders();
    return await http.delete(Uri.parse(url), headers: headers);
  }
}
