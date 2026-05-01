'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { getAppBreadcrumbs } from '@/lib/app-breadcrumbs';

export function AppBreadcrumbs() {
  const pathname = usePathname();
  const items = getAppBreadcrumbs(pathname);

  return (
    <nav aria-label="Konum" className="min-w-0 text-sm text-[var(--color-neutral-600)]">
      <ol className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        {items.map((item, index) => (
          <li key={`${item.href}-${index}`} className="flex min-w-0 items-center gap-2">
            {index > 0 ? (
              <span className="shrink-0 text-[var(--color-neutral-400)]" aria-hidden>
                /
              </span>
            ) : null}
            {index === items.length - 1 ? (
              <span
                className="truncate font-medium text-[var(--color-neutral-900)]"
                aria-current="page"
              >
                {item.label}
              </span>
            ) : (
              <Link
                href={item.href}
                className="truncate hover:text-[var(--color-primary-700)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-500)] focus-visible:ring-offset-2"
              >
                {item.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
