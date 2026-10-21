import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';
import 'package:path/path.dart' as p;
import '../config/api_config.dart';
import '../models/bill_model.dart';
import 'api_service.dart';

class BillService {
  final ApiService _api = ApiService();

  Future<List<BillModel>> getBills() async {
    final response = await _api.get(ApiConfig.bills);
    if (response.statusCode == 200) {
      final List<dynamic> list = jsonDecode(response.body);
      return list.map((item) => BillModel.fromJson(item)).toList();
    } else {
      throw Exception('Failed to load invoice list');
    }
  }

  Future<BillModel> getBillDetail(int id) async {
    final response = await _api.get(ApiConfig.billDetail(id));
    if (response.statusCode == 200) {
      return BillModel.fromJson(jsonDecode(response.body));
    } else {
      throw Exception('Invoice detail not found');
    }
  }

  Future<Map<String, dynamic>> uploadDocument(File file) async {
    final token = await _api.getToken();
    final uri = Uri.parse(ApiConfig.processDocument);
    final request = http.MultipartRequest('POST', uri);

    if (token != null && token.isNotEmpty) {
      request.headers['Authorization'] = 'Bearer $token';
    }

    final ext = p.extension(file.path).toLowerCase();
    MediaType contentType;
    if (ext == '.pdf') {
      contentType = MediaType('application', 'pdf');
    } else if (ext == '.png') {
      contentType = MediaType('image', 'png');
    } else if (ext == '.webp') {
      contentType = MediaType('image', 'webp');
    } else {
      contentType = MediaType('image', 'jpeg');
    }

    request.files.add(
      await http.MultipartFile.fromPath(
        'file',
        file.path,
        contentType: contentType,
      ),
    );

    final streamedResponse = await request.send();
    final response = await http.Response.fromStream(streamedResponse);

    if (response.statusCode == 200) {
      return jsonDecode(response.body);
    } else {
      final error = jsonDecode(response.body);
      throw Exception(error['detail'] ?? 'Document processing failed.');
    }
  }

  Future<void> updateBill(int id, Map<String, dynamic> updateFields) async {
    final response = await _api.put(
      ApiConfig.updateBill(id),
      body: updateFields,
    );

    if (response.statusCode != 200) {
      final error = jsonDecode(response.body);
      throw Exception(error['detail'] ?? 'Failed to update invoice.');
    }
  }

  Future<void> deleteBill(int id) async {
    final response = await _api.delete(ApiConfig.deleteBill(id));
    if (response.statusCode != 200) {
      throw Exception('Failed to delete invoice.');
    }
  }

  Future<void> submitFeedback(int rating, String comment) async {
    final response = await _api.post(
      ApiConfig.feedback,
      body: {'rating': rating, 'comment': comment},
    );

    if (response.statusCode != 200) {
      throw Exception('Failed to submit feedback.');
    }
  }
}
