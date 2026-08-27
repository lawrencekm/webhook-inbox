'use client';

import { useMemo, useState } from 'react';
import {
  absoluteTime,
  formatBytes,
  methodStyle,
  queryPairs,
  toCurl,
  tryFormPairs,
  tryPrettyJson,
} from '@/lib/format';
import type { CapturedRequest } from '@/lib/types';
import CopyButton from './CopyButton';
import { IconArrowLeft, IconTrash } from './Icons';

type Tab = 'body' | 'headers' | 'query' | 'curl';

interface Props {
  request: CapturedRequest;
  endpointUrl: string;
  onDelete: (id: string) => void;
  onBack: () => void;
}

/** Right pane: everything about one captured request. */
export default function RequestDetail({ request, endpointUrl, onDelete, onBack }: Props) {
  const [tab, setTab] = useState<Tab>('body');
  const [raw, setRaw] = useState(false);

  const pretty = useMemo(() => tryPrettyJson(request.body), [request.body]);
  const formPairs = useMemo(
    () => tryFormPairs(request.contentType, request.body),
    [request.contentType, request.body],
  );
  const qPairs = useMemo(() => queryPairs(request.query), [request.query]);
  const curl = useMemo(() => toCurl(request, endpointUrl), [request, endpointUrl]);

  const fullUrl = `${endpointUrl}${request.path}${request.query ? `?${request.query}` : ''}`;

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'body', label: 'Body' },
    { id: 'headers', label: 'Headers', count: request.headers.length },
    { id: 'query', label: 'Query', count: qPairs.length },
    { id: 'curl', label: 'cURL' },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Summary */}
      <header className="shrink-0 border-b border-line px-4 py-4 sm:px-6 sm:py-5">
        <div className="flex items-start gap-3">
          <button
            onClick={onBack}
            aria-label="Back to list"
            className="-ml-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-ink md:hidden"
          >
            <IconArrowLeft />
          </button>
          <span
            className={`shrink-0 rounded-md px-2 py-1 font-mono text-[11px] font-bold tracking-wider ${methodStyle(
              request.method,
            )}`}
          >
            {request.method}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-mono text-sm text-ink" title={fullUrl}>
              {request.path || '/'}
              {request.query && <span className="text-muted">?{request.query}</span>}
            </p>
            <p className="mt-1 text-xs text-faint">{absoluteTime(request.at)}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <CopyButton value={fullUrl} label="URL" compact />
            <button
              onClick={() => onDelete(request.id)}
              aria-label="Delete this request"
              title="Delete this request"
              className="inline-flex h-[30px] w-[30px] items-center justify-center rounded-lg border border-line text-muted transition hover:border-danger hover:text-danger"
            >
              <IconTrash width={15} height={15} />
            </button>
          </div>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2.5 text-xs sm:grid-cols-4">
          <Meta label="Size" value={request.size ? formatBytes(request.size) : '—'} />
          <Meta label="Content type" value={request.contentType || '—'} />
          <Meta label="From" value={request.ip || '—'} />
          <Meta label="User agent" value={request.userAgent || '—'} />
        </dl>
      </header>

      {/* Tabs */}
      <div className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-line px-2 sm:px-4">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`relative shrink-0 px-3 py-2.5 text-sm font-medium transition ${
              tab === t.id ? 'text-ink' : 'text-muted hover:text-ink'
            }`}
          >
            {t.label}
            {typeof t.count === 'number' && t.count > 0 && (
              <span className="ml-1.5 text-[11px] text-faint">{t.count}</span>
            )}
            {tab === t.id && (
              <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-accent" />
            )}
          </button>
        ))}
      </div>

      {/* Panel */}
      <div className="min-h-0 flex-1 overflow-y-auto p-4 scroll-thin sm:p-6">
        {tab === 'body' && (
          <>
            {request.body ? (
              <>
                <PanelBar
                  copyValue={raw || !pretty ? request.body : pretty}
                  right={
                    (pretty || formPairs) && (
                      <button
                        onClick={() => setRaw((v) => !v)}
                        className="rounded-md px-2 py-1 text-xs font-medium text-muted transition hover:text-ink"
                      >
                        {raw ? 'Formatted' : 'Raw'}
                      </button>
                    )
                  }
                />
                {!raw && formPairs ? (
                  <PairTable pairs={formPairs} />
                ) : (
                  <Code>{!raw && pretty ? pretty : request.body}</Code>
                )}
                {request.truncated && (
                  <p className="mt-3 rounded-lg bg-surface-2 px-3 py-2 text-xs text-warn">
                    Body truncated for storage — the original was {formatBytes(request.size)}.
                  </p>
                )}
              </>
            ) : (
              <Empty>No request body.</Empty>
            )}
          </>
        )}

        {tab === 'headers' && <PairTable pairs={request.headers} />}

        {tab === 'query' &&
          (qPairs.length ? <PairTable pairs={qPairs} /> : <Empty>No query string.</Empty>)}

        {tab === 'curl' && (
          <>
            <PanelBar copyValue={curl} />
            <Code>{curl}</Code>
          </>
        )}
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-faint">{label}</dt>
      <dd className="truncate text-ink" title={value}>
        {value}
      </dd>
    </div>
  );
}

function PanelBar({ copyValue, right }: { copyValue: string; right?: React.ReactNode }) {
  return (
    <div className="mb-2 flex items-center justify-end gap-1">
      {right}
      <CopyButton value={copyValue} compact label="Copy" />
    </div>
  );
}

function Code({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-xl border border-line bg-surface-2 p-4 font-mono text-[12.5px] leading-relaxed break-words whitespace-pre-wrap text-ink scroll-thin">
      {children}
    </pre>
  );
}

function PairTable({ pairs }: { pairs: [string, string][] }) {
  if (!pairs.length) return <Empty>Nothing here.</Empty>;
  return (
    <div className="overflow-hidden rounded-xl border border-line">
      <table className="w-full table-fixed text-left text-[13px]">
        <tbody>
          {pairs.map(([name, value], i) => (
            <tr key={`${name}-${i}`} className="border-b border-line last:border-0">
              <th
                scope="row"
                className="w-2/5 max-w-0 truncate bg-surface-2 px-3 py-2.5 align-top font-mono font-medium text-muted"
                title={name}
              >
                {name}
              </th>
              <td className="px-3 py-2.5 align-top font-mono break-all text-ink">{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-10 text-center text-sm text-faint">{children}</p>;
}
