import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getRouteEstimate, __testing } from '../../src/services/osrm.js';

const { buildRouteUrl, DEFAULT_OSRM_BASE_URL, DEFAULT_TIMEOUT_MS } = __testing;

describe('osrm - buildRouteUrl', () => {
  it('builds correct URL with coordinates', () => {
    const url = buildRouteUrl({
      pickupLat: 12.9716,
      pickupLng: 77.5946,
      dropLat: 13.0827,
      dropLng: 80.2707,
    });

    expect(url.toString()).toContain('77.5946,12.9716;80.2707,13.0827');
    expect(url.searchParams.get('overview')).toBe('false');
    expect(url.searchParams.get('steps')).toBe('false');
  });

  it('uses OSRM_BASE_URL env variable when set', () => {
    process.env.OSRM_BASE_URL = 'http://my-osrm-server.com';

    const url = buildRouteUrl({
      pickupLat: 12.9716,
      pickupLng: 77.5946,
      dropLat: 13.0827,
      dropLng: 80.2707,
    });

    expect(url.toString()).toContain('my-osrm-server.com');

    delete process.env.OSRM_BASE_URL;
  });

  it('falls back to DEFAULT_OSRM_BASE_URL when env not set', () => {
    const url = buildRouteUrl({
      pickupLat: 1, pickupLng: 2, dropLat: 3, dropLng: 4,
    });

    expect(url.toString()).toContain(DEFAULT_OSRM_BASE_URL.replace('https://', ''));
  });
});

describe('osrm - getRouteEstimate', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns null when coordinates are missing', async () => {
    const result = await getRouteEstimate({});
    expect(result).toBeNull();
  });

  it('returns null when coordinates are non-finite', async () => {
    const result = await getRouteEstimate({
      pickupLat: NaN,
      pickupLng: 77.5,
      dropLat: 13.0,
      dropLng: 80.2,
    });
    expect(result).toBeNull();
  });

  it('returns null when called with no arguments', async () => {
    const result = await getRouteEstimate();
    expect(result).toBeNull();
  });

  it('returns null when fetch response is not ok', async () => {
    fetch.mockResolvedValue({ ok: false });

    const result = await getRouteEstimate({
      pickupLat: 12.9, pickupLng: 77.5, dropLat: 13.0, dropLng: 80.2,
    });

    expect(result).toBeNull();
  });

  it('returns null when routes array is empty', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ routes: [] }),
    });

    const result = await getRouteEstimate({
      pickupLat: 12.9, pickupLng: 77.5, dropLat: 13.0, dropLng: 80.2,
    });

    expect(result).toBeNull();
  });

  it('returns null when route distance is invalid', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ routes: [{ distance: -1, duration: 3600 }] }),
    });

    const result = await getRouteEstimate({
      pickupLat: 12.9, pickupLng: 77.5, dropLat: 13.0, dropLng: 80.2,
    });

    expect(result).toBeNull();
  });

  it('returns distanceKm and durationSeconds on valid response', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        routes: [{ distance: 45000, duration: 3600 }],
      }),
    });

    const result = await getRouteEstimate({
      pickupLat: 12.9, pickupLng: 77.5, dropLat: 13.0, dropLng: 80.2,
    });

    expect(result).toEqual({ distanceKm: 45, durationSeconds: 3600 });
  });

  it('returns null durationSeconds when duration is not finite', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        routes: [{ distance: 20000, duration: NaN }],
      }),
    });

    const result = await getRouteEstimate({
      pickupLat: 12.9, pickupLng: 77.5, dropLat: 13.0, dropLng: 80.2,
    });

    expect(result).toEqual({ distanceKm: 20, durationSeconds: null });
  });

  it('returns null when fetch throws (e.g. timeout/abort)', async () => {
    fetch.mockRejectedValue(new Error('AbortError'));

    const result = await getRouteEstimate({
      pickupLat: 12.9, pickupLng: 77.5, dropLat: 13.0, dropLng: 80.2,
    });

    expect(result).toBeNull();
  });

  it('uses OSRM_TIMEOUT_MS env variable', async () => {
    process.env.OSRM_TIMEOUT_MS = '3000';

    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ routes: [{ distance: 10000, duration: 600 }] }),
    });

    const result = await getRouteEstimate({
      pickupLat: 12.9, pickupLng: 77.5, dropLat: 13.0, dropLng: 80.2,
    });

    expect(result).not.toBeNull();

    delete process.env.OSRM_TIMEOUT_MS;
  });
});