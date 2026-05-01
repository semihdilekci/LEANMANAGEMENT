# Lean Management — Design System

Drop-in paket. Soğuk gri-mavi zemin, **canlı mavi** birincil renk, beyaz kartlar ve çok renkli istatistik rozetleri. Özet: repo kökündeki **`design-system.json`** (Cool Blue Dashboard); CSS:**`tokens.css`** + **`components.css`**.

## İçindekiler

```
lean-design-system/
├── tokens.css          # Renk, tipografi, spacing, radius, shadow, motion (CSS değişkenleri)
├── components.css      # Hazır bileşen sınıfları (ls-btn, ls-card, ls-stat-tile, ls-cta-card, …)
├── icons.jsx           # 24×24 stroke tabanlı ikonlar (window.I.* olarak expose)
├── index.css           # Tek noktadan import — fontlar + tokens + components
└── README.md
```

## Tasarım özeti (design-system.json ile uyumlu)

- Sayfa zemini: **soğuk gri-mavi** (~`#F4F7FA` ailesi), `--gradient-page-bg`.
- Birincil: **mavi** (`--gradient-primary`, `--color-primary-*`, linkler `#2563EB`).
- Kartlar: **beyaz**, **yumuşak gölge**, çerçeve yok.
- Vurgu: **fuşya/magenta** (`--gradient-accent`) — segment çubuğu ucu, versus rozeti.
- İstatistik rozetleri: gök mavisi, teal, lavanta, pembe, amber-peach (`--color-stat-*`).

## Kurulum

### 1) Klasörü projenize kopyalayın

`lean-design-system/` klasörünü projenizin istediğiniz yerine atın.

### 2) Import edin

**Vanilla HTML:**

```html
<link rel="stylesheet" href="src/assets/lean-design-system/index.css" />
```

**React / Next.js / Vite:**

```js
import './assets/lean-design-system/index.css';
```

**Tailwind ile birlikte:**

```css
@import './assets/lean-design-system/index.css';
@tailwind base;
@tailwind components;
@tailwind utilities;
```

### 3) Kullanın

```html
<button class="ls-btn ls-btn--primary">KTİ Oluştur</button>

<div class="ls-card">
  <div class="ls-card__header">
    <h3 class="ls-card__title">Başlık</h3>
    <a class="ls-link" href="#">Tümünü gör</a>
  </div>
  <p class="text-body">İçerik…</p>
</div>

<!-- CTA bloğu (tek gradient vurgu) -->
<section class="ls-cta-card">
  <p class="ls-cta-card__pretitle">Öne çıkan</p>
  <h2 class="ls-cta-card__title">Başlık</h2>
  <button type="button" class="ls-btn--ghost-on-gradient">İlerle</button>
</section>
```

### 4) İkonları kullanın (opsiyonel, React)

Vanilla HTML + Babel için `icons.jsx` README akışını kullanın. Modern React’te dosya sonundaki `window.I = I` satırını `export default I` ile değiştirin.

## Token kullanımı (cheat-sheet)

| Amaç                  | Değişken                                                                                                                             |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Sayfa arka planı      | `var(--gradient-page-bg)`                                                                                                            |
| Birincil gradient     | `var(--gradient-primary)`                                                                                                            |
| Accent gradient       | `var(--gradient-accent)`                                                                                                             |
| Metin                 | `var(--color-fg)` / `--color-fg-soft` / `--color-fg-subtle`                                                                          |
| Kart yüzeyi           | `var(--color-surface-card)`                                                                                                          |
| Gölge (kart)          | `var(--shadow-card)` / `--shadow-card-hover`                                                                                         |
| Link rengi            | `var(--color-link)`                                                                                                                  |
| Sol menü pasif metin  | `var(--color-sidebar-nav-idle)`                                                                                                      |
| Sol menü seçili satır | Sınıf `ls-sidebar-nav-link--active` + `color: var(--color-fg-inverse)` (Tailwind Preflight `a{color:inherit}` için `components.css`) |
| İstatistik rozeti     | `var(--color-stat-lavender)` … `--color-stat-sky`                                                                                    |
| Progress segmentleri  | `var(--color-progress-positive)` vb.                                                                                                 |
| Font                  | `var(--font-display)` / `--font-body`                                                                                                |
| Spacing               | `var(--space-1)` … `--space-12`                                                                                                      |
| Radius                | `var(--radius-md)` … `--radius-card`                                                                                                 |
| Hareket               | `var(--dur-base)` + `var(--ease-standard)`                                                                                           |

Tam liste: `tokens.css`.

## Kural: Token dışına çıkma

- Yeni renk/spacing için önce `tokens.css`’e ekleyin; **design-system.json** ile çelişmeyin.
- Mümkünse `ls-*` bileşenlerini kullanın.
- Kanonik ürün spesifikasyonu: kök `design-system.json`. Bu klasör onun **CSS implementasyonu**dur.

## Cursor / agent (LeanManagement repo)

`.cursor/rules/26-lean-design-system.mdc` — UI çalışmasında bu README + `tokens.css` + `components.css` birlikte referans alınır.
