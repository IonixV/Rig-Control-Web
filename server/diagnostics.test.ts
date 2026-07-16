// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { pushDiagnosticsLine } from './diagnostics.ts';

function fakeCtx() {
  return {
    diagnosticsLog: [] as string[],
    diagnosticsLogTimestamps: [] as number[],
    io: { emit: vi.fn() },
  } as any;
}

afterEach(() => {
  vi.useRealTimers();
});

describe('pushDiagnosticsLine', () => {
  it('prepends a timestamp to a line that does not already have one', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 15, 9, 5, 3, 42));
    const ctx = fakeCtx();

    pushDiagnosticsLine(ctx, 'plain line');

    expect(ctx.diagnosticsLog).toEqual(['[09:05:03.042] plain line']);
  });

  it('leaves an already-timestamped line unchanged', () => {
    const ctx = fakeCtx();

    pushDiagnosticsLine(ctx, '[12:34:56.789] already stamped');

    expect(ctx.diagnosticsLog).toEqual(['[12:34:56.789] already stamped']);
  });

  it('does not treat a non-timestamp bracket tag as a timestamp', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 15, 9, 5, 3, 42));
    const ctx = fakeCtx();

    pushDiagnosticsLine(ctx, '[AUDIO-INIT] starting');

    expect(ctx.diagnosticsLog).toEqual(['[09:05:03.042] [AUDIO-INIT] starting']);
  });

  it('emits diagnostics-log with the stamped line', () => {
    const ctx = fakeCtx();

    pushDiagnosticsLine(ctx, '[01:02:03.004] hello');

    expect(ctx.io.emit).toHaveBeenCalledWith('diagnostics-log', ['[01:02:03.004] hello']);
  });

  it('records a matching Date.now() timestamp alongside the line', () => {
    vi.useFakeTimers();
    const now = new Date(2026, 0, 15, 9, 5, 3, 42).getTime();
    vi.setSystemTime(now);
    const ctx = fakeCtx();

    pushDiagnosticsLine(ctx, 'line');

    expect(ctx.diagnosticsLogTimestamps).toEqual([now]);
  });

  it('prunes entries older than the 10-minute window', () => {
    vi.useFakeTimers();
    const start = new Date(2026, 0, 15, 9, 0, 0, 0).getTime();
    vi.setSystemTime(start);
    const ctx = fakeCtx();

    pushDiagnosticsLine(ctx, 'old line');
    expect(ctx.diagnosticsLog).toHaveLength(1);

    vi.setSystemTime(start + 11 * 60 * 1000); // 11 minutes later
    pushDiagnosticsLine(ctx, 'new line');

    expect(ctx.diagnosticsLog).toEqual(['[09:11:00.000] new line']);
    expect(ctx.diagnosticsLogTimestamps).toEqual([start + 11 * 60 * 1000]);
  });

  it('enforces the 5000-line hard cap even within the age window', () => {
    const ctx = fakeCtx();
    const now = Date.now();
    for (let i = 0; i < 5000; i++) {
      ctx.diagnosticsLog.push(`line ${i}`);
      ctx.diagnosticsLogTimestamps.push(now);
    }

    pushDiagnosticsLine(ctx, 'overflow line');

    expect(ctx.diagnosticsLog).toHaveLength(5000);
    expect(ctx.diagnosticsLog[0]).toBe('line 1');
    expect(ctx.diagnosticsLog.at(-1)).toContain('overflow line');
  });
});
