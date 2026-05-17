import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart' as ll;

import '../core/app_routes.dart';
import '../data/mock_data.dart';
import '../models/app_models.dart';
import '../services/route_service.dart';
import '../theme/app_theme.dart';

// ---------------------------------------------------------------------------
// HomeScreen — full-screen map with OSRM route + typed markers
// ---------------------------------------------------------------------------
class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  // Route polyline future (OSRM, falls back to straight waypoints)
  late final Future<List<ll.LatLng>> _routeFuture;

  // Currently selected waypoint for the bottom preview panel
  RouteMapPoint? _selected;

  @override
  void initState() {
    super.initState();
    final waypoints = activeRouteMapPoints
        .map((p) => ll.LatLng(p.latitude, p.longitude))
        .toList(growable: false);
    _routeFuture = RouteService.fetchRouteGeoJson(waypoints).onError(
      (_, __) => waypoints,
    );
  }

  void _onPointTap(RouteMapPoint point) {
    setState(() => _selected = point);
  }

  void _dismissPanel() {
    setState(() => _selected = null);
  }

  void _openDetail(RouteMapPoint point) {
    final load = loadOfferById[point.loadOfferId];
    if (load != null) {
      Navigator.of(context).pushNamed(
        AppRoutes.loadDetail,
        arguments: load,
      );
    } else {
      Navigator.of(context).pushNamed(
        AppRoutes.loadPointDetail,
        arguments: point,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: FutureBuilder<List<ll.LatLng>>(
        future: _routeFuture,
        builder: (context, snap) {
          // While loading show a full-screen spinner
          if (snap.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }

          final waypoints = activeRouteMapPoints
              .map((p) => ll.LatLng(p.latitude, p.longitude))
              .toList(growable: false);

          // Use fetched polyline or fall back to straight waypoints
          final polyline =
              (snap.data != null && snap.data!.isNotEmpty) ? snap.data! : waypoints;

          // Truck sits at the very first waypoint (start of route)
          final truckPos = waypoints.first;

          // Camera center = midpoint of bounding box
          final allLats = polyline.map((p) => p.latitude).toList();
          final allLngs = polyline.map((p) => p.longitude).toList();
          final centerLat =
              (allLats.reduce(math.min) + allLats.reduce(math.max)) / 2;
          final centerLng =
              (allLngs.reduce(math.min) + allLngs.reduce(math.max)) / 2;

          return Stack(
            children: [
              // ── Map ────────────────────────────────────────────────────
              FlutterMap(
                options: MapOptions(
                  initialCenter: ll.LatLng(centerLat, centerLng),
                  initialZoom: 6.2,
                  interactionOptions: const InteractionOptions(
                    flags: InteractiveFlag.all,
                  ),
                  onTap: (_, __) => _dismissPanel(),
                ),
                children: [
                  // OSM tiles
                  TileLayer(
                    urlTemplate:
                        'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                    userAgentPackageName: 'com.truxify.driver',
                  ),

                  // Route polyline
                  PolylineLayer(
                    polylines: [
                      Polyline(
                        points: polyline,
                        strokeWidth: 4.5,
                        color: const Color(0xFF1A237E),
                        borderStrokeWidth: 1.5,
                        borderColor: Colors.white.withValues(alpha: 0.6),
                      ),
                    ],
                  ),

                  // Markers
                  MarkerLayer(
                    markers: [
                      // ── Intermediate waypoints (index 1 .. n-2) ────────
                      for (int i = 1;
                          i < activeRouteMapPoints.length - 1;
                          i++)
                        _buildWaypointMarker(activeRouteMapPoints[i]),

                      // ── Delivery / destination marker (last point) ─────
                      _buildDestinationMarker(activeRouteMapPoints.last),

                      // ── Truck at start (first point) ───────────────────
                      Marker(
                        point: truckPos,
                        width: 56,
                        height: 56,
                        alignment: Alignment.center,
                        child: _TruckMarker(
                          onTap: _dismissPanel,
                        ),
                      ),
                    ],
                  ),
                ],
              ),

              // ── Bottom preview panel ──────────────────────────────────
              if (_selected != null)
                Positioned(
                  left: 0,
                  right: 0,
                  bottom: 0,
                  child: _PointPreviewPanel(
                    point: _selected!,
                    onDismiss: _dismissPanel,
                    onViewDetail: () => _openDetail(_selected!),
                  ),
                ),
            ],
          );
        },
      ),
    );
  }

  // ── Intermediate waypoint marker (blue = claimable, green = claimed) ──────
  Marker _buildWaypointMarker(RouteMapPoint point) {
    final color = point.claimed
        ? const Color(0xFF2E7D32) // green — claimed
        : const Color(0xFF1565C0); // blue  — available
    final icon = point.claimed
        ? Icons.check_circle_rounded
        : Icons.inventory_2_rounded;

    return Marker(
      point: ll.LatLng(point.latitude, point.longitude),
      width: 44,
      height: 44,
      alignment: Alignment.center,
      child: GestureDetector(
        onTap: () => _onPointTap(point),
        child: Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            color: color,
            shape: BoxShape.circle,
            border: Border.all(color: Colors.white, width: 2.5),
            boxShadow: [
              BoxShadow(
                color: color.withValues(alpha: 0.38),
                blurRadius: 8,
                offset: const Offset(0, 3),
              ),
            ],
          ),
          child: Icon(icon, color: Colors.white, size: 18),
        ),
      ),
    );
  }

  // ── Destination / delivery marker (red pin) ───────────────────────────────
  Marker _buildDestinationMarker(RouteMapPoint point) {
    const color = Color(0xFFC62828);
    return Marker(
      point: ll.LatLng(point.latitude, point.longitude),
      width: 44,
      height: 44,
      alignment: Alignment.center,
      child: GestureDetector(
        onTap: () => _onPointTap(point),
        child: Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            color: color,
            shape: BoxShape.circle,
            border: Border.all(color: Colors.white, width: 2.5),
            boxShadow: [
              BoxShadow(
                color: color.withValues(alpha: 0.38),
                blurRadius: 8,
                offset: const Offset(0, 3),
              ),
            ],
          ),
          child: const Icon(Icons.location_on_rounded, color: Colors.white, size: 20),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Animated truck marker
// ---------------------------------------------------------------------------
class _TruckMarker extends StatefulWidget {
  const _TruckMarker({required this.onTap});

  final VoidCallback onTap;

  @override
  State<_TruckMarker> createState() => _TruckMarkerState();
}

class _TruckMarkerState extends State<_TruckMarker>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1400),
  )..repeat(reverse: true);

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: widget.onTap,
      child: AnimatedBuilder(
        animation: _ctrl,
        builder: (_, __) {
          final pulse = 1.0 + _ctrl.value * 0.20;
          return Stack(
            alignment: Alignment.center,
            children: [
              // Pulse ring
              Transform.scale(
                scale: pulse,
                child: Container(
                  width: 52,
                  height: 52,
                  decoration: BoxDecoration(
                    color: const Color(0xFFE65100).withValues(alpha: 0.16),
                    shape: BoxShape.circle,
                  ),
                ),
              ),
              // Truck circle
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: const Color(0xFFE65100),
                  shape: BoxShape.circle,
                  border: Border.all(color: Colors.white, width: 2.5),
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFFE65100).withValues(alpha: 0.45),
                      blurRadius: 10,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: const Icon(
                  Icons.local_shipping_rounded,
                  color: Colors.white,
                  size: 20,
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Bottom preview panel — shown when a marker is tapped
// ---------------------------------------------------------------------------
class _PointPreviewPanel extends StatelessWidget {
  const _PointPreviewPanel({
    required this.point,
    required this.onDismiss,
    required this.onViewDetail,
  });

  final RouteMapPoint point;
  final VoidCallback onDismiss;
  final VoidCallback onViewDetail;

  Color get _accentColor {
    // Last point in activeRouteMapPoints = delivery
    if (point.id == activeRouteMapPoints.last.id) return const Color(0xFFC62828);
    return point.claimed ? const Color(0xFF2E7D32) : const Color(0xFF1565C0);
  }

  String get _typeLabel {
    if (point.id == activeRouteMapPoints.last.id) return 'Delivery Point';
    return point.claimed ? 'Claimed Load' : 'Available Load';
  }

  @override
  Widget build(BuildContext context) {
    final color = _accentColor;
    return Container(
      margin: const EdgeInsets.fromLTRB(12, 0, 12, 16),
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
      decoration: BoxDecoration(
        color: TruxifyColors.cardBackground,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.15),
            blurRadius: 18,
            offset: const Offset(0, -2),
          ),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Drag handle
          Center(
            child: Container(
              width: 36,
              height: 4,
              margin: const EdgeInsets.only(bottom: 12),
              decoration: BoxDecoration(
                color: TruxifyColors.border,
                borderRadius: BorderRadius.circular(999),
              ),
            ),
          ),

          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Colored icon
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(point.icon, color: color, size: 22),
              ),
              const SizedBox(width: 12),

              // Title + subtitle
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            point.title,
                            style: Theme.of(context)
                                .textTheme
                                .titleMedium
                                ?.copyWith(fontWeight: FontWeight.w700),
                          ),
                        ),
                        GestureDetector(
                          onTap: onDismiss,
                          child: const Icon(
                            Icons.close_rounded,
                            size: 20,
                            color: TruxifyColors.secondaryText,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 2),
                    Text(
                      point.subtitle,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: TruxifyColors.secondaryText,
                          ),
                    ),
                  ],
                ),
              ),
            ],
          ),

          const SizedBox(height: 10),

          // Type pill
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.10),
              borderRadius: BorderRadius.circular(999),
            ),
            child: Text(
              _typeLabel,
              style: TextStyle(
                color: color,
                fontSize: 11,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),

          const SizedBox(height: 14),

          // Details snippet
          Text(
            point.details,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: TruxifyColors.secondaryText,
                ),
          ),

          const SizedBox(height: 14),

          // CTA
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: onViewDetail,
              style: ElevatedButton.styleFrom(
                backgroundColor: color,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 13),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12)),
                elevation: 0,
              ),
              child: Text(
                point.claimed ? 'View Details' : 'Claim This Load',
                style: const TextStyle(
                    fontWeight: FontWeight.w700, fontSize: 15),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
