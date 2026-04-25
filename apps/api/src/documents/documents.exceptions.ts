import { AppException } from '../common/exceptions/app.exception.js';

export class DocumentNotFoundException extends AppException {
  constructor() {
    super('DOCUMENT_NOT_FOUND', 'Doküman bulunamadı.', 404);
  }
}

export class DocumentContentTypeInvalidException extends AppException {
  constructor() {
    super('DOCUMENT_CONTENT_TYPE_INVALID', 'Bu dosya türü yüklenemez.', 415);
  }
}

export class DocumentSizeExceededException extends AppException {
  constructor() {
    super('DOCUMENT_SIZE_EXCEEDED', 'Dosya boyutu 10 MB sınırını aşıyor.', 413);
  }
}

export class DocumentUploadForbiddenException extends AppException {
  constructor() {
    super('DOCUMENT_UPLOAD_FORBIDDEN', 'Bu bağlamda dosya yükleme yetkiniz yok.', 403);
  }
}

export class DocumentScanPendingException extends AppException {
  constructor() {
    super('DOCUMENT_SCAN_PENDING', 'Doküman virüs taramasında; lütfen bekleyin.', 409);
  }
}

export class DocumentInfectedException extends AppException {
  constructor() {
    super('DOCUMENT_INFECTED', 'Doküman güvenlik taramasında zararlı olarak işaretlendi.', 403);
  }
}

export class DocumentStagingMissingException extends AppException {
  constructor() {
    super('DOCUMENT_NOT_FOUND', 'Yüklenen dosya depoda bulunamadı.', 404);
  }
}

export class DocumentMetaMismatchException extends AppException {
  constructor() {
    super('VALIDATION_FAILED', 'Gönderilen bilgiler ile yüklenen dosya uyuşmuyor.', 400);
  }
}

export class DocumentInitiateExpiredException extends AppException {
  constructor() {
    super('VALIDATION_FAILED', 'Yükleme oturumu geçersiz veya süresi dolmuş.', 400);
  }
}

export class ProcessAccessDeniedException extends AppException {
  constructor() {
    super('PROCESS_ACCESS_DENIED', 'Bu dokümana erişim yetkiniz yok.', 403);
  }
}
