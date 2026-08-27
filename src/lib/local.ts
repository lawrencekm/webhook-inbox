'use client';

import type { CapturedRequest } from './types';

/**
 * Browser-local persistence.
 *
 * The server keeps a rolling buffer so nothing is lost while your tab is shut;
 * this module keeps *your* permanent copy. Requests live here until you delete
 * them, and nothing here ever leaves the browser.
 */

const ENDPOINTS_KEY = 'wi.endpoints.v1';
const REQUESTS_PREFIX = 'wi.requests.v1.';
const THEME_KEY = 'wi.theme.v1';

/** Hard ceiling per endpoint so one noisy integration cannot fill the origin quota. */
export const LOCAL_REQUEST_CAP = 1000;

export interface LocalEndpoint {
  token: string;
  name: string;
  createdAt: string;
}

interface EndpointBook {
  version: 1;
  active: string | null;
  items: LocalEndpoint[];
}

const EMPTY_BOOK: EndpointBook = { version: 1, active: null, items: [] };

function available(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    const s = window.localStorage;
    const probe = '__wi_probe__';
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

function read<T>(key: string, fallback: T): T {
  const s = available();
  if (!s) return fallback;
  try {
    const raw = s.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): boolean {
  const s = available();
  if (!s) return false;
  try {
    s.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------- endpoints -- */

export function loadEndpoints(): EndpointBook {
  const book = read<EndpointBook>(ENDPOINTS_KEY, EMPTY_BOOK);
  if (!book || !Array.isArray(book.items)) return { ...EMPTY_BOOK };
  return { version: 1, active: book.active ?? null, items: book.items.filter((e) => e?.token) };
}

export function saveEndpoints(book: EndpointBook): void {
  write(ENDPOINTS_KEY, book);
}

export function rememberEndpoint(endpoint: LocalEndpoint): EndpointBook {
  const book = loadEndpoints();
  const idx = book.items.findIndex((e) => e.token === endpoint.token);
  if (idx === -1) book.items.unshift(endpoint);
  else book.items[idx] = { ...book.items[idx], ...endpoint };
  book.active = endpoint.token;
  saveEndpoints(book);
  return book;
}

export function renameEndpoint(token: string, name: string): EndpointBook {
  const book = loadEndpoints();
  const item = book.items.find((e) => e.token === token);
  if (item) item.name = name;
  saveEndpoints(book);
  return book;
}

export function forgetEndpoint(token: string): EndpointBook {
  const book = loadEndpoints();
  book.items = book.items.filter((e) => e.token !== token);
  if (book.active === token) book.active = book.items[0]?.token ?? null;
  saveEndpoints(book);
  const s = available();
  try {
    s?.removeItem(REQUESTS_PREFIX + token);
  } catch {
    /* ignore */
  }
  return book;
}

export function setActiveEndpoint(token: string): void {
  const book = loadEndpoints();
  book.active = token;
  saveEndpoints(book);
}

/* -------------------------------------------------------------- requests -- */

export function loadRequests(token: string): CapturedRequest[] {
  const list = read<CapturedRequest[]>(REQUESTS_PREFIX + token, []);
  return Array.isArray(list) ? list : [];
}

function persistRequests(token: string, list: CapturedRequest[]): CapturedRequest[] {
  let candidate = list.slice(0, LOCAL_REQUEST_CAP);
  // Under quota pressure, shed the oldest quarter and try again rather than
  // silently losing the newest capture.
  for (let attempt = 0; attempt < 4; attempt += 1) {
    if (write(REQUESTS_PREFIX + token, candidate)) return candidate;
    const keep = Math.floor(candidate.length * 0.75);
    if (keep < 1) break;
    candidate = candidate.slice(0, keep);
  }
  return candidate;
}

/** Union of what we had and what arrived, newest first, de-duplicated by id. */
export function mergeRequests(token: string, incoming: CapturedRequest[]): CapturedRequest[] {
  if (!incoming.length) return loadRequests(token);
  const existing = loadRequests(token);
  const seen = new Set(existing.map((r) => r.id));
  const fresh = incoming.filter((r) => r?.id && !seen.has(r.id));
  if (!fresh.length) return existing;
  const merged = [...fresh, ...existing].sort((a, b) => (a.id < b.id ? 1 : a.id > b.id ? -1 : 0));
  return persistRequests(token, merged);
}

export function removeRequest(token: string, id: string): CapturedRequest[] {
  return persistRequests(
    token,
    loadRequests(token).filter((r) => r.id !== id),
  );
}

export function clearRequests(token: string): CapturedRequest[] {
  return persistRequests(token, []);
}

/* ----------------------------------------------------------------- theme -- */

export type Theme = 'light' | 'dark' | 'system';

export function loadTheme(): Theme {
  const s = available();
  const raw = s?.getItem(THEME_KEY);
  return raw === 'light' || raw === 'dark' ? raw : 'system';
}

export function saveTheme(theme: Theme): void {
  const s = available();
  try {
    if (theme === 'system') s?.removeItem(THEME_KEY);
    else s?.setItem(THEME_KEY, theme);
  } catch {
    /* ignore */
  }
}

export function applyTheme(theme: Theme): void {
  if (typeof document === 'undefined') return;
  const dark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
}
