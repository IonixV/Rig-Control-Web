import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildFilename, buildLogContent } from './DiagnosticsTab';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  delete (window as any).electron;
});

describe('buildFilename', () => {
  it('formats a timestamped .txt filename from the current date/time', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 5, 9, 5, 3));
    expect(buildFilename()).toBe('rigcontrol-web-diagnostics-20260105-090503.txt');
  });

  it('zero-pads single-digit month/day/hour/minute/second', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 11, 31, 23, 59, 9));
    expect(buildFilename()).toBe('rigcontrol-web-diagnostics-20261231-235909.txt');
  });
});

describe('buildLogContent', () => {
  it('includes a header and the joined log lines, labeled "browser" outside Electron', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 5, 9, 5, 3));
    vi.stubGlobal('navigator', { userAgent: 'TestAgent/1.0' });
    delete (window as any).electron;

    const content = buildLogContent(['line one', 'line two']);

    expect(content).toContain('RigControl Web Diagnostics');
    expect(content).toContain('Origin: browser (TestAgent/1.0)');
    expect(content).toContain('line one\nline two\n');
  });

  it('labels the origin "electron" when window.electron.isElectron is true', () => {
    vi.stubGlobal('navigator', { userAgent: 'TestAgent/1.0' });
    (window as any).electron = { isElectron: true };

    const content = buildLogContent(['line one']);

    expect(content).toContain('Origin: electron (TestAgent/1.0)');
  });

  it('produces just the header plus a trailing newline for an empty log', () => {
    vi.stubGlobal('navigator', { userAgent: 'TestAgent/1.0' });
    delete (window as any).electron;

    const content = buildLogContent([]);

    expect(content.endsWith('\n')).toBe(true);
  });
});
