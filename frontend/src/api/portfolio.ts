import { useQuery } from '@tanstack/react-query';
import { fetchApi } from './client.ts';
import type { PortfolioSummary, ProjectHealth, PortfolioEVSummary, PlanViewItem } from './types.ts';

export function usePortfolioSummary() {
  return useQuery<PortfolioSummary>({
    queryKey: ['portfolio', 'summary'],
    queryFn: () => fetchApi<PortfolioSummary>('/api/portfolio/summary'),
  });
}

export function usePortfolioHealth() {
  return useQuery<ProjectHealth[]>({
    queryKey: ['portfolio', 'health'],
    queryFn: () => fetchApi<ProjectHealth[]>('/api/portfolio/health'),
  });
}

export function usePortfolioEVComparison() {
  return useQuery<PortfolioEVSummary>({
    queryKey: ['portfolio', 'ev-comparison'],
    queryFn: () => fetchApi<PortfolioEVSummary>('/api/portfolio/ev-comparison'),
  });
}

export function usePlanView() {
  return useQuery<PlanViewItem[]>({
    queryKey: ['portfolio', 'plans'],
    queryFn: () => fetchApi<PlanViewItem[]>('/api/portfolio/plans'),
  });
}
