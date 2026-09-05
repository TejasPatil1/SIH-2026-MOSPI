import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type WatchlistQuery } from './client';

const STATIC = { staleTime: Infinity, retry: 1 } as const;

export const useHealth = () => useQuery({ queryKey: ['health'], queryFn: api.health, ...STATIC, refetchInterval: 30_000 });

export const usePortfolio = (p?: { sector?: string; ministry?: string }) =>
  useQuery({ queryKey: ['portfolio', p ?? {}], queryFn: () => api.portfolio(p), ...STATIC });

export const useWatchlist = (q: WatchlistQuery) =>
  useQuery({ queryKey: ['watchlist', q], queryFn: () => api.watchlist(q), ...STATIC, placeholderData: (prev) => prev });

export const useProject = (id: string) =>
  useQuery({ queryKey: ['project', id], queryFn: () => api.project(id), ...STATIC, enabled: !!id });

export const useTimeline = (id: string) =>
  useQuery({ queryKey: ['timeline', id], queryFn: () => api.timeline(id), ...STATIC, enabled: !!id });

export const useReplay = (id: string) =>
  useQuery({ queryKey: ['replay', id], queryFn: () => api.replay(id), ...STATIC, enabled: !!id, retry: false });

export const usePeers = (id: string) =>
  useQuery({ queryKey: ['peers', id], queryFn: () => api.peers(id), ...STATIC, enabled: !!id });

export const useRegistry = () => useQuery({ queryKey: ['registry'], queryFn: api.registry, ...STATIC });

export function useScoreRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (batchId: string | null) => api.scoreRun(batchId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['portfolio'] });
      qc.invalidateQueries({ queryKey: ['watchlist'] });
    },
  });
}

export const useUpload = () => useMutation({ mutationFn: (f: File | null) => (f ? api.upload(f) : api.uploadSample()) });
export const useAssistant = () => useMutation({ mutationFn: (q: string) => api.assistant(q) });
