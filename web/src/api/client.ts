import type {
  AssistantAnswer, Health, Peers, Portfolio, ProjectDetail, Registry,
  Replay, ScoreRunResult, Timeline, UploadResult, Watchlist,
} from './types';
import { mockRequest } from './mock';

const BASE = import.meta.env.VITE_API_URL ?? '/api';
export const USE_MOCK = String(import.meta.env.VITE_USE_MOCK ?? 'false') === 'true';

export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly detail?: string) {
    super(message);
  }
}

async function get<T>(path: string, params?: Record<string, unknown>): Promise<T> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params ?? {})) {
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
  }
  const url = `${path}${qs.toString() ? `?${qs}` : ''}`;
  if (USE_MOCK) return mockRequest<T>('GET', path, params);
  return send<T>(`${BASE}${url}`, { method: 'GET' });
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  if (USE_MOCK) return mockRequest<T>('POST', path, body as Record<string, unknown>);
  const isForm = body instanceof FormData;
  return send<T>(`${BASE}${path}`, {
    method: 'POST',
    headers: isForm ? undefined : { 'Content-Type': 'application/json' },
    body: isForm ? body : JSON.stringify(body ?? {}),
  });
}

async function send<T>(url: string, init: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    throw new ApiError('Could not reach the scoring service', 0,
      'The API process is not responding. Start it with `make demo`, or set VITE_USE_MOCK=true.');
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new ApiError(`Request failed (${res.status})`, res.status, safeDetail(detail));
  }
  return res.json() as Promise<T>;
}

function safeDetail(raw: string): string | undefined {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed?.detail === 'string' ? parsed.detail : undefined;
  } catch {
    return undefined;
  }
}

export interface WatchlistQuery {
  n?: number;
  weight_by_exposure?: boolean;
  sector?: string;
  ministry?: string;
  band?: string;
  min_cost_cr?: number;
  q?: string;
}

export const api = {
  health: () => get<Health>('/health'),
  portfolio: (p?: { sector?: string; ministry?: string }) => get<Portfolio>('/portfolio', p),
  watchlist: (q: WatchlistQuery) => get<Watchlist>('/watchlist', q as Record<string, unknown>),
  project: (id: string) => get<ProjectDetail>(`/projects/${id}`),
  timeline: (id: string) => get<Timeline>(`/projects/${id}/timeline`),
  replay: (id: string) => get<Replay>(`/projects/${id}/replay`),
  peers: (id: string) => get<Peers>(`/projects/${id}/peers`),
  registry: () => get<Registry>('/registry'),
  upload: (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return post<UploadResult>('/upload', fd);
  },
  uploadSample: () => post<UploadResult>('/upload/sample'),
  scoreRun: (batch_id: string | null) => post<ScoreRunResult>('/score/run', { batch_id }),
  assistant: (question: string) => post<AssistantAnswer>('/assistant', { question }),
};
