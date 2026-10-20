import { useState } from 'react';
import { Plus, FileText, Globe, Loader2, Check, AlertCircle, Trash2 } from 'lucide-react';
import { ingestContent, deleteItem } from '../api';
import type { Item } from '../types';

interface Props {
  items: Item[];
  loading: boolean;
  onIngested: () => void;
}

export default function SourcesPanel({ items, loading, onIngested }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [mode, setMode] = useState<'note' | 'url'>('note');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;

    setSaving(true);
    setMessage(null);

    try {
      const result = await ingestContent({
        type: mode,
        content: content.trim(),
        title: title.trim() || undefined,
      });
      setMessage({ type: 'success', text: `Saved "${result.title}" (${result.chunk_count} chunks)` });
      setTitle('');
      setContent('');
      onIngested();
      setTimeout(() => setShowForm(false), 1500);
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to save' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className="shrink-0 px-5 h-14 flex items-center justify-between border-b"
        style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
      >
        <div className="flex items-center gap-2">
          <span className="w-[3px] h-4 rounded-full" style={{ backgroundColor: 'var(--color-sage)' }} />
          <span
            className="text-[10.5px] font-semibold uppercase tracking-widest"
            style={{ color: 'var(--color-ink-faint)' }}
          >
            Sources
          </span>
          <span
            className="text-[11px] font-medium px-1.5 py-0.5 rounded"
            style={{ backgroundColor: 'var(--color-surface-sunken)', color: 'var(--color-ink-faint)' }}
          >
            {items.length}
          </span>
        </div>
        <button
          onClick={() => setShowForm(f => !f)}
          className="p-1.5 rounded-md transition-colors hover:opacity-80"
          style={{ color: 'var(--color-fern)' }}
          title="Add content"
        >
          <Plus size={18} />
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--color-border-soft)' }}>
          <div className="flex gap-1.5 mb-3">
            {(['note', 'url'] as const).map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors"
                style={{
                  backgroundColor: mode === m ? 'var(--color-fern)' : 'var(--color-surface-recessed)',
                  color: mode === m ? '#fff' : 'var(--color-ink-soft)',
                }}
              >
                {m === 'note' ? <FileText size={13} /> : <Globe size={13} />}
                {m === 'note' ? 'Note' : 'URL'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-2.5">
            <input
              type="text"
              placeholder="Title (optional)"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full px-3 py-2 rounded text-sm border outline-none"
              style={{
                borderColor: 'var(--color-border)',
                backgroundColor: 'var(--color-surface-raised)',
                color: 'var(--color-ink)',
              }}
            />
            {mode === 'note' ? (
              <textarea
                placeholder="Enter your note..."
                value={content}
                onChange={e => setContent(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 rounded text-sm border outline-none resize-y"
                style={{
                  borderColor: 'var(--color-border)',
                  backgroundColor: 'var(--color-surface-raised)',
                  color: 'var(--color-ink)',
                }}
              />
            ) : (
              <input
                type="url"
                placeholder="https://example.com/article"
                value={content}
                onChange={e => setContent(e.target.value)}
                className="w-full px-3 py-2 rounded text-sm border outline-none"
                style={{
                  borderColor: 'var(--color-border)',
                  backgroundColor: 'var(--color-surface-raised)',
                  color: 'var(--color-ink)',
                }}
              />
            )}
            <button
              type="submit"
              disabled={saving || !content.trim()}
              className="w-full py-2 rounded text-sm font-medium transition-colors disabled:opacity-40"
              style={{ backgroundColor: 'var(--color-fern)', color: '#fff' }}
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </form>

          {message && (
            <div className="flex items-center gap-1.5 mt-2.5">
              {message.type === 'success' ? (
                <Check size={14} style={{ color: 'var(--color-fern)' }} />
              ) : (
                <AlertCircle size={14} style={{ color: 'var(--color-danger)' }} />
              )}
              <p
                className="text-xs"
                style={{ color: message.type === 'success' ? 'var(--color-fern)' : 'var(--color-danger)' }}
              >
                {message.text}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Items list */}
      <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2">
        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={20} className="animate-spin" style={{ color: 'var(--color-ink-faint)' }} />
          </div>
        )}

        {!loading && items.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 gap-2 opacity-40">
            <FileText size={36} style={{ color: 'var(--color-ink-faint)' }} />
            <p className="text-sm" style={{ color: 'var(--color-ink-soft)' }}>
              No sources yet
            </p>
          </div>
        )}

        {items.map(item => (
          <div
            key={item.id}
            className="group rounded-md border px-3.5 py-3 transition-colors relative"
            style={{
              borderColor: 'var(--color-border-soft)',
              backgroundColor: 'var(--color-surface-raised)',
              opacity: deletingId === item.id ? 0.5 : 1,
            }}
          >
            <button
              onClick={async () => {
                setDeletingId(item.id);
                try {
                  await deleteItem(item.id);
                  onIngested();
                } catch {
                  // silently fail
                } finally {
                  setDeletingId(null);
                }
              }}
              disabled={deletingId === item.id}
              className="absolute top-2.5 right-2.5 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:opacity-80"
              style={{ color: 'var(--color-danger)' }}
              title="Delete"
            >
              {deletingId === item.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            </button>
            <div className="flex items-center gap-2 mb-1 pr-6">
              <span
                className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase"
                style={{
                  backgroundColor: item.type === 'url' ? 'var(--color-teal-soft)' : 'var(--color-gold-soft)',
                  color: item.type === 'url' ? 'var(--color-teal)' : 'var(--color-gold)',
                }}
              >
                {item.type === 'url' ? <Globe size={10} /> : <FileText size={10} />}
                {item.type}
              </span>
              <h3 className="text-sm font-medium truncate" style={{ color: 'var(--color-ink)' }}>
                {item.title}
              </h3>
            </div>
            {item.summary ? (
              <p className="text-xs line-clamp-2 italic" style={{ color: 'var(--color-ink-soft)' }}>
                {item.summary}
              </p>
            ) : (
              <p className="text-xs line-clamp-2" style={{ color: 'var(--color-ink-soft)' }}>
                {item.content_preview}
              </p>
            )}
            <p className="text-[10px] mt-1.5" style={{ color: 'var(--color-ink-faint)' }}>
              {new Date(item.created_at).toLocaleDateString()}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
