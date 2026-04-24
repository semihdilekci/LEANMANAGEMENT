import { AppException } from '../common/exceptions/app.exception.js';

export class UserNotFoundException extends AppException {
  constructor() {
    super('USER_NOT_FOUND', 'Kullanıcı bulunamadı.', 404);
  }
}

export class UserSicilDuplicateException extends AppException {
  constructor(sicil?: string) {
    super(
      'USER_SICIL_DUPLICATE',
      'Bu sicil numarası zaten kayıtlı.',
      409,
      sicil ? { sicil } : undefined,
    );
  }
}

export class UserEmailDuplicateException extends AppException {
  constructor() {
    super('USER_EMAIL_DUPLICATE', 'Bu e-posta adresi zaten kayıtlı.', 409);
  }
}

export class UserSelfEditForbiddenException extends AppException {
  constructor() {
    super('USER_SELF_EDIT_FORBIDDEN', 'Kendi hesabınız üzerinde bu işlemi yapamazsınız.', 403);
  }
}

export class UserAlreadyPassiveException extends AppException {
  constructor() {
    super('USER_ALREADY_PASSIVE', 'Kullanıcı zaten pasif durumdadır.', 409);
  }
}

export class UserAlreadyActiveException extends AppException {
  constructor() {
    super('USER_ALREADY_ACTIVE', 'Kullanıcı zaten aktif durumdadır.', 409);
  }
}

export class UserManagerCycleException extends AppException {
  constructor() {
    super('USER_MANAGER_CYCLE', 'Yönetici atamasında döngü tespit edildi.', 422);
  }
}

export class UserAnonymizedException extends AppException {
  constructor() {
    super('USER_ANONYMIZED', 'Anonimleştirilmiş kullanıcı üzerinde bu işlem yapılamaz.', 403);
  }
}

export class MasterDataNotFoundException extends AppException {
  constructor(field?: string) {
    super(
      'MASTER_DATA_NOT_FOUND',
      'Belirtilen kayıt bulunamadı.',
      404,
      field ? { field } : undefined,
    );
  }
}

export class MasterDataInUseException extends AppException {
  constructor(field?: string) {
    super(
      'MASTER_DATA_IN_USE',
      'Belirtilen kayıt pasif durumdadır, kullanılamaz.',
      422,
      field ? { field } : undefined,
    );
  }
}

export class PermissionDeniedException extends AppException {
  constructor(details?: Record<string, unknown>) {
    super('PERMISSION_DENIED', 'Bu işlem için yetkiniz bulunmamaktadır.', 403, details);
  }
}
