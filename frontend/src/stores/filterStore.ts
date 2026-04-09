import { create } from 'zustand';

export interface FilterStore {
  selectedProjectId: number | null;
  severityFilter: string;
  deviationTypeFilter: string;

  setProjectId: (id: number | null) => void;
  setSeverity: (s: string) => void;
  setDeviationType: (t: string) => void;
  resetFilters: () => void;
}

export const useFilterStore = create<FilterStore>((set) => ({
  selectedProjectId: null,
  severityFilter: '',
  deviationTypeFilter: '',

  setProjectId: (id) => set({ selectedProjectId: id }),

  setSeverity: (s) => set({ severityFilter: s }),

  setDeviationType: (t) => set({ deviationTypeFilter: t }),

  resetFilters: () =>
    set({
      selectedProjectId: null,
      severityFilter: '',
      deviationTypeFilter: '',
    }),
}));
