# Lean Management — Design System

Drop-in paket. Herhangi bir Cursor / web projesine bu klasörü kopyala, bir satırla import et.

## İçindekiler

```
lean-design-system/
├── tokens.css          # Renk, tipografi, spacing, shadow, radius tokenları (CSS değişkenleri)
├── components.css      # Hazır component sınıfları (ls-btn, ls-card, ls-chip, ls-alert, ls-toast, ls-input, ...)
├── icons.jsx           # 24×24 stroke-based ikon kütüphanesi (window.I.* olarak expose)
├── index.css           # Tek noktadan import — fontlar + tokens + components
└── README.md
```

## Kurulum

### 1) Klasörü projenize kopyalayın
`lean-design-system/` klasörünü projenizin istediğiniz yerine atın. Örn:
```
your-project/
└── src/
    └── assets/
        └── lean-design-system/
```

### 2) Import edin

**Vanilla HTML:**
```html
<link rel="stylesheet" href="src/assets/lean-design-system/index.css" />
```

**React / Next.js / Vite:**
```js
// _app.js, main.jsx veya root layout
import './assets/lean-design-system/index.css';
```

**Tailwind projesine ek olarak:**
`index.css` Tailwind ile çakışmaz. `@layer base` altında import edebilirsiniz:
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
  <h3>Kart başlığı</h3>
  <p>İçerik…</p>
</div>

<!-- Token'lar her yerde CSS değişkeni olarak var: -->
<div style="color: var(--color-primary-600); font-family: var(--font-display);">
  Marka metni
</div>
```

### 4) İkonları kullanın (opsiyonel, React)

Vanilla HTML + Babel kullanıyorsanız:
```html
<script type="text/babel" src="lean-design-system/icons.jsx"></script>
<script type="text/babel">
  // artık window.I.check(), I.flow(), I.users() vs. kullanılabilir
  const App = () => <div className="ls-chip-icon">{I.check()}</div>;
</script>
```

Modern React projesinde `icons.jsx` dosyasını normal bir modül haline getirmek için son satırdaki `window.I = I` kısmını `export default I` ile değiştirin.

## Token Kullanımı (cheat-sheet)

| Amaç          | Değişken                                    |
|---------------|---------------------------------------------|
| Ana renk      | `var(--color-primary-500)` … `-900`         |
| Sage/yeşil    | `var(--color-secondary-500)` …              |
| Metin         | `var(--color-fg)` / `--fg-soft` / `--fg-muted` |
| Arkaplan      | `var(--color-bg)` / `--surface-0`           |
| Border        | `var(--color-border)` / `--border-strong`   |
| Başarı/hata   | `var(--color-success)` / `--color-danger`   |
| Font          | `var(--font-display)` / `--font-body)` / `--font-mono` |
| Spacing       | `var(--space-1)` … `--space-12`             |
| Radius        | `var(--radius-sm)` / `-md` / `-lg` / `-xl`  |
| Shadow        | `var(--shadow-1)` / `-2` / `-3`             |
| Duration      | `var(--dur-fast)` / `--dur-base)`           |

Tam liste için `tokens.css`'yi açın.

## Kural: Token dışına çıkma

- Yeni renk/spacing uydurmak yerine önce `tokens.css`'ye ekleyin.
- Inline style yerine mümkün olduğunca `ls-*` sınıflarını kullanın.
- Component örnekleri için orijinal projedeki `Design System.html` dosyası kanonik referanstır.

## Cursor / agent (LeanManagement repo)

`apps/web` veya bu klasördeki dosyalarla çalışırken `.cursor/rules/26-lean-design-system.mdc` otomatik eklenir; UI implementasyonunda bu README ile `tokens.css` / `components.css` zorunlu referanstır (`00-project-identity`, `20-frontend-architecture`, `24-frontend-components` ile uyumlu).
