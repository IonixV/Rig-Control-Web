// @vitest-environment node
import os from 'os';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getLanIPs } from './tls.ts';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('getLanIPs', () => {
  it('returns non-internal IPv4 addresses from every interface', () => {
    vi.spyOn(os, 'networkInterfaces').mockReturnValue({
      eth0: [
        { address: '192.168.1.50', family: 'IPv4', internal: false } as any,
      ],
      wlan0: [
        { address: '10.0.0.5', family: 'IPv4', internal: false } as any,
      ],
    });

    expect(getLanIPs().sort()).toEqual(['10.0.0.5', '192.168.1.50']);
  });

  it('excludes loopback/internal addresses', () => {
    vi.spyOn(os, 'networkInterfaces').mockReturnValue({
      lo: [{ address: '127.0.0.1', family: 'IPv4', internal: true } as any],
    });

    expect(getLanIPs()).toEqual([]);
  });

  it('excludes IPv6 addresses', () => {
    vi.spyOn(os, 'networkInterfaces').mockReturnValue({
      eth0: [{ address: 'fe80::1', family: 'IPv6', internal: false } as any],
    });

    expect(getLanIPs()).toEqual([]);
  });

  it('skips interfaces with no addresses', () => {
    vi.spyOn(os, 'networkInterfaces').mockReturnValue({
      eth0: undefined,
      wlan0: [{ address: '10.0.0.5', family: 'IPv4', internal: false } as any],
    } as any);

    expect(getLanIPs()).toEqual(['10.0.0.5']);
  });
});
