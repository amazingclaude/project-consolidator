import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApi, postApi, putApi, deleteApi } from './client';
import type {
  DNORegion,
  FiscalPlanSummary,
  FiscalPlanDetail,
  CreatePlanRequest,
  UpdatePlanRequest,
  UpdateActualsRequest,
  CustomRegionResponse,
  HierarchyInput,
} from './types';

export function useDNORegions() {
  return useQuery<DNORegion[]>({
    queryKey: ['planning', 'regions'],
    queryFn: () => fetchApi<DNORegion[]>('/api/planning/regions'),
  });
}

export function useFiscalPlans() {
  return useQuery<FiscalPlanSummary[]>({
    queryKey: ['planning', 'plans'],
    queryFn: () => fetchApi<FiscalPlanSummary[]>('/api/planning/plans'),
  });
}

export function useFiscalPlan(planId: number | undefined) {
  return useQuery<FiscalPlanDetail>({
    queryKey: ['planning', 'plans', planId],
    queryFn: () => fetchApi<FiscalPlanDetail>(`/api/planning/plans/${planId}`),
    enabled: planId !== undefined,
  });
}

export function useCreatePlan() {
  const qc = useQueryClient();
  return useMutation<FiscalPlanDetail, Error, CreatePlanRequest>({
    mutationFn: (data) => postApi<FiscalPlanDetail>('/api/planning/plans', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['planning', 'plans'] });
    },
  });
}

export function useUpdatePlan(planId: number) {
  const qc = useQueryClient();
  return useMutation<FiscalPlanDetail, Error, UpdatePlanRequest>({
    mutationFn: (data) => putApi<FiscalPlanDetail>(`/api/planning/plans/${planId}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['planning', 'plans'] });
    },
  });
}

export function useDeletePlan() {
  const qc = useQueryClient();
  return useMutation<unknown, Error, number>({
    mutationFn: (planId) => deleteApi(`/api/planning/plans/${planId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['planning', 'plans'] });
    },
  });
}

export function useOptimizePlan(planId: number) {
  const qc = useQueryClient();
  return useMutation<FiscalPlanDetail, Error, void>({
    mutationFn: () => postApi<FiscalPlanDetail>(`/api/planning/plans/${planId}/optimize`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['planning', 'plans'] });
    },
  });
}

export function useUpdateActuals(planId: number) {
  const qc = useQueryClient();
  return useMutation<FiscalPlanDetail, Error, UpdateActualsRequest>({
    mutationFn: (data) => putApi<FiscalPlanDetail>(`/api/planning/plans/${planId}/actuals`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['planning', 'plans'] });
    },
  });
}

export function useUpdatePlanStatus(planId: number) {
  const qc = useQueryClient();
  return useMutation<FiscalPlanDetail, Error, string>({
    mutationFn: (status) => putApi<FiscalPlanDetail>(`/api/planning/plans/${planId}/status`, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['planning', 'plans'] });
    },
  });
}

export function useHierarchy(planId: number | undefined) {
  return useQuery<CustomRegionResponse[]>({
    queryKey: ['planning', 'hierarchy', planId],
    queryFn: () => fetchApi<CustomRegionResponse[]>(`/api/planning/plans/${planId}/hierarchy`),
    enabled: planId !== undefined,
  });
}

export function useSaveHierarchy(planId: number) {
  const qc = useQueryClient();
  return useMutation<CustomRegionResponse[], Error, HierarchyInput>({
    mutationFn: (data) => putApi<CustomRegionResponse[]>(`/api/planning/plans/${planId}/hierarchy`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['planning'] });
    },
  });
}

export function useUpdateContractActuals(planId: number) {
  const qc = useQueryClient();
  return useMutation<FiscalPlanDetail, Error, { actuals: { contract_id: number; month: number; actual_sockets: number }[] }>({
    mutationFn: (data) => putApi<FiscalPlanDetail>(`/api/planning/plans/${planId}/contract-actuals`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['planning'] });
    },
  });
}
