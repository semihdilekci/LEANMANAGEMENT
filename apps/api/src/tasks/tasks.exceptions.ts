import { AppException } from '../common/exceptions/app.exception.js';

export class TaskNotFoundException extends AppException {
  constructor() {
    super('TASK_NOT_FOUND', 'Görev bulunamadı', 404);
  }
}

export class TaskAccessDeniedException extends AppException {
  constructor() {
    super('TASK_ACCESS_DENIED', 'Bu göreve erişim yetkiniz yok', 403);
  }
}

export class TaskNotClaimableException extends AppException {
  constructor() {
    super(
      'TASK_NOT_CLAIMABLE',
      'Bu görev bu şekilde üstlenilemez (claim gerekli değil veya mod uyumsuz).',
      422,
    );
  }
}

export class TaskClaimLostException extends AppException {
  constructor() {
    super('TASK_CLAIM_LOST', 'Görev başka bir aday tarafından üstlenildi', 409);
  }
}

export class TaskAlreadyCompletedException extends AppException {
  constructor() {
    super('TASK_ALREADY_COMPLETED', 'Görev zaten tamamlandı', 409);
  }
}

export class TaskCompletionActionInvalidException extends AppException {
  constructor() {
    super('TASK_COMPLETION_ACTION_INVALID', 'Bu adım için izin verilmeyen aksiyon', 422);
  }
}

export class TaskReasonRequiredException extends AppException {
  constructor() {
    super('TASK_REASON_REQUIRED', 'Bu aksiyon için gerekçe zorunludur', 400);
  }
}

export class TaskMustClaimFirstException extends AppException {
  constructor() {
    super('TASK_MUST_CLAIM_FIRST', 'Claim modundaki görevi önce üstlenmeniz gerekir', 422);
  }
}

export class TaskInvalidStateException extends AppException {
  constructor() {
    super('TASK_INVALID_STATE', 'Görev bu işlem için uygun durumda değil', 409);
  }
}

export class KtiNotSupportedException extends AppException {
  constructor() {
    super('KTI_NOT_SUPPORTED', 'Sadece KTİ süreç türü desteklenmektedir', 400);
  }
}
