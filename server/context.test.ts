// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { createInitialContext } from './context.ts';

describe('createInitialContext', () => {
  it('passes through io/baseDir/dataDir unchanged', () => {
    const fakeIo = { emit: () => {} } as any;
    const ctx = createInitialContext(fakeIo, '/base', '/data');

    expect(ctx.io).toBe(fakeIo);
    expect(ctx.baseDir).toBe('/base');
    expect(ctx.dataDir).toBe('/data');
  });

  it('defaults rig polling and connection state', () => {
    const ctx = createInitialContext({} as any, '/base', '/data');

    expect(ctx.pollRate).toBe(2000);
    expect(ctx.isConnected).toBe(false);
    expect(ctx.autoReconnect).toBe(false);
    expect(ctx.clientHost).toBe('127.0.0.1');
    expect(ctx.clientPort).toBe(4532);
    expect(ctx.vfoSupported).toBe(true);
    expect(ctx.powerSupported).toBe(false);
    expect(ctx.powerState).toBe('unknown');
  });

  it('defaults spectrum settings to disabled Hamlib UDP on the standard multicast group', () => {
    const ctx = createInitialContext({} as any, '/base', '/data');

    expect(ctx.spectrumSettings).toEqual({
      enabled: false,
      source: 'hamlib',
      multicastAddr: '224.0.0.1',
      multicastPort: 4531,
      ft4222SpanIndex: 5,
    });
    expect(ctx.spectrumSupported).toBe(false);
    expect(ctx.spectrumSocket).toBeNull();
  });

  it('defaults lastStatus to a plausible idle rig snapshot', () => {
    const ctx = createInitialContext({} as any, '/base', '/data');

    expect(ctx.lastStatus).toMatchObject({
      frequency: '14074000',
      mode: 'USB',
      bandwidth: '2400',
      ptt: false,
      vfo: 'VFOA',
      isSplit: false,
      txVFO: 'VFOB',
      powerState: 'unknown',
      powerPending: false,
    });
  });

  it('provides working default no-op saveSettings and a rejecting default sendToRig', async () => {
    const ctx = createInitialContext({} as any, '/base', '/data');

    expect(() => ctx.saveSettings()).not.toThrow();
    await expect(ctx.sendToRig('f')).rejects.toBeTruthy();
  });

  it('starts empty auth/queue/log collections', () => {
    const ctx = createInitialContext({} as any, '/base', '/data');

    expect(ctx.authenticatedSockets.size).toBe(0);
    expect(ctx.rigCommandQueue).toEqual([]);
    expect(ctx.rigctldLogs).toEqual([]);
    expect(ctx.diagnosticsLog).toEqual([]);
    expect(ctx.pendingQuickPolls.size).toBe(0);
  });
});
