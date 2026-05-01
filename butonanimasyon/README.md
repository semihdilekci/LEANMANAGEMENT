# MorphingNav — Squash & Stretch Navigation Component

Lean Management projesi için Next.js 15 + React 19 + TypeScript + Tailwind + shadcn/ui uyumlu, Framer Motion tabanlı animasyonlu navigasyon komponenti. lucide-react ikon desteğiyle birlikte gelir.

## Kurulum

```bash
pnpm add framer-motion lucide-react
# zaten kuruluysa atla — shadcn/ui projelerinde lucide-react genelde hazır gelir
```

`cn` utility'si shadcn/ui kurulumunda `@/lib/utils` altında zaten var olmalı. Yoksa:

```ts
// src/lib/utils.ts
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

## Dosya yerleşimi

`morphing-nav.tsx` dosyasını `src/components/morphing-nav.tsx` (veya `components/morphing-nav.tsx`) altına koy.

## Kullanım

```tsx
import { Home, Workflow, ListTodo, Bell } from 'lucide-react';
import { MorphingNav, type NavItem } from '@/components/morphing-nav';

const navItems: NavItem[] = [
  { label: 'Ana Sayfa', href: '/', icon: Home },
  { label: 'Süreçler', href: '/surecler', icon: Workflow },
  { label: 'Görevlerim', href: '/gorevlerim', icon: ListTodo },
  { label: 'Bildirim ayarları', href: '/bildirimler', icon: Bell },
];

<MorphingNav items={navItems} />;
```

`NavItem.icon` property'si zorunlu ve `LucideIcon` tipinde. İkonları https://lucide.dev/icons üzerinden seç.

## Lean Management için ikon önerileri

Tüm ikonlar `lucide-react`'tan import edilir:

| Sayfa türü            | Önerilen ikon                         |
| --------------------- | ------------------------------------- |
| Ana Sayfa / Dashboard | `Home`, `LayoutDashboard`             |
| Süreçler / Process    | `Workflow`, `GitBranch`, `Network`    |
| Kaizen / İyileştirme  | `Sparkles`, `TrendingUp`, `Lightbulb` |
| A3 Raporları          | `FileText`, `ClipboardList`           |
| Değer Akışı (VSM)     | `Activity`, `Waypoints`               |
| Görevler              | `ListTodo`, `CheckSquare`             |
| KPI / Raporlar        | `BarChart3`, `LineChart`              |
| Takım / Kullanıcılar  | `Users`, `UserCircle`                 |
| Ayarlar               | `Settings`, `Cog`                     |
| Bildirimler           | `Bell`                                |

## Mimari kararlar

- **Aktif state pathname'den türetilir.** `usePathname()` hook'u Next.js App Router ile uyumlu, ekstra state yönetimi gerekmez. Sayfa yenilemeden bağımsız doğru item highlight olur.
- **Yön takibi `useRef` ile.** Animasyonun yönü (yukarı/aşağı) `transformOrigin`'i etkilediği için bir önceki index ref'te tutuluyor. State yerine ref tercih edildi — ekstra render tetiklemez.
- **Pill ayrı bir motion.div.** Her item kendi animasyonunu yapsa "shared element" hissi kaybolur. Tek pill, item array dışında, absolute positioned. İkonlar ve label'lar pill'in üstünde z-index ile durur.
- **İkon stroke'u aktif item'da kalınlaşıyor.** `strokeWidth={isActive ? 2.25 : 2}` — aktif durumun görsel hiyerarşisini güçlendirir.
- **Reduced motion desteği.** `useReducedMotion()` hook'u ile motion-sensitive kullanıcılar için animasyon sadeleşir (200ms ease-out slide). WCAG 2.3.3 uyumu için kritik.
- **Keyframe + `times` array kullanımı.** 4 fazlı animasyonu tek bir Framer Motion `animate` propu içinde tanımlamak için keyframe array'leri ve `times` array'i kullanıldı. Her faz kendi cubic-bezier easing'ine sahip — bu da `ease` array'i ile sağlanıyor.

## Parametre ayarı

`morphing-nav.tsx`'in en üstündeki `PILL_CONFIG` objesini değiştir:

```ts
const PILL_CONFIG = {
  squashY: 0.85, // 0.5 (yassı) - 1 (yok)
  squashX: 0.88,
  bridge: 0.82, // 0.4 (ip gibi) - 1 (kalın)
  overshoot: 1.06, // 1 (yok) - 1.2 (dramatik pop)
  d1: 0.14, // saniye — sıkıştır
  d2: 0.28, // köprü uzar
  d3: 0.36, // hedefte topla
  d4: 0.22, // yerleş
};
```

Toplam süre 1 saniyenin altında kalsın — enterprise UI'da 700-1000ms tatlı nokta.

## Layout sabitleri

`ITEM_HEIGHT` (44px) ve `ITEM_GAP` (8px) sabitlerini değiştirdiysen, JSX tarafında `h-11` (44px) ve `space-y-2` (8px) Tailwind sınıflarını da güncelle. Bu üç sayı senkron olmalı.

## Tasarım sistemi entegrasyonu

Pill rengi şu an Tailwind'in `from-blue-500 to-blue-400` gradient'ini kullanıyor. Lean Management projesinin design tokens'ı varsa (örn. `bg-primary`), o sınıfla değiştir:

```tsx
className = '... bg-primary shadow-lg shadow-primary/30';
```

shadcn/ui'ın CSS variables'ı zaten `--primary` tanımlı, bu otomatik dark mode uyumlu olur.

## Test edilen edge case'ler

- Tek item üzerine tekrar tıklama: animasyon tetiklenmez (`if (idx === activeIndex) return`)
- Animasyon sırasında başka item'a tıklama: Framer Motion mevcut animasyonu interrupt eder, yeni hedefe smooth geçer (otomatik davranış)
- İlk render: `initial={false}` ile pill başlangıç pozisyonunda statik kalır, mount animasyonu olmaz

## Sınırlar / bilinmesi gerekenler

- Bu komponent yalnızca **dikey listede** çalışır. Yatay tab bar için STEP hesabı X eksenine taşınmalı, transformOrigin "left/right" olmalı.
- Çok uzun listelerde (10+ item) overshoot dramatik gözükebilir — uzun mesafelerde `overshoot`'u koşullu olarak küçültmek isteyebilirsin.
- Server component içinden çağırma: bu komponent `"use client"` direktifi taşır, layout dosyasında client wrapper olarak kullanılmalı.
- İkon boyutu sabit 18px — daha büyük/küçük istersen `h-[18px] w-[18px]` kısmını değiştir, item yüksekliğini de gerekirse ayarla.
