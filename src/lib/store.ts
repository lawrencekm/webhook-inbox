import { Redis } from '@upstash/redis';
import { DEFAULT_RESPONSE, type CapturedRequest, type EndpointMeta } from './types';

/* ------------------------------------------------------------------ config */

export const RETENTION_SECONDS = Number(process.env.WEBHOOK_RETENTION_SECONDS ?? 2_592_000); // 30 days
export const MAX_REQUESTS = Number(process.env.WEBHOOK_MAX_REQUESTS ?? 200);
/** Cap on stored body size. Larger bodies are truncated with a flag. */
export const MAX_BODY_BYTES = 96 * 1024;

const NS = 'wi';
const metaKey = (t: string) => `${NS}:meta:${t}`;
const listKey = (t: string) => `${NS}:req:${t}`;
const seqKey = (t: string) => `${NS}:seq:${t}`;

/* ----------------------------------------------------------------- backends */

export interface Store {
  readonly kind: 'redis' | 'memory';
  getMeta(token: string): Promise<EndpointMeta | null>;
  putMeta(meta: EndpointMeta): Promise<void>;
  dropEndpoint(token: string): Promise<void>;
  addRequest(token: string, req: CapturedRequest): Promise<void>;
  listRequests(token: string, limit?: number): Promise<CapturedRequest[]>;
  deleteRequest(token: string, id: string): Promise<boolean>;
  clearRequests(token: string): Promise<void>;
  /** Monotonic capture counter. Cheap to poll; changes iff a request arrived. */
  seq(token: string): Promise<number>;
}

/* -- Redis ---------------------------------------------------------------- */

/**
 * Resolve Upstash REST credentials.
 *
 * Vercel's Upstash marketplace integration prefixes every variable it injects
 * with the store's name (`WEBHOOK_INBOX_KV_REST_API_URL`), so no fixed name is
 * reliable. Check the canonical pairs first, then fall back to any
 * `<PREFIX>KV_REST_API_URL` that has a matching `<PREFIX>KV_REST_API_TOKEN`.
 * Pairing on the shared prefix keeps a URL and token from different stores from
 * being combined; read-only tokens end in `_READ_ONLY_TOKEN` and never match.
 */
function redisCredentials(): { url: string; token: string } | null {
  const env = process.env;
  const canonical: ReadonlyArray<readonly [string | undefined, string | undefined]> = [
    [env.UPSTASH_REDIS_REST_URL, env.UPSTASH_REDIS_REST_TOKEN],
    [env.KV_REST_API_URL, env.KV_REST_API_TOKEN],
  ];
  for (const [url, token] of canonical) if (url && token) return { url, token };

  const SUFFIX = 'KV_REST_API_URL';
  // Sorted so a project with several stores resolves to the same one every boot.
  for (const key of Object.keys(env).sort()) {
    if (!key.endsWith(SUFFIX)) continue;
    const url = env[key];
    const token = env[`${key.slice(0, -SUFFIX.length)}KV_REST_API_TOKEN`];
    if (url && token) return { url, token };
  }
  return null;
}

function redisClient(): Redis | null {
  const creds = redisCredentials();
  if (!creds) return null;
  const { url, token } = creds;
  // Deserialization is handled here rather than by the client so that the exact
  // string we pushed is the exact string we can LREM later.
  return new Redis({ url, token, automaticDeserialization: false });
}

function safeParse<T>(raw: unknown): T | null {
  if (typeof raw !== 'string') return (raw as T) ?? null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

class RedisStore implements Store {
  readonly kind = 'redis' as const;
  constructor(private readonly r: Redis) {}

  async getMeta(token: string): Promise<EndpointMeta | null> {
    return safeParse<EndpointMeta>(await this.r.get(metaKey(token)));
  }

  async putMeta(meta: EndpointMeta): Promise<void> {
    await this.r.set(metaKey(meta.token), JSON.stringify(meta), { ex: RETENTION_SECONDS });
  }

  async dropEndpoint(token: string): Promise<void> {
    await this.r.del(metaKey(token), listKey(token), seqKey(token));
  }

  async addRequest(token: string, req: CapturedRequest): Promise<void> {
    const p = this.r.pipeline();
    p.lpush(listKey(token), JSON.stringify(req));
    p.ltrim(listKey(token), 0, MAX_REQUESTS - 1);
    p.incr(seqKey(token));
    // Any traffic keeps the whole endpoint alive for another full window.
    p.expire(listKey(token), RETENTION_SECONDS);
    p.expire(seqKey(token), RETENTION_SECONDS);
    p.expire(metaKey(token), RETENTION_SECONDS);
    await p.exec();
  }

  async listRequests(token: string, limit = MAX_REQUESTS): Promise<CapturedRequest[]> {
    const raw = (await this.r.lrange(listKey(token), 0, limit - 1)) as unknown[];
    return raw.map((x) => safeParse<CapturedRequest>(x)).filter((x): x is CapturedRequest => !!x);
  }

  async deleteRequest(token: string, id: string): Promise<boolean> {
    const raw = (await this.r.lrange(listKey(token), 0, MAX_REQUESTS - 1)) as unknown[];
    const match = raw.find((x) => safeParse<CapturedRequest>(x)?.id === id);
    if (typeof match !== 'string') return false;
    await this.r.lrem(listKey(token), 1, match);
    return true;
  }

  async clearRequests(token: string): Promise<void> {
    await this.r.del(listKey(token));
  }

  async seq(token: string): Promise<number> {
    const v = await this.r.get(seqKey(token));
    return Number(v ?? 0) || 0;
  }
}

/* -- In-memory (local dev only) ------------------------------------------- */

interface MemoryBucket {
  meta: EndpointMeta | null;
  requests: CapturedRequest[];
  seq: number;
  expiresAt: number;
}

// Survives Fast Refresh in dev by living on globalThis.
const memory: Map<string, MemoryBucket> =
  (globalThis as { __wiMemory?: Map<string, MemoryBucket> }).__wiMemory ??
  ((globalThis as { __wiMemory?: Map<string, MemoryBucket> }).__wiMemory = new Map());

class MemoryStore implements Store {
  readonly kind = 'memory' as const;

  private bucket(token: string, create = false): MemoryBucket | null {
    const existing = memory.get(token);
    if (existing && existing.expiresAt > Date.now()) return existing;
    if (existing) memory.delete(token);
    if (!create) return null;
    const fresh: MemoryBucket = {
      meta: null,
      requests: [],
      seq: 0,
      expiresAt: Date.now() + RETENTION_SECONDS * 1000,
    };
    memory.set(token, fresh);
    return fresh;
  }

  async getMeta(token: string) {
    return this.bucket(token)?.meta ?? null;
  }

  async putMeta(meta: EndpointMeta) {
    const b = this.bucket(meta.token, true)!;
    b.meta = meta;
    b.expiresAt = Date.now() + RETENTION_SECONDS * 1000;
  }

  async dropEndpoint(token: string) {
    memory.delete(token);
  }

  async addRequest(token: string, req: CapturedRequest) {
    const b = this.bucket(token, true)!;
    b.requests.unshift(req);
    b.requests.length = Math.min(b.requests.length, MAX_REQUESTS);
    b.seq += 1;
    b.expiresAt = Date.now() + RETENTION_SECONDS * 1000;
  }

  async listRequests(token: string, limit = MAX_REQUESTS) {
    return (this.bucket(token)?.requests ?? []).slice(0, limit);
  }

  async deleteRequest(token: string, id: string) {
    const b = this.bucket(token);
    if (!b) return false;
    const before = b.requests.length;
    b.requests = b.requests.filter((r) => r.id !== id);
    return b.requests.length !== before;
  }

  async clearRequests(token: string) {
    const b = this.bucket(token);
    if (b) b.requests = [];
  }

  async seq(token: string) {
    return this.bucket(token)?.seq ?? 0;
  }
}

/* ---------------------------------------------------------------- singleton */

let cached: Store | null = null;

export function getStore(): Store {
  if (cached) return cached;
  const client = redisClient();
  if (client) {
    cached = new RedisStore(client);
  } else {
    if (process.env.NODE_ENV === 'production') {
      console.warn(
        '[webhook-inbox] No Upstash Redis credentials found. Falling back to an in-memory ' +
          'store — data will NOT persist across serverless invocations. Set ' +
          'UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN, or let the Vercel ' +
          'Upstash integration inject its <STORE>_KV_REST_API_URL/_TOKEN pair.',
      );
    }
    cached = new MemoryStore();
  }
  return cached;
}

/** Reads an endpoint, creating it on first sight so a URL is live immediately. */
export async function ensureEndpoint(token: string, name?: string): Promise<EndpointMeta> {
  const store = getStore();
  const existing = await store.getMeta(token);
  if (existing) return existing;
  const meta: EndpointMeta = {
    token,
    name: name?.trim() || 'Untitled endpoint',
    createdAt: new Date().toISOString(),
    response: { ...DEFAULT_RESPONSE },
  };
  await store.putMeta(meta);
  return meta;
}
