import { beforeEach, describe, expect, it } from 'vitest';
import { checkAndClearPreferences, clearUserPreferences, nsKey } from './useAuth';

// Pure exported helpers only — the useAuth hook's socket-driven state
// machine itself is out of scope for this pass.

beforeEach(() => {
  localStorage.clear();
});

describe('nsKey', () => {
  it('uppercases the callsign and joins it with the key', () => {
    expect(nsKey('w1abc', 'foo')).toBe('W1ABC:foo');
  });
});

describe('clearUserPreferences', () => {
  it('removes every namespaced preference key for that callsign', () => {
    localStorage.setItem('W1ABC:grid-layout-v1', 'x');
    localStorage.setItem('W1ABC:console-collapsed', 'true');
    localStorage.setItem('W1ABC:prefs-cleared-at', '2026-01-01T00:00:00.000Z');

    clearUserPreferences('w1abc');

    expect(localStorage.getItem('W1ABC:grid-layout-v1')).toBeNull();
    expect(localStorage.getItem('W1ABC:console-collapsed')).toBeNull();
    expect(localStorage.getItem('W1ABC:prefs-cleared-at')).toBeNull();
  });

  it('does not touch another callsign\'s keys', () => {
    localStorage.setItem('W1ABC:console-collapsed', 'true');
    localStorage.setItem('K2XYZ:console-collapsed', 'false');

    clearUserPreferences('w1abc');

    expect(localStorage.getItem('K2XYZ:console-collapsed')).toBe('false');
  });
});

describe('checkAndClearPreferences', () => {
  it('clears and stamps the marker when no marker exists yet', () => {
    localStorage.setItem('W1ABC:console-collapsed', 'true');

    checkAndClearPreferences('w1abc', '2026-01-01T00:00:00.000Z');

    expect(localStorage.getItem('W1ABC:console-collapsed')).toBeNull();
    expect(localStorage.getItem('W1ABC:prefs-cleared-at')).not.toBeNull();
  });

  it('clears when the server timestamp is newer than the last-cleared marker', () => {
    localStorage.setItem('W1ABC:prefs-cleared-at', '2026-01-01T00:00:00.000Z');
    localStorage.setItem('W1ABC:console-collapsed', 'true');

    checkAndClearPreferences('w1abc', '2026-02-01T00:00:00.000Z');

    expect(localStorage.getItem('W1ABC:console-collapsed')).toBeNull();
  });

  it('does not clear when the server timestamp is older than or equal to the last-cleared marker', () => {
    localStorage.setItem('W1ABC:prefs-cleared-at', '2026-02-01T00:00:00.000Z');
    localStorage.setItem('W1ABC:console-collapsed', 'true');

    checkAndClearPreferences('w1abc', '2026-01-01T00:00:00.000Z');

    expect(localStorage.getItem('W1ABC:console-collapsed')).toBe('true');
  });
});
