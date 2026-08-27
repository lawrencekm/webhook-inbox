# Webhook Inbox

A lean, self-hosted alternative to webhook.site. Create a live HTTPS endpoint in
one click, watch every request land in real time, and keep the history in your
own browser until you delete it.

Built by [Lawrence Njenga](https://github.com/lawrencekm).

---

## How to use it

1. **Open the app and click "Create my endpoint".**
   You get a private URL that looks like `https://your-app.vercel.app/w/kx7m2p9qwe4rza`.

2. **Point your webhook at it.**
   Any method works, any path under the URL works, any payload works:

   ```bash
   curl -X POST https://your-app.vercel.app/w/kx7m2p9qwe4rza/orders/created \
     -H 'Content-Type: application/json' \
     -d '{"event":"order.created","amount":4200}'
   ```

3. **Watch it arrive.** The request shows up in the list immediately — no refresh.
   Click it to see the body (JSON pretty-printed, form data decoded), all headers,
   the query string, and a ready-to-run cURL command that reproduces the call.

4. **Keep or clear.** Requests stay in your browser across visits and refreshes.
   The trash icon clears them; the download icon exports everything as JSON.

### Things worth knowing

| What | How it behaves |
| --- | --- |
| **Your endpoint stays live** | It keeps working until you delete it. Nothing expires while you are using it. |
| **Closed your tab?** | Requests are still captured. The server keeps a 30-day rolling buffer and the app catches up when you come back. |
| **Someone else opens the app** | They get their own endpoint. Tokens are 14 random characters and are remembered per browser — nobody shares an inbox. |
| **Multiple endpoints** | Use the switcher in the top-left to keep several side by side (e.g. `stripe-test`, `mpesa-c2b`). |
| **Custom replies** | The gear icon lets you set the status code, content type, body, and extra headers your endpoint replies with — useful when a provider only marks a webhook delivered after a specific response. |
| **Private by default** | No account, no sign-in. Your request history never leaves your browser; only the rolling server buffer touches the backend. |

### Keyboard and UI notes

- The endpoint URL is one click to copy.
- Filter the list by method, or search across path, headers and body.
- Light and dark themes; the toggle remembers your choice.
- Works on a phone — the list and detail views stack.

---

## Deploy your own

### 1. Push to GitHub and import into Vercel

```bash
git init && git add -A && git commit -m "Webhook Inbox"
git remote add origin git@github.com:lawrencekm/webhook-inbox.git
git push -u origin main
```

Then import the repo at [vercel.com/new](https://vercel.com/new). No build settings
to change — Vercel detects Next.js.

### 2. Add Redis (one click)

In your Vercel project: **Storage → Marketplace → Upstash → Redis → Create**.

Vercel injects the credentials automatically. Depending on how the store was
created they arrive either as `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`
or, from the marketplace integration, prefixed with the store name
(`WEBHOOK_INBOX_KV_REST_API_URL` / `WEBHOOK_INBOX_KV_REST_API_TOKEN`). Both are
detected — nothing to rename.
Redeploy once and you are done. The free tier is comfortably enough for personal
testing (see the note on cost below).

### 3. Optional environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `WEBHOOK_RETENTION_SECONDS` | `2592000` (30 days) | How long the server buffer keeps a request. Your browser copy is unaffected. |
| `WEBHOOK_MAX_REQUESTS` | `200` | Ring-buffer size per endpoint on the server. |
| `NEXT_PUBLIC_BASE_URL` | *(derived)* | Only needed if you serve the app behind a proxy that rewrites the host. |

---

## Run it locally

```bash
npm install
npm run dev          # http://localhost:3000
```

With no Redis credentials the app falls back to an in-memory store, so local
development works with zero configuration. Data is wiped when you restart the
server — set the two Upstash variables in `.env.local` if you want persistence
(copy `.env.example` to get started).

```bash
npm run build        # production build
npm start            # serve the production build
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
```

---

## API

Every endpoint is also usable from a script.

| Method | Path | Purpose |
| --- | --- | --- |
| `ANY` | `/w/:token/*` | The capture endpoint. Whatever you send is recorded. |
| `POST` | `/api/endpoints` | Mint a new endpoint. Returns its metadata. |
| `GET` | `/api/endpoints/:token` | Read endpoint metadata (creates it if new). |
| `PATCH` | `/api/endpoints/:token` | Update the label and/or the canned response. |
| `DELETE` | `/api/endpoints/:token` | Delete the endpoint and its buffer. |
| `GET` | `/api/endpoints/:token/requests` | List the server buffer, newest first. Accepts `?limit=` and `?since=<id>`. |
| `DELETE` | `/api/endpoints/:token/requests` | Clear the server buffer. |
| `DELETE` | `/api/endpoints/:token/requests/:id` | Delete a single captured request. |
| `GET` | `/api/endpoints/:token/stream` | Server-Sent Events feed of new captures. |

Example — poll your latest request from a test script:

```bash
curl -s https://your-app.vercel.app/api/endpoints/kx7m2p9qwe4rza/requests?limit=1 \
  | jq '.requests[0].body'
```

---

## Cost

On Vercel Hobby and the Upstash free tier this runs at zero cost for personal use.
The live feed polls a single Redis counter every 2 seconds and pauses entirely
when the tab is hidden, which keeps command usage low — roughly 1,800 commands per
hour of actively-watched tab against a 500k/month allowance.

---

## License

MIT © Lawrence Njenga
