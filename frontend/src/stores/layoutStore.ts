import { create } from 'zustand';

/**
 * Layout item type matching react-grid-layout's Layout interface.
 * Defined locally to avoid import compatibility issues with the library's
 * `export =` / namespace pattern under verbatimModuleSyntax.
 */
export interface LayoutItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
  static?: boolean;
  isDraggable?: boolean;
  isResizable?: boolean;
}

const DEFAULT_WIDGETS = [
  'cost-overview',
  'schedule-overview',
  'gantt',
  'deviation-table',
];

const DEFAULT_LAYOUT: LayoutItem[] = [
  { i: 'cost-overview', x: 0, y: 0, w: 6, h: 4, minW: 3, minH: 2 },
  { i: 'schedule-overview', x: 6, y: 0, w: 6, h: 4, minW: 3, minH: 2 },
  { i: 'gantt', x: 0, y: 4, w: 6, h: 4, minW: 4, minH: 3 },
  { i: 'deviation-table', x: 6, y: 4, w: 6, h: 4, minW: 3, minH: 2 },
];

const STORAGE_KEY = 'portfolio-layouts';

interface PersistedState {
  layouts: Record<string, LayoutItem[]>;
  activeWidgets: Record<string, string[]>;
}

function loadFromStorage(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as PersistedState;
      return {
        layouts: parsed.layouts ?? {},
        activeWidgets: parsed.activeWidgets ?? {},
      };
    }
  } catch {
    // Ignore parse errors and fall through to defaults
  }
  return { layouts: {}, activeWidgets: {} };
}

function saveToStorage(state: PersistedState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      layouts: state.layouts,
      activeWidgets: state.activeWidgets,
    }));
  } catch {
    // Ignore storage errors (quota exceeded, etc.)
  }
}

export interface LayoutStore {
  layouts: Record<string, LayoutItem[]>;
  activeWidgets: Record<string, string[]>;

  getLayout: (projectId: string) => LayoutItem[];
  getActiveWidgets: (projectId: string) => string[];
  saveLayout: (projectId: string, layout: LayoutItem[]) => void;
  addWidget: (projectId: string, widgetId: string) => void;
  removeWidget: (projectId: string, widgetId: string) => void;
  resetLayout: (projectId: string) => void;
}

const persisted = loadFromStorage();

export const useLayoutStore = create<LayoutStore>((set, get) => ({
  layouts: persisted.layouts,
  activeWidgets: persisted.activeWidgets,

  getLayout: (projectId) => {
    return get().layouts[projectId] ?? DEFAULT_LAYOUT;
  },

  getActiveWidgets: (projectId) => {
    return get().activeWidgets[projectId] ?? DEFAULT_WIDGETS;
  },

  saveLayout: (projectId, layout) => {
    set((state) => {
      const newState = {
        layouts: { ...state.layouts, [projectId]: layout },
        activeWidgets: state.activeWidgets,
      };
      saveToStorage(newState);
      return newState;
    });
  },

  addWidget: (projectId, widgetId) => {
    set((state) => {
      const current = state.activeWidgets[projectId] ?? DEFAULT_WIDGETS;
      if (current.includes(widgetId)) return state;

      const currentLayout = state.layouts[projectId] ?? DEFAULT_LAYOUT;

      // Find the next available y position (below all existing widgets)
      const maxY = currentLayout.reduce(
        (max, item) => Math.max(max, item.y + item.h),
        0,
      );

      const newLayout: LayoutItem[] = [
        ...currentLayout,
        { i: widgetId, x: 0, y: maxY, w: 6, h: 4, minW: 3, minH: 2 },
      ];

      const newState = {
        layouts: { ...state.layouts, [projectId]: newLayout },
        activeWidgets: {
          ...state.activeWidgets,
          [projectId]: [...current, widgetId],
        },
      };
      saveToStorage(newState);
      return newState;
    });
  },

  removeWidget: (projectId, widgetId) => {
    set((state) => {
      const current = state.activeWidgets[projectId] ?? DEFAULT_WIDGETS;
      const currentLayout = state.layouts[projectId] ?? DEFAULT_LAYOUT;

      const newState = {
        layouts: {
          ...state.layouts,
          [projectId]: currentLayout.filter((item) => item.i !== widgetId),
        },
        activeWidgets: {
          ...state.activeWidgets,
          [projectId]: current.filter((id) => id !== widgetId),
        },
      };
      saveToStorage(newState);
      return newState;
    });
  },

  resetLayout: (projectId) => {
    set((state) => {
      const { [projectId]: _removedLayouts, ...restLayouts } = state.layouts;
      const { [projectId]: _removedWidgets, ...restWidgets } = state.activeWidgets;

      const newState = {
        layouts: restLayouts,
        activeWidgets: restWidgets,
      };
      saveToStorage(newState);
      return newState;
    });
  },
}));
