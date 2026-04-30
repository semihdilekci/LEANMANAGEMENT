/** UTC tarih sınırına göre şifre bitişine kalan tam gün (web banner + API uyarısı ile ortak). */
export function calendarDaysUntilPasswordExpiry(
  expiresAtIso: string,
  now: Date = new Date(),
): number {
  const expiry = new Date(expiresAtIso);
  const startToday = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const startExpiry = Date.UTC(expiry.getUTCFullYear(), expiry.getUTCMonth(), expiry.getUTCDate());
  return Math.round((startExpiry - startToday) / 86_400_000);
}
