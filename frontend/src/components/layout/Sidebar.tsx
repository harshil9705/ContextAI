import { useState } from 'react';
import {
  BookOpen,
  MessageSquare,
  Plus,
  PanelLeftClose,
  PanelLeft,
  Sun,
  Moon,
  Inbox,
} from 'lucide-react';

type View = 'chat' | 'sources';

interface Props {
  activeView: View;
  onViewChange: (view: View) => void;
  itemCount: number;
}

export default function Sidebar({ activeView, onViewChange, itemCount }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof document !== 'undefined') {
      return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    }
    return 'light';
  });

  function toggleTheme() {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
  }

  const navItems = [
    { id: 'chat' as const, label: 'Ask & Search', icon: MessageSquare, accent: 'var(--color-teal)' },
    { id: 'sources' as const, label: 'Sources', icon: BookOpen, accent: 'var(--color-sage)', badge: itemCount },
  ];

  return (
    <aside
      className="flex flex-col h-full border-r transition-all duration-300"
      style={{
        width: collapsed ? 64 : 256,
        borderColor: 'var(--color-border)',
        backgroundColor: 'var(--color-surface)',
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 h-14 shrink-0">
        <div className="flex gap-1">
          <span className="block w-2.5 h-2.5 rounded-sm" style={{ background: 'var(--color-fern)' }} />
          <span className="block w-2.5 h-2.5 rounded-sm" style={{ background: 'var(--color-gold)' }} />
          <span className="block w-2.5 h-2.5 rounded-sm" style={{ background: 'var(--color-teal)' }} />
        </div>
        {!collapsed && (
          <span className="text-sm font-semibold tracking-tight" style={{ color: 'var(--color-ink)' }}>
            Knowledge Inbox
          </span>
        )}
      </div>

      {/* Add content button */}
      {/* {!collapsed && (
        <div className="px-3 mb-1">
          <button
            onClick={() => onViewChange('sources')}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors"
            style={{
              backgroundColor: 'var(--color-fern)',
              color: '#fff',
            }}
          >
            <Plus size={16} />
            Add Content
          </button>
        </div>
      )} */}
      {collapsed && (
        <div className="px-3 mb-1 flex justify-center">
          <button
            onClick={() => onViewChange('sources')}
            className="p-2 rounded-md transition-colors"
            style={{ backgroundColor: 'var(--color-fern)', color: '#fff' }}
            title="Add Content"
          >
            <Plus size={18} />
          </button>
        </div>
      )}

      {/* Section header */}
      {!collapsed && (
        <div
          className="px-4 pt-4 pb-1 text-[10.5px] font-semibold uppercase tracking-widest"
          style={{ color: 'var(--color-ink-faint)' }}
        >
          Navigate
        </div>
      )}

      {/* Nav items */}
      <nav className="flex-1 px-3 space-y-0.5 mt-1">
        {navItems.map(item => {
          const active = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all relative"
              style={{
                backgroundColor: active ? 'var(--color-surface-recessed)' : 'transparent',
                color: active ? 'var(--color-ink)' : 'var(--color-ink-soft)',
              }}
              title={collapsed ? item.label : undefined}
            >
              {active && (
                <span
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r"
                  style={{ backgroundColor: item.accent }}
                />
              )}
              <item.icon size={18} style={{ color: active ? item.accent : 'var(--color-ink-faint)' }} />
              {!collapsed && <span>{item.label}</span>}
              {!collapsed && item.badge !== undefined && item.badge > 0 && (
                <span
                  className="ml-auto text-[11px] font-medium px-1.5 py-0.5 rounded"
                  style={{ backgroundColor: 'var(--color-surface-sunken)', color: 'var(--color-ink-faint)' }}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div
        className="px-3 py-3 border-t flex items-center gap-2"
        style={{ borderColor: 'var(--color-border-soft)' }}
      >
        <button
          onClick={toggleTheme}
          className="p-2 rounded-md transition-colors hover:opacity-80"
          style={{ color: 'var(--color-ink-faint)' }}
          title={theme === 'light' ? 'Dark mode' : 'Light mode'}
        >
          {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
        </button>
        <div className="flex-1" />
        <button
          onClick={() => setCollapsed(c => !c)}
          className="p-2 rounded-md transition-colors hover:opacity-80"
          style={{ color: 'var(--color-ink-faint)' }}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <PanelLeft size={16} /> : <PanelLeftClose size={16} />}
        </button>
      </div>
    </aside>
  );
}
