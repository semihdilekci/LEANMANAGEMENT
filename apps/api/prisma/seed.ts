/**
 * Kaynak: docs/02_DATABASE_SCHEMA.md (seed notları), docs/01_DOMAIN_MODEL.md §2.3–2.4
 */
import { createHash } from 'node:crypto';

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

import {
  encryptAes256GcmDeterministic,
  encryptAes256GcmProbabilistic,
  hmacBlindIndexHex,
} from '../../../packages/shared-utils/src/pii-crypto.js';

const prisma = new PrismaClient();

const BCRYPT_COST = 12;

/** docs/02 §6.3 — SUPERADMIN tüm izinler; diğer sistem rolleri özet set */
const ALL_PERMISSION_KEYS: string[] = [
  'USER_CREATE',
  'USER_UPDATE_ATTRIBUTE',
  'USER_LIST_VIEW',
  'USER_DEACTIVATE',
  'USER_REACTIVATE',
  'USER_ROLE_ASSIGN',
  'ROLE_CREATE',
  'ROLE_VIEW',
  'ROLE_UPDATE',
  'ROLE_DELETE',
  'ROLE_PERMISSION_MANAGE',
  'ROLE_ASSIGN',
  'ROLE_RULE_MANAGE',
  'PROCESS_KTI_START',
  'PROCESS_CANCEL',
  'PROCESS_ROLLBACK',
  'PROCESS_VIEW_ALL',
  'MASTER_DATA_MANAGE',
  'AUDIT_LOG_VIEW',
  'SYSTEM_SETTINGS_EDIT',
  'DOCUMENT_UPLOAD',
  'USER_SESSION_VIEW',
  'USER_SESSION_REVOKE',
  'USER_ANONYMIZE',
  'NOTIFICATION_READ',
  'USER_PROFILE_VIEW',
  'MASTER_DATA_VIEW',
];

function requireEnv32Hex(name: string): Buffer {
  const v = process.env[name];
  if (!v || v.length !== 64 || !/^[0-9a-fA-F]+$/.test(v)) {
    throw new Error(`${name} zorunlu: 64 hex karakter (32 byte), örn. openssl rand -hex 32`);
  }
  return Buffer.from(v, 'hex');
}

function chainHashPlaceholder(prev: string, rowJson: string): string {
  return createHash('sha256')
    .update(prev + rowJson)
    .digest('hex');
}

async function main(): Promise<void> {
  const piiKey = requireEnv32Hex('APP_PII_ENCRYPTION_KEY');
  const pepper = requireEnv32Hex('APP_PII_PEPPER');

  const superadminEmail = (process.env.SUPERADMIN_EMAIL ?? 'superadmin@leanmgmt.local')
    .toLowerCase()
    .trim();
  const superadminPassword = process.env.SUPERADMIN_PASSWORD ?? 'AdminPass123!@#';
  const superadminSicil = process.env.SUPERADMIN_SICIL ?? '00000001';

  const sicilNorm = superadminSicil;
  const sicilEnc = encryptAes256GcmDeterministic(sicilNorm, piiKey, 'user:sicil:v1');
  const sicilBlind = hmacBlindIndexHex(sicilNorm, pepper);

  const emailEnc = encryptAes256GcmDeterministic(superadminEmail, piiKey, 'user:email:v1');
  const emailBlind = hmacBlindIndexHex(superadminEmail, pepper);

  const passwordHash = await bcrypt.hash(superadminPassword, BCRYPT_COST);

  const company = await prisma.company.create({
    data: { code: 'SYSTEM', name: 'System' },
  });

  const location = await prisma.location.create({
    data: { code: 'SYSTEM', name: 'System', companyId: company.id },
  });

  const department = await prisma.department.create({
    data: { code: 'SYSTEM', name: 'System' },
  });

  const level = await prisma.level.create({
    data: { code: 'SYSTEM', name: 'System' },
  });

  const position = await prisma.position.create({
    data: { code: 'SYSTEM', name: 'System' },
  });

  const team = await prisma.team.create({
    data: { code: 'SYSTEM', name: 'System' },
  });

  const workArea = await prisma.workArea.create({
    data: { code: 'SYSTEM', name: 'System' },
  });

  const workSubArea = await prisma.workSubArea.create({
    data: {
      code: 'SYSTEM',
      name: 'System',
      parentWorkAreaCode: workArea.code,
    },
  });

  const superadmin = await prisma.user.create({
    data: {
      sicilEncrypted: sicilEnc,
      sicilBlindIndex: sicilBlind,
      firstName: 'Super',
      lastName: 'Admin',
      emailEncrypted: emailEnc,
      emailBlindIndex: emailBlind,
      passwordHash,
      employeeType: 'WHITE_COLLAR',
      companyId: company.id,
      locationId: location.id,
      departmentId: department.id,
      positionId: position.id,
      levelId: level.id,
      teamId: team.id,
      workAreaId: workArea.id,
      workSubAreaId: workSubArea.id,
      passwordChangedAt: new Date(),
    },
  });

  const rolesData = [
    {
      code: 'SUPERADMIN',
      name: 'Superadmin',
      isSystem: true,
      description: 'Tam yetkili sistem yöneticisi',
    },
    { code: 'USER_MANAGER', name: 'Kullanıcı Yöneticisi', isSystem: true, description: null },
    { code: 'ROLE_MANAGER', name: 'Rol ve Yetki Yöneticisi', isSystem: true, description: null },
    { code: 'PROCESS_MANAGER', name: 'Süreç Yöneticisi', isSystem: true, description: null },
  ] as const;

  const createdRoles: { id: string; code: string }[] = [];
  for (const r of rolesData) {
    const role = await prisma.role.create({
      data: {
        code: r.code,
        name: r.name,
        description: r.description,
        isSystem: r.isSystem,
        createdByUserId: superadmin.id,
      },
    });
    createdRoles.push({ id: role.id, code: role.code });
  }

  const superadminRole = createdRoles.find((x) => x.code === 'SUPERADMIN');
  if (!superadminRole) throw new Error('SUPERADMIN rolü oluşturulamadı');

  for (const key of ALL_PERMISSION_KEYS) {
    await prisma.rolePermission.create({
      data: {
        roleId: superadminRole.id,
        permissionKey: key,
        grantedByUserId: superadmin.id,
      },
    });
  }

  const roleManagerPerms = [
    'ROLE_CREATE',
    'ROLE_VIEW',
    'ROLE_UPDATE',
    'ROLE_DELETE',
    'ROLE_PERMISSION_MANAGE',
    'ROLE_ASSIGN',
    'ROLE_RULE_MANAGE',
    'USER_ROLE_ASSIGN',
  ];
  const userManagerPerms = [
    'USER_CREATE',
    'USER_UPDATE_ATTRIBUTE',
    'USER_LIST_VIEW',
    'USER_DEACTIVATE',
    'USER_REACTIVATE',
    'USER_SESSION_VIEW',
    'USER_SESSION_REVOKE',
    'USER_ANONYMIZE',
    'MASTER_DATA_MANAGE',
    'MASTER_DATA_VIEW',
  ];
  const processManagerPerms = [
    'PROCESS_VIEW_ALL',
    'PROCESS_CANCEL',
    'PROCESS_ROLLBACK',
    'AUDIT_LOG_VIEW',
  ];

  const grantToRole = async (code: string, keys: string[]): Promise<void> => {
    const role = createdRoles.find((x) => x.code === code);
    if (!role) return;
    for (const key of keys) {
      await prisma.rolePermission.create({
        data: { roleId: role.id, permissionKey: key, grantedByUserId: superadmin.id },
      });
    }
  };

  await grantToRole('ROLE_MANAGER', roleManagerPerms);
  await grantToRole('USER_MANAGER', userManagerPerms);
  await grantToRole('PROCESS_MANAGER', processManagerPerms);

  await prisma.userRole.create({
    data: {
      userId: superadmin.id,
      roleId: superadminRole.id,
      assignedByUserId: superadmin.id,
    },
  });

  const pepperHex = process.env.APP_PII_PEPPER!;

  const consentBody = JSON.stringify({
    locale: 'tr',
    title: 'Aydınlatma ve açık rıza',
    body: '6698 sayılı KVKK kapsamında kişisel verileriniz; kimlik, iletişim, iş ve deneyim bilgileri yönleriyle; platformda görev, süreç ve denetim amaçlarıyla sınırlı işlenmektedir. Bu metni onaylayarak açık rızanızı vermiş olursunuz.',
  });
  const { ciphertext: contentEnc, dek: contentDek } = encryptAes256GcmProbabilistic(consentBody);

  const publishedConsent = await prisma.consentVersion.create({
    data: {
      version: 1,
      contentEncrypted: contentEnc,
      contentDek: contentDek,
      status: 'PUBLISHED',
      publishedAt: new Date(),
      effectiveFrom: new Date(),
      createdByUserId: superadmin.id,
    },
  });

  const superadminConsentSignature = createHash('sha256')
    .update(`${superadmin.id}:${publishedConsent.id}:${pepperHex}`)
    .digest('hex');

  await prisma.userConsent.create({
    data: {
      userId: superadmin.id,
      consentVersionId: publishedConsent.id,
      ipHash: createHash('sha256').update('seed-consent').digest('hex'),
      userAgent: 'seed',
      signature: superadminConsentSignature,
    },
  });

  const pendingSicil = '00000002';
  const pendingSicilEnc = encryptAes256GcmDeterministic(pendingSicil, piiKey, 'user:sicil:v1');
  const pendingSicilBlind = hmacBlindIndexHex(pendingSicil, pepper);
  const pendingEmail = (
    process.env.SEED_CONSENT_PENDING_EMAIL ?? 'consentpending@leanmgmt.local'
  ).toLowerCase();
  const pendingEnc = encryptAes256GcmDeterministic(pendingEmail, piiKey, 'user:email:v1');
  const pendingBlind = hmacBlindIndexHex(pendingEmail, pepper);
  const pendingPassword = process.env.SEED_CONSENT_PENDING_PASSWORD ?? 'PendingPass123!@#';
  const pendingHash = await bcrypt.hash(pendingPassword, BCRYPT_COST);

  const userManagerRole = createdRoles.find((x) => x.code === 'USER_MANAGER');
  if (!userManagerRole) throw new Error('USER_MANAGER rolü yok');

  const consentPendingUser = await prisma.user.create({
    data: {
      sicilEncrypted: pendingSicilEnc,
      sicilBlindIndex: pendingSicilBlind,
      firstName: 'Rıza',
      lastName: 'Bekleyen',
      emailEncrypted: pendingEnc,
      emailBlindIndex: pendingBlind,
      passwordHash: pendingHash,
      employeeType: 'WHITE_COLLAR',
      companyId: company.id,
      locationId: location.id,
      departmentId: department.id,
      positionId: position.id,
      levelId: level.id,
      teamId: team.id,
      workAreaId: workArea.id,
      workSubAreaId: workSubArea.id,
      passwordChangedAt: new Date(),
    },
  });

  await prisma.userRole.create({
    data: {
      userId: consentPendingUser.id,
      roleId: userManagerRole.id,
      assignedByUserId: superadmin.id,
    },
  });

  /** Faz 4: integration — USER_LIST_VIEW dışı yetkilerle kullanıcı */
  const processManagerRole = createdRoles.find((x) => x.code === 'PROCESS_MANAGER');
  if (!processManagerRole) throw new Error('PROCESS_MANAGER rolü yok');
  const onlyProcSicil = '00000009';
  const onlyProcSicilEnc = encryptAes256GcmDeterministic(onlyProcSicil, piiKey, 'user:sicil:v1');
  const onlyProcSicilBlind = hmacBlindIndexHex(onlyProcSicil, pepper);
  const onlyProcEmail = 'integration_process@leanmgmt.local';
  const onlyProcEnc = encryptAes256GcmDeterministic(onlyProcEmail, piiKey, 'user:email:v1');
  const onlyProcBlind = hmacBlindIndexHex(onlyProcEmail, pepper);
  const onlyProcPassword = process.env.SEED_INTEGRATION_PROCESS_PASSWORD ?? 'OnlyProc123!@#';
  const onlyProcHash = await bcrypt.hash(onlyProcPassword, BCRYPT_COST);

  const onlyProcessUser = await prisma.user.create({
    data: {
      sicilEncrypted: onlyProcSicilEnc,
      sicilBlindIndex: onlyProcSicilBlind,
      firstName: 'Proc',
      lastName: 'Only',
      emailEncrypted: onlyProcEnc,
      emailBlindIndex: onlyProcBlind,
      passwordHash: onlyProcHash,
      employeeType: 'WHITE_COLLAR',
      companyId: company.id,
      locationId: location.id,
      departmentId: department.id,
      positionId: position.id,
      levelId: level.id,
      teamId: team.id,
      workAreaId: workArea.id,
      workSubAreaId: workSubArea.id,
      passwordChangedAt: new Date(),
    },
  });
  await prisma.userRole.create({
    data: {
      userId: onlyProcessUser.id,
      roleId: processManagerRole.id,
      assignedByUserId: superadmin.id,
    },
  });
  const onlyProcSignature = createHash('sha256')
    .update(`${onlyProcessUser.id}:${publishedConsent.id}:${pepperHex}`)
    .digest('hex');
  await prisma.userConsent.create({
    data: {
      userId: onlyProcessUser.id,
      consentVersionId: publishedConsent.id,
      ipHash: createHash('sha256').update('seed-onlyproc').digest('hex'),
      userAgent: 'seed',
      signature: onlyProcSignature,
    },
  });

  const systemSettingsSeed: { key: string; value: unknown; description: string | null }[] = [
    { key: 'LOGIN_ATTEMPT_THRESHOLD', value: 5, description: null },
    { key: 'LOGIN_ATTEMPT_WINDOW_MINUTES', value: 15, description: null },
    { key: 'LOCKOUT_THRESHOLD', value: 5, description: null },
    { key: 'LOCKOUT_DURATION_MINUTES', value: 30, description: null },
    { key: 'PASSWORD_EXPIRY_DAYS', value: 180, description: null },
    { key: 'SUPERADMIN_IP_WHITELIST', value: [], description: null },
    {
      key: 'ACTIVE_CONSENT_VERSION_ID',
      value: publishedConsent.id,
      description: 'Aktif rıza sürümü',
    },
  ];

  for (const row of systemSettingsSeed) {
    await prisma.systemSetting.create({
      data: {
        key: row.key,
        value: row.value as object,
        description: row.description,
      },
    });
  }

  const genesisHash = chainHashPlaceholder('GENESIS', JSON.stringify({ event: 'seed' }));
  await prisma.auditLog.create({
    data: {
      userId: superadmin.id,
      action: 'SEED_COMPLETED',
      entity: 'system',
      entityId: 'bootstrap',
      ipHash: createHash('sha256').update('seed').digest('hex'),
      chainHash: genesisHash,
    },
  });

  console.log('Seed tamamlandı. Superadmin:', superadminEmail, 'sicil:', superadminSicil);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
