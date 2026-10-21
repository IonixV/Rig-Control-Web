import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTheme, readStoredTheme } from './useTheme';

describe('useTheme', () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.theme;
  });

  it('defaults to dark and applies it to <html>', () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('toggles to light, applies it, and persists it', () => {
    const { result } = renderHook(() => useTheme());
    act(() => result.current.toggleTheme());
    expect(result.current.theme).toBe('light');
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(localStorage.getItem('theme')).toBe('light');
    expect(readStoredTheme()).toBe('light');
  });

  it('restores a stored light theme and ignores junk values', () => {
    localStorage.setItem('theme', 'light');
    expect(renderHook(() => useTheme()).result.current.theme).toBe('light');
    localStorage.setItem('theme', 'purple');
    expect(readStoredTheme()).toBe('dark');
  });
});
