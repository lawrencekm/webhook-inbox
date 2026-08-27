# Webhook Inbox — Product Requirements

**Author:** Lawrence Njenga ([@lawrencekm](https://github.com/lawrencekm))
**Status:** v1.0 — shipped
**Last updated:** 26 August 2026

---

## 1. Problem

Testing a webhook integration means having a public HTTPS URL that will accept
anything and show you exactly what arrived. Today that means leaving your own
tooling and going to webhook.site, which introduces three frictions:

1. **Rate limits and expiry.** Free public testers expire endpoints after a
   fixed window, mid-test.
2. **Shared trust boundary.** Payloads under test may contain credentials,
   customer identifiers, or signed bodies. They land on infrastructure you do
   not control.
3. **No continuity.** Close the tab and the history is a matter of luck.

## 2. Goal

A webhook tester the author controls end to end, hosted on Vercel, that removes
any reason to open webhook.site again.

**Success is:** a live URL in one click, every request visible instantly, history
that persists until explicitly deleted, and an endpoint that stays alive as long
as it is wanted.

## 3. Non-goals

Out of scope for v1, deliberately, to keep the app lean:

- Accounts, teams, sharing, or any form of sign-in.
- Request forwarding / replay to a local machine (tunnelling).
- Email or DNS capture.
- Scripted response logic (WebhookScript-style DSL). A static configurable
  response covers the real need.
- Server-side search or long-term archival.

## 4. Users

| User | Need |
| --- | --- |
| **Primary — the author, integrating payment and messaging APIs** | Verify what a provider (M-Pesa, Stripe, a carrier gateway) actually posts, including headers and signatures, and control what the endpoint replies so the provider marks delivery as successful. |
| **Secondary — anyone who opens the public URL** | Get their own endpoint immediately, with no interference from anyone else's traffic. |

## 5. Requirements

### 5.1 Must have

| # | Requirement | Rationale |
| --- | --- | --- |
| R1 | One click produces a live HTTPS endpoint | The whole value proposition is speed. |
| R2 | The endpoint accepts any method, any sub-path, any content type, any body | Providers differ; the tester must not be opinionated. |
| R3 | Every capture records method, path, query, all headers, body, size, source IP, and timestamp | This is the product. |
| R4 | Requests appear in an open tab without a refresh | Testing loops are tight; polling by hand breaks flow. |
| R5 | Requests captured while the tab is closed are not lost | "My webhooks stay live" is meaningless if you must be watching. |
| R6 | History persists in the browser until the user deletes it | The user's copy is permanent; the server's is a buffer. |
| R7 | Two different browsers get two different endpoints | No cross-talk on a public deployment. |
| R8 | The endpoint's response (status, content type, body, headers) is configurable | Some providers retry or mark failure unless they get a specific reply. |
| R9 | The endpoint stays live until deleted | No surprise expiry mid-test. |

### 5.2 Should have

| # | Requirement |
| --- | --- |
| R10 | Several named endpoints per browser, switchable from the header |
| R11 | Copy any request as a runnable cURL command |
| R12 | Export all captured requests as JSON |
| R13 | Filter by method; free-text search across path, headers, and body |
| R14 | Pretty-printing for JSON, decoding for form-encoded bodies |
| R15 | Light and dark themes, remembered |

### 5.3 Quality bar

| Area | Requirement |
| --- | --- |
| **Navigation** | One level deep. Landing → endpoint. Everything else is in-page. No hidden menus. |
| **Layout** | Generous negative space; content, not chrome. Two panes on desktop, stacked with a back affordance on mobile. |
| **Responsive** | Usable from 360 px up. No horizontal page scroll at any width. |
| **Accessibility** | Keyboard reachable, visible focus rings, labelled controls, colour never the sole signal. |
| **Cost** | Runs within Vercel Hobby and the Upstash free tier for personal use. |
| **Failure** | A storage outage must not break capture's reply to the sender, and must not lose the browser's local history. |

## 6. Design decisions

### 6.1 Two-tier storage

The brief asked for browser-local storage; the brief also asked for webhooks that
stay live. Those pull in opposite directions — a browser cannot receive an HTTP
request while it is closed. The resolution:

- **The browser holds the permanent copy.** `localStorage`, capped at 1,000
  requests per endpoint, deleted only by the user.
- **The server holds a rolling buffer.** The newest 200 requests per endpoint,
  for 30 days, so nothing is missed while the tab is shut. The buffer's only job
  is to hand the browser what it missed.

On page load the app reads the full server buffer and merges it into local
history, de-duplicated by request id.

### 6.2 Why Upstash Redis

Evaluated against the "lean but robust" constraint:

| Option | Verdict |
| --- | --- |
| **Upstash Redis** ✅ | HTTP/REST — works from serverless with no connection pooling. Native TTL and `LTRIM` give expiry and the ring buffer for free. One-click install from the Vercel Marketplace. ~60 lines of storage code, no schema, no migrations. |
| Neon / Vercel Postgres | Correct but heavier: schema, migrations, and a cleanup job to replicate what `EXPIRE` does natively. Cold starts on the free tier. |
| Vercel Blob | No TTL, awkward listing and pagination. Cleanup would be hand-rolled. |
| Browser only | Cannot satisfy R5 — a closed tab receives nothing. |

An in-memory implementation of the same interface ships alongside so that local
development needs no configuration at all.

### 6.3 Live updates without pub/sub

Upstash speaks REST, not Redis pub/sub. The SSE endpoint therefore polls a single
monotonic capture counter every 2 seconds — one cheap `GET` — and only reads the
request list when that counter moves. Delivery is derived from the counter delta
rather than from comparing ids, so ordering across concurrent serverless
instances cannot cause a miss.

The connection closes at ~52 s to stay inside the serverless invocation limit;
`EventSource` reconnects on its own. A hidden tab closes the stream entirely, so
a forgotten tab costs nothing.

### 6.4 Endpoint identity

14 characters from a 31-symbol alphabet (≈8 × 10²⁰ combinations), with visually
ambiguous characters removed so a URL survives being read aloud or screenshotted.
Unguessable is the whole security model — there is no auth, by design.

## 7. Metrics

This is a personal tool, so the measures are behavioural rather than analytical:

- Zero visits to webhook.site during integration work.
- Time from opening the app to a working URL: under 5 seconds.
- No test session lost to endpoint expiry.
- Monthly infrastructure cost: KES 0.

## 8. Risks

| Risk | Mitigation |
| --- | --- |
| Public deployment gets scraped or abused | Endpoints are only minted on an explicit click, never on page load. Bodies are capped at 96 KB and buffers at 200 entries, so a single endpoint cannot grow without bound. |
| `localStorage` quota exhaustion | Writes retry, shedding the oldest quarter of history each attempt, so the newest capture is never the one dropped. |
| Free-tier Redis command limits | Counter-based polling, a 2-second interval, and pausing on tab hide keep a watched tab at roughly 1,800 commands per hour. |
| Storage outage | Capture still returns the configured response to the sender; only the record is lost. Local history renders offline. |

## 9. Future

Ordered by expected value, none committed:

1. Signature verification helpers (Stripe, M-Pesa, GitHub) — show pass/fail beside the request.
2. Per-endpoint response delay, to test sender timeout behaviour.
3. Forward-to-localhost relay.
4. Shareable read-only link for a single captured request.
