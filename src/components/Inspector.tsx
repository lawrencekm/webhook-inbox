'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import * as local from '@/lib/local';
import type { CapturedRequest, EndpointMeta, RequestsPayload } from '@/lib/types';
import { DEFAULT_RESPONSE } from '@/lib/types';
import CopyButton from './CopyButton';
import EndpointSwitcher from './EndpointSwitcher';
import RequestDetail from './RequestDetail';
import RequestList from './RequestList';
import SettingsDialog from './SettingsDialog';
import ThemeToggle from './ThemeToggle';
import { IconDownload, IconHook, IconPlus, IconSettings, IconTrash } from './Icons';

type Connection = 'connecting' | 'live' | 'offline';

export default function Inspector({ token }: { token: string }) {
  const router = useRouter();

  const [meta, setMeta] = useState<EndpointMeta | null>(null);
  const [requests, setRequests] = useState<CapturedRequest[]>([]);
  const [endpoints, setEndpoints] = useState<local.LocalEndpoint[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [connection, setConnection] = useState<Connection>('connecting');
  const [filter, setFilter] = useState('');
  const [method, setMethod] = useState('ALL');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [origin, setOrigin] = useState('');

  const endpointUrl = origin ? `${origin}/w/${token}` : '';
  const selected = useMemo(
    () => requests.find((r) => r.id === selectedId) ?? null,
    [requests, selectedId],
  );

  /* ------------------------------------------------------------- bootstrap */

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  // Local history is authoritative for what you see; paint it immediately.
  useEffect(() => {
    setRequests(local.loadRequests(token));
    setSelectedId(null);
    setFilter('');
    setMethod('ALL');
  }, [token]);

  // Endpoint metadata (created on first sight server-side).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/endpoints/${token}`, { cache: 'no-store' });
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as EndpointMeta;
        if (cancelled) return;
        setMeta(data);
        const book = local.rememberEndpoint({
          token,
          name: local.loadEndpoints().items.find((e) => e.token === token)?.name ?? data.name,
          createdAt: data.createdAt,
        });
        setEndpoints(book.items);
      } catch {
        if (!cancelled) {
          setMeta({
            token,
            name: 'Untitled endpoint',
            createdAt: new Date().toISOString(),
            response: { ...DEFAULT_RESPONSE },
          });
          setEndpoints(local.loadEndpoints().items);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  /**
   * Pulls the whole server buffer and folds it into local history. Reading the
   * full window (rather than asking for everything after a cursor) means a
   * capture can never be skipped; `mergeRequests` de-duplicates by id.
   */
  const syncFromServer = useCallback(async () => {
    try {
      const res = await fetch(`/api/endpoints/${token}/requests`, { cache: 'no-store' });
      if (!res.ok) return;
      const data = (await res.json()) as RequestsPayload;
      if (data.requests?.length) setRequests(local.mergeRequests(token, data.requests));
    } catch {
      /* offline is survivable — local history still renders */
    }
  }, [token]);

  useEffect(() => {
    void syncFromServer();
  }, [syncFromServer]);

  /* ------------------------------------------------------------ live feed */

  const sourceRef = useRef<EventSource | null>(null);

  const connect = useCallback(() => {
    sourceRef.current?.close();
    const es = new EventSource(`/api/endpoints/${token}/stream`);
    sourceRef.current = es;

    es.addEventListener('open', () => setConnection('live'));
    es.addEventListener('requests', (e) => {
      try {
        const incoming = JSON.parse((e as MessageEvent<string>).data) as CapturedRequest[];
        if (incoming.length) setRequests(local.mergeRequests(token, incoming));
      } catch {
        /* ignore malformed frame */
      }
    });
    // The server closes at ~52s to stay inside the serverless limit; EventSource
    // reconnects on its own, which also refreshes the cursor.
    es.onerror = () => setConnection((c) => (c === 'live' ? 'connecting' : c));
  }, [token]);

  useEffect(() => {
    if (typeof window === 'undefined' || !('EventSource' in window)) {
      setConnection('offline');
      return;
    }
    connect();

    // Don't burn quota on a tab nobody is looking at.
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        setConnection('connecting');
        void syncFromServer();
        connect();
      } else {
        sourceRef.current?.close();
        sourceRef.current = null;
        setConnection('offline');
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      sourceRef.current?.close();
      sourceRef.current = null;
    };
  }, [connect, syncFromServer]);

  // Keeps relative timestamps honest without re-rendering constantly.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 20_000);
    return () => clearInterval(t);
  }, []);

  /* --------------------------------------------------------------- actions */

  const createEndpoint = useCallback(async () => {
    setCreating(true);
    try {
      const res = await fetch('/api/endpoints', { method: 'POST' });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as EndpointMeta;
      local.rememberEndpoint({ token: data.token, name: data.name, createdAt: data.createdAt });
      router.push(`/e/${data.token}`);
    } catch {
      setCreating(false);
    }
  }, [router]);

  const deleteRequest = useCallback(
    (id: string) => {
      setRequests(local.removeRequest(token, id));
      setSelectedId((cur) => (cur === id ? null : cur));
      void fetch(`/api/endpoints/${token}/requests/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      }).catch(() => {});
    },
    [token],
  );

  const clearAll = useCallback(() => {
    setRequests(local.clearRequests(token));
    setSelectedId(null);
    setConfirmClear(false);
    void fetch(`/api/endpoints/${token}/requests`, { method: 'DELETE' }).catch(() => {});
  }, [token]);

  const exportJson = useCallback(() => {
    const blob = new Blob([JSON.stringify({ endpoint: endpointUrl, requests }, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `webhook-inbox-${token}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }, [requests, endpointUrl, token]);

  const saveSettings = useCallback(
    async (patch: { name: string; response: EndpointMeta['response'] }) => {
      const res = await fetch(`/api/endpoints/${token}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (res.ok) {
        setMeta((await res.json()) as EndpointMeta);
        setEndpoints(local.renameEndpoint(token, patch.name).items);
      }
    },
    [token],
  );

  const deleteEndpoint = useCallback(() => {
    void fetch(`/api/endpoints/${token}`, { method: 'DELETE' }).catch(() => {});
    const book = local.forgetEndpoint(token);
    setSettingsOpen(false);
    if (book.items[0]) router.push(`/e/${book.items[0].token}`);
    else router.push('/');
  }, [token, router]);

  /* ------------------------------------------------------------------ view */

  return (
    <div className="flex h-dvh flex-col">
      {/* Top bar */}
      <header className="z-30 flex shrink-0 items-center gap-2 border-b border-line bg-bg px-3 py-2.5 sm:gap-3 sm:px-5">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 rounded-lg px-1 py-1 text-sm font-semibold text-ink"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-accent-contrast">
            <IconHook width={15} height={15} />
          </span>
          <span className="hidden sm:inline">Webhook Inbox</span>
        </Link>

        <span className="mx-1 hidden h-5 w-px bg-line sm:block" />

        <EndpointSwitcher
          endpoints={endpoints}
          activeToken={token}
          onSelect={(t) => router.push(`/e/${t}`)}
          onCreate={createEndpoint}
          creating={creating}
        />

        <div className="flex-1" />

        <button
          onClick={createEndpoint}
          disabled={creating}
          className="hidden items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm font-medium text-muted transition hover:border-line-strong hover:text-ink disabled:opacity-50 sm:inline-flex"
        >
          <IconPlus width={15} height={15} /> New
        </button>
        <button
          onClick={() => setSettingsOpen(true)}
          aria-label="Endpoint settings"
          title="Endpoint settings"
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line text-muted transition hover:border-line-strong hover:text-ink"
        >
          <IconSettings />
        </button>
        <ThemeToggle />
      </header>

      {/* Endpoint URL */}
      <section className="shrink-0 border-b border-line bg-bg-subtle px-3 py-4 sm:px-5 sm:py-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
          <div className="min-w-0 flex-1">
            <p className="mb-1.5 flex items-center gap-2 text-[11px] font-medium tracking-wide text-muted uppercase">
              Your endpoint URL
              <StatusPill connection={connection} />
            </p>
            <p className="truncate font-mono text-[13px] text-ink sm:text-[15px]" title={endpointUrl}>
              {endpointUrl || `…/w/${token}`}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <CopyButton
              value={endpointUrl}
              label="Copy URL"
              className="!border-accent !bg-accent !px-3.5 !py-2 !text-sm !text-accent-contrast hover:!opacity-90"
            />
            <span className="hidden text-xs text-faint lg:inline">
              Any method · any path · any payload
            </span>
          </div>
        </div>
      </section>

      {/* Panes */}
      <main className="grid min-h-0 flex-1 md:grid-cols-[minmax(300px,34%)_1fr] lg:grid-cols-[minmax(340px,30%)_1fr]">
        <aside
          className={`min-h-0 flex-col border-line md:flex md:border-r ${
            selected ? 'hidden md:flex' : 'flex'
          }`}
        >
          <div className="flex shrink-0 items-center justify-between gap-2 px-3 py-2.5">
            <p className="text-xs text-muted">
              <span className="font-semibold text-ink">{requests.length}</span>{' '}
              {requests.length === 1 ? 'request' : 'requests'} kept in this browser
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={exportJson}
                disabled={!requests.length}
                aria-label="Export all requests as JSON"
                title="Export as JSON"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-ink disabled:opacity-40"
              >
                <IconDownload width={15} height={15} />
              </button>
              <button
                onClick={() => (confirmClear ? clearAll() : setConfirmClear(true))}
                onBlur={() => setConfirmClear(false)}
                disabled={!requests.length}
                className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs font-medium transition disabled:opacity-40 ${
                  confirmClear ? 'bg-danger text-white' : 'text-muted hover:bg-surface-2 hover:text-ink'
                }`}
              >
                <IconTrash width={15} height={15} />
                {confirmClear && 'Confirm'}
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 border-t border-line">
            <RequestList
              requests={requests}
              selectedId={selectedId}
              onSelect={setSelectedId}
              filter={filter}
              onFilterChange={setFilter}
              method={method}
              onMethodChange={setMethod}
              now={now}
            />
          </div>
        </aside>

        <section className={`min-h-0 ${selected ? 'block' : 'hidden md:block'}`}>
          {selected ? (
            <RequestDetail
              request={selected}
              endpointUrl={endpointUrl}
              onDelete={deleteRequest}
              onBack={() => setSelectedId(null)}
            />
          ) : (
            <Placeholder endpointUrl={endpointUrl} hasRequests={requests.length > 0} />
          )}
        </section>
      </main>

      {meta && (
        <SettingsDialog
          meta={meta}
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          onSave={saveSettings}
          onDeleteEndpoint={deleteEndpoint}
        />
      )}
    </div>
  );
}

function StatusPill({ connection }: { connection: Connection }) {
  const map = {
    live: { dot: 'bg-ok live-dot', text: 'Live' },
    connecting: { dot: 'bg-warn', text: 'Connecting' },
    offline: { dot: 'bg-faint', text: 'Paused' },
  }[connection];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-surface px-2 py-0.5 text-[10px] font-semibold tracking-normal text-muted normal-case">
      <span className={`h-1.5 w-1.5 rounded-full ${map.dot}`} />
      {map.text}
    </span>
  );
}

function Placeholder({ endpointUrl, hasRequests }: { endpointUrl: string; hasRequests: boolean }) {
  const sample = `curl -X POST ${endpointUrl || 'https://…'} \\
  -H 'Content-Type: application/json' \\
  -d '{"event":"test","ok":true}'`;

  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="w-full max-w-lg text-center">
        <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-surface-2 text-faint">
          <IconHook width={22} height={22} />
        </span>
        <h2 className="text-base font-semibold text-ink">
          {hasRequests ? 'Select a request' : 'Your endpoint is live'}
        </h2>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted">
          {hasRequests
            ? 'Pick anything on the left to see its headers, body, and a ready-to-run cURL command.'
            : 'Point any webhook at the URL above. Requests appear here the moment they arrive.'}
        </p>
        {!hasRequests && endpointUrl && (
          <div className="mt-6 text-left">
            <div className="mb-2 flex justify-end">
              <CopyButton value={sample} label="Copy" compact />
            </div>
            <pre className="overflow-x-auto rounded-xl border border-line bg-surface-2 p-4 text-left font-mono text-[12px] leading-relaxed text-ink scroll-thin">
              {sample}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
