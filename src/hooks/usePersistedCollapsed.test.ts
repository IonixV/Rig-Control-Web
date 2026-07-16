import { beforeEach, describe, expect, it } from 'vitest';
import { readCollapsed } from './usePersistedCollapsed';

const ns = (key: string) => `W1ABC:${key}`;

beforeEach(() => {
  localStorage.clear();
});

describe('readCollapsed', () => {
  it('returns the namespaced value when present', () => {
    localStorage.setItem(ns('foo-collapsed'), 'true');

    expect(readCollapsed(ns, 'foo-collapsed', null, false)).toBe(true);
  });

  it('falls back to the legacy key when the namespaced key is absent', () => {
    localStorage.setItem(ns('legacy-foo-collapsed'), 'false');

    expect(readCollapsed(ns, 'foo-collapsed', 'legacy-foo-collapsed', true)).toBe(false);
  });

  it('falls back to defaultCollapsed when neither key is present', () => {
    expect(readCollapsed(ns, 'foo-collapsed', 'legacy-foo-collapsed', true)).toBe(true);
    expect(readCollapsed(ns, 'foo-collapsed', null, false)).toBe(false);
  });

  it('prefers the namespaced value over the legacy value when both are present', () => {
    localStorage.setItem(ns('foo-collapsed'), 'false');
    localStorage.setItem(ns('legacy-foo-collapsed'), 'true');

    expect(readCollapsed(ns, 'foo-collapsed', 'legacy-foo-collapsed', true)).toBe(false);
  });
});
