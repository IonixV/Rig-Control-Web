import { describe, expect, it } from 'vitest';
import { renumberSegments, type CompactSegment } from './CompactLayout';
import type { GridItem } from '../types/layout';

function item(overrides: Partial<GridItem> & Pick<GridItem, 'i' | 'x' | 'y'>): GridItem {
  return { w: 3, h: 1, ...overrides };
}

describe('renumberSegments', () => {
  it('returns an empty array for no segments', () => {
    expect(renumberSegments([])).toEqual([]);
  });

  it('assigns a single full-width segment to row 0', () => {
    const segments: CompactSegment[] = [
      { type: 'full', item: item({ i: 'vfo', x: 0, y: 5, w: 9, h: 2 }) },
    ];

    expect(renumberSegments(segments)).toEqual([{ i: 'vfo', x: 0, y: 0, w: 9, h: 2 }]);
  });

  it('collapses a cols segment\'s distinct y values to dense sequential rows, preserving item order within a row', () => {
    const segments: CompactSegment[] = [
      {
        type: 'cols',
        items: [
          item({ i: 'a', x: 0, y: 3 }),
          item({ i: 'b', x: 3, y: 3 }),
          item({ i: 'c', x: 0, y: 5 }),
        ],
      },
    ];

    expect(renumberSegments(segments)).toEqual([
      { i: 'a', x: 0, y: 0, w: 3, h: 1 },
      { i: 'b', x: 3, y: 0, w: 3, h: 1 },
      { i: 'c', x: 0, y: 1, w: 3, h: 1 },
    ]);
  });

  it('continues the row counter across a full segment followed by a cols segment', () => {
    const segments: CompactSegment[] = [
      { type: 'full', item: item({ i: 'vfo', x: 0, y: 0, w: 9, h: 2 }) },
      {
        type: 'cols',
        items: [item({ i: 'a', x: 0, y: 10 }), item({ i: 'b', x: 3, y: 12 })],
      },
    ];

    expect(renumberSegments(segments)).toEqual([
      { i: 'vfo', x: 0, y: 0, w: 9, h: 2 },
      { i: 'a', x: 0, y: 1, w: 3, h: 1 },
      { i: 'b', x: 3, y: 2, w: 3, h: 1 },
    ]);
  });
});
