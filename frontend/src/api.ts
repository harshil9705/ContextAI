import type { IngestRequest, IngestResponse, ItemsListResponse, QueryResponse, ChatMessage, StreamEvent } from './types';

const BASE = '/api';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(body.detail || `Request failed (${res.status})`);
  }

  return res.json();
}

export function ingestContent(data: IngestRequest): Promise<IngestResponse> {
  return request('/ingest', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function getItems(): Promise<ItemsListResponse> {
  return request('/items');
}

export function deleteItem(id: string): Promise<{ status: string; id: string }> {
  return request(`/items/${id}`, { method: 'DELETE' });
}

export function queryKnowledge(question: string, history?: ChatMessage[]): Promise<QueryResponse> {
  return request('/query', {
    method: 'POST',
    body: JSON.stringify({ question, history }),
  });
}

export async function queryKnowledgeStream(
  question: string,
  history: ChatMessage[],
  onEvent: (event: StreamEvent) => void,
): Promise<void> {
  const res = await fetch(`${BASE}/query/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, history }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(body.detail || `Request failed (${res.status})`);
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const event: StreamEvent = JSON.parse(line.slice(6));
          onEvent(event);
        } catch { /* skip malformed */ }
      }
    }
  }
}
