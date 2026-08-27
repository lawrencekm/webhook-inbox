'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as local from '@/lib/local';
import type { EndpointMeta } from '@/lib/types';
import ThemeToggle from './ThemeToggle';
import { IconBolt, IconHook, IconInbox, IconShield } from './Icons';

/**
 * Landing screen. Deliberately does not auto-mint an endpoint on page load —
 * crawlers and idle visits would fill storage with tokens nobody asked for.
 */
export default function Landing() {
  const router = useRouter();
  const [mine, setMine] = useState<local.LocalEndpoint[]>([]);
  const [ready, setReady] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setMine(local.loadEndpoints().items);
    setReady(true);
  }, []);

  const create = useCallback(async () => {
    setCreating(true);
    setError('');
    try {
      const res = await fetch('/api/endpoints', { method: 'POST' });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as EndpointMeta;
      local.rememberEndpoint({ token: data.token, name: data.name, createdAt: data.createdAt });
      router.push(`/e/${data.token}`);
    } catch {
      setError('Could not create an endpoint. Check your connection and try again.');
      setCreating(false);
    }
  }, [router]);

  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
        <span className="flex items-center gap-2 text-sm font-semibold text-ink">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-accent-contrast">
            <IconHook width={15} height={15} />
          </span>
          Webhook Inbox
        </span>
        <ThemeToggle />
      </header>

      <main className="mx-auto max-w-5xl px-6 pb-24">
        {/* Hero */}
        <section className="pt-14 pb-16 sm:pt-24 sm:pb-24">
          <h1 className="max-w-3xl text-4xl leading-[1.08] font-semibold tracking-tight text-balance text-ink sm:text-6xl">
            A live HTTPS endpoint,
            <br className="hidden sm:block" /> ready before you finish reading this.
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-muted sm:text-lg">
            Point any webhook at your URL and watch every request land in real time — headers, body,
            query, the lot. Your history stays in your browser until you delete it.
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-3">
            <button
              onClick={create}
              disabled={creating}
              className="rounded-xl bg-accent px-6 py-3.5 text-sm font-semibold text-accent-contrast transition hover:opacity-90 disabled:opacity-60"
            >
              {creating ? 'Creating your endpoint…' : 'Create my endpoint'}
            </button>
            {ready && mine.length > 0 && (
              <Link
                href={`/e/${mine[0]!.token}`}
                className="rounded-xl border border-line px-6 py-3.5 text-sm font-medium text-ink transition hover:border-line-strong"
              >
                Open my last endpoint
              </Link>
            )}
          </div>
          {error && <p className="mt-4 text-sm text-danger">{error}</p>}
          <p className="mt-4 text-xs text-faint">No account. No install. Free.</p>
        </section>

        {/* Your endpoints */}
        {ready && mine.length > 0 && (
          <section className="mb-20">
            <h2 className="mb-4 text-xs font-semibold tracking-wide text-muted uppercase">
              Your endpoints
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {mine.map((e) => (
                <li key={e.token}>
                  <Link
                    href={`/e/${e.token}`}
                    className="flex items-center gap-3 rounded-xl border border-line bg-surface p-4 transition hover:border-line-strong"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-muted">
                      <IconInbox width={17} height={17} />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-ink">{e.name}</span>
                      <span className="block truncate font-mono text-[11px] text-faint">
                        /w/{e.token}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* How it works */}
        <section className="border-t border-line pt-16">
          <ol className="grid gap-10 sm:grid-cols-3 sm:gap-8">
            {[
              {
                n: '01',
                t: 'Claim a URL',
                d: 'One click mints a private endpoint. Nobody else gets yours — this browser remembers it.',
              },
              {
                n: '02',
                t: 'Send anything',
                d: 'Any method, any path under it, any payload. The endpoint answers with whatever response you configure.',
              },
              {
                n: '03',
                t: 'Inspect and keep',
                d: 'Requests stream in live. Copy them as cURL, export as JSON, or clear them when you are done.',
              },
            ].map((s) => (
              <li key={s.n}>
                <span className="font-mono text-xs text-accent">{s.n}</span>
                <h3 className="mt-2 text-base font-semibold text-ink">{s.t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{s.d}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Guarantees */}
        <section className="mt-16 grid gap-4 sm:grid-cols-3">
          {[
            {
              icon: <IconBolt width={16} height={16} />,
              t: 'Always on',
              d: 'Requests are buffered server-side, so nothing is missed while your tab is closed.',
            },
            {
              icon: <IconShield width={16} height={16} />,
              t: 'Yours alone',
              d: 'Endpoint tokens are unguessable and tied to your browser. No sign-in, no shared inbox.',
            },
            {
              icon: <IconInbox width={16} height={16} />,
              t: 'Kept until you say so',
              d: 'Your local copy of every request persists across visits and survives a refresh.',
            },
          ].map((f) => (
            <div key={f.t} className="rounded-xl border border-line bg-surface p-5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-soft text-accent">
                {f.icon}
              </span>
              <h3 className="mt-3 text-sm font-semibold text-ink">{f.t}</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{f.d}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-5xl flex-col gap-1 px-6 py-8 text-xs text-faint sm:flex-row sm:items-center sm:justify-between">
          <span>Webhook Inbox — a lean, self-hosted webhook tester.</span>
          <span>Requests are stored in your browser. Clear them any time.</span>
        </div>
      </footer>
    </div>
  );
}
