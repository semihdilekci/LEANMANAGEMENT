'use client';

import { usePathname } from 'next/navigation';
import { useLayoutEffect, useRef } from 'react';

/** DOM sırasındaki üst sınır; çok uzun listelerde gecikme birikimini sınırlar */
const MAX_STAGGER_INDEX = 14;
const STAGGER_MS = 42;

/**
 * Rota değişince `main` içindeki `.ls-card` öğelerine giriş animasyonu uygular.
 * Gecikmeler `querySelectorAll` sırasına göre — sayfa ağacındaki kart sırası.
 */
export function PageRouteCardMotion({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const containerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    const cards = root.querySelectorAll<HTMLElement>('.ls-card');
    cards.forEach((el, i) => {
      const delay = Math.min(i, MAX_STAGGER_INDEX) * STAGGER_MS;
      el.style.setProperty('--card-enter-delay', `${delay}ms`);
    });
  }, [pathname]);

  return (
    <div ref={containerRef} key={pathname} className="page-route-card-motion w-full min-w-0">
      {children}
    </div>
  );
}
