import { isValidToken } from '@/lib/ids';
import { getStore } from '@/lib/store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
/** Vercel caps a single function invocation; the client reconnects after this. */
export const maxDuration = 60;

const POLL_MS = 2_000;
const LIFETIME_MS = 52_000;
/** Newest N replayed when a stream opens, closing the gap against a page-load fetch. */
const RESYNC_ON_OPEN = 10;

/**
 * GET — Server-Sent Events feed of newly captured requests.
 *
 * Upstash speaks REST, not pub/sub, so this polls a monotonic counter (one
 * cheap GET per tick) and only reads the list when that counter moves.
 */
export async function GET(req: Request, ctx: { params: Promise<{ token: string }> }): Promise<Response> {
  const { token } = await ctx.params;
  if (!isValidToken(token)) return new Response('Invalid endpoint token.', { status: 400 });

  const store = getStore();
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const startedAt = Date.now();
      let closed = false;
      let lastSeq = -1;

      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          closed = true;
        }
      };

      const shutdown = () => {
        if (closed) return;
        closed = true;
        clearInterval(timer);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };

      req.signal.addEventListener('abort', shutdown);
      send('open', { token, at: new Date().toISOString() });

      const tick = async () => {
        if (closed) return;
        if (Date.now() - startedAt > LIFETIME_MS) {
          send('bye', { reason: 'lifetime' });
          shutdown();
          return;
        }
        try {
          const seq = await store.seq(token);
          if (seq !== lastSeq) {
            // The list is in arrival order, so the newest `delta` entries are
            // exactly what has landed since the previous tick. Deriving the
            // window from the counter avoids relying on id comparison, which is
            // not totally ordered across concurrent instances.
            const delta = lastSeq < 0 ? RESYNC_ON_OPEN : Math.max(seq - lastSeq, 0);
            lastSeq = seq;
            if (delta > 0) {
              const fresh = (await store.listRequests(token)).slice(0, delta);
              // Oldest first so the client can prepend in a stable order.
              if (fresh.length) send('requests', fresh.slice().reverse());
            }
          } else {
            // Comment frame keeps proxies from buffering the connection shut.
            if (!closed) controller.enqueue(encoder.encode(': ping\n\n'));
          }
        } catch (err) {
          console.error('[webhook-inbox] stream tick failed', err);
        }
      };

      const timer = setInterval(() => void tick(), POLL_MS);
      void tick();
    },
  });

  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-store, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    },
  });
}
