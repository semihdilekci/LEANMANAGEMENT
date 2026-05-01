'use client';

import Link from 'next/link';

import { UserAvatar } from '@/components/profile/UserAvatar';
import { useAuthStore } from '@/stores/auth-store';

/** Sidebar ve mobil menü — `/profile` bağlantısı (Weather avatar + ad soyad) */
export function SidebarProfileNavLink({
  onNavigate,
  compact,
}: {
  onNavigate?: () => void;
  /** Mobil çekmecede biraz daha geniş dokunma alanı */
  compact?: boolean;
}) {
  const user = useAuthStore((s) => s.currentUser);
  if (!user) return null;

  return (
    <Link
      href="/profile"
      onClick={onNavigate}
      className={
        compact
          ? 'flex min-h-[44px] items-center gap-3 rounded-md px-2 py-2 text-sm text-[var(--color-sidebar-nav-idle)] transition-colors hover:bg-[var(--color-primary-a06)]'
          : 'flex items-center gap-3 rounded-md px-2 py-2 text-sm text-[var(--color-sidebar-nav-idle)] transition-colors hover:bg-[var(--color-primary-a06)]'
      }
    >
      <UserAvatar avatarKey={user.avatarKey} size={compact ? 40 : 36} />
      <span className="min-w-0 flex-1 truncate font-medium">
        {user.firstName} {user.lastName}
      </span>
    </Link>
  );
}
