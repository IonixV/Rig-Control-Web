import { describe, it, expect } from 'vitest';
import { formatRawCommand } from './useRigControl';

describe('formatRawCommand', () => {
  it('prefixes a single-letter short-form command with a bare +', () => {
    expect(formatRawCommand('f')).toBe('+f');
    expect(formatRawCommand('m')).toBe('+m');
  });

  it('prefixes a multi-letter long-form command name with +\\', () => {
    expect(formatRawCommand('get_powerstat')).toBe('+\\get_powerstat');
    expect(formatRawCommand('dump_state')).toBe('+\\dump_state');
  });

  it('prefixes a single-letter command with arguments using a bare +', () => {
    expect(formatRawCommand('l NB')).toBe('+l NB');
  });

  it('trims surrounding whitespace before prefixing', () => {
    expect(formatRawCommand('  f  ')).toBe('+f');
  });

  it('passes through commands the user already prefixed with +', () => {
    expect(formatRawCommand('+f')).toBe('+f');
    expect(formatRawCommand('+\\get_powerstat')).toBe('+\\get_powerstat');
  });
});
