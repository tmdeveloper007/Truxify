import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'supabase_service.dart';

class OrderService {
  OrderService({SupabaseClient? client}) : _providedClient = client;

  final SupabaseClient? _providedClient;

  SupabaseClient get _client => _providedClient ?? Supabase.instance.client;

  Future<void> createOrder({
    required String orderDisplayId,
    required String pickupAddress,
    required String dropAddress,
    required double pickupLat,
    required double pickupLng,
    required double dropLat,
    required double dropLng,
    required String pickupTime,
    required String goodsType,
    required double weightTonnes,
    required String truckId,
    required String driverId,
    required double totalAmount,
  }) async {
    await _client.from('orders').insert({
      'order_display_id': orderDisplayId,
      'customer_id': SupabaseService.requireUserId(),
      'driver_id': driverId,
      'truck_id': truckId,
      'status': 'pending',
      'pickup_address': pickupAddress,
      'pickup_lat': pickupLat,
      'pickup_lng': pickupLng,
      'drop_address': dropAddress,
      'drop_lat': dropLat,
      'drop_lng': dropLng,
      'pickup_date': DateTime.now().toIso8601String(),
      'pickup_time': pickupTime,
      'goods_type': goodsType,
      'weight_tonnes': weightTonnes,
      'total_amount': (totalAmount * 100).toInt(),
      'eta': 'TBD',
    });
  }

  Future<Map<String, dynamic>?> fetchOrderById(String orderDisplayId) async {
    final userId = SupabaseService.requireUserId();

    final response = await _client
        .from('orders')
        .select()
        .eq('order_display_id', orderDisplayId)
        .eq('customer_id', userId)
        .maybeSingle();

    return response;
  }

  Future<List<Map<String, dynamic>>> fetchOrders() async {
    final userId = SupabaseService.requireUserId();

    final response = await _client
        .from('orders')
        .select()
        .eq('customer_id', userId)
        .order('pickup_date', ascending: false);

    debugPrint('Orders response: $response');

    return List<Map<String, dynamic>>.from(response);
  }

  Future<List<Map<String, dynamic>>> fetchOrderTimeline(
    String orderDisplayId,
  ) async {
    final response = await _client
        .from('order_timeline')
        .select()
        .eq('order_display_id', orderDisplayId)
        .order('sort_order');

    return List<Map<String, dynamic>>.from(response);
  }

  Future<List<Map<String, dynamic>>> fetchActiveOrders() async {
    final userId = SupabaseService.requireUserId();

    final response = await _client
        .from('orders')
        .select()
        .eq('customer_id', userId)
        .inFilter('status', ['pending', 'active', 'in_transit']);

    return List<Map<String, dynamic>>.from(response);
  }

  Future<List<Map<String, dynamic>>> fetchHistoryOrders() async {
    final userId = SupabaseService.requireUserId();

    final response = await _client
        .from('orders')
        .select()
        .eq('customer_id', userId)
        .inFilter('status', [
      'completed',
      'delivered',
      'payment_released',
      'cancelled',
    ]);

    return List<Map<String, dynamic>>.from(response);
  }
}
