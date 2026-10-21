import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../config/app_theme.dart';
import '../../providers/admin_provider.dart';
import '../../widgets/glass_card.dart';

class UserManagementScreen extends StatefulWidget {
  const UserManagementScreen({Key? key}) : super(key: key);

  @override
  State<UserManagementScreen> createState() => _UserManagementScreenState();
}

class _UserManagementScreenState extends State<UserManagementScreen> {
  String _searchQuery = '';

  @override
  Widget build(BuildContext context) {
    final adminProvider = Provider.of<AdminProvider>(context);
    final rawUsers = adminProvider.users;

    final users = rawUsers.where((u) {
      final name = (u['name'] ?? '').toString().toLowerCase();
      final email = (u['email'] ?? '').toString().toLowerCase();
      final query = _searchQuery.toLowerCase();
      return name.contains(query) || email.contains(query);
    }).toList();

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.all(20.0),
          child: TextField(
            onChanged: (val) => setState(() => _searchQuery = val),
            style: const TextStyle(color: AppTheme.textPrimary, fontSize: 14),
            decoration: const InputDecoration(
              hintText: 'Search user by name or email...',
              prefixIcon: Icon(Icons.search, color: AppTheme.primaryCyan),
            ),
          ),
        ),
        Expanded(
          child: RefreshIndicator(
            onRefresh: () => adminProvider.fetchUsers(),
            child: adminProvider.isLoading
                ? const Center(child: CircularProgressIndicator())
                : users.isEmpty
                    ? const Center(
                        child: Text(
                          'No users found',
                          style: TextStyle(color: AppTheme.textMuted),
                        ),
                      )
                    : ListView.separated(
                        padding: const EdgeInsets.symmetric(horizontal: 20),
                        itemCount: users.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 12),
                        itemBuilder: (context, index) {
                          final user = users[index];
                          final int userId = user['id'];
                          final String name = user['name'] ?? 'User';
                          final String email = user['email'] ?? '';
                          final String plan = user['plan'] ?? 'Free';
                          final String status = user['status'] ?? 'active';
                          final int uploads = user['uploads'] ?? 0;
                          final bool isSuspended = status == 'suspended';

                          return GlassCard(
                            padding: const EdgeInsets.all(16),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    CircleAvatar(
                                      radius: 20,
                                      backgroundColor: AppTheme.primaryCyan,
                                      child: Text(
                                        name.isNotEmpty ? name[0].toUpperCase() : 'U',
                                        style: const TextStyle(
                                          color: Colors.white,
                                          fontWeight: FontWeight.bold,
                                        ),
                                      ),
                                    ),
                                    const SizedBox(width: 12),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            name,
                                            style: const TextStyle(
                                              fontSize: 15,
                                              fontWeight: FontWeight.bold,
                                              color: AppTheme.textPrimary,
                                            ),
                                          ),
                                          Text(
                                            email,
                                            style: const TextStyle(
                                              fontSize: 12,
                                              color: AppTheme.textSecondary,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                    Container(
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: 8,
                                        vertical: 3,
                                      ),
                                      decoration: BoxDecoration(
                                        color: isSuspended
                                            ? AppTheme.accentRose.withOpacity(0.15)
                                            : AppTheme.secondaryEmerald.withOpacity(0.15),
                                        borderRadius: BorderRadius.circular(12),
                                        border: Border.all(
                                          color: isSuspended
                                              ? AppTheme.accentRose
                                              : AppTheme.secondaryEmerald,
                                        ),
                                      ),
                                      child: Text(
                                        status.toUpperCase(),
                                        style: TextStyle(
                                          color: isSuspended
                                              ? AppTheme.accentRose
                                              : AppTheme.secondaryEmerald,
                                          fontSize: 10,
                                          fontWeight: FontWeight.bold,
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 12),
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    Text(
                                      'Uploads: $uploads',
                                      style: const TextStyle(
                                        color: AppTheme.textMuted,
                                        fontSize: 12,
                                      ),
                                    ),

                                    // Plan Dropdown Selector
                                    DropdownButton<String>(
                                      value: plan,
                                      dropdownColor: AppTheme.cardSurface,
                                      underline: const SizedBox(),
                                      style: const TextStyle(
                                        color: AppTheme.primaryCyan,
                                        fontSize: 12,
                                        fontWeight: FontWeight.bold,
                                      ),
                                      items: ['Free', 'Basic', 'Pro', 'Enterprise']
                                          .map((p) => DropdownMenuItem(
                                                value: p,
                                                child: Text(p),
                                              ))
                                          .toList(),
                                      onChanged: (newPlan) {
                                        if (newPlan != null && newPlan != plan) {
                                          adminProvider.updateUserPlan(
                                            userId,
                                            newPlan,
                                          );
                                        }
                                      },
                                    ),

                                    // Status Toggle Switch
                                    Switch(
                                      value: !isSuspended,
                                      activeColor: AppTheme.secondaryEmerald,
                                      onChanged: (val) {
                                        adminProvider.updateUserStatus(
                                          userId,
                                          val ? 'active' : 'suspended',
                                        );
                                      },
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
    );
  }
}
