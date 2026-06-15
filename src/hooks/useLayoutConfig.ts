import { useState, useCallback } from 'react';
import type { LayoutConfig, ViewLayout, GridItem, PanelType, PanelAddConfig } from '../types/layout';
import { PANEL_MIN_SIZES, mufMapStorageKey } from '../types/layout';


const BASE_STORAGE_KEY = 'grid-layout-v1';

export const DEFAULT_COMPACT_LAYOUT: ViewLayout = {
  cols: 2,
  rows: 4,
  items: [
    { i: 'vfo',         x: 0, y: 0, w: 2, h: 1, minW: 2, minH: 1, panelType: 'vfo' },
    { i: 'smeter',      x: 0, y: 1, w: 1, h: 1, minW: 1, minH: 1, panelType: 'smeter' },
    { i: 'audio_feed',  x: 1, y: 1, w: 1, h: 1, minW: 1, minH: 1, panelType: 'audio_feed' },
    { i: 'controls',    x: 0, y: 2, w: 1, h: 1, minW: 1, minH: 1, panelType: 'controls' },
    { i: 'video_feed',  x: 1, y: 2, w: 1, h: 1, minW: 1, minH: 1, panelType: 'video_feed' },
    { i: 'rflevels',    x: 0, y: 3, w: 1, h: 1, minW: 1, minH: 1, panelType: 'rflevels' },
    { i: 'cwdecode',    x: 1, y: 3, w: 1, h: 1, minW: 1, minH: 1, panelType: 'cwdecode' },
  ],
};

export const DEFAULT_PHONE_LAYOUT: ViewLayout = {
  cols: 1,
  rows: 8,
  items: [
    { i: 'vfo', x: 0, y: 0, w: 1, h: 1, minW: 1, minH: 1, panelType: 'vfo' },
    { i: 'video_feed', x: 0, y: 1, w: 1, h: 1, minW: 1, minH: 1, panelType: 'video_feed' },
    { i: 'audio_feed', x: 0, y: 2, w: 1, h: 1, minW: 1, minH: 1, panelType: 'audio_feed' },
    { i: 'smeter', x: 0, y: 3, w: 1, h: 1, minW: 1, minH: 1, panelType: 'smeter' },
    { i: 'controls', x: 0, y: 4, w: 1, h: 2, minW: 1, minH: 1, panelType: 'controls' },
    { i: 'spots_pota', x: 0, y: 6, w: 1, h: 1, minW: 1, minH: 1, panelType: 'spots_pota' },
    { i: 'spots_sota', x: 0, y: 7, w: 1, h: 1, minW: 1, minH: 1, panelType: 'spots_sota' },
    { i: 'commandconsole', x: 0, y: 8, w: 1, h: 1, minW: 1, minH: 1, panelType: 'commandconsole' },
  ],
};

const DEFAULT_LAYOUT: LayoutConfig = {
  compact: DEFAULT_COMPACT_LAYOUT,
  phone: DEFAULT_PHONE_LAYOUT,
};

function loadFromStorage(storageKey: string): LayoutConfig | null {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    const config = JSON.parse(raw) as LayoutConfig;
    const hasLegacyPanel = (items: { panelType?: string }[]) =>
      items.some(item => item.panelType === 'videoaudio');
    if (hasLegacyPanel(config.compact.items) || hasLegacyPanel(config.phone.items)) {
      localStorage.removeItem(storageKey);
      return null;
    }
    return config;
  } catch {
    return null;
  }
}

function saveToStorage(storageKey: string, config: LayoutConfig): void {
  try {
    localStorage.setItem(storageKey, JSON.stringify(config));
  } catch {
    // ignore
  }
}

// Reset MufMapPanel's saved pan/zoom + tab selection so re-adding the panel starts fresh.
function clearMufMapState(callsign: string): void {
  try {
    localStorage.removeItem(mufMapStorageKey(callsign));
  } catch {
    // ignore
  }
}

export function useLayoutConfig(callsign = "") {
  const storageKey = callsign
    ? `${callsign.toUpperCase()}:${BASE_STORAGE_KEY}`
    : BASE_STORAGE_KEY;
  const [config, setConfig] = useState<LayoutConfig>(() => loadFromStorage(storageKey) ?? DEFAULT_LAYOUT);

  const setCompactLayout = useCallback((layout: ViewLayout) => {
    setConfig(prev => {
      const next = { ...prev, compact: layout };
      saveToStorage(storageKey, next);
      return next;
    });
  }, []);

  const setPhoneLayout = useCallback((layout: ViewLayout) => {
    setConfig(prev => {
      const next = { ...prev, phone: layout };
      saveToStorage(storageKey, next);
      return next;
    });
  }, []);

  const addPanel = useCallback((view: 'compact' | 'phone', panelType: PanelType, config?: PanelAddConfig) => {
    setConfig(prev => {
      const viewLayout = prev[view];
      const mins = PANEL_MIN_SIZES[panelType];
      const isFullWidth = config?.fullWidth ?? false;
      const newItem: GridItem = {
        i: `${panelType}-${Date.now()}`,
        x: 0,
        y: viewLayout.items.reduce((max, item) => Math.max(max, item.y + item.h), 0),
        w: isFullWidth ? 9999 : (mins?.minW ?? 1),
        h: mins?.minH ?? 1,
        minW: mins?.minW ?? 1,
        minH: mins?.minH ?? 1,
        panelType,
        ...(config?.heightPx !== undefined && { heightPx: config.heightPx }),
        ...(config?.fullWidth !== undefined && { fullWidth: config.fullWidth }),
      };
      const next = { ...prev, [view]: { ...viewLayout, items: [...viewLayout.items, newItem] } };
      saveToStorage(storageKey, next);
      return next;
    });
  }, []);

  const removePanel = useCallback((view: 'compact' | 'phone', itemId: string) => {
    setConfig(prev => {
      const viewLayout = prev[view];
      const removedItem = viewLayout.items.find(i => i.i === itemId);
      if (removedItem?.panelType === 'mufmap') clearMufMapState(callsign);
      const next = { ...prev, [view]: { ...viewLayout, items: viewLayout.items.filter(i => i.i !== itemId) } };
      saveToStorage(storageKey, next);
      return next;
    });
  }, [callsign]);

  const setGridSize = useCallback((view: 'compact' | 'phone', cols: number, rows: number) => {
    setConfig(prev => {
      const viewLayout = prev[view];
      const clampedItems = viewLayout.items
        .filter(item => item.x < cols && item.y < rows)
        .map(item => ({
          ...item,
          w: Math.min(item.w, cols - item.x),
          h: Math.min(item.h, rows - item.y),
        }));
      const next = { ...prev, [view]: { ...viewLayout, cols, rows, items: clampedItems } };
      saveToStorage(storageKey, next);
      return next;
    });
  }, []);

  const updateItemPositions = useCallback((view: 'compact' | 'phone', updatedItems: Array<{ i: string; x: number; y: number; w: number; h: number }>) => {
    setConfig(prev => {
      const viewLayout = prev[view];
      const posMap = new Map(updatedItems.map(u => [u.i, u]));
      const mergedItems = viewLayout.items.map(item => {
        const update = posMap.get(item.i);
        return update ? { ...item, x: update.x, y: update.y, w: update.w, h: update.h } : item;
      });
      const next = { ...prev, [view]: { ...viewLayout, items: mergedItems } };
      saveToStorage(storageKey, next);
      return next;
    });
  }, []);

  const resetToDefault = useCallback((view?: 'compact' | 'phone') => {
    setConfig(prev => {
      const views: ('compact' | 'phone')[] = view ? [view] : ['compact', 'phone'];
      if (views.some(v => prev[v].items.some(item => item.panelType === 'mufmap'))) {
        clearMufMapState(callsign);
      }
      const next = view ? { ...DEFAULT_LAYOUT, [view]: DEFAULT_LAYOUT[view] } : DEFAULT_LAYOUT;
      saveToStorage(storageKey, next);
      return next;
    });
  }, [callsign]);

  return {
    compactLayout: config.compact,
    phoneLayout: config.phone,
    setCompactLayout,
    setPhoneLayout,
    addPanel,
    removePanel,
    setGridSize,
    updateItemPositions,
    resetToDefault,
  };
}
