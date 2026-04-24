import type { Metadata } from 'next';
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
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
