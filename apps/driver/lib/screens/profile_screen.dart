import 'package:flutter/material.dart';

import '../data/mock_data.dart';
import '../theme/app_theme.dart';
import '../widgets/common_widgets.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({
    super.key,
    this.onOpenTripHistory,
    this.onOpenDocuments,
    this.onOpenMyTruck,
    this.onOpenEarnings,
  });

  final VoidCallback? onOpenTripHistory;
  final VoidCallback? onOpenDocuments;
  final VoidCallback? onOpenMyTruck;
  final VoidCallback? onOpenEarnings;

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  Future<void> _showInfoSheet(BuildContext context, String title, String subtitle) async {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: TruxifyColors.cardBackground,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (context) {
        return Padding(
          padding: const EdgeInsets.fromLTRB(20, 10, 20, 20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const BottomSheetHandle(),
              const SizedBox(height: 16),
              Text(title, style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 8),
              Text(subtitle, style: Theme.of(context).textTheme.bodyMedium),
              const SizedBox(height: 16),
              PrimaryButton(label: 'Done', onPressed: () => Navigator.of(context).pop()),
            ],
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 110),
        children: [
          // Header
          Container(
            decoration: BoxDecoration(
              color: TruxifyColors.accent,
              borderRadius: BorderRadius.circular(12),
            ),
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                CircleAvatar(
                  radius: 32,
                  backgroundColor: TruxifyColors.cardBackground,
                  child: Text(driverInitials, style: textTheme.titleLarge?.copyWith(color: TruxifyColors.accent)),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(driverName, style: textTheme.headlineSmall?.copyWith(color: TruxifyColors.white, fontWeight: FontWeight.w700)),
                      const SizedBox(height: 4),
                      Text('$driverTruck · $driverTruckNumber', style: textTheme.bodyMedium?.copyWith(color: TruxifyColors.white.withValues(alpha: 0.95))),
                      const SizedBox(height: 8),
                      Text('⭐ $driverRating • $driverTrips trips', style: textTheme.bodySmall?.copyWith(color: TruxifyColors.white.withValues(alpha: 0.95))),
                    ],
                  ),
                ),
                Column(
                  children: [
                    IconButton(
                      onPressed: () => _showInfoSheet(context, 'Edit Profile', 'Edit profile is not available in demo.'),
                      icon: const Icon(Icons.edit_rounded, color: TruxifyColors.white),
                      tooltip: 'Edit',
                    ),
                    IconButton(
                      onPressed: () => widget.onOpenTripHistory?.call(),
                      icon: const Icon(Icons.history_rounded, color: TruxifyColors.white),
                      tooltip: 'Trip History',
                    ),
                  ],
                )
              ],
            ),
          ),

          const SizedBox(height: 12),

          // Metrics
          AppCard(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
            child: Row(
              children: [
                Expanded(child: _MetricColumn(label: 'Earned', value: driverEarningsMonth)),
                const Separator(),
                Expanded(child: _MetricColumn(label: 'Trips', value: driverTrips)),
                const Separator(),
                Expanded(child: _MetricColumn(label: 'Completion', value: driverCompletion)),
              ],
            ),
          ),

          const SizedBox(height: 16),

          // Quick actions
          AppCard(
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                _QuickAction(
                  icon: Icons.local_shipping_rounded,
                  label: 'My Truck',
                  onTap: () => widget.onOpenMyTruck?.call(),
                ),
                _QuickAction(
                  icon: Icons.payments_rounded,
                  label: 'Earnings',
                  onTap: () => widget.onOpenEarnings?.call(),
                ),
                _QuickAction(
                  icon: Icons.description_rounded,
                  label: 'Documents',
                  onTap: () => widget.onOpenDocuments?.call(),
                ),
              ],
            ),
          ),

          const SizedBox(height: 18),

          const SectionLabel(label: 'SETTINGS'),
          AppCard(
            child: Column(
              children: [
                ListTile(
                  contentPadding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  title: Text('Language', style: Theme.of(context).textTheme.titleMedium),
                  subtitle: Text('English', style: Theme.of(context).textTheme.bodyMedium),
                  trailing: const Icon(Icons.chevron_right_rounded, color: TruxifyColors.secondaryText),
                  onTap: () => _showInfoSheet(context, 'Language', 'Language switching will be connected to localization settings.'),
                ),
                const Divider(height: 1),
                ListTile(
                  contentPadding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  title: Text('Help & Support', style: Theme.of(context).textTheme.titleMedium),
                  subtitle: Text('FAQs, chat, and emergency help', style: Theme.of(context).textTheme.bodyMedium),
                  trailing: const Icon(Icons.chevron_right_rounded, color: TruxifyColors.secondaryText),
                  onTap: () => _showInfoSheet(context, 'Help & Support', 'Help and support can be routed to chat, call, or FAQ endpoints.'),
                ),
                const Divider(height: 1),
                ListTile(
                  contentPadding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  title: Text('About Truxify', style: Theme.of(context).textTheme.titleMedium),
                  subtitle: Text('Driver-first freight marketplace', style: Theme.of(context).textTheme.bodyMedium),
                  trailing: const Icon(Icons.chevron_right_rounded, color: TruxifyColors.secondaryText),
                  onTap: () => _showInfoSheet(context, 'About Truxify', 'Truxify is a driver-first freight marketplace demo.'),
                ),
              ],
            ),
          ),

          const SizedBox(height: 18),
          AppCard(
            onTap: () {
              ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Logout tapped')));
            },
            child: Row(
              children: [
                const Icon(Icons.logout_rounded, color: TruxifyColors.error),
                const SizedBox(width: 12),
                Text('Logout', style: Theme.of(context).textTheme.titleMedium?.copyWith(color: TruxifyColors.error, fontWeight: FontWeight.w600)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _MetricColumn extends StatelessWidget {
  const _MetricColumn({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(value, style: Theme.of(context).textTheme.titleLarge?.copyWith(color: TruxifyColors.primaryText, fontWeight: FontWeight.w700)),
        const SizedBox(height: 4),
        Text(label, style: Theme.of(context).textTheme.bodyMedium),
      ],
    );
  }
}

class _QuickAction extends StatelessWidget {
  const _QuickAction({required this.icon, required this.label, required this.onTap});

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
        child: Column(
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: TruxifyColors.secondaryBackground,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(icon, color: TruxifyColors.accentDark),
            ),
            const SizedBox(height: 8),
            Text(label, style: Theme.of(context).textTheme.bodySmall),
          ],
        ),
      ),
    );
  }
}
