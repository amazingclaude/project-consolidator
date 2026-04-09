import { useQuery } from '@tanstack/react-query';
import { fetchApi } from './client.ts';
import type {
  ProjectSummary,
  ProjectDetail,
  TaskItem,
  TaskFilters,
  CostMetrics,
  ScheduleMetrics,
  TimeMetrics,
  IntegrityMetrics,
  DeviationItem,
  EVMetrics,
} from './types.ts';

export function useProjects() {
  return useQuery<ProjectSummary[]>({
    queryKey: ['projects'],
    queryFn: () => fetchApi<ProjectSummary[]>('/api/projects'),
  });
}

export function useProject(id: number | null) {
  return useQuery<ProjectDetail>({
    queryKey: ['projects', id],
    queryFn: () => fetchApi<ProjectDetail>(`/api/projects/${id}`),
    enabled: id !== null,
  });
}

export function useProjectTasks(id: number | null, filters?: TaskFilters) {
  return useQuery<TaskItem[]>({
    queryKey: ['projects', id, 'tasks', filters],
    queryFn: () => {
      const params = new URLSearchParams();
      if (filters?.critical !== undefined) {
        params.set('critical', String(filters.critical));
      }
      if (filters?.milestones !== undefined) {
        params.set('milestones', String(filters.milestones));
      }
      if (filters?.summary !== undefined) {
        params.set('summary', String(filters.summary));
      }
      const qs = params.toString();
      const url = `/api/projects/${id}/tasks${qs ? `?${qs}` : ''}`;
      return fetchApi<TaskItem[]>(url);
    },
    enabled: id !== null,
  });
}

export function useCostMetrics(id: number | null) {
  return useQuery<CostMetrics>({
    queryKey: ['projects', id, 'cost-metrics'],
    queryFn: () => fetchApi<CostMetrics>(`/api/projects/${id}/cost-metrics`),
    enabled: id !== null,
  });
}

export function useScheduleMetrics(id: number | null) {
  return useQuery<ScheduleMetrics>({
    queryKey: ['projects', id, 'schedule-metrics'],
    queryFn: () => fetchApi<ScheduleMetrics>(`/api/projects/${id}/schedule-metrics`),
    enabled: id !== null,
  });
}

export function useTimeMetrics(id: number | null) {
  return useQuery<TimeMetrics>({
    queryKey: ['projects', id, 'time-metrics'],
    queryFn: () => fetchApi<TimeMetrics>(`/api/projects/${id}/time-metrics`),
    enabled: id !== null,
  });
}

export function useIntegrityMetrics(id: number | null) {
  return useQuery<IntegrityMetrics>({
    queryKey: ['projects', id, 'integrity-metrics'],
    queryFn: () => fetchApi<IntegrityMetrics>(`/api/projects/${id}/integrity-metrics`),
    enabled: id !== null,
  });
}

export function useProjectDeviations(id: number | null) {
  return useQuery<DeviationItem[]>({
    queryKey: ['projects', id, 'deviations'],
    queryFn: () => fetchApi<DeviationItem[]>(`/api/projects/${id}/deviations`),
    enabled: id !== null,
  });
}

export function useEVMetrics(id: number | null) {
  return useQuery<EVMetrics>({
    queryKey: ['projects', id, 'ev-metrics'],
    queryFn: () => fetchApi<EVMetrics>(`/api/projects/${id}/ev-metrics`),
    enabled: id !== null,
  });
}
