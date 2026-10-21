import 'package:flutter/material.dart';
import '../config/app_theme.dart';

class StatusBadge extends StatelessWidget {
  final String status;
  final bool isPaymentStatus;

  const StatusBadge({
    Key? key,
    required this.status,
    this.isPaymentStatus = false,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    Color bg;
    Color fg;
    String label = status.toUpperCase();

    final normalized = status.toLowerCase();

    if (isPaymentStatus) {
      if (normalized == 'paid') {
        bg = AppTheme.secondaryEmerald.withOpacity(0.15);
        fg = AppTheme.secondaryEmerald;
      } else if (normalized == 'overdue') {
        bg = AppTheme.accentRose.withOpacity(0.15);
        fg = AppTheme.accentRose;
      } else if (normalized == 'partially_paid') {
        bg = AppTheme.warningAmber.withOpacity(0.15);
        fg = AppTheme.warningAmber;
      } else {
        bg = AppTheme.textMuted.withOpacity(0.15);
        fg = AppTheme.textSecondary;
      }
    } else {
      if (normalized == 'processed') {
        bg = AppTheme.secondaryEmerald.withOpacity(0.15);
        fg = AppTheme.secondaryEmerald;
      } else if (normalized == 'processing') {
        bg = AppTheme.primaryCyan.withOpacity(0.15);
        fg = AppTheme.primaryCyan;
      } else if (normalized == 'review') {
        bg = AppTheme.warningAmber.withOpacity(0.15);
        fg = AppTheme.warningAmber;
      } else {
        bg = AppTheme.accentRose.withOpacity(0.15);
        fg = AppTheme.accentRose;
      }
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: fg.withOpacity(0.4), width: 1),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: fg,
          fontSize: 11,
          fontWeight: FontWeight.bold,
          letterSpacing: 0.5,
        ),
      ),
    );
  }
}
