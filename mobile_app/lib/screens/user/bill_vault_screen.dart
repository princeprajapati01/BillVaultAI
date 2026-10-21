import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../config/app_theme.dart';
import '../../providers/bill_provider.dart';
import '../../widgets/glass_card.dart';
import '../../widgets/status_badge.dart';
import 'bill_detail_screen.dart';

class BillVaultScreen extends StatefulWidget {
  const BillVaultScreen({Key? key}) : super(key: key);

  @override
  State<BillVaultScreen> createState() => _BillVaultScreenState();
}

class _BillVaultScreenState extends State<BillVaultScreen> {
  final _searchController = TextEditingController();

  final List<String> _categories = const [
    'All',
    'Travel',
    'Fuel',
    'Food',
    'Software',
    'Utilities',
    'Medical',
    'Electronics',
    'Subscription',
    'Office',
  ];

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final billProvider = Provider.of<BillProvider>(context);
    final bills = billProvider.bills;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Invoice Vault'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => billProvider.fetchBills(),
          ),
        ],
      ),
      body: Column(
        children: [
          // Search & Filter Header
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
            child: TextField(
              controller: _searchController,
              onChanged: (val) => billProvider.setSearchQuery(val),
              style: const TextStyle(color: AppTheme.textPrimary, fontSize: 14),
              decoration: InputDecoration(
                hintText: 'Search merchant or invoice number...',
                prefixIcon: const Icon(Icons.search, color: AppTheme.primaryCyan),
                suffixIcon: _searchController.text.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.clear, color: AppTheme.textMuted),
                        onPressed: () {
                          _searchController.clear();
                          billProvider.setSearchQuery('');
                        },
                      )
                    : null,
              ),
            ),
          ),

          // Category Chips Row
          SizedBox(
            height: 40,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 20),
              itemCount: _categories.length,
              separatorBuilder: (_, __) => const SizedBox(width: 8),
              itemBuilder: (context, index) {
                final cat = _categories[index];
                final isSelected = billProvider.selectedCategory == cat;

                return ChoiceChip(
                  label: Text(cat),
                  selected: isSelected,
                  onSelected: (_) => billProvider.setCategory(cat),
                  selectedColor: AppTheme.primaryCyan,
                  backgroundColor: AppTheme.cardSurface,
                  labelStyle: TextStyle(
                    color: isSelected ? Colors.white : AppTheme.textSecondary,
                    fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                    fontSize: 12,
                  ),
                  side: BorderSide(
                    color: isSelected ? AppTheme.primaryCyan : AppTheme.cardBorder,
                  ),
                );
              },
            ),
          ),

          const SizedBox(height: 12),

          // Invoice List View
          Expanded(
            child: RefreshIndicator(
              onRefresh: () => billProvider.fetchBills(),
              child: billProvider.isLoading
                  ? const Center(child: CircularProgressIndicator())
                  : bills.isEmpty
                      ? ListView(
                          children: const [
                            SizedBox(height: 80),
                            Center(
                              child: Text(
                                'No matching invoices found in vault.',
                                style: TextStyle(color: AppTheme.textSecondary),
                              ),
                            ),
                          ],
                        )
                      : ListView.separated(
                          padding: const EdgeInsets.all(20),
                          itemCount: bills.length,
                          separatorBuilder: (_, __) => const SizedBox(height: 12),
                          itemBuilder: (context, index) {
                            final bill = bills[index];
                            return GlassCard(
                              padding: const EdgeInsets.all(16),
                              onTap: () {
                                Navigator.push(
                                  context,
                                  MaterialPageRoute(
                                    builder: (_) => BillDetailScreen(billId: bill.id),
                                  ),
                                );
                              },
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    mainAxisAlignment:
                                        MainAxisAlignment.spaceBetween,
                                    children: [
                                      Expanded(
                                        child: Text(
                                          bill.merchant,
                                          style: const TextStyle(
                                            fontSize: 16,
                                            fontWeight: FontWeight.bold,
                                            color: AppTheme.textPrimary,
                                          ),
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                        ),
                                      ),
                                      StatusBadge(status: bill.status),
                                    ],
                                  ),
                                  const SizedBox(height: 8),
                                  Row(
                                    mainAxisAlignment:
                                        MainAxisAlignment.spaceBetween,
                                    children: [
                                      Text(
                                        'Inv #${bill.invoiceNumber}',
                                        style: const TextStyle(
                                          color: AppTheme.textSecondary,
                                          fontSize: 13,
                                        ),
                                      ),
                                      Text(
                                        '₹${bill.amount.toStringAsFixed(2)}',
                                        style: const TextStyle(
                                          fontSize: 16,
                                          fontWeight: FontWeight.bold,
                                          color: AppTheme.secondaryEmerald,
                                        ),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 8),
                                  Row(
                                    mainAxisAlignment:
                                        MainAxisAlignment.spaceBetween,
                                    children: [
                                      Text(
                                        '${bill.date} • ${bill.category}',
                                        style: const TextStyle(
                                          color: AppTheme.textMuted,
                                          fontSize: 12,
                                        ),
                                      ),
                                      Row(
                                        children: [
                                          const Icon(
                                            Icons.verified_outlined,
                                            size: 14,
                                            color: AppTheme.primaryCyan,
                                          ),
                                          const SizedBox(width: 4),
                                          Text(
                                            '${bill.confidence}% AI',
                                            style: const TextStyle(
                                              color: AppTheme.primaryCyan,
                                              fontSize: 12,
                                              fontWeight: FontWeight.bold,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ],
                                  ),
                                ],
                              ),
                            );
                          },
                        ),
            ),
          ),
        ],
      ),
    );
  }
}
