import 'package:flutter/material.dart';

import '../controllers/app_controller.dart';
import '../theme/app_theme.dart';
import 'find_trucks_screen.dart';
import 'home_screen.dart';
import 'orders_screen.dart';
import 'profile_screen.dart';

class FreightFairShellScreen extends StatefulWidget {
  const FreightFairShellScreen({super.key});

  @override
  State<FreightFairShellScreen> createState() => _FreightFairShellScreenState();
}

class _FreightFairShellScreenState extends State<FreightFairShellScreen> {
  final GlobalKey<NavigatorState> _homeNavigatorKey = GlobalKey<NavigatorState>();
  final GlobalKey<NavigatorState> _findNavigatorKey = GlobalKey<NavigatorState>();
  final GlobalKey<NavigatorState> _ordersNavigatorKey = GlobalKey<NavigatorState>();
  final GlobalKey<NavigatorState> _profileNavigatorKey = GlobalKey<NavigatorState>();

  @override
  Widget build(BuildContext context) {
    final controller = FreightFairScope.of(context);

    return Scaffold(
      backgroundColor: FreightFairColors.secondaryBackground,
      body: IndexedStack(
        index: controller.currentTab,
        children: [
          _buildNavigator(_homeNavigatorKey, const HomeScreen()),
          _buildNavigator(_findNavigatorKey, const FindTrucksScreen()),
          _buildNavigator(_ordersNavigatorKey, const OrdersScreen()),
          _buildNavigator(_profileNavigatorKey, const ProfileScreen()),
        ],
      ),
      bottomNavigationBar: Container(
        decoration: const BoxDecoration(
          color: Colors.white,
          border: Border(top: BorderSide(color: FreightFairColors.border, width: 1)),
        ),
        child: NavigationBar(
          backgroundColor: Colors.white,
          selectedIndex: controller.currentTab,
          onDestinationSelected: controller.setTab,
          labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
          destinations: const [
            NavigationDestination(icon: Icon(Icons.home_rounded), label: 'Home'),
            NavigationDestination(icon: Icon(Icons.search_rounded), label: 'Find Trucks'),
            NavigationDestination(icon: Icon(Icons.inventory_2_rounded), label: 'Orders'),
            NavigationDestination(icon: Icon(Icons.person_rounded), label: 'Profile'),
          ],
        ),
      ),
    );
  }

  Widget _buildNavigator(GlobalKey<NavigatorState> key, Widget root) {
    return Navigator(
      key: key,
      onGenerateRoute: (settings) {
        return MaterialPageRoute<void>(builder: (_) => root, settings: settings);
      },
    );
  }
}
