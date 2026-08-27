import type { CapturedRequest } from './types';

/** Tailwind-ish class pairs per HTTP verb. Colour carries meaning, not decoration. */
export const METHOD_STYLES: Record<string, string> = {
  GET: 'text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-500/12',
  POST: 'text-blue-700 bg-blue-50 dark:text-blue-300 dark:bg-blue-500/12',
  PUT: 'text-amber-700 bg-amber-50 dark:text-amber-300 dark:bg-amber-500/12',
  PATCH: 'text-violet-700 bg-violet-50 dark:text-violet-300 dark:bg-violet-500/12',
  DELETE: 'text-rose-700 bg-rose-50 dark:text-rose-300 dark:bg-rose-500/12',
  HEAD: 'text-teal-700 bg-teal-50 dark:text-teal-300 dark:bg-teal-500/12',
  OPTIONS: 'text-cyan-700 bg-cyan-50 dark:text-cyan-300 dark:bg-cyan-500/12',
};

export function methodStyle(method: string): string {
  return METHOD_STYLES[method.toUpperCase()] ?? 'text-ink/70 bg-surface-2';
}

export function formatBytes(n: number): string {
  if (!n) return '0 B';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10240 ? 1 : 0)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

/** "just now" / "4m ago" / "3h ago" / "12 Aug". */
export function relativeTime(iso: string, now = Date.now()): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return '';
  const secs = Math.max(0, Math.round((now - then) / 1000));
  if (secs < 5) return 'just now';
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(then).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export function absoluteTime(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  return new Date(t).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/** Pretty-prints JSON, returning null when the text is not JSON. */
export function tryPrettyJson(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed || !/^[[{"]|^-?\d|^true$|^false$|^null$/.test(trimmed)) return null;
  try {
    return JSON.stringify(JSON.parse(trimmed), null, 2);
  } catch {
    return null;
  }
}

/** Decodes an application/x-www-form-urlencoded body into pairs. */
export function tryFormPairs(contentType: string, body: string): [string, string][] | null {
  if (!contentType.toLowerCase().includes('application/x-www-form-urlencoded')) return null;
  if (!body.trim()) return null;
  try {
    return [...new URLSearchParams(body).entries()];
  } catch {
    return null;
  }
}

export function queryPairs(query: string): [string, string][] {
  if (!query) return [];
  try {
    return [...new URLSearchParams(query).entries()];
  } catch {
    return [];
  }
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

/** Rebuilds the original call as a runnable curl command. */
export function toCurl(req: CapturedRequest, endpointUrl: string): string {
  const url = `${endpointUrl}${req.path}${req.query ? `?${req.query}` : ''}`;
  const skip = new Set(['host', 'content-length', 'connection', 'accept-encoding']);
  const lines = [`curl -X ${req.method} ${shellQuote(url)}`];
  for (const [name, value] of req.headers) {
    if (skip.has(name.toLowerCase()) || name.startsWith('x-forwarded')) continue;
    lines.push(`  -H ${shellQuote(`${name}: ${value}`)}`);
  }
  if (req.body) lines.push(`  --data-raw ${shellQuote(req.body)}`);
  return lines.join(' \\\n');
}

export function statusTone(status: number): string {
  if (status >= 500) return 'text-danger';
  if (status >= 400) return 'text-warn';
  if (status >= 200 && status < 300) return 'text-ok';
  return 'text-muted';
}
