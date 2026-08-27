'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { IconCheck, IconCopy } from './Icons';

interface Props {
  value: string;
  label?: string;
  /** Compact icon-only rendering for dense toolbars. */
  compact?: boolean;
  className?: string;
}

/** Copies `value` to the clipboard with an inline confirmation. */
export default function CopyButton({ value, label = 'Copy', compact = false, className = '' }: Props) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const copy = useCallback(async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        // Fallback for non-secure contexts (e.g. plain-http LAN testing).
        const ta = document.createElement('textarea');
        ta.value = value;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }, [value]);

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? 'Copied' : label}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium text-muted transition hover:border-line-strong hover:text-ink ${className}`}
    >
      {copied ? <IconCheck className="text-ok" /> : <IconCopy />}
      {!compact && <span>{copied ? 'Copied' : label}</span>}
    </button>
  );
}
