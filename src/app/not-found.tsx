import Link from 'next/link';
import { IconHook } from '@/components/Icons';

export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-6">
      <div className="text-center">
        <span className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-accent-contrast">
          <IconHook width={22} height={22} />
        </span>
        <h1 className="text-lg font-semibold text-ink">That endpoint doesn’t exist</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted">
          The link may be mistyped, or the endpoint was deleted. You can spin up a new one in a
          second.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-contrast transition hover:opacity-90"
        >
          Create a new endpoint
        </Link>
      </div>
    </main>
  );
}
