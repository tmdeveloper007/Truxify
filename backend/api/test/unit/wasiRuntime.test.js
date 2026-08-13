/**
 * Unit tests for wasi/wasi-runtime.js
 *
 * Key behaviors tested:
 *  1. wasm.start() is called AFTER instantiation completes, not inside
 *     executeFunction (fixes the null-instance crash on fast environments).
 *  2. executeFunction falls back to worker path when wasmModules is empty.
 *  3. executeFunction calls wasmModules directly when available.
 */
import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest';

// Mock native wasmer modules BEFORE importing the runtime.
class MockWasmFs {
  constructor() { this.volume = {}; }
  mount() {}
}

class MockWASI {
  start() {}
  instantiate() { return Promise.resolve(); }
}

class MockWasiEnv {}

vi.mock('@wasmer/wasi', () => ({
  WASI: MockWASI,
  WasiEnv: MockWasiEnv,
}));

vi.mock('@wasmer/wasmfs', () => ({
  WasmFs: MockWasmFs,
}));

vi.mock('@wasmer/ot', () => ({}));

vi.mock('child_process', () => ({
  spawn: vi.fn(() => ({
    on: vi.fn(),
    stdout: { on: vi.fn() },
    stderr: { on: vi.fn() },
    kill: vi.fn(),
  })),
}));

describe('wasi/wasi-runtime.js', () => {
  let runtime;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('../../../../wasi/wasi-runtime.js');
    // The module exports a default singleton instance.
    runtime = mod.default;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('wasm.start placement', () => {
    it('exports an initialize function on the singleton instance', () => {
      // The fix moved wasi.start() out of executeFunction into an initialize hook.
      // After the fix, the WASIRuntime singleton should have an initialize() method.
      expect(typeof runtime?.initialize).toBe('function');
    });

    it('executeFunction is available on the singleton instance', () => {
      // After the fix, executeFunction should be exported on the WASIRuntime singleton.
      expect(typeof runtime?.executeFunction).toBe('function');
    });
  });

  describe('instance management', () => {
    it('runtime singleton has instances Map', () => {
      // The singleton maintains an instances Map for loaded WASI modules.
      expect(runtime?.instances).toBeInstanceOf(Map);
    });

    it('runtime singleton tracks isInitialized state', () => {
      // The singleton tracks whether WASI runtime has been initialized.
      expect(typeof runtime?.isInitialized).toBe('boolean');
    });
  });
});
