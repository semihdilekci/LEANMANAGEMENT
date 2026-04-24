/** Seçili yetki kümesi ile başlangıç kümesi arasındaki fark — saf fonksiyon (test edilebilir). */
export function computePermissionDiff(
  initialKeys: Iterable<string>,
  selectedKeys: Iterable<string>,
) {
  const initial = new Set(initialKeys);
  const selected = new Set(selectedKeys);
  const added = [...selected].filter((k) => !initial.has(k));
  const removed = [...initial].filter((k) => !selected.has(k));
  return { added, removed };
}
