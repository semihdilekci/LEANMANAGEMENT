import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  CheckSquare,
  FileText,
  KeyRound,
  type LucideIcon,
  UserX,
  XCircle,
} from 'lucide-react';

/** Ekran kataloğu S-NOTIF-LIST ile uyumlu ikon eşlemesi */
export function notificationEventIcon(eventType: string): LucideIcon {
  switch (eventType) {
    case 'TASK_ASSIGNED':
      return CheckSquare;
    case 'TASK_CLAIMED_BY_PEER':
      return UserX;
    case 'PROCESS_COMPLETED':
      return CheckCircle2;
    case 'PROCESS_REJECTED':
      return XCircle;
    case 'SLA_WARNING':
      return Bell;
    case 'SLA_BREACH':
      return AlertTriangle;
    case 'PASSWORD_EXPIRY_WARNING':
      return KeyRound;
    case 'CONSENT_VERSION_PUBLISHED':
      return FileText;
    default:
      return Bell;
  }
}

const EVENT_LABELS: Record<string, string> = {
  TASK_ASSIGNED: 'Görev atandı',
  TASK_CLAIMED_BY_PEER: 'Görev başkası tarafından üstlenildi',
  SLA_WARNING: 'SLA uyarısı',
  SLA_BREACH: 'SLA aşımı',
  PROCESS_COMPLETED: 'Süreç tamamlandı',
  PROCESS_REJECTED: 'Süreç reddedildi',
  PROCESS_CANCELLED: 'Süreç iptal edildi',
  ROLLBACK_PERFORMED: 'Geri alma',
  DOCUMENT_INFECTED: 'Doküman taraması',
  ACCOUNT_LOCKED: 'Hesap kilitlendi',
  PASSWORD_RESET_REQUESTED: 'Şifre sıfırlama talebi',
  PASSWORD_CHANGED: 'Şifre değişti',
  PASSWORD_EXPIRY_WARNING: 'Şifre süresi uyarısı',
  SUSPICIOUS_LOGIN: 'Şüpheli giriş',
  SUPERADMIN_LOGIN: 'Süperadmin girişi',
  SECURITY_ANOMALY: 'Güvenlik uyarısı',
  AUDIT_CHAIN_BROKEN: 'Denetim zinciri',
  USER_LOGIN_WELCOME: 'Hoş geldiniz',
  DAILY_DIGEST: 'Günlük özet',
};

export function notificationEventLabel(eventType: string): string {
  return EVENT_LABELS[eventType] ?? eventType;
}

export function formatNotificationRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const sec = Math.floor((Date.now() - then) / 1000);
  if (sec < 45) return 'Az önce';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} dk önce`;
  const hr = Math.floor(min / 60);
  if (hr < 36) return `${hr} saat önce`;
  const day = Math.floor(hr / 24);
  if (day < 14) return `${day} gün önce`;
  return new Date(iso).toLocaleDateString('tr-TR');
}
