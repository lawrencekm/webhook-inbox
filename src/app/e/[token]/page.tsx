import { notFound } from 'next/navigation';
import Inspector from '@/components/Inspector';
import { isValidToken } from '@/lib/ids';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return { title: `Endpoint ${token.slice(0, 6)}…`, robots: { index: false, follow: false } };
}

export default async function EndpointPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!isValidToken(token)) notFound();
  return <Inspector token={token} />;
}
