import { NextResponse } from 'next/server';
import { isValidToken } from '@/lib/ids';
import { getStore } from '@/lib/store';

export const dynamic = 'force-dynamic';

/** DELETE — remove one captured request from the server buffer. */
export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ token: string; id: string }> },
): Promise<Response> {
  const { token, id } = await ctx.params;
  if (!isValidToken(token) || !id) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }
  const removed = await getStore().deleteRequest(token, decodeURIComponent(id));
  return NextResponse.json({ ok: true, removed }, { headers: { 'cache-control': 'no-store' } });
}
