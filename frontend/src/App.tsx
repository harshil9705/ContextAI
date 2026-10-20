import { useEffect, useState, useCallback } from 'react';
import { getItems } from './api';
import type { Item } from './types';
import Sidebar from './components/layout/Sidebar';
import ChatPanel from './components/ChatPanel';
import SourcesPanel from './components/SourcesPanel';

type View = 'chat' | 'sources';

export default function App() {
  const [items, setItems] = useState<Item[]>([]);
  const [itemsLoading, setItemsLoading] = useState(true);
  const [activeView, setActiveView] = useState<View>('chat');

  const fetchItems = useCallback(async () => {
    setItemsLoading(true);
    try {
      const data = await getItems();
      setItems(data.items);
    } catch {
      // silently fail
    } finally {
      setItemsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: 'var(--color-bg)' }}>
      <Sidebar activeView={activeView} onViewChange={setActiveView} itemCount={items.length} />

      <main className="flex-1 flex overflow-hidden" style={{ backgroundColor: 'var(--color-bg)' }}>
        {activeView === 'chat' ? (
          <>
            {/* Chat takes 2/3, sources sidebar takes 1/3 on large screens */}
            <div className="flex-1 min-w-0">
              <ChatPanel />
            </div>
            <div
              className="hidden lg:flex w-80 border-l flex-col"
              style={{ borderColor: 'var(--color-border)' }}
            >
              <SourcesPanel items={items} loading={itemsLoading} onIngested={fetchItems} />
            </div>
          </>
        ) : (
          <div className="flex-1">
            <SourcesPanel items={items} loading={itemsLoading} onIngested={fetchItems} />
          </div>
        )}
      </main>
    </div>
  );
}
