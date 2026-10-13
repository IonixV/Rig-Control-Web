// @vitest-environment node
import { describe, expect, it, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { parsePort, resolvePort, saveConfiguredPort, DEFAULT_PORT } from './serverConfig.ts';

const dirs: string[] = [];
function tmp() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'rcw-cfg-'));
  dirs.push(d);
  return d;
}
afterEach(() => { dirs.splice(0).forEach(d => fs.rmSync(d, { recursive: true, force: true })); });

describe('parsePort', () => {
  it('accepts valid ports as numbers or strings', () => {
    expect(parsePort(3000)).toBe(3000);
    expect(parsePort('8443')).toBe(8443);
    expect(parsePort(65535)).toBe(65535);
  });
  it('rejects out-of-range, fractional and non-numeric values', () => {
    for (const v of [80, 1023, 65536, 3000.5, 'abc', '', null, undefined, NaN]) {
      expect(parsePort(v)).toBeNull();
    }
  });
});

describe('resolvePort', () => {
  it('defaults to 3000', () => {
    expect(resolvePort(tmp(), {})).toEqual({ port: DEFAULT_PORT, source: 'default' });
  });
  it('uses the saved config', () => {
    const d = tmp();
    saveConfiguredPort(d, 8443);
    expect(resolvePort(d, {})).toEqual({ port: 8443, source: 'config' });
  });
  it('lets RCW_PORT override the saved config', () => {
    const d = tmp();
    saveConfiguredPort(d, 8443);
    expect(resolvePort(d, { RCW_PORT: '3177' })).toEqual({ port: 3177, source: 'env' });
  });
  it('ignores a corrupt config file', () => {
    const d = tmp();
    fs.writeFileSync(path.join(d, 'server-config.json'), '{nope');
    expect(resolvePort(d, {}).source).toBe('default');
  });
});
