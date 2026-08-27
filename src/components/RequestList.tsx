'use client';

import { useMemo } from 'react';
import { formatBytes, methodStyle, relativeTime } from '@/lib/format';
import type { CapturedRequest } from '@/lib/types';
import { IconInbox, IconSearch, IconX } from './Icons';

interface Props {
  requests: CapturedRequest[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  filter: string;
  onFilterChange: (value: string) => void;
  method: string;
  onMethodChange: (value: string) => void;
  now: number;
}

const ALL = 'ALL';

/** Left rail: filter controls plus the chronological list of captures. */
export default function RequestList({
  requests,
  selectedId,
  onSelect,
  filter,
  onFilterChange,
  method,
  onMethodChange,
  now,
}: Props) {
  const methods = useMemo(() => {
    const set = new Set(requests.map((r) => r.method));
    return [ALL, ...[...set].sort()];
  }, [requests]);

  const visible = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    return requests.filter((r) => {
      if (method !== ALL && r.method !== method) return false;
      if (!needle) return true;
      return (
        r.path.toLowerCase().includes(needle) ||
        r.query.toLowerCase().includes(needle) ||
        r.body.toLowerCase().includes(needle) ||
        r.method.toLowerCase().includes(needle) ||
        r.headers.some(([n, v]) => `${n}: ${v}`.toLowerCase().includes(needle))
      );
    });
  }, [requests, filter, method]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 space-y-2.5 border-b border-line p-3">
        <div className="relative">
          <IconSearch className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-faint" />
          <input
            type="search"
            value={filter}
            onChange={(e) => onFilterChange(e.target.value)}
            placeholder="Search path, headers, body…"
            aria-label="Search requests"
            className="w-full rounded-lg border border-line bg-surface-2 py-2 pr-8 pl-9 text-sm text-ink placeholder:text-faint focus:border-accent focus:outline-none"
          />
          {filter && (
            <button
              onClick={() => onFilterChange('')}
              aria-label="Clear search"
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-faint hover:text-ink"
            >
              <IconX width={14} height={14} />
            </button>
          )}
        </div>

        {methods.length > 2 && (
          <div className="flex flex-wrap gap-1.5">
            {methods.map((m) => (
              <button
                key={m}
                onClick={() => onMethodChange(m)}
                className={`rounded-md px-2 py-1 font-mono text-[11px] font-semibold tracking-wide transition ${
                  method === m
                    ? 'bg-accent text-accent-contrast'
                    : 'bg-surface-2 text-muted hover:text-ink'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto scroll-thin">
        {visible.length === 0 ? (
          <EmptyState hasAny={requests.length > 0} />
        ) : (
          <ul>
            {visible.map((r) => {
              const selected = r.id === selectedId;
              return (
                <li key={r.id}>
                  <button
                    onClick={() => onSelect(r.id)}
                    aria-current={selected}
                    className={`flex w-full items-start gap-3 border-b border-line px-3 py-3 text-left transition ${
                      selected ? 'bg-accent-soft' : 'hover:bg-surface-2'
                    }`}
                  >
                    <span
                      className={`mt-0.5 shrink-0 rounded-md px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-wider ${methodStyle(
                        r.method,
                      )}`}
                    >
                      {r.method}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-mono text-[13px] text-ink">
                        {r.path || '/'}
                        {r.query && <span className="text-faint">?{r.query}</span>}
                      </span>
                      <span className="mt-1 block truncate text-[11px] text-faint">
                        {relativeTime(r.at, now)}
                        {r.size > 0 && ` · ${formatBytes(r.size)}`}
                        {r.ip && ` · ${r.ip}`}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function EmptyState({ hasAny }: { hasAny: boolean }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-2 text-faint">
        <IconInbox width={20} height={20} />
      </span>
      <p className="text-sm font-medium text-ink">
        {hasAny ? 'Nothing matches that filter' : 'Waiting for the first request'}
      </p>
      <p className="max-w-[24ch] text-xs leading-relaxed text-muted">
        {hasAny
          ? 'Try a different search term or method.'
          : 'Send anything to your endpoint URL and it will appear here instantly.'}
      </p>
    </div>
  );
}
