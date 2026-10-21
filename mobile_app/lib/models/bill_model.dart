class BillModel {
  final int id;
  final String merchant;
  final double amount;
  final double gst;
  final double cgst;
  final double sgst;
  final double igst;
  final String? gstNumber;
  final double subtotal;
  final String? paymentMethod;
  final String? transactionId;
  final String? notes;
  final String invoiceNumber;
  final String date;
  final String category;
  final String status;
  final String? dueDate;
  final String? paymentTerms;
  final double balanceDue;
  final double amountPaid;
  final String paymentStatus;
  final String? statusReason;
  final int confidence;
  final String? imageUrl;
  final String? rawOCR;
  final String currency;

  BillModel({
    required this.id,
    required this.merchant,
    required this.amount,
    required this.gst,
    this.cgst = 0.0,
    this.sgst = 0.0,
    this.igst = 0.0,
    this.gstNumber,
    required this.subtotal,
    this.paymentMethod,
    this.transactionId,
    this.notes,
    required this.invoiceNumber,
    required this.date,
    required this.category,
    required this.status,
    this.dueDate,
    this.paymentTerms,
    this.balanceDue = 0.0,
    this.amountPaid = 0.0,
    this.paymentStatus = 'UNKNOWN',
    this.statusReason,
    required this.confidence,
    this.imageUrl,
    this.rawOCR,
    this.currency = 'INR',
  });

  factory BillModel.fromJson(Map<String, dynamic> json) {
    return BillModel(
      id: json['id'] is int ? json['id'] : int.parse(json['id'].toString()),
      merchant: json['merchant'] ?? json['merchant_name'] ?? 'Unknown Merchant',
      amount: (json['amount'] ?? json['invoice_total'] ?? 0.0).toDouble(),
      gst: (json['gst'] ?? json['tax_amount'] ?? 0.0).toDouble(),
      cgst: (json['cgst'] ?? json['cgst_amount'] ?? 0.0).toDouble(),
      sgst: (json['sgst'] ?? json['sgst_amount'] ?? 0.0).toDouble(),
      igst: (json['igst'] ?? json['igst_amount'] ?? 0.0).toDouble(),
      gstNumber: json['gstNumber'] ?? json['gst_number'],
      subtotal: (json['subtotal'] ?? 0.0).toDouble(),
      paymentMethod: json['paymentMethod'] ?? json['payment_method'],
      transactionId: json['transactionId'] ?? json['transaction_id'],
      notes: json['notes'],
      invoiceNumber: json['invoiceNumber'] ?? json['invoice_number'] ?? 'Not detected',
      date: json['date'] ?? json['invoice_date'] ?? 'Not detected',
      category: json['category'] ?? 'Office',
      status: json['status'] ?? 'processed',
      dueDate: json['dueDate'] ?? json['due_date'],
      paymentTerms: json['paymentTerms'] ?? json['payment_terms'],
      balanceDue: (json['balanceDue'] ?? json['balance_due'] ?? 0.0).toDouble(),
      amountPaid: (json['amountPaid'] ?? json['amount_paid'] ?? 0.0).toDouble(),
      paymentStatus: json['paymentStatus'] ?? json['payment_status'] ?? 'UNKNOWN',
      statusReason: json['statusReason'] ?? json['status_reason'],
      confidence: json['confidence'] is int
          ? json['confidence']
          : ((json['confidence_score'] ?? 1.0) * 100).toInt(),
      imageUrl: json['imageUrl'] ?? json['image_url'],
      rawOCR: json['rawOCR'] ?? json['raw_ocr'],
      currency: json['currency'] ?? 'INR',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'merchant_name': merchant,
      'invoice_total': amount,
      'tax_amount': gst,
      'cgst_amount': cgst,
      'sgst_amount': sgst,
      'igst_amount': igst,
      'gst_number': gstNumber,
      'subtotal': subtotal,
      'payment_method': paymentMethod,
      'transaction_id': transactionId,
      'notes': notes,
      'invoice_number': invoiceNumber,
      'invoice_date': date,
      'category': category,
      'due_date': dueDate,
      'payment_terms': paymentTerms,
      'balance_due': balanceDue,
      'amount_paid': amountPaid,
      'payment_status': paymentStatus,
      'status_reason': statusReason,
    };
  }
}
