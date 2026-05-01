// Generic örnek — kendi menünü buradaki yapıyı takip ederek yaz
'use client';

import { Home, Workflow, ListTodo, Bell } from 'lucide-react';
import { MorphingNav, type NavItem } from '@/components/morphing-nav';

// İkonları lucide-react'tan seç: https://lucide.dev/icons
// Lean Management projende kullanabileceğin örnekler:
//   Home, LayoutDashboard, Workflow, GitBranch, ListTodo, ClipboardList,
//   Target, TrendingUp, FileText, Users, Settings, Bell, BarChart3, Activity
const navItems: NavItem[] = [
  { label: 'Ana Sayfa', href: '/', icon: Home },
  { label: 'Süreçler', href: '/surecler', icon: Workflow },
  { label: 'Görevlerim', href: '/gorevlerim', icon: ListTodo },
  { label: 'Bildirim ayarları', href: '/bildirimler', icon: Bell },
];

export default function SidebarLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <aside className="w-72 p-6">
        <MorphingNav items={navItems} />
      </aside>
      <main className="flex-1">{children}</main>
    </div>
  );
}
