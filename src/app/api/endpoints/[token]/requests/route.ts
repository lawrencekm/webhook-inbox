import { NextResponse } from 'next/server';
import { isValidToken } from '@/lib/ids';
import { MAX_REQUESTS, getStore } from '@/lib/store';
import type { RequestsPayload } from '@/lib/types';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ token: string }> };
const noStore = { 'cache-control': 'no-store' };

/** GET — the server-side buffer for this endpoint, newest first. */
export async function GET(req: Request, ctx: Ctx): Promise<Response> {
  const { token } = await ctx.params;
  if (!isValidToken(token)) {
    return NextResponse.json({ error: 'Invalid endpoint token.' }, { status: 400 });
  }

  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get('limit')) || MAX_REQUESTS, MAX_REQUESTS);
  const since = url.searchParams.get('since') ?? '';

  const store = getStore();
  const [seq, all] = await Promise.all([store.seq(token), store.listRequests(token, limit)]);
  const requests = since ? all.filter((r) => r.id > since) : all;

  const payload: RequestsPayload = { token, seq, requests };
  return NextResponse.json(payload, { headers: noStore });
}

/** DELETE — clear the server buffer. The browser copy is untouched. */
export async function DELETE(_req: Request, ctx: Ctx): Promise<Response> {
  const { token } = await ctx.params;
  if (!isValidToken(token)) {
    return NextResponse.json({ error: 'Invalid endpoint token.' }, { status: 400 });
  }
  await getStore().clearRequests(token);
  return NextResponse.json({ ok: true }, { headers: noStore });
}
