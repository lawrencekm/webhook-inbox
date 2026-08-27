import { NextResponse } from 'next/server';
import { createRequestId, isValidToken } from '@/lib/ids';
import { MAX_BODY_BYTES, ensureEndpoint, getStore } from '@/lib/store';
import type { CapturedRequest, HeaderPair } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Headers that leak infrastructure detail and add noise to the inspector. */
const HIDDEN_HEADERS = new Set(['x-vercel-id', 'x-vercel-deployment-url', 'x-vercel-ip-timezone']);

function collectHeaders(req: Request): HeaderPair[] {
  const out: HeaderPair[] = [];
  req.headers.forEach((value, name) => {
    if (!HIDDEN_HEADERS.has(name.toLowerCase())) out.push([name, value]);
  });
  return out.sort((a, b) => a[0].localeCompare(b[0]));
}

function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0]!.trim();
  return req.headers.get('x-real-ip') ?? '';
}

async function readBody(req: Request): Promise<{ body: string; size: number; truncated: boolean }> {
  if (req.method === 'GET' || req.method === 'HEAD') return { body: '', size: 0, truncated: false };
  try {
    const buf = Buffer.from(await req.arrayBuffer());
    const size = buf.byteLength;
    if (size === 0) return { body: '', size: 0, truncated: false };
    const slice = size > MAX_BODY_BYTES ? buf.subarray(0, MAX_BODY_BYTES) : buf;
    return { body: slice.toString('utf8'), size, truncated: size > MAX_BODY_BYTES };
  } catch {
    return { body: '', size: 0, truncated: false };
  }
}

async function capture(
  req: Request,
  ctx: { params: Promise<{ token: string; path?: string[] }> },
): Promise<Response> {
  const { token, path } = await ctx.params;

  if (!isValidToken(token)) {
    return NextResponse.json({ error: 'Invalid endpoint token.' }, { status: 404 });
  }

  const url = new URL(req.url);
  const { body, size, truncated } = await readBody(req);

  const record: CapturedRequest = {
    id: createRequestId(),
    at: new Date().toISOString(),
    method: req.method.toUpperCase(),
    path: path?.length ? `/${path.join('/')}` : '',
    query: url.search.replace(/^\?/, ''),
    headers: collectHeaders(req),
    contentType: req.headers.get('content-type') ?? '',
    body,
    size,
    truncated,
    ip: clientIp(req),
    userAgent: req.headers.get('user-agent') ?? '',
  };

  // Endpoint config drives the reply. Capture must never fail the caller, so a
  // storage error still returns the configured response.
  const meta = await ensureEndpoint(token).catch(() => null);
  try {
    await getStore().addRequest(token, record);
  } catch (err) {
    console.error('[webhook-inbox] capture failed', err);
  }

  const cfg = meta?.response;
  const headers = new Headers({
    'content-type': cfg?.contentType || 'application/json',
    'cache-control': 'no-store',
    'x-webhook-inbox-id': record.id,
    'access-control-allow-origin': '*',
  });
  for (const [name, value] of cfg?.headers ?? []) {
    if (name.trim()) headers.set(name.trim(), value);
  }

  const status = Math.min(Math.max(cfg?.status ?? 200, 100), 599);
  const hasBody = status !== 204 && status !== 304 && req.method !== 'HEAD';
  return new Response(hasBody ? (cfg?.body ?? '') : null, { status, headers });
}

export const GET = capture;
export const POST = capture;
export const PUT = capture;
export const PATCH = capture;
export const DELETE = capture;
export const HEAD = capture;

export async function OPTIONS(): Promise<Response> {
  return new Response(null, {
    status: 204,
    headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,HEAD,OPTIONS',
      'access-control-allow-headers': '*',
      'access-control-max-age': '86400',
    },
  });
}
