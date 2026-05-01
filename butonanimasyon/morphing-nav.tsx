'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion, useReducedMotion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─────────────────────────────────────────────────────────────
// Animasyon konfigürasyonu — playground'daki parametrelerle birebir
// Beğendiğin değerleri burada değiştirirsin, başka bir yere dokunma
// ─────────────────────────────────────────────────────────────
const PILL_CONFIG = {
  // Şekil parametreleri
  squashY: 0.85, // Faz 1: dikey sıkışma (0.5 = yassı, 1 = sıkışma yok)
  squashX: 0.88, // Faz 1: yatay sıkışma
  bridge: 0.82, // Faz 2: köprü inceliği (0.4 = ip, 1 = kalın)
  overshoot: 1.06, // Faz 3: hedefte hafif büyüme (1 = düz, 1.2 = pop)

  // Faz süreleri (saniye cinsinden — Framer Motion saniye kullanır)
  d1: 0.14, // sıkıştır
  d2: 0.28, // köprü uzar
  d3: 0.36, // hedefte topla + overshoot
  d4: 0.22, // yerleş
} as const;

const ITEM_HEIGHT = 44; // px — her nav item'ın yüksekliği
const ITEM_GAP = 8; // px — itemlar arası boşluk
const STEP = ITEM_HEIGHT + ITEM_GAP; // 52px

// ─────────────────────────────────────────────────────────────
// Nav item tipi — projendeki menüye göre genişlet
// ─────────────────────────────────────────────────────────────
export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

type MorphingNavProps = {
  items: NavItem[];
  className?: string;
};

export function MorphingNav({ items, className }: MorphingNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion();

  // Aktif index'i pathname'den türet
  const activeIndex = Math.max(
    0,
    items.findIndex((item) => item.href === pathname),
  );

  // Animasyon sırasında geçiş yönünü bilmek için önceki index'i takip et
  const prevIndexRef = useRef(activeIndex);
  const [, forceUpdate] = useState(0);

  const fromIdx = prevIndexRef.current;
  const toIdx = activeIndex;
  const direction = toIdx > fromIdx ? 1 : -1;
  const distance = Math.abs(toIdx - fromIdx);
  const stretchScaleY = (distance * STEP + ITEM_HEIGHT) / ITEM_HEIGHT;

  // Köprü uzarken pill'in sabit kalan ucu — yönden bağımsız üst kenar
  const bridgeY = direction > 0 ? fromIdx * STEP : toIdx * STEP;

  const totalDuration = PILL_CONFIG.d1 + PILL_CONFIG.d2 + PILL_CONFIG.d3 + PILL_CONFIG.d4;

  // Reduced motion: sade slide
  const reducedAnimation = {
    y: toIdx * STEP,
    scaleX: 1,
    scaleY: 1,
    transition: { duration: 0.2, ease: 'easeOut' as const },
  };

  // 4 fazlı squash-and-stretch keyframe'i
  const fullAnimation = {
    y: [
      fromIdx * STEP, // başlangıç
      fromIdx * STEP, // faz 1: yerinde sıkış
      bridgeY, // faz 2: köprü pozisyonu
      toIdx * STEP, // faz 3: hedef + overshoot
      toIdx * STEP, // faz 4: yerleş
    ],
    scaleX: [
      1,
      PILL_CONFIG.squashX, // sıkış
      PILL_CONFIG.bridge, // köprü inceliği
      PILL_CONFIG.overshoot, // overshoot
      1, // normal
    ],
    scaleY: [
      1,
      PILL_CONFIG.squashY,
      stretchScaleY, // dikey uzama
      PILL_CONFIG.overshoot,
      1,
    ],
    transformOrigin: direction > 0 ? 'top center' : 'bottom center',
    transition: {
      duration: totalDuration,
      times: [
        0,
        PILL_CONFIG.d1 / totalDuration,
        (PILL_CONFIG.d1 + PILL_CONFIG.d2) / totalDuration,
        (PILL_CONFIG.d1 + PILL_CONFIG.d2 + PILL_CONFIG.d3) / totalDuration,
        1,
      ],
      ease: [
        [0.4, 0, 0.6, 1], // faz 1: ease-in-out
        [0.55, 0, 0.1, 1], // faz 2: hızlı uzama
        [0.34, 1.56, 0.64, 1], // faz 3: spring overshoot
        [0.4, 0, 0.2, 1], // faz 4: yumuşak iniş
      ] as const,
    },
  };

  function handleNavigate(item: NavItem, idx: number) {
    if (idx === activeIndex) return;
    prevIndexRef.current = activeIndex;
    router.push(item.href);
    // Pathname güncellenince component re-render olur; prev ref korunur
    forceUpdate((n) => n + 1);
  }

  return (
    <nav
      className={cn(
        'relative w-full max-w-xs rounded-2xl border border-border bg-secondary p-4',
        className,
      )}
      aria-label="Ana navigasyon"
    >
      {/* Pill — aktif item göstergesi */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute left-4 right-4 top-4 rounded-[10px] bg-gradient-to-br from-blue-500 to-blue-400 shadow-lg shadow-blue-500/30"
        style={{ height: ITEM_HEIGHT }}
        initial={false}
        animate={prefersReducedMotion ? reducedAnimation : fullAnimation}
      />

      {/* Nav itemları */}
      <ul className="relative z-10 space-y-2">
        {items.map((item, idx) => {
          const isActive = idx === activeIndex;
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={(e) => {
                  e.preventDefault();
                  handleNavigate(item, idx);
                }}
                className={cn(
                  'flex h-11 items-center gap-3 rounded-[10px] px-4 text-sm font-medium transition-colors duration-300',
                  isActive ? 'text-white' : 'text-foreground hover:text-foreground/80',
                )}
              >
                <Icon
                  className="h-[18px] w-[18px] shrink-0"
                  aria-hidden
                  strokeWidth={isActive ? 2.25 : 2}
                />
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
