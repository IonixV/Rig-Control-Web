// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { formatExtendedCommand, normalizeVfoName, parseExtendedResponse, resetRigState } from './rigComm.ts';
import { createInitialContext } from './context.ts';

describe('normalizeVfoName', () => {
  it('maps Main/Sub to VFOA/VFOB', () => {
    expect(normalizeVfoName('Main')).toBe('VFOA');
    expect(normalizeVfoName('Sub')).toBe('VFOB');
  });

  it('passes through already-normalized or unrecognized names', () => {
    expect(normalizeVfoName('VFOA')).toBe('VFOA');
    expect(normalizeVfoName('VFOB')).toBe('VFOB');
    expect(normalizeVfoName('Other')).toBe('Other');
  });

  it('trims whitespace before comparing', () => {
    expect(normalizeVfoName('  Main  ')).toBe('VFOA');
    expect(normalizeVfoName('  Sub\n')).toBe('VFOB');
  });
});

describe('formatExtendedCommand', () => {
  it('prefixes single-letter short-form commands with +', () => {
    expect(formatExtendedCommand('f')).toBe('+f');
    expect(formatExtendedCommand('  t  ')).toBe('+t');
  });

  it('prefixes multi-letter long-form commands with +\\', () => {
    expect(formatExtendedCommand('get_powerstat')).toBe('+\\get_powerstat');
  });

  it('preserves arguments after a single-letter command name', () => {
    expect(formatExtendedCommand('F 14074000')).toBe('+F 14074000');
  });

  it('preserves arguments after a long-form command name', () => {
    expect(formatExtendedCommand('set_freq 14074000')).toBe('+\\set_freq 14074000');
  });
});

describe('parseExtendedResponse', () => {
  it('returns the raw response unchanged if it has fewer than 3 lines', () => {
    expect(parseExtendedResponse('RPRT 0')).toBe('RPRT 0');
    expect(parseExtendedResponse('Frequency: 14074000\nRPRT 0')).toBe(
      'Frequency: 14074000\nRPRT 0',
    );
  });

  it('throws on an RPRT 1 error response', () => {
    expect(() =>
      parseExtendedResponse('get_freq:\nFrequency: 14074000\nRPRT 1'),
    ).toThrow('Rig command error (RPRT 1)');
  });

  it('strips the echoed command line and trailing RPRT line, extracting labeled values', () => {
    const resp = 'get_freq:\nFrequency: 14074000\nRPRT 0';
    expect(parseExtendedResponse(resp)).toBe('14074000');
  });

  it('joins multiple labeled value lines with newlines', () => {
    const resp = 'get_mode:\nMode: USB\nPassband: 2400\nRPRT 0';
    expect(parseExtendedResponse(resp)).toBe('USB\n2400');
  });

  it('passes through lines with no colon label as-is', () => {
    const resp = 'dump_state:\nplain line\nRPRT 0';
    expect(parseExtendedResponse(resp)).toBe('plain line');
  });
});

describe('resetRigState', () => {
  it('resets power/capability flags and lastStatus to their documented defaults', () => {
    const ctx = createInitialContext({} as any, '/base', '/data');

    // Dirty the fields resetRigState is responsible for clearing.
    ctx.vfoSupported = false;
    ctx.powerSupported = true;
    ctx.powerState = 'off';
    ctx.powerOpInProgress = true;
    ctx.lastPowerCheck = 123456;
    ctx.powerOffProbeFailureCount = 3;
    ctx.pendingCapabilityProbe = true;
    ctx.knownPoweredOff = true;
    ctx.lastStatus = { ...ctx.lastStatus, frequency: '7074000', ptt: true, mode: 'CW' };

    resetRigState(ctx);

    expect(ctx.vfoSupported).toBe(true);
    expect(ctx.powerSupported).toBe(false);
    expect(ctx.powerState).toBe('unknown');
    expect(ctx.powerOpInProgress).toBe(false);
    expect(ctx.lastPowerCheck).toBe(0);
    expect(ctx.powerOffProbeFailureCount).toBe(0);
    expect(ctx.pendingCapabilityProbe).toBe(false);
    expect(ctx.knownPoweredOff).toBe(false);
    expect(ctx.lastStatus).toEqual({
      frequency: '14074000',
      mode: 'USB',
      bandwidth: '2400',
      ptt: false,
      smeter: -54,
      swr: 1.0,
      alc: 0,
      powerMeter: 0,
      rfpower: 0.5,
      vdd: 13.8,
      vfo: 'VFOA',
      isSplit: false,
      txVFO: 'VFOB',
      rfLevel: 0,
      agc: 6,
      attenuation: 0,
      preamp: 0,
      nb: false,
      nbLevel: 0,
      nr: false,
      nrLevel: 8 / 15,
      anf: false,
      tuner: false,
      powerState: 'unknown',
      powerPending: false,
    });
  });
});
