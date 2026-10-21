import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../config/app_theme.dart';
import '../../providers/admin_provider.dart';
import '../../widgets/glass_card.dart';

class SystemHealthScreen extends StatelessWidget {
  const SystemHealthScreen({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    final adminProvider = Provider.of<AdminProvider>(context);
    final health = adminProvider.healthStats;

    if (health == null) {
      return const Center(child: CircularProgressIndicator());
    }

    return RefreshIndicator(
      onRefresh: () => adminProvider.fetchSystemHealth(),
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(20.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Server Metrics Grid
            GridView.count(
              crossAxisCount: 2,
              crossAxisSpacing: 12,
              mainAxisSpacing: 12,
              childAspectRatio: 1.4,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              children: [
                _metricTile('CPU Load', health.cpuUsage, health.cpuStatus, Icons.memory),
                _metricTile('Memory (RAM)', health.memoryPercent, health.memory, Icons.developer_board),
                _metricTile('Server Uptime', health.uptime, 'Optimal', Icons.timer_outlined),
                _metricTile('Avg API Latency', health.apiLatency, health.apiStatus, Icons.speed),
              ],
            ),

            const SizedBox(height: 20),

            // Active System Alerts
            const Text(
              'System Health Alerts',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.bold,
                color: AppTheme.textPrimary,
              ),
            ),
            const SizedBox(height: 12),
            GlassCard(
              padding: const EdgeInsets.all(16),
              child: ListView.separated(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: health.systemAlerts.length,
                separatorBuilder: (_, __) => const Divider(color: AppTheme.cardBorder),
                itemBuilder: (context, index) {
                  final alert = health.systemAlerts[index];
                  final isWarning = alert['type'] == 'warning';
                  return Row(
                    children: [
                      Icon(
                        isWarning ? Icons.warning_amber_rounded : Icons.check_circle_outline,
                        color: isWarning ? AppTheme.accentRose : AppTheme.secondaryEmerald,
                        size: 20,
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              alert['message'] ?? '',
                              style: const TextStyle(
                                color: AppTheme.textPrimary,
                                fontSize: 13,
                              ),
                            ),
                            Text(
                              alert['time'] ?? '',
                              style: const TextStyle(
                                color: AppTheme.textMuted,
                                fontSize: 11,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _metricTile(String title, String mainVal, String subVal, IconData icon) {
    return GlassCard(
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                title,
                style: const TextStyle(color: AppTheme.textSecondary, fontSize: 12),
              ),
              Icon(icon, color: AppTheme.primaryCyan, size: 20),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            mainVal,
            style: const TextStyle(
              color: AppTheme.textPrimary,
              fontSize: 20,
              fontWeight: FontWeight.bold,
            ),
          ),
          Text(
            subVal,
            style: const TextStyle(color: AppTheme.textMuted, fontSize: 11),
          ),
        ],
      ),
    );
  }
}
