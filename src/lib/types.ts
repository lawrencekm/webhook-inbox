/** A single header pair. Kept as tuples so duplicate header names survive. */
export type HeaderPair = [name: string, value: string];

/** One captured inbound HTTP request. */
export interface CapturedRequest {
  /** Sortable, collision-resistant id: `<epochMillis>-<random>`. */
  id: string;
  /** ISO-8601 timestamp of capture. */
  at: string;
  method: string;
  /** Extra path segments appended after the token, e.g. "/orders/created". */
  path: string;
  /** Raw query string without the leading "?" (empty when none). */
  query: string;
  headers: HeaderPair[];
  contentType: string;
  /** Body as text. May be truncated — see `truncated`. */
  body: string;
  /** Byte length of the original body, before truncation. */
  size: number;
  truncated: boolean;
  /** Best-effort client IP from proxy headers. */
  ip: string;
  userAgent: string;
}

/** The response the endpoint sends back to whoever called it. */
export interface ResponseConfig {
  status: number;
  contentType: string;
  body: string;
  /** Extra response headers, as name/value pairs. */
  headers: HeaderPair[];
}

/** Server-side record for one endpoint. */
export interface EndpointMeta {
  token: string;
  /** Human label shown in the switcher. */
  name: string;
  createdAt: string;
  response: ResponseConfig;
}

export const DEFAULT_RESPONSE: ResponseConfig = {
  status: 200,
  contentType: 'application/json',
  body: '{\n  "success": true\n}',
  headers: [],
};

/** Shape returned by GET /api/endpoints/[token]/requests */
export interface RequestsPayload {
  token: string;
  /** Monotonic capture counter — used by the live stream as a cheap change flag. */
  seq: number;
  requests: CapturedRequest[];
}
