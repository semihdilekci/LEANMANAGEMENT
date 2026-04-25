/** Tamamlanan görevler tablosu — completion_action rozeti */
export function completionActionLabelTr(action: string | null | undefined): string {
  switch (action) {
    case 'APPROVE':
      return 'Onaylandı';
    case 'REJECT':
      return 'Reddedildi';
    case 'REQUEST_REVISION':
      return 'Revize istendi';
    default:
      return action && action.length > 0 ? action : '—';
  }
}
