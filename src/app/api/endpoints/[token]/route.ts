import { NextResponse } from 'next/server';
import { isValidToken } from '@/lib/ids';
import { ensureEndpoint, getStore } from '@/lib/store';
import { DEFAULT_RESPONSE, type HeaderPair, type ResponseConfig } from '@/lib/types';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ token: string }> };
const noStore = { 'cache-control': 'no-store' };

function badToken() {
  return NextResponse.json({ error: 'Invalid endpoint token.' }, { status: 400 });
}

function sanitizeHeaders(input: unknown): HeaderPair[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((p): p is HeaderPair => Array.isArray(p) && typeof p[0] === 'string' && typeof p[1] === 'string')
    .map(([n, v]) => [n.slice(0, 100).trim(), v.slice(0, 2000)] as HeaderPair)
    .filter(([n]) => n.length > 0)
    .slice(0, 20);
}

function sanitizeResponse(input: unknown, current: ResponseConfig): ResponseConfig {
  if (!input || typeof input !== 'object') return current;
  const r = input as Partial<ResponseConfig>;
  const status = Number(r.status);
  return {
    status: Number.isFinite(status) ? Math.min(Math.max(Math.trunc(status), 100), 599) : current.status,
    contentType:
      typeof r.contentType === 'string' && r.contentType.trim()
        ? r.contentType.trim().slice(0, 120)
        : current.contentType,
    body: typeof r.body === 'string' ? r.body.slice(0, 64 * 1024) : current.body,
    headers: r.headers === undefined ? current.headers : sanitizeHeaders(r.headers),
  };
}

/** GET — read (and lazily create) endpoint metadata. */
export async function GET(_req: Request, ctx: Ctx): Promise<Response> {
  const { token } = await ctx.params;
  if (!isValidToken(token)) return badToken();
  const meta = await ensureEndpoint(token);
  return NextResponse.json(meta, { headers: noStore });
}

/** PATCH — rename the endpoint and/or change its canned response. */
export async function PATCH(req: Request, ctx: Ctx): Promise<Response> {
  const { token } = await ctx.params;
  if (!isValidToken(token)) return badToken();

  let payload: { name?: unknown; response?: unknown } = {};
  try {
    payload = (await req.json()) as typeof payload;
  } catch {
    return NextResponse.json({ error: 'Expected a JSON body.' }, { status: 400 });
  }

  const meta = await ensureEndpoint(token);
  const next = {
    ...meta,
    name: typeof payload.name === 'string' ? payload.name.trim().slice(0, 60) || meta.name : meta.name,
    response: sanitizeResponse(payload.response, meta.response ?? DEFAULT_RESPONSE),
  };

  await getStore().putMeta(next);
  return NextResponse.json(next, { headers: noStore });
}

/** DELETE — remove the endpoint and every request captured for it. */
export async function DELETE(_req: Request, ctx: Ctx): Promise<Response> {
  const { token } = await ctx.params;
  if (!isValidToken(token)) return badToken();
  await getStore().dropEndpoint(token);
  return NextResponse.json({ ok: true }, { headers: noStore });
}
