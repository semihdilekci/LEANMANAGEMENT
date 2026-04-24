'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Toaster } from 'sonner';

import { AuthHydrator } from '@/components/auth/auth-hydrator';

function SentryClientInit() {
  useEffect(() => {
    const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
    if (!dsn) return;
    void import('@sentry/react').then((Sentry) => {
      Sentry.init({ dsn, environment: process.env.NODE_ENV, tracesSampleRate: 0.1 });
    });
  }, []);
  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1 },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <SentryClientInit />
      <AuthHydrator>{children}</AuthHydrator>
      <Toaster position="top-right" richColors />
    </QueryClientProvider>
  );
}
