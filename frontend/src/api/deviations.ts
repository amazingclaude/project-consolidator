import { useQuery } from '@tanstack/react-query';
import { fetchApi } from './client.ts';
import type { DeviationItem, DeviationSummary, DeviationFilters } from './types.ts';

export function useDeviations(filters?: DeviationFilters) {
  return useQuery<DeviationItem[]>({
    queryKey: ['deviations', filters],
    queryFn: () => {
      const params = new URLSearchParams();
      if (filters?.severity) {
        params.set('severity', filters.severity);
      }
      if (filters?.project_id !== undefined) {
        params.set('project_id', String(filters.project_id));
      }
      if (filters?.type) {
        params.set('type', filters.type);
      }
      const qs = params.toString();
      const url = `/api/deviations${qs ? `?${qs}` : ''}`;
      return fetchApi<DeviationItem[]>(url);
    },
  });
}

export function useDeviationSummary() {
  return useQuery<DeviationSummary>({
    queryKey: ['deviations', 'summary'],
    queryFn: () => fetchApi<DeviationSummary>('/api/deviations/summary'),
  });
}
