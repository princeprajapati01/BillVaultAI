import 'package:flutter/material.dart';
import 'package:fl_chart/fl_chart.dart';
import '../config/app_theme.dart';

class SpendingChart extends StatelessWidget {
  final Map<String, double> categoryData;

  const SpendingChart({Key? key, required this.categoryData}) : super(key: key);

  List<Color> get _chartColors => const [
        AppTheme.primaryCyan,
        AppTheme.secondaryEmerald,
        AppTheme.accentViolet,
        AppTheme.warningAmber,
        AppTheme.accentRose,
        Color(0xFF3B82F6),
        Color(0xFFEC4899),
      ];

  @override
  Widget build(BuildContext context) {
    if (categoryData.isEmpty) {
      return Container(
        height: 180,
        alignment: Alignment.center,
        child: const Text(
          'No invoice data available yet.',
          style: TextStyle(color: AppTheme.textMuted, fontSize: 14),
        ),
      );
    }

    final total = categoryData.values.fold(0.0, (sum, val) => sum + val);
    final entries = categoryData.entries.toList();

    return Column(
      children: [
        SizedBox(
          height: 160,
          child: PieChart(
            PieChartData(
              sectionsSpace: 3,
              centerSpaceRadius: 35,
              sections: List.generate(entries.length, (index) {
                final entry = entries[index];
                final percentage = total > 0 ? (entry.value / total * 100) : 0.0;
                final color = _chartColors[index % _chartColors.length];

                return PieChartSectionData(
                  color: color,
                  value: entry.value,
                  title: '${percentage.toStringAsFixed(0)}%',
                  radius: 40,
                  titleStyle: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                  ),
                );
              }),
            ),
          ),
        ),
        const SizedBox(height: 16),
        Wrap(
          spacing: 12,
          runSpacing: 8,
          children: List.generate(entries.length, (index) {
            final entry = entries[index];
            final color = _chartColors[index % _chartColors.length];
            return Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 10,
                  height: 10,
                  decoration: BoxDecoration(
                    color: color,
                    shape: BoxShape.circle,
                  ),
                ),
                const SizedBox(width: 6),
                Text(
                  '${entry.key} (₹${entry.value.toStringAsFixed(0)})',
                  style: const TextStyle(
                    color: AppTheme.textSecondary,
                    fontSize: 12,
                  ),
                ),
              ],
            );
          }),
        ),
      ],
    );
  }
}
