import { useMutation } from '@tanstack/react-query';
import { postApi } from './client.ts';
import type { NLQueryRequest, NLQueryResponse } from './types.ts';

export function useNLQuery() {
  return useMutation<NLQueryResponse, Error, NLQueryRequest>({
    mutationFn: (request: NLQueryRequest) =>
      postApi<NLQueryResponse>('/api/nl-query', request),
  });
}
