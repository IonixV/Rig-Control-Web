import { describe, expect, it } from 'vitest';
import { computeSwappedPositions } from './PhoneLayout';
import type { GridItem } from '../types/layout';

function item(i: string, y: number): GridItem {
  return { i, x: 0, y, w: 6, h: 2 };
}

describe('computeSwappedPositions', () => {
  const visibleItems = [item('a', 0), item('b', 2), item('c', 4)];

  it('swaps y values with the previous item when moving up', () => {
    const updates = computeSwappedPositions(visibleItems[1], 'up', 1, visibleItems);

    expect(updates).toEqual([
      { i: 'b', x: 0, y: 0, w: 6, h: 2 },
      { i: 'a', x: 0, y: 2, w: 6, h: 2 },
    ]);
  });

  it('swaps y values with the next item when moving down', () => {
    const updates = computeSwappedPositions(visibleItems[1], 'down', 1, visibleItems);

    expect(updates).toEqual([
      { i: 'b', x: 0, y: 4, w: 6, h: 2 },
      { i: 'c', x: 0, y: 2, w: 6, h: 2 },
    ]);
  });

  it('returns null when the first item tries to move up', () => {
    expect(computeSwappedPositions(visibleItems[0], 'up', 0, visibleItems)).toBeNull();
  });

  it('returns null when the last item tries to move down', () => {
    const lastIdx = visibleItems.length - 1;
    expect(computeSwappedPositions(visibleItems[lastIdx], 'down', lastIdx, visibleItems)).toBeNull();
  });
});
