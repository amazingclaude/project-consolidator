import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApi, postApi } from './client.ts';
import type { IngestionRequest, IngestionResult, IngestionStatus } from './types.ts';

export function useIngestionStatus() {
  return useQuery<IngestionStatus>({
    queryKey: ['ingestion', 'status'],
    queryFn: () => fetchApi<IngestionStatus>('/api/ingestion/status'),
  });
}

export function useRunIngestion() {
  const queryClient = useQueryClient();

  return useMutation<IngestionResult, Error, IngestionRequest>({
    mutationFn: (request: IngestionRequest) =>
      postApi<IngestionResult>('/api/ingestion/run', request),
    onSuccess: () => {
      // Invalidate all queries that depend on ingested data
      void queryClient.invalidateQueries({ queryKey: ['portfolio'] });
      void queryClient.invalidateQueries({ queryKey: ['projects'] });
      void queryClient.invalidateQueries({ queryKey: ['deviations'] });
      void queryClient.invalidateQueries({ queryKey: ['ingestion', 'status'] });
    },
  });
}
