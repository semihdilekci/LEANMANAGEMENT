'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { readCookie } from '@/lib/auth-session-hint';
import { refreshAccessToken } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';

const PROTECTED_PREFIXES = ['/dashboard', '/profile'];

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function AuthHydrator({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.accessToken);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function run(): Promise<void> {
      if (!isProtectedPath(pathname)) {
        if (!cancelled) setHydrated(true);
        return;
      }
      if (accessToken) {
        if (!cancelled) setHydrated(true);
        return;
      }
      const csrf = readCookie('csrf_token');
      if (!csrf) {
        if (!cancelled) {
          setHydrated(true);
          router.replace('/login');
        }
        return;
      }
      try {
        await refreshAccessToken();
      } catch {
        if (!cancelled) router.replace('/login');
      } finally {
        if (!cancelled) setHydrated(true);
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [pathname, accessToken, router]);

  if (isProtectedPath(pathname) && !hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center" role="status">
        <span className="sr-only">Oturum yükleniyor</span>
        <p className="text-[var(--color-neutral-600)]">Yükleniyor…</p>
      </div>
    );
  }

  return <>{children}</>;
}
