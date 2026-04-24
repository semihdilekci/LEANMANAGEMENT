import { AppException } from '../common/exceptions/app.exception.js';

export class RoleNotFoundException extends AppException {
  constructor() {
    super('ROLE_NOT_FOUND', 'Rol bulunamadı.', 404);
  }
}

/** docs/03 — rol yetkisi değişimi kendi etkin yetki kümesini düşürürdü */
export class RolePermissionSelfEditForbiddenException extends AppException {
  constructor() {
    super(
      'ROLE_SELF_EDIT_FORBIDDEN',
      'Bu değişiklik kendi yetki düzeyinizi düşüreceği için uygulanamaz.',
      403,
    );
  }
}

export class RoleRuleNotFoundException extends AppException {
  constructor() {
    super('ROLE_RULE_NOT_FOUND', 'Rol kuralı bulunamadı.', 404);
  }
}

export class RoleCodeDuplicateException extends AppException {
  constructor() {
    super('ROLE_CODE_DUPLICATE', 'Bu rol kodu zaten kullanılıyor.', 409);
  }
}

export class RoleSystemCannotDeleteException extends AppException {
  constructor() {
    super('ROLE_SYSTEM_CANNOT_DELETE', 'Sistem rolleri silinemez.', 403);
  }
}

export class RoleSelfDeleteForbiddenException extends AppException {
  constructor() {
    super('ROLE_SELF_EDIT_FORBIDDEN', 'Atandığınız bir rolü silemezsiniz.', 403);
  }
}

export class RoleRuleInvalidStructureException extends AppException {
  constructor(message = 'Kural yapısı geçersiz.') {
    super('ROLE_RULE_INVALID_STRUCTURE', message, 422);
  }
}
