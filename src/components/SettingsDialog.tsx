'use client';

import { useEffect, useState } from 'react';
import { DEFAULT_RESPONSE, type EndpointMeta, type HeaderPair } from '@/lib/types';
import { IconPlus, IconTrash, IconX } from './Icons';

interface Props {
  meta: EndpointMeta;
  open: boolean;
  onClose: () => void;
  onSave: (patch: { name: string; response: EndpointMeta['response'] }) => Promise<void>;
  onDeleteEndpoint: () => void;
}

const CONTENT_TYPES = [
  'application/json',
  'text/plain',
  'text/html',
  'application/xml',
  'text/xml',
];

/**
 * Endpoint settings: label, and the canned response the endpoint replies with.
 * Being able to shape the reply is what lets you satisfy senders that expect a
 * specific status, header, or payload before they consider the call delivered.
 */
export default function SettingsDialog({ meta, open, onClose, onSave, onDeleteEndpoint }: Props) {
  const [name, setName] = useState(meta.name);
  const [status, setStatus] = useState(String(meta.response.status));
  const [contentType, setContentType] = useState(meta.response.contentType);
  const [body, setBody] = useState(meta.response.body);
  const [headers, setHeaders] = useState<HeaderPair[]>(meta.response.headers ?? []);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(meta.name);
    setStatus(String(meta.response.status));
    setContentType(meta.response.contentType);
    setBody(meta.response.body);
    setHeaders(meta.response.headers ?? []);
    setConfirmDelete(false);
  }, [open, meta]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  const parsedStatus = Number(status);
  const statusValid = Number.isFinite(parsedStatus) && parsedStatus >= 100 && parsedStatus <= 599;

  const save = async () => {
    if (!statusValid || saving) return;
    setSaving(true);
    try {
      await onSave({
        name: name.trim() || meta.name,
        response: {
          status: Math.trunc(parsedStatus),
          contentType: contentType.trim() || 'application/json',
          body,
          headers: headers.filter(([n]) => n.trim()),
        },
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-6"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Endpoint settings"
        className="animate-in flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border border-line bg-surface shadow-[var(--shadow)] sm:rounded-2xl"
      >
        <header className="flex shrink-0 items-center justify-between border-b border-line px-5 py-4">
          <h2 className="text-base font-semibold text-ink">Endpoint settings</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-ink"
          >
            <IconX />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-7 overflow-y-auto px-5 py-6 scroll-thin">
          <Field label="Label" hint="Only you see this. Stored in your browser and on the endpoint.">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              placeholder="Stripe test hooks"
              className="w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
            />
          </Field>

          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-ink">Response</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                What your endpoint sends back to the caller. Change it when a provider needs a
                specific status code or payload before it marks a webhook as delivered.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Status code">
                <input
                  value={status}
                  onChange={(e) => setStatus(e.target.value.replace(/[^\d]/g, '').slice(0, 3))}
                  inputMode="numeric"
                  className={`w-full rounded-lg border bg-surface-2 px-3 py-2 font-mono text-sm text-ink focus:outline-none ${
                    statusValid ? 'border-line focus:border-accent' : 'border-danger'
                  }`}
                />
                {!statusValid && <p className="mt-1 text-xs text-danger">Must be 100–599.</p>}
              </Field>

              <Field label="Content type">
                <input
                  value={contentType}
                  onChange={(e) => setContentType(e.target.value)}
                  list="wi-content-types"
                  className="w-full rounded-lg border border-line bg-surface-2 px-3 py-2 font-mono text-sm text-ink focus:border-accent focus:outline-none"
                />
                <datalist id="wi-content-types">
                  {CONTENT_TYPES.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </Field>
            </div>

            <Field label="Body">
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={6}
                spellCheck={false}
                className="w-full resize-y rounded-lg border border-line bg-surface-2 px-3 py-2 font-mono text-[12.5px] leading-relaxed text-ink focus:border-accent focus:outline-none"
              />
            </Field>

            <Field label="Extra headers — optional, up to 20 pairs">
              <div className="space-y-2">
                {headers.map(([n, v], i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      value={n}
                      onChange={(e) =>
                        setHeaders((h) => h.map((p, j) => (j === i ? [e.target.value, p[1]] : p)))
                      }
                      placeholder="X-Custom"
                      className="w-2/5 rounded-lg border border-line bg-surface-2 px-3 py-2 font-mono text-xs text-ink focus:border-accent focus:outline-none"
                    />
                    <input
                      value={v}
                      onChange={(e) =>
                        setHeaders((h) => h.map((p, j) => (j === i ? [p[0], e.target.value] : p)))
                      }
                      placeholder="value"
                      className="flex-1 rounded-lg border border-line bg-surface-2 px-3 py-2 font-mono text-xs text-ink focus:border-accent focus:outline-none"
                    />
                    <button
                      onClick={() => setHeaders((h) => h.filter((_, j) => j !== i))}
                      aria-label={`Remove header ${n || i + 1}`}
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line text-muted transition hover:border-danger hover:text-danger"
                    >
                      <IconTrash width={15} height={15} />
                    </button>
                  </div>
                ))}
                {headers.length < 20 && (
                  <button
                    onClick={() => setHeaders((h) => [...h, ['', '']])}
                    className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-accent transition hover:bg-accent-soft"
                  >
                    <IconPlus width={14} height={14} /> Add header
                  </button>
                )}
              </div>
            </Field>

            <button
              onClick={() => {
                setStatus(String(DEFAULT_RESPONSE.status));
                setContentType(DEFAULT_RESPONSE.contentType);
                setBody(DEFAULT_RESPONSE.body);
                setHeaders([]);
              }}
              className="text-xs font-medium text-muted underline underline-offset-4 transition hover:text-ink"
            >
              Reset response to default
            </button>
          </div>

          <div className="rounded-xl border border-line p-4">
            <h3 className="text-sm font-semibold text-ink">Delete this endpoint</h3>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              Removes it from this browser and wipes its server buffer. The URL stops being
              associated with your history and cannot be recovered.
            </p>
            {confirmDelete ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  onClick={onDeleteEndpoint}
                  className="rounded-lg bg-danger px-3 py-2 text-xs font-semibold text-white transition hover:opacity-90"
                >
                  Yes, delete permanently
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="rounded-lg border border-line px-3 py-2 text-xs font-medium text-muted transition hover:text-ink"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="mt-3 rounded-lg border border-line px-3 py-2 text-xs font-medium text-danger transition hover:border-danger"
              >
                Delete endpoint
              </button>
            )}
          </div>
        </div>

        <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-line px-5 py-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-muted transition hover:text-ink"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={!statusValid || saving}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-contrast transition hover:opacity-90 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </footer>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-muted">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-xs text-faint">{hint}</span>}
    </label>
  );
}
