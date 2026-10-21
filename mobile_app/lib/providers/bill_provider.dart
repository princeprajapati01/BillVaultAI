import 'dart:io';
import 'package:flutter/material.dart';
import '../models/bill_model.dart';
import '../services/bill_service.dart';

class BillProvider with ChangeNotifier {
  final BillService _billService = BillService();

  List<BillModel> _bills = [];
  bool _isLoading = false;
  bool _isUploading = false;
  String? _errorMessage;
  String _selectedCategory = 'All';
  String _searchQuery = '';

  List<BillModel> get bills {
    return _bills.where((bill) {
      final matchesCategory = _selectedCategory == 'All' ||
          bill.category.toLowerCase() == _selectedCategory.toLowerCase();
      final matchesSearch = _searchQuery.isEmpty ||
          bill.merchant.toLowerCase().contains(_searchQuery.toLowerCase()) ||
          bill.invoiceNumber.toLowerCase().contains(_searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    }).toList();
  }

  List<BillModel> get rawBills => _bills;
  bool get isLoading => _isLoading;
  bool get isUploading => _isUploading;
  String? get errorMessage => _errorMessage;
  String get selectedCategory => _selectedCategory;

  double get totalSpend {
    return _bills.fold(0.0, (sum, item) => sum + item.amount);
  }

  Map<String, double> get categorySpendBreakdown {
    final Map<String, double> breakdown = {};
    for (var bill in _bills) {
      breakdown[bill.category] = (breakdown[bill.category] ?? 0.0) + bill.amount;
    }
    return breakdown;
  }

  void setCategory(String category) {
    _selectedCategory = category;
    notifyListeners();
  }

  void setSearchQuery(String query) {
    _searchQuery = query;
    notifyListeners();
  }

  Future<void> fetchBills() async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      _bills = await _billService.getBills();
      _isLoading = false;
      notifyListeners();
    } catch (e) {
      _errorMessage = e.toString().replaceAll('Exception: ', '');
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> uploadDocument(File file) async {
    _isUploading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      await _billService.uploadDocument(file);
      await fetchBills();
      _isUploading = false;
      notifyListeners();
      return true;
    } catch (e) {
      _errorMessage = e.toString().replaceAll('Exception: ', '');
      _isUploading = false;
      notifyListeners();
      return false;
    }
  }

  Future<void> updateBill(int id, Map<String, dynamic> updateFields) async {
    try {
      await _billService.updateBill(id, updateFields);
      await fetchBills();
    } catch (e) {
      rethrow;
    }
  }

  Future<void> deleteBill(int id) async {
    try {
      await _billService.deleteBill(id);
      _bills.removeWhere((bill) => bill.id == id);
      notifyListeners();
    } catch (e) {
      rethrow;
    }
  }

  Future<void> submitFeedback(int rating, String comment) async {
    await _billService.submitFeedback(rating, comment);
  }
}
