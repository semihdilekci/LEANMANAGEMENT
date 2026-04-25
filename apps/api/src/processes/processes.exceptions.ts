import { AppException } from '../common/exceptions/app.exception.js';

export class ProcessNotFoundException extends AppException {
  constructor() {
    super('PROCESS_NOT_FOUND', 'Süreç bulunamadı.', 404);
  }
}

export class ProcessInvalidStateException extends AppException {
  constructor() {
    super('PROCESS_INVALID_STATE', 'Bu işlem mevcut süreç durumunda yapılamaz.', 409);
  }
}

export class ProcessTypeUnknownException extends AppException {
  constructor() {
    super('PROCESS_TYPE_UNKNOWN', 'Bu süreç tipi desteklenmiyor.', 400);
  }
}

export class ProcessCancelReasonRequiredException extends AppException {
  constructor() {
    super('PROCESS_CANCEL_REASON_REQUIRED', 'İptal gerekçesi zorunludur.', 400);
  }
}

export class ProcessRollbackInvalidTargetException extends AppException {
  constructor(details?: Record<string, unknown>) {
    super('PROCESS_ROLLBACK_INVALID_TARGET', 'Bu adıma geri dönüş mümkün değil.', 422, details);
  }
}

/** docs/03_API_CONTRACTS.md — KTİ başlatma, manager zorunlu (kod sözleşmeye uygun) */
export class KtiManagerRequiredException extends AppException {
  constructor() {
    super('USER_NOT_FOUND', 'KTİ için yönetici atamanız tanımlı değil.', 422);
  }
}

export class KtiCompanyMismatchException extends AppException {
  constructor() {
    super('VALIDATION_FAILED', 'Şirket seçimi kullanıcı profiliniz ile uyumlu değil.', 400);
  }
}

/** docs/03_API_CONTRACTS.md §9.5 — GET /processes/:displayId erişim reddi */
export class ProcessViewAccessDeniedException extends AppException {
  constructor() {
    super('PROCESS_ACCESS_DENIED', 'Bu sürece erişim yetkiniz yok.', 403);
  }
}
