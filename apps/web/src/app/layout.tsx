import type { Metadata } from 'next';
import Link from 'next/link';

import { Providers } from '@/app/providers';

import './globals.css';

export const metadata: Metadata = {
  title: 'Lean Management',
  description: 'Kurumsal lean yönetim platformu',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr">
      <body className="min-h-screen antialiased">
        <Link
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-[var(--color-primary-600)] focus:px-4 focus:py-2 focus:text-[var(--color-neutral-0)]"
        >
          Ana içeriğe atla
        </Link>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
