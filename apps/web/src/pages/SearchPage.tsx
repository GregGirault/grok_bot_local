import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { SearchResult } from '@grok-bot/shared';
import { api } from '../lib/api';

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      setError('');
      return;
    }
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError('');
      void api
        .search(query.trim())
        .then(setResults)
        .catch((e) => setError(e instanceof Error ? e.message : String(e)))
        .finally(() => setLoading(false));
    }, 220);
    return () => window.clearTimeout(timer);
  }, [query]);

  const open = (r: SearchResult) => {
    if (r.target.startsWith('/uploads/')) {
      window.open(r.target, '_blank', 'noopener,noreferrer');
      return;
    }
    navigate(r.target);
  };

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-8 max-w-3xl">
      <div className="flex items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-semibold">Search</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--gb-muted)' }}>
            Bots, conversations, groups, routines and files · Ctrl/Cmd+K
          </p>
        </div>
      </div>
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search prior work…"
        className="w-full rounded-xl border px-4 py-3 text-sm outline-none focus:ring-2"
        style={{
          background: 'var(--gb-input)',
          borderColor: 'var(--gb-border)',
          // @ts-expect-error CSS custom property
          '--tw-ring-color': 'var(--gb-accent)',
        }}
      />
      {loading && <p className="text-xs mt-3" style={{ color: 'var(--gb-muted)' }}>Searching…</p>}
      {error && <p className="text-xs text-red-400 mt-3">{error}</p>}
      <div className="mt-5 space-y-2">
        {query.trim().length >= 2 && !loading && results.length === 0 && !error && (
          <p className="text-sm" style={{ color: 'var(--gb-muted)' }}>No matches.</p>
        )}
        {results.map((r) => (
          <button
            type="button"
            key={`${r.type}:${r.id}`}
            onClick={() => open(r)}
            className="w-full text-left rounded-xl border px-4 py-3 hover:bg-zinc-900/60 transition"
            style={{ borderColor: 'var(--gb-border)' }}
          >
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-wide rounded bg-zinc-800 px-1.5 py-0.5" style={{ color: 'var(--gb-muted)' }}>
                {r.type}
              </span>
              <span className="text-sm font-medium truncate">{r.title}</span>
              {r.subtitle && <span className="text-[11px] truncate" style={{ color: 'var(--gb-muted)' }}>{r.subtitle}</span>}
            </div>
            {r.snippet && (
              <p className="text-xs mt-1.5 line-clamp-2" style={{ color: 'var(--gb-muted)' }}>
                {r.snippet}
              </p>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
