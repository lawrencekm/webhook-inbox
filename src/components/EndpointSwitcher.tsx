'use client';

import { useEffect, useRef, useState } from 'react';
import type { LocalEndpoint } from '@/lib/local';
import { IconChevronDown, IconInbox, IconPlus } from './Icons';

interface Props {
  endpoints: LocalEndpoint[];
  activeToken: string;
  onSelect: (token: string) => void;
  onCreate: () => void;
  creating: boolean;
}

/** Dropdown over the endpoints this browser remembers. */
export default function EndpointSwitcher({ endpoints, activeToken, onSelect, onCreate, creating }: Props) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const active = endpoints.find((e) => e.token === activeToken);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={wrap} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex max-w-[15rem] items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm font-medium text-ink transition hover:border-line-strong"
      >
        <IconInbox className="shrink-0 text-muted" />
        <span className="truncate">{active?.name ?? 'Endpoints'}</span>
        <IconChevronDown className={`shrink-0 text-faint transition ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          role="listbox"
          className="animate-in absolute left-0 z-40 mt-2 w-72 overflow-hidden rounded-xl border border-line bg-surface shadow-[var(--shadow)]"
        >
          <div className="max-h-72 overflow-y-auto py-1 scroll-thin">
            {endpoints.map((e) => (
              <button
                key={e.token}
                role="option"
                aria-selected={e.token === activeToken}
                onClick={() => {
                  setOpen(false);
                  if (e.token !== activeToken) onSelect(e.token);
                }}
                className={`flex w-full flex-col items-start gap-0.5 px-3 py-2.5 text-left transition hover:bg-surface-2 ${
                  e.token === activeToken ? 'bg-accent-soft' : ''
                }`}
              >
                <span className="w-full truncate text-sm font-medium text-ink">{e.name}</span>
                <span className="w-full truncate font-mono text-[11px] text-faint">/{e.token}</span>
              </button>
            ))}
            {endpoints.length === 0 && (
              <p className="px-3 py-4 text-sm text-muted">No endpoints yet.</p>
            )}
          </div>
          <div className="border-t border-line p-1">
            <button
              onClick={() => {
                setOpen(false);
                onCreate();
              }}
              disabled={creating}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-accent transition hover:bg-accent-soft disabled:opacity-50"
            >
              <IconPlus />
              {creating ? 'Creating…' : 'New endpoint'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
