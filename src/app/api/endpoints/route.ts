import { NextResponse } from 'next/server';
import { createToken } from '@/lib/ids';
import { ensureEndpoint } from '@/lib/store';

export const dynamic = 'force-dynamic';

/** POST /api/endpoints — mint a brand new endpoint. */
export async function POST(req: Request): Promise<Response> {
  let name: string | undefined;
  try {
    const body = (await req.json()) as { name?: string };
    name = typeof body?.name === 'string' ? body.name.slice(0, 60) : undefined;
  } catch {
    /* empty body is fine */
  }

  const meta = await ensureEndpoint(createToken(), name);
  return NextResponse.json(meta, { status: 201, headers: { 'cache-control': 'no-store' } });
}
