import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Webhook Inbox — instant endpoints for testing webhooks',
    template: '%s · Webhook Inbox',
  },
  description:
    'Create a live HTTPS endpoint in one click, inspect every request that hits it, and keep the history in your own browser until you delete it.',
  applicationName: 'Webhook Inbox',
  openGraph: {
    title: 'Webhook Inbox',
    description: 'Instant HTTPS endpoints for testing webhooks. Live, private, and yours.',
    type: 'website',
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0d' },
  ],
  width: 'device-width',
  initialScale: 1,
};

/** Applies the stored theme before first paint so there is no flash. */
const THEME_BOOTSTRAP = `
try {
  var t = localStorage.getItem('wi.theme.v1');
  var dark = t === 'dark' || (t !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
  if (dark) document.documentElement.classList.add('dark');
} catch (e) {}
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
        <link
          rel="icon"
          href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%234f46e5'/%3E%3Cpath d='M10 20.5a6 6 0 1 1 8.7-5.4V22' fill='none' stroke='white' stroke-width='2.6' stroke-linecap='round'/%3E%3Ccircle cx='18.7' cy='23.5' r='2.4' fill='white'/%3E%3C/svg%3E"
        />
      </head>
      <body className="min-h-dvh bg-bg text-ink antialiased">{children}</body>
    </html>
  );
}
