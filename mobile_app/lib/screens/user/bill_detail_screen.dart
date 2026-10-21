import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../config/app_theme.dart';
import '../../models/bill_model.dart';
import '../../providers/bill_provider.dart';
import '../../widgets/glass_card.dart';
import '../../widgets/status_badge.dart';

class BillDetailScreen extends StatefulWidget {
  final int billId;
  const BillDetailScreen({Key? key, required this.billId}) : super(key: key);

  @override
  State<BillDetailScreen> createState() => _BillDetailScreenState();
}

class _BillDetailScreenState extends State<BillDetailScreen> {
  BillModel? _bill;
  bool _isLoading = true;
  bool _showRawOcr = false;

  @override
  void initState() {
    super.initState();
    _fetchDetail();
  }

  void _fetchDetail() async {
    final billProvider = Provider.of<BillProvider>(context, listen: false);
    try {
      final detail = await billProvider.rawBills.firstWhere(
        (b) => b.id == widget.billId,
        orElse: () => BillModel(
          id: widget.billId,
          merchant: 'Loading...',
          amount: 0.0,
          gst: 0.0,
          subtotal: 0.0,
          invoiceNumber: '',
          date: '',
          category: 'Office',
          status: 'processing',
          confidence: 0,
        ),
      );
      setState(() {
        _bill = detail;
        _isLoading = false;
      });
    } catch (e) {
      setState(() => _isLoading = false);
    }
  }

  void _showEditModal() {
    if (_bill == null) return;

    final merchantCtrl = TextEditingController(text: _bill!.merchant);
    final totalCtrl = TextEditingController(text: _bill!.amount.toString());
    final taxCtrl = TextEditingController(text: _bill!.gst.toString());
    final invNoCtrl = TextEditingController(text: _bill!.invoiceNumber);
    final dateCtrl = TextEditingController(text: _bill!.date);

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppTheme.cardSurface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) {
        return Padding(
          padding: EdgeInsets.only(
            left: 20,
            right: 20,
            top: 20,
            bottom: MediaQuery.of(context).viewInsets.bottom + 20,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text(
                'Edit Invoice Fields',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: AppTheme.textPrimary,
                ),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: merchantCtrl,
                style: const TextStyle(color: AppTheme.textPrimary),
                decoration: const InputDecoration(labelText: 'Merchant Name'),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: totalCtrl,
                keyboardType: TextInputType.number,
                style: const TextStyle(color: AppTheme.textPrimary),
                decoration: const InputDecoration(labelText: 'Grand Total Amount'),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: taxCtrl,
                keyboardType: TextInputType.number,
                style: const TextStyle(color: AppTheme.textPrimary),
                decoration: const InputDecoration(labelText: 'Tax Amount'),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: invNoCtrl,
                style: const TextStyle(color: AppTheme.textPrimary),
                decoration: const InputDecoration(labelText: 'Invoice Number'),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: dateCtrl,
                style: const TextStyle(color: AppTheme.textPrimary),
                decoration: const InputDecoration(labelText: 'Invoice Date'),
              ),
              const SizedBox(height: 20),
              ElevatedButton(
                onPressed: () async {
                  final billProvider =
                      Provider.of<BillProvider>(context, listen: false);
                  try {
                    await billProvider.updateBill(widget.billId, {
                      'merchant_name': merchantCtrl.text.trim(),
                      'invoice_total': double.tryParse(totalCtrl.text) ?? 0.0,
                      'tax_amount': double.tryParse(taxCtrl.text) ?? 0.0,
                      'invoice_number': invNoCtrl.text.trim(),
                      'invoice_date': dateCtrl.text.trim(),
                    });
                    if (mounted) {
                      Navigator.pop(context);
                      _fetchDetail();
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text('Invoice updated successfully'),
                          backgroundColor: AppTheme.secondaryEmerald,
                        ),
                      );
                    }
                  } catch (e) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text('Update failed: $e')),
                    );
                  }
                },
                child: const Text('Save Changes'),
              ),
            ],
          ),
        );
      },
    );
  }

  void _handleDelete() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppTheme.cardSurface,
        title: const Text('Delete Invoice'),
        content: const Text('Are you sure you want to delete this invoice?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppTheme.accentRose),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Delete'),
          ),
        ],
      ),
    );

    if (confirm == true && mounted) {
      final billProvider = Provider.of<BillProvider>(context, listen: false);
      try {
        await billProvider.deleteBill(widget.billId);
        if (mounted) {
          Navigator.pop(context);
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Invoice deleted')),
          );
        }
      } catch (e) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Delete failed: $e')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return Scaffold(
        appBar: AppBar(title: const Text('Invoice Details')),
        body: const Center(child: CircularProgressIndicator()),
      );
    }

    final b = _bill!;

    return Scaffold(
      appBar: AppBar(
        title: Text(b.merchant),
        actions: [
          IconButton(
            icon: const Icon(Icons.edit_outlined),
            onPressed: _showEditModal,
          ),
          IconButton(
            icon: const Icon(Icons.delete_outline, color: AppTheme.accentRose),
            onPressed: _handleDelete,
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Receipt Image Preview
            if (b.imageUrl != null && b.imageUrl!.isNotEmpty)
              GlassCard(
                padding: EdgeInsets.zero,
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(16),
                  child: Image.network(
                    b.imageUrl!,
                    height: 220,
                    width: double.infinity,
                    fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) => Container(
                      height: 120,
                      color: AppTheme.cardSurface,
                      alignment: Alignment.center,
                      child: const Text(
                        'Document Preview Available on Server',
                        style: TextStyle(color: AppTheme.textMuted),
                      ),
                    ),
                  ),
                ),
              ),

            const SizedBox(height: 16),

            // Main Billing Summary Card
            GlassCard(
              isGlowing: true,
              child: Column(
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        b.merchant,
                        style: const TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.bold,
                          color: AppTheme.textPrimary,
                        ),
                      ),
                      StatusBadge(status: b.status),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'Grand Total',
                        style: TextStyle(color: AppTheme.textSecondary, fontSize: 14),
                      ),
                      Text(
                        '₹${b.amount.toStringAsFixed(2)}',
                        style: const TextStyle(
                          fontSize: 24,
                          fontWeight: FontWeight.bold,
                          color: AppTheme.secondaryEmerald,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),

            const SizedBox(height: 16),

            // Extracted Fields Detail Grid
            GlassCard(
              child: Column(
                children: [
                  _detailRow('Invoice Number', b.invoiceNumber),
                  const Divider(color: AppTheme.cardBorder),
                  _detailRow('Invoice Date', b.date),
                  const Divider(color: AppTheme.cardBorder),
                  _detailRow('Subtotal', '₹${b.subtotal.toStringAsFixed(2)}'),
                  const Divider(color: AppTheme.cardBorder),
                  _detailRow('Total Tax (GST)', '₹${b.gst.toStringAsFixed(2)}'),
                  if (b.cgst > 0) ...[
                    const Divider(color: AppTheme.cardBorder),
                    _detailRow('CGST', '₹${b.cgst.toStringAsFixed(2)}'),
                  ],
                  if (b.sgst > 0) ...[
                    const Divider(color: AppTheme.cardBorder),
                    _detailRow('SGST', '₹${b.sgst.toStringAsFixed(2)}'),
                  ],
                  const Divider(color: AppTheme.cardBorder),
                  _detailRow('Category', b.category),
                  const Divider(color: AppTheme.cardBorder),
                  _detailRow('Payment Status', b.paymentStatus),
                  const Divider(color: AppTheme.cardBorder),
                  _detailRow('AI Confidence Score', '${b.confidence}%'),
                ],
              ),
            ),

            const SizedBox(height: 16),

            // Accordion for Raw OCR Text
            GlassCard(
              onTap: () => setState(() => _showRawOcr = !_showRawOcr),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'Raw OCR Output',
                        style: TextStyle(
                          fontWeight: FontWeight.bold,
                          color: AppTheme.primaryCyan,
                        ),
                      ),
                      Icon(
                        _showRawOcr
                            ? Icons.keyboard_arrow_up
                            : Icons.keyboard_arrow_down,
                        color: AppTheme.primaryCyan,
                      ),
                    ],
                  ),
                  if (_showRawOcr) ...[
                    const SizedBox(height: 12),
                    Text(
                      b.rawOCR != null && b.rawOCR!.isNotEmpty
                          ? b.rawOCR!
                          : 'No raw OCR text detected.',
                      style: const TextStyle(
                        fontFamily: 'monospace',
                        fontSize: 12,
                        color: AppTheme.textSecondary,
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _detailRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6.0),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(color: AppTheme.textSecondary, fontSize: 13)),
          Text(
            value,
            style: const TextStyle(
              color: AppTheme.textPrimary,
              fontWeight: FontWeight.bold,
              fontSize: 13,
            ),
          ),
        ],
      ),
    );
  }
}
