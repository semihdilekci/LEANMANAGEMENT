/** API ile aynı eşik — client tarafında erken uyarı için */
export const CONSENT_PUBLISH_MIN_LEAD_MS = 60_000;

export function minEffectiveFromIsoForPublish(nowMs: number): string {
  return new Date(nowMs + CONSENT_PUBLISH_MIN_LEAD_MS).toISOString();
}

export function isEffectiveFromPublishValid(iso: string, nowMs: number): boolean {
  const t = new Date(iso).getTime();
  return !Number.isNaN(t) && t >= nowMs + CONSENT_PUBLISH_MIN_LEAD_MS;
}

/** datetime-local değerini (yerel) ISO UTC stringe çevirir */
export function datetimeLocalToIsoUtc(localValue: string): string {
  const d = new Date(localValue);
  return d.toISOString();
}

export function isoToDatetimeLocalValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
