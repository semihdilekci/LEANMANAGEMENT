import { MASTER_DATA_TYPES } from '@leanmgmt/shared-schemas';
import type { MasterDataType } from '@leanmgmt/shared-schemas';

import { MASTER_DATA_TYPE_LABELS } from '@/lib/queries/master-data';

export interface AppBreadcrumbItem {
  href: string;
  label: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const DISPLAY_ID_RE = /^KTI-\d+$/i;

const TOP_SEGMENT_LABEL: Record<string, string> = {
  dashboard: 'Ana Sayfa',
  processes: 'Süreçler',
  tasks: 'Görevlerim',
  'my-tasks': 'Görevlerim',
  users: 'Kullanıcılar',
  roles: 'Roller',
  'master-data': 'Master Data',
  notifications: 'Bildirimler',
  profile: 'Profilim',
  new: 'Yeni',
  edit: 'Düzenle',
  sessions: 'Oturumlar',
  kti: 'KTİ',
  start: 'Başlat',
};

const ROLE_SUB_LABEL: Record<string, string> = {
  permissions: 'Yetkiler',
  rules: 'Öznitelik kuralları',
  users: 'Kullanıcı atamaları',
};

function isUuid(segment: string): boolean {
  return UUID_RE.test(segment);
}

function isMasterDataType(segment: string): segment is MasterDataType {
  return (MASTER_DATA_TYPES as readonly string[]).includes(segment);
}

function labelForSegment(segments: string[], index: number): string {
  const seg = segments[index];
  if (seg === undefined) {
    return 'Detay';
  }
  const prev = index > 0 ? segments[index - 1] : null;
  const prev2 = index > 1 ? segments[index - 2] : null;

  if (isMasterDataType(seg)) {
    return MASTER_DATA_TYPE_LABELS[seg];
  }
  if (DISPLAY_ID_RE.test(seg)) {
    return seg;
  }
  if (isUuid(seg)) {
    if (prev === 'users') return 'Kullanıcı';
    if (prev === 'tasks') return 'Görev';
    if (prev === 'roles') return 'Rol';
    if (prev === 'master-data' || (typeof prev === 'string' && isMasterDataType(prev))) {
      return 'Kayıt';
    }
    return 'Detay';
  }
  if (typeof prev === 'string' && isUuid(prev) && prev2 === 'roles' && seg in ROLE_SUB_LABEL) {
    return ROLE_SUB_LABEL[seg] as string;
  }
  if (prev && isUuid(prev) && prev2 === 'users' && seg === 'roles') {
    return 'Rol atamaları';
  }
  if (TOP_SEGMENT_LABEL[seg]) {
    return TOP_SEGMENT_LABEL[seg];
  }
  return seg.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * (app) rotaları için URL’den Türkçe breadcrumb üretir; admin `(admin)` grubunda değildir.
 */
export function getAppBreadcrumbs(pathname: string): AppBreadcrumbItem[] {
  const normalized = pathname.replace(/\/+$/, '') || '/';
  if (normalized === '/' || normalized === '/dashboard') {
    return [{ href: '/dashboard', label: 'Ana Sayfa' }];
  }

  const segments = normalized.split('/').filter(Boolean);
  const crumbs: AppBreadcrumbItem[] = [{ href: '/dashboard', label: 'Ana Sayfa' }];

  let i = 0;
  while (i < segments.length) {
    const tail = segments.slice(i);

    if (tail.length >= 2 && tail[0] === 'settings' && tail[1] === 'notifications') {
      crumbs.push({ href: '/settings/notifications', label: 'Bildirim ayarları' });
      i += 2;
      continue;
    }
    if (tail.length >= 2 && tail[0] === 'profile' && tail[1] === 'change-password') {
      crumbs.push({ href: '/profile/change-password', label: 'Şifre değiştir' });
      i += 2;
      continue;
    }
    if (tail.length >= 3 && tail[0] === 'processes' && tail[1] === 'kti' && tail[2] === 'start') {
      crumbs.push({ href: '/processes', label: 'Süreçler' });
      crumbs.push({ href: '/processes/kti/start', label: 'Yeni KTİ' });
      i += 3;
      continue;
    }

    const href = `/${segments.slice(0, i + 1).join('/')}`;
    const label = labelForSegment(segments, i);
    crumbs.push({ href, label });
    i += 1;
  }

  return dedupeConsecutiveHrefs(crumbs);
}

function dedupeConsecutiveHrefs(items: AppBreadcrumbItem[]): AppBreadcrumbItem[] {
  const out: AppBreadcrumbItem[] = [];
  for (const item of items) {
    const last = out[out.length - 1];
    if (last && last.href === item.href) {
      out[out.length - 1] = item;
      continue;
    }
    out.push(item);
  }
  return out;
}
