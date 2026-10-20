export interface IngestRequest {
  type: 'note' | 'url';
  content: string;
  title?: string;
}

export interface IngestResponse {
  id: string;
  title: string;
  type: string;
  chunk_count: number;
  summary: string;
  created_at: string;
}

export interface Item {
  id: string;
  title: string;
  type: string;
  content_preview: string;
  summary: string;
  created_at: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface StreamEvent {
  type: 'sources' | 'token' | 'done' | 'error';
  sources?: Source[];
  token?: string;
  detail?: string;
}

export interface ItemsListResponse {
  items: Item[];
}

export interface QueryRequest {
  question: string;
}

export interface Source {
  item_id: string;
  title: string;
  chunk_text: string;
  relevance_score: number;
}

export interface QueryResponse {
  answer: string;
  sources: Source[];
}
