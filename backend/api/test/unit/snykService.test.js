import { describe, expect, it, vi, beforeEach } from 'vitest';

// Shared exec mock state
const execCalls = [];
const execResponses = {};

vi.mock('child_process', () => ({
  exec: vi.fn((cmd, opts, cb) => {
    execCalls.push({ cmd, opts });
    const key = cmd.trim().split(' ').slice(0, 5).join(' ');
    const response = execResponses[key] || { code: 0, stdout: '{"vulnerabilities":[]}', stderr: '' };
    if (typeof opts === 'function') {
      opts(response);
    } else if (cb) {
      cb(null, response.stdout, response.stderr);
    }
    return { on: vi.fn() };
  }),
}));

vi.mock('../../src/middleware/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

describe('SnykService — exit code handling and path storage', () => {
  let svc;

  beforeEach(async () => {
    execCalls.length = 0;
    Object.keys(execResponses).forEach(k => delete execResponses[k]);
    vi.resetModules();
    // eslint-disable-next-line global-require
    const SnykSvc = (await import('../../../../snyk/snyk.service.js')).default;
    // Export is `export default new SnykService()` — a singleton instance.
    svc = SnykSvc;
    // Reset mutable state between tests.
    svc.scanResults = [];
    svc.vulnerabilities = [];
  });

  function mockExec(pattern, response) {
    execResponses[pattern] = response;
  }

  it('scanCode stores the sanitized path, not the Node path module', async () => {
    mockExec('snyk code test ./my-project --severity-threshold=high --json', {
      code: 1,
      stdout: '{"results":[]}',
      stderr: '',
    });

    const result = await svc.scanCode('./my-project');

    expect(result.success).toBe(true);
    // The record must store the actual scanned path, not the Node path module.
    const lastRecord = svc.scanResults[svc.scanResults.length - 1];
    expect(lastRecord.path).toBe('./my-project');
  });

  it('scanDependencies treats exit code 1 (vulnerabilities found) as success', async () => {
    mockExec('snyk test --severity-threshold=high --json', {
      code: 1,
      stdout: '{"vulnerabilities":[]}',
      stderr: '',
    });

    const result = await svc.scanDependencies('/some/path');

    expect(result.success).toBe(true);
    expect(result.data).toHaveProperty('vulnerabilities');
  });

  it('scanDependencies treats exit code 2 (real error) as failure', async () => {
    mockExec('snyk test --severity-threshold=high --json', {
      code: 2,
      stdout: '',
      stderr: 'Authentication failed. Please set SNYK_TOKEN.',
    });

    const result = await svc.scanDependencies('/some/path');

    expect(result.success).toBe(false);
    expect(result.error).toContain('Authentication failed');
  });

  it('scanCode treats exit code 0 (no issues) as success', async () => {
    mockExec('snyk code test . --severity-threshold=high --json', {
      code: 0,
      stdout: '{"results":[]}',
      stderr: '',
    });

    const result = await svc.scanCode('.');

    expect(result.success).toBe(true);
  });
});
