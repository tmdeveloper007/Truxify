import { WebSocketServer } from 'ws';
import { mongoDb, redisClient, firebaseAdmin } from '../config/db.js';

// In-memory mapping of active client subscriptions
// Key: order_display_id or driver_id
// Value: Set of WebSocket client connections
const trackingSubscriptions = new Map();

// =====================================================================
// 📦 EXTRA STORAGE & BUFFER CONFIGURATIONS (#269)
// =====================================================================
let telemetryWriteBuffer = [];
const BUFFER_FLUSH_INTERVAL_MS = 20000; // 20-second sliding time window
let isSchedulerActive = false;

/**
 * Initialize WebSockets Server and bind event handlers
 */
export function initWebSocketServer(server) {
  const wss = new WebSocketServer({ noServer: true });

  // Handle upgrade event manually to allow authentication or path matching
  server.on('upgrade', (request, socket, head) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;

    if (pathname === '/ws/tracking') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  wss.on('connection', async (ws, req) => {
    // Replace legacy url.parse with new URL
    const reqUrl = new URL(req.url, 'http://localhost');
    const token    = reqUrl.searchParams.get('token');
    const bypassAuth = process.env.BYPASS_AUTH === 'true';

    if (bypassAuth) {
      ws.driverId = reqUrl.searchParams.get('driver_id') || 'test_driver';
      console.log(`🔓 WS Auth bypassed for driver: ${ws.driverId}`);
    } else {
      if (!token) {
        ws.close(4001, 'Unauthorized: No token provided');
        return;
      }
      try {
        const decoded = await firebaseAdmin.auth().verifyIdToken(token);
        ws.driverId = decoded.uid;
        console.log(`✅ WS Authenticated driver: ${ws.driverId}`);
      } catch (e) {
        console.error('WS Auth failed:', e.message);
        ws.close(4001, 'Unauthorized: Invalid token');
        return;
      }
    }

    console.log('🔌 New WebSocket connection established on /ws/tracking');
    ws.isAlive = true;

    // Ping-pong to detect dead connections
    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('message', async (message) => {
      try {
        const payload = JSON.parse(message.toString());
        const { event, data } = payload;

        if (!event || !data) {
          return ws.send(JSON.stringify({ error: 'Invalid payload format. Must include "event" and "data" keys.' }));
        }

        switch (event) {
          case 'location_ping':
            await handleLocationPing(ws, data);
            break;

          case 'subscribe_tracking':
            handleSubscribe(ws, data);
            break;

          case 'unsubscribe_tracking':
            handleUnsubscribe(ws, data);
            break;

          default:
            ws.send(JSON.stringify({ warning: `Unknown event type: ${event}` }));
        }
      } catch (err) {
        console.error('WS Message parsing error:', err.message);
        ws.send(JSON.stringify({ error: 'Invalid JSON payload structure.' }));
      }
    });

    ws.on('close', () => {
      console.log('🔌 WebSocket connection closed.');
      removeClientFromAllSubscriptions(ws);
    });

    ws.on('error', (err) => {
      console.error('🔌 WebSocket client error:', err.message);
      removeClientFromAllSubscriptions(ws);
    });
  });

  // Keep-alive polling interval every 30 seconds
  const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) {
        console.log('🔌 Terminating unresponsive WebSocket client.');
        return ws.terminate();
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on('close', () => {
    clearInterval(interval);
  });

  // Automatically spin up the DB batch flushing system thread
  if (!isSchedulerActive) {
    initTelemetryScheduler();
  }

  console.log('🚀 WebSocket tracking router initialized.');
}

/**
 * Handle incoming GPS coordinate telemetry from a driver app
 * Data properties: driver_id, order_display_id, latitude, longitude, speed, bearing, device_timestamp
 */
async function handleLocationPing(ws, data) {
  const { driver_id, order_display_id, latitude, longitude, speed, bearing, device_timestamp } = data;

  if (!driver_id || !latitude || !longitude) {
    return ws.send(JSON.stringify({ error: 'Missing mandatory tracking parameters (driver_id, lat, lng).' }));
  }

  // Use explicit device incoming timestamp or fall back to current server clock safely
  const currentPingTime = device_timestamp ? new Date(device_timestamp) : new Date();
  const incomingEpoch = currentPingTime.getTime();

  // 🛡️ 1. IDEMPOTENCY GATE & OUT-OF-ORDER SEQUENCER
  if (redisClient) {
    try {
      const seqKey = `driver:sequence:${driver_id}`;
      const lastRecordedEpochStr = await redisClient.get(seqKey);
      
      if (lastRecordedEpochStr) {
        const lastRecordedEpoch = parseInt(lastRecordedEpochStr, 10);
        
        // If arriving frame is older or matches current timeline sequence (Jitter drop), terminate pipeline execution
        if (incomingEpoch <= lastRecordedEpoch) {
          console.warn(`[TRUXIFY SEQUENCE CONTROL] Out-of-order telemetry dropped for Driver: ${driver_id}. Stale jitter detected.`);
          return;
        }
      }
      
      // Update high-speed caching with current epoch sequence checkpoint
      await redisClient.set(seqKey, incomingEpoch.toString(), 'EX', 86400); // 24hr retention limit
    } catch (err) {
      console.error('Redis sequence verification cache error:', err.message);
    }
  }

  // 🛡️ 2. WRITE-BUFFER DEFERMENT (BATCHING)
  // Instead of pushing to MongoDB on every single ping, append array snapshots to buffer layout
  telemetryWriteBuffer.push({
    driver_id,
    order_display_id: order_display_id || null,
    location: {
      type: 'Point',
      coordinates: [parseFloat(longitude), parseFloat(latitude)]
    },
    speed_kmh: speed || 0,
    bearing_deg: bearing || 0,
    pinged_at: currentPingTime,
    buffered_at: new Date()
  });

  // 3. Cache current location in Redis with 2 minutes expiry (Upstash telemetry fallback)
  if (redisClient) {
    try {
      const redisKey = `driver:location:${driver_id}`;
      await redisClient.set(
        redisKey,
        JSON.stringify({ latitude, longitude, speed, bearing, updated_at: currentPingTime }),
        'EX',
        120
      );
    } catch (err) {
      console.error('Redis cache telemetry error:', err.message);
    }
  }

  // 4. Broadcast to all clients subscribed to this driver's telemetry stream
  const broadcastPayload = JSON.stringify({
    event: 'location_update',
    data: {
      driver_id,
      order_display_id,
      latitude,
      longitude,
      speed,
      bearing,
      timestamp: currentPingTime
    }
  });

  // Broadcast to subscribers of order
  if (order_display_id && trackingSubscriptions.has(order_display_id)) {
    const clients = trackingSubscriptions.get(order_display_id);
    clients.forEach((client) => {
      if (client.readyState === 1) { // OPEN
        client.send(broadcastPayload);
      }
    });
  }

  // Broadcast to subscribers of driver
  if (trackingSubscriptions.has(driver_id)) {
    const clients = trackingSubscriptions.get(driver_id);
    clients.forEach((client) => {
      if (client.readyState === 1) {
        client.send(broadcastPayload);
      }
    });
  }
}

/**
 * Periodically dumps the aggregated batch matrix logs into MongoDB Atlas database collections
 */
async function flushTelemetryBuffer() {
  if (telemetryWriteBuffer.length === 0) return;

  // Clone current buffer block state and isolate storage arrays instantly
  const recordsToFlush = [...telemetryWriteBuffer];
  telemetryWriteBuffer = [];

  console.log(`[TRUXIFY BATCH CONTROL] Committing bulk cluster of ${recordsToFlush.length} spatial rows to MongoDB...`);

  if (mongoDb) {
    try {
      const collection = mongoDb.collection('live_gps_pings');
      // Bulk insert array elements simultaneously
      await collection.insertMany(recordsToFlush, { ordered: false });
      console.log(`[TRUXIFY DB SUCCESS] Successfully flushed ${recordsToFlush.length} records to MongoDB clusters.`);
    } catch (err) {
      console.error('Mongo bulk insert telemetry logs crashed:', err.message);
      // Recovery track: re-insert frames back into execution pools
      telemetryWriteBuffer = [...recordsToFlush, ...telemetryWriteBuffer];
    }
  }
}

/**
 * Initializes sliding scheduler clock cycles
 */
function initTelemetryScheduler() {
  isSchedulerActive = true;
  setInterval(async () => {
    await flushTelemetryBuffer();
  }, BUFFER_FLUSH_INTERVAL_MS);
}

/**
 * Subscribe a customer socket to location broadcasts for an order or driver
 */
function handleSubscribe(ws, data) {
  const { order_display_id, driver_id } = data;
  const targetId = order_display_id || driver_id;

  if (!targetId) {
    return ws.send(JSON.stringify({ error: 'Subscription target (order_display_id or driver_id) is missing.' }));
  }

  if (!trackingSubscriptions.has(targetId)) {
    trackingSubscriptions.set(targetId, new Set());
  }

  trackingSubscriptions.get(targetId).add(ws);
  console.log(`🔌 Client subscribed to telemetry updates for: "${targetId}"`);
  ws.send(JSON.stringify({ status: 'subscribed', target: targetId }));
}

/**
 * Unsubscribe a customer socket from location broadcasts
 */
function handleUnsubscribe(ws, data) {
  const { order_display_id, driver_id } = data;
  const targetId = order_display_id || driver_id;

  if (targetId && trackingSubscriptions.has(targetId)) {
    trackingSubscriptions.get(targetId).delete(ws);
    console.log(`🔌 Client unsubscribed from updates for: "${targetId}"`);
    ws.send(JSON.stringify({ status: 'unsubscribed', target: targetId }));
  }
}

/**
 * Cleanup client socket from tracking logs on connection drop
 */
function removeClientFromAllSubscriptions(ws) {
  trackingSubscriptions.forEach((clients, key) => {
    if (clients.has(ws)) {
      clients.delete(ws);
      console.log(`🔌 Removed socket subscription from "${key}" due to disconnect.`);
    }
    // Clean up empty subscription groups
    if (clients.size === 0) {
      trackingSubscriptions.delete(key);
    }
  });
}
