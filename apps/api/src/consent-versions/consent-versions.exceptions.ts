import { AppException } from '../common/exceptions/app.exception.js';

export class ConsentVersionNotFoundAdminException extends AppException {
  constructor() {
    super('CONSENT_VERSION_NOT_FOUND', 'Rıza metni sürümü bulunamadı', 404);
  }
}

export class ConsentVersionAlreadyPublishedException extends AppException {
  constructor() {
    super('CONSENT_ALREADY_PUBLISHED', 'Bu sürüm zaten yayımlanmış', 409);
  }
}
