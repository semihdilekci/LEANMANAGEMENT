import { AppException } from '../common/exceptions/app.exception.js';

/** docs/03_API_CONTRACTS.md §9.8 — bilgi sızdırmadan 404 */
export class NotificationNotFoundException extends AppException {
  constructor() {
    super('VALIDATION_FAILED', 'Bildirim bulunamadı', 404);
  }
}
