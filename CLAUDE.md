# CLAUDE.md

Guidance for Claude Code (and any other agent) working in this repository.

## What this is

**Webhook Inbox** — a self-hosted webhook.site alternative. Next.js 15 App Router,
TypeScript, Tailwind v4, deployed on Vercel with Upstash Redis. Author: Lawrence
Njenga ([@lawrencekm](https://github.com/lawrencekm)).

Read `PRD.md` before making product decisions. It records what was deliberately
left out and why — most "obvious missing feature" ideas are non-goals on purpose.

## The one architectural idea

**Two tiers of storage, with different jobs.**

- `localStorage` in the browser is the **permanent** copy of the user's request
  history. It is deleted only when the user asks. Capped at 1,000 per endpoint.
- Redis on the server is a **rolling buffer** — newest 200 per endpoint, 30-day
  TTL. Its only job is to hand the browser what arrived while the tab was closed.

On load, the client fetches the full server buffer and merges it into local
history, de-duplicated by request id. Never invert this: the server is not the
source of truth for what the user sees.

## Layout

```
src/
  app/
    w/[token]/[[...path]]/route.ts       the capture endpoint (any method, any path)
    e/[token]/page.tsx                   the inspector page
    api/endpoints/…                      endpoint CRUD, request list, SSE stream
    page.tsx  layout.tsx  globals.css  not-found.tsx
  components/                            all client components
  lib/
    store.ts    Redis + in-memory implementations of one `Store` interface
    local.ts    everything that touches localStorage ('use client')
    types.ts    shared shapes; the single source of truth for the data model
    ids.ts      token and request-id generation
    format.ts   presentation helpers (bytes, relative time, cURL, pretty JSON)
```

## Conventions

- **Storage access goes through `getStore()`.** Never import `@upstash/redis`
  outside `src/lib/store.ts`. Both implementations must satisfy `Store` so local
  dev keeps working with no credentials.
- **`src/lib/local.ts` is browser-only.** It is `'use client'` and every access is
  wrapped — private mode, disabled storage, and quota exhaustion must all degrade
  quietly, never throw.
- **Capture must never fail the sender.** A storage error in
  `w/[token]/[[...path]]/route.ts` is logged and swallowed; the configured
  response still goes back.
- **Colour comes from CSS variables in `globals.css`**, surfaced as Tailwind
  tokens (`bg-surface`, `text-muted`, `border-line`, …). Do not hardcode hex
  values or use raw Tailwind palette colours in components — dark mode is driven
  entirely by those variables.
- **Types live in `lib/types.ts`.** If you add a field to a captured request, add
  it there first; the API, the store, and the UI all read from that shape.
- Route handlers are `export const dynamic = 'force-dynamic'` — nothing here is
  cacheable.

## Things that will bite you

- **`params` is a Promise** in Next 15 route handlers and pages. Always `await`.
- **The live feed is counter-driven, not id-driven.** `stream/route.ts` polls
  `seq` and sends the newest `delta` entries. Request ids are only *approximately*
  ordered across concurrent serverless instances, so do not reintroduce
  `filter(r => r.id > cursor)` as the delivery mechanism — it can drop a capture.
- **Free-tier Redis budget is real.** Each SSE tick is one `GET`. Do not shorten
  `POLL_MS`, do not remove the `visibilitychange` handler that closes the stream
  on a hidden tab, and do not add per-tick list reads.
- **`maxDuration = 60` on the stream route** is not decorative. The loop must stop
  before the platform kills it (`LIFETIME_MS = 52_000`); `EventSource` reconnects.
- **Never `LREM` a re-serialised object.** `RedisStore` sets
  `automaticDeserialization: false` precisely so the string pushed is the string
  removed. Keep it that way.

## Working on this

```bash
npm run dev          # zero-config: falls back to the in-memory store
npm run typecheck    # tsc --noEmit
npm run lint
npm run build        # must pass before any change is considered done
```

Verify changes against a running server, not by reading the diff:

```bash
npm run build && npm start &
TOKEN=$(curl -s -X POST localhost:3000/api/endpoints | jq -r .token)
curl -X POST "localhost:3000/w/$TOKEN/test" -H 'content-type: application/json' -d '{"a":1}'
curl -s "localhost:3000/api/endpoints/$TOKEN/requests" | jq '.requests[0] | {method,path,body}'
```

## Scope discipline

The brief is "lean but robust". Before adding anything, check it against the
non-goals in `PRD.md` §3. Prefer deleting code to adding an option. If a feature
needs a new dependency, that is a strong signal it belongs in §9 (Future) rather
than in the app.
