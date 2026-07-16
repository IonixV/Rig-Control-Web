// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { formatExtendedCommand, parseExtendedResponse } from './rigComm.ts';

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
