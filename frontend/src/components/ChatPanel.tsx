import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Bot, User, Loader2, RotateCcw } from 'lucide-react';
import { queryKnowledgeStream } from '../api';
import type { Source, ChatMessage, StreamEvent } from '../types';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: Source[];
  streaming?: boolean;
}

export default function ChatPanel() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  const getHistory = useCallback((): ChatMessage[] => {
    return messages
      .filter(m => !m.streaming)
      .map(m => ({ role: m.role, content: m.content }));
  }, [messages]);

  async function handleSend() {
    const q = input.trim();
    if (!q || q.length < 3 || loading) return;

    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: q };
    const aiMsgId = crypto.randomUUID();

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    const aiMsg: Message = { id: aiMsgId, role: 'assistant', content: '', streaming: true };
    setMessages(prev => [...prev, aiMsg]);

    const history = getHistory();

    try {
      await queryKnowledgeStream(q, history, (event: StreamEvent) => {
        if (event.type === 'sources') {
          setMessages(prev =>
            prev.map(m => m.id === aiMsgId ? { ...m, sources: event.sources } : m)
          );
        } else if (event.type === 'token') {
          setMessages(prev =>
            prev.map(m => m.id === aiMsgId ? { ...m, content: m.content + event.token } : m)
          );
        } else if (event.type === 'done') {
          setMessages(prev =>
            prev.map(m => m.id === aiMsgId ? { ...m, streaming: false } : m)
          );
        } else if (event.type === 'error') {
          setMessages(prev =>
            prev.map(m => m.id === aiMsgId ? { ...m, content: `Error: ${event.detail}`, streaming: false } : m)
          );
        }
      });
    } catch (err) {
      setMessages(prev =>
        prev.map(m =>
          m.id === aiMsgId
            ? { ...m, content: `Sorry, something went wrong: ${err instanceof Error ? err.message : 'Unknown error'}`, streaming: false }
            : m
        )
      );
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
  }

  function handleNewChat() {
    setMessages([]);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className="shrink-0 px-5 h-14 flex items-center justify-between border-b"
        style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
      >
        <div className="flex items-center gap-2">
          <span className="w-[3px] h-4 rounded-full" style={{ backgroundColor: 'var(--color-teal)' }} />
          <span
            className="text-[10.5px] font-semibold uppercase tracking-widest"
            style={{ color: 'var(--color-ink-faint)' }}
          >
            Ask your knowledge base
          </span>
        </div>
        {messages.length > 0 && (
          <button
            onClick={handleNewChat}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors hover:opacity-80"
            style={{ color: 'var(--color-ink-soft)' }}
            title="New chat"
          >
            <RotateCcw size={13} />
            New
          </button>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {messages.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center h-full gap-3 opacity-40">
            <Bot size={48} style={{ color: 'var(--color-teal)' }} />
            <p className="text-sm" style={{ color: 'var(--color-ink-soft)' }}>
              Ask a question about your saved content
            </p>
            <p className="text-xs" style={{ color: 'var(--color-ink-faint)' }}>
              Follow-up questions use conversation context
            </p>
          </div>
        )}

        {messages.map(msg => (
          <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && (
              <div
                className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-1"
                style={{ backgroundColor: 'var(--color-teal-soft)' }}
              >
                <Bot size={16} style={{ color: 'var(--color-teal)' }} />
              </div>
            )}

            <div
              className="max-w-[80%] rounded-lg px-4 py-3 border"
              style={{
                backgroundColor: msg.role === 'user' ? 'var(--color-surface-recessed)' : 'var(--color-surface-raised)',
                borderColor: 'var(--color-border-soft)',
              }}
            >
              <p className="text-sm whitespace-pre-wrap leading-relaxed" style={{ color: 'var(--color-ink)' }}>
                {msg.content}
                {msg.streaming && msg.content && (
                  <span className="inline-block w-1.5 h-4 ml-0.5 animate-pulse rounded-sm" style={{ backgroundColor: 'var(--color-teal)' }} />
                )}
              </p>

              {msg.streaming && !msg.content && (
                <Loader2 size={18} className="animate-spin" style={{ color: 'var(--color-teal)' }} />
              )}

              {msg.sources && msg.sources.length > 0 && !msg.streaming && (
                <div className="mt-3 pt-3 space-y-2" style={{ borderTop: '1px solid var(--color-border-soft)' }}>
                  <span
                    className="text-[11px] font-semibold uppercase tracking-wider"
                    style={{ color: 'var(--color-ink-faint)' }}
                  >
                    Sources
                  </span>
                  {msg.sources.map((src, i) => (
                    <div
                      key={`${src.item_id}-${i}`}
                      className="rounded px-3 py-2"
                      style={{ backgroundColor: 'var(--color-surface-sunken)' }}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium" style={{ color: 'var(--color-ink)' }}>
                          {src.title}
                        </span>
                        <span
                          className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                          style={{ backgroundColor: 'var(--color-teal-soft)', color: 'var(--color-teal)' }}
                        >
                          {Math.round(src.relevance_score * 100)}%
                        </span>
                      </div>
                      <p className="text-xs line-clamp-2" style={{ color: 'var(--color-ink-soft)' }}>
                        {src.chunk_text}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {msg.role === 'user' && (
              <div
                className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-1"
                style={{ backgroundColor: 'var(--color-surface-recessed)' }}
              >
                <User size={16} style={{ color: 'var(--color-ink-faint)' }} />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Input */}
      <div
        className="shrink-0 px-5 py-3 border-t"
        style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
      >
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question..."
            rows={1}
            className="flex-1 resize-none text-sm px-3 py-2.5 rounded-md border outline-none transition-colors"
            style={{
              borderColor: 'var(--color-border)',
              backgroundColor: 'var(--color-surface-raised)',
              color: 'var(--color-ink)',
              minHeight: 40,
              maxHeight: 100,
            }}
          />
          <button
            onClick={handleSend}
            disabled={loading || input.trim().length < 3}
            className="shrink-0 w-10 h-10 flex items-center justify-center rounded-md transition-colors disabled:opacity-40"
            style={{ backgroundColor: 'var(--color-fern)', color: '#fff' }}
          >
            <Send size={16} />
          </button>
        </div>
        <p className="text-[11px] mt-1.5" style={{ color: 'var(--color-ink-faint)' }}>
          {navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}+Enter to send
        </p>
      </div>
    </div>
  );
}
