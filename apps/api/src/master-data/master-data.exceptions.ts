import { AppException } from '../common/exceptions/app.exception.js';

export class MasterDataRecordNotFoundException extends AppException {
  constructor() {
    super('MASTER_DATA_NOT_FOUND', 'Kayıt bulunamadı.', 404);
  }
}

export class MasterDataCodeDuplicateException extends AppException {
  constructor(code?: string) {
    super(
      'MASTER_DATA_CODE_DUPLICATE',
      'Bu kod zaten kullanımda.',
      409,
      code ? { code } : undefined,
    );
  }
}

export class MasterDataCodeImmutableException extends AppException {
  constructor() {
    super('MASTER_DATA_CODE_IMMUTABLE', 'Kod alanı değiştirilemez.', 403);
  }
}

export class MasterDataInUseByUsersException extends AppException {
  constructor(activeUsersCount: number) {
    super(
      'MASTER_DATA_IN_USE',
      'Bu kayıda bağlı aktif kullanıcılar mevcut, önce kullanıcıları güncellemeniz gerekmektedir.',
      422,
      { activeUsersCount },
    );
  }
}

export class MasterDataParentInactiveException extends AppException {
  constructor() {
    super('MASTER_DATA_PARENT_INACTIVE', 'Üst alan (work area) pasif durumdadır.', 422);
  }
}

export class MasterDataUnknownTypeException extends AppException {
  constructor(type: string) {
    super('MASTER_DATA_NOT_FOUND', `Geçersiz master data tipi: ${type}`, 404);
  }
}

/** Liste: MASTER_DATA_MANAGE yok ve (tip companies değil veya PROCESS_KTI_START yok) */
export class MasterDataListAccessDeniedException extends AppException {
  constructor() {
    super('PERMISSION_DENIED', 'Bu işlem için yetkiniz bulunmamaktadır.', 403, {
      required: ['MASTER_DATA_MANAGE'],
      missing: ['MASTER_DATA_MANAGE'],
    });
  }
}
