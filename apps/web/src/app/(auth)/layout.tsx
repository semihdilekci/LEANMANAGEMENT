import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Oturum',
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--color-neutral-50)] p-[var(--space-4)]">
      <header className="mb-[var(--space-8)] text-center">
        <p className="font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--color-primary-700)]">
          Lean Management
        </p>
        <p className="text-sm text-[var(--color-neutral-600)]">Kurumsal lean yönetim platformu</p>
      </header>
      <main className="w-full max-w-md" id="main-content">
        {children}
      </main>
    </div>
  );
}
