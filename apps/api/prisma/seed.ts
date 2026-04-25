/**
 * Kaynak: docs/02_DATABASE_SCHEMA.md (seed notları), docs/01_DOMAIN_MODEL.md §2.3–2.4
 */
import 'dotenv/config';
import { createHash } from 'node:crypto';

import bcrypt from 'bcrypt';

import { createPrismaClient } from '../src/prisma/prisma-factory.js';

import {
  bufferToPrismaBytes,
  encryptAes256GcmDeterministic,
  encryptAes256GcmProbabilistic,
  hmacBlindIndexHex,
} from '@leanmgmt/shared-utils';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL gerekli');
}
const prisma = createPrismaClient(databaseUrl);

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
  'EMAIL_TEMPLATE_VIEW',
  'EMAIL_TEMPLATE_EDIT',
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

  /** Aynı DB’de `pnpm prisma:seed` tekrar çalışsın diye benzersiz kodlarda upsert */
  const company = await prisma.company.upsert({
    where: { code: 'SYSTEM' },
    create: { code: 'SYSTEM', name: 'System' },
    update: {},
  });

  const location = await prisma.location.upsert({
    where: { code: 'SYSTEM' },
    create: { code: 'SYSTEM', name: 'System', companyId: company.id },
    update: { companyId: company.id },
  });

  const department = await prisma.department.upsert({
    where: { code: 'SYSTEM' },
    create: { code: 'SYSTEM', name: 'System' },
    update: {},
  });

  const level = await prisma.level.upsert({
    where: { code: 'SYSTEM' },
    create: { code: 'SYSTEM', name: 'System' },
    update: {},
  });

  const position = await prisma.position.upsert({
    where: { code: 'SYSTEM' },
    create: { code: 'SYSTEM', name: 'System' },
    update: {},
  });

  const team = await prisma.team.upsert({
    where: { code: 'SYSTEM' },
    create: { code: 'SYSTEM', name: 'System' },
    update: {},
  });

  const workArea = await prisma.workArea.upsert({
    where: { code: 'SYSTEM' },
    create: { code: 'SYSTEM', name: 'System' },
    update: {},
  });

  const workSubArea = await prisma.workSubArea.upsert({
    where: { code: 'SYSTEM' },
    create: {
      code: 'SYSTEM',
      name: 'System',
      parentWorkAreaCode: workArea.code,
    },
    update: {},
  });

  const superadmin = await prisma.user.upsert({
    where: { sicilBlindIndex: sicilBlind },
    create: {
      sicilEncrypted: bufferToPrismaBytes(sicilEnc),
      sicilBlindIndex: sicilBlind,
      firstName: 'Super',
      lastName: 'Admin',
      emailEncrypted: bufferToPrismaBytes(emailEnc),
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
    update: {},
  });

  /** KTİ başlatma testleri ve süreç motoru için superadmin’e atanmış yönetici */
  const managerSicil = '00000003';
  const managerSicilEnc = encryptAes256GcmDeterministic(managerSicil, piiKey, 'user:sicil:v1');
  const managerSicilBlind = hmacBlindIndexHex(managerSicil, pepper);
  const managerEmail = 'seed.manager@leanmgmt.local';
  const managerEmailEnc = encryptAes256GcmDeterministic(managerEmail, piiKey, 'user:email:v1');
  const managerEmailBlind = hmacBlindIndexHex(managerEmail, pepper);
  const managerPasswordHash = await bcrypt.hash('ManagerPass123!@#', BCRYPT_COST);
  const seedManager = await prisma.user.upsert({
    where: { sicilBlindIndex: managerSicilBlind },
    create: {
      sicilEncrypted: bufferToPrismaBytes(managerSicilEnc),
      sicilBlindIndex: managerSicilBlind,
      firstName: 'Seed',
      lastName: 'Manager',
      emailEncrypted: bufferToPrismaBytes(managerEmailEnc),
      emailBlindIndex: managerEmailBlind,
      passwordHash: managerPasswordHash,
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
    update: {},
  });
  await prisma.user.update({
    where: { id: superadmin.id },
    data: { managerUserId: seedManager.id },
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
    const role = await prisma.role.upsert({
      where: { code: r.code },
      create: {
        code: r.code,
        name: r.name,
        description: r.description,
        isSystem: r.isSystem,
        createdByUserId: superadmin.id,
      },
      update: {
        name: r.name,
        description: r.description ?? undefined,
      },
    });
    createdRoles.push({ id: role.id, code: role.code });
  }

  const superadminRole = createdRoles.find((x) => x.code === 'SUPERADMIN');
  if (!superadminRole) throw new Error('SUPERADMIN rolü oluşturulamadı');

  for (const key of ALL_PERMISSION_KEYS) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionKey: {
          roleId: superadminRole.id,
          permissionKey: key,
        },
      },
      create: {
        roleId: superadminRole.id,
        permissionKey: key,
        grantedByUserId: superadmin.id,
      },
      update: {},
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
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionKey: { roleId: role.id, permissionKey: key },
        },
        create: {
          roleId: role.id,
          permissionKey: key,
          grantedByUserId: superadmin.id,
        },
        update: {},
      });
    }
  };

  await grantToRole('ROLE_MANAGER', roleManagerPerms);
  await grantToRole('USER_MANAGER', userManagerPerms);
  await grantToRole('PROCESS_MANAGER', processManagerPerms);

  await prisma.userRole.upsert({
    where: {
      userId_roleId: { userId: superadmin.id, roleId: superadminRole.id },
    },
    create: {
      userId: superadmin.id,
      roleId: superadminRole.id,
      assignedByUserId: superadmin.id,
    },
    update: {},
  });

  const pepperHex = process.env.APP_PII_PEPPER!;

  const consentBody = JSON.stringify({
    locale: 'tr',
    title: 'Aydınlatma ve açık rıza',
    body: '6698 sayılı KVKK kapsamında kişisel verileriniz; kimlik, iletişim, iş ve deneyim bilgileri yönleriyle; platformda görev, süreç ve denetim amaçlarıyla sınırlı işlenmektedir. Bu metni onaylayarak açık rızanızı vermiş olursunuz.',
  });
  const { ciphertext: contentEnc, dek: contentDek } = encryptAes256GcmProbabilistic(consentBody);

  const publishedConsent = await prisma.consentVersion.upsert({
    where: { version: 1 },
    create: {
      version: 1,
      contentEncrypted: bufferToPrismaBytes(contentEnc),
      contentDek: bufferToPrismaBytes(contentDek),
      status: 'PUBLISHED',
      publishedAt: new Date(),
      effectiveFrom: new Date(),
      createdByUserId: superadmin.id,
    },
    update: {},
  });

  const superadminConsentSignature = createHash('sha256')
    .update(`${superadmin.id}:${publishedConsent.id}:${pepperHex}`)
    .digest('hex');

  await prisma.userConsent.upsert({
    where: {
      userId_consentVersionId: {
        userId: superadmin.id,
        consentVersionId: publishedConsent.id,
      },
    },
    create: {
      userId: superadmin.id,
      consentVersionId: publishedConsent.id,
      ipHash: createHash('sha256').update('seed-consent').digest('hex'),
      userAgent: 'seed',
      signature: superadminConsentSignature,
    },
    update: {},
  });

  const seedManagerConsentSignature = createHash('sha256')
    .update(`${seedManager.id}:${publishedConsent.id}:${pepperHex}`)
    .digest('hex');
  await prisma.userConsent.upsert({
    where: {
      userId_consentVersionId: {
        userId: seedManager.id,
        consentVersionId: publishedConsent.id,
      },
    },
    create: {
      userId: seedManager.id,
      consentVersionId: publishedConsent.id,
      ipHash: createHash('sha256').update('seed-manager-consent').digest('hex'),
      userAgent: 'seed',
      signature: seedManagerConsentSignature,
    },
    update: {},
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

  const consentPendingUser = await prisma.user.upsert({
    where: { sicilBlindIndex: pendingSicilBlind },
    create: {
      sicilEncrypted: bufferToPrismaBytes(pendingSicilEnc),
      sicilBlindIndex: pendingSicilBlind,
      firstName: 'Rıza',
      lastName: 'Bekleyen',
      emailEncrypted: bufferToPrismaBytes(pendingEnc),
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
    update: {},
  });

  await prisma.userRole.upsert({
    where: {
      userId_roleId: { userId: consentPendingUser.id, roleId: userManagerRole.id },
    },
    create: {
      userId: consentPendingUser.id,
      roleId: userManagerRole.id,
      assignedByUserId: superadmin.id,
    },
    update: {},
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

  const onlyProcessUser = await prisma.user.upsert({
    where: { sicilBlindIndex: onlyProcSicilBlind },
    create: {
      sicilEncrypted: bufferToPrismaBytes(onlyProcSicilEnc),
      sicilBlindIndex: onlyProcSicilBlind,
      firstName: 'Proc',
      lastName: 'Only',
      emailEncrypted: bufferToPrismaBytes(onlyProcEnc),
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
    update: {},
  });
  await prisma.userRole.upsert({
    where: {
      userId_roleId: { userId: onlyProcessUser.id, roleId: processManagerRole.id },
    },
    create: {
      userId: onlyProcessUser.id,
      roleId: processManagerRole.id,
      assignedByUserId: superadmin.id,
    },
    update: {},
  });
  const onlyProcSignature = createHash('sha256')
    .update(`${onlyProcessUser.id}:${publishedConsent.id}:${pepperHex}`)
    .digest('hex');
  await prisma.userConsent.upsert({
    where: {
      userId_consentVersionId: {
        userId: onlyProcessUser.id,
        consentVersionId: publishedConsent.id,
      },
    },
    create: {
      userId: onlyProcessUser.id,
      consentVersionId: publishedConsent.id,
      ipHash: createHash('sha256').update('seed-onlyproc').digest('hex'),
      userAgent: 'seed',
      signature: onlyProcSignature,
    },
    update: {},
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
    await prisma.systemSetting.upsert({
      where: { key: row.key },
      create: {
        key: row.key,
        value: row.value as object,
        description: row.description,
      },
      update: {
        value: row.value as object,
        description: row.description ?? undefined,
      },
    });
  }

  /** Faz 7 iter 2 — varsayılan e-posta şablonları (tekrar seed: update boş, admin düzenlemesi korunur) */
  const defaultEmailTemplates: {
    eventType:
      | 'TASK_ASSIGNED'
      | 'TASK_CLAIMED_BY_PEER'
      | 'SLA_WARNING'
      | 'SLA_BREACH'
      | 'PROCESS_COMPLETED'
      | 'PROCESS_REJECTED'
      | 'PROCESS_CANCELLED'
      | 'ROLLBACK_PERFORMED'
      | 'PASSWORD_RESET_REQUESTED'
      | 'PASSWORD_CHANGED'
      | 'USER_LOGIN_WELCOME'
      | 'DAILY_DIGEST';
    subjectTemplate: string;
    htmlBodyTemplate: string;
    textBodyTemplate: string;
    requiredVariables: string[];
  }[] = [
    {
      eventType: 'TASK_ASSIGNED',
      subjectTemplate: 'Yeni görev: {{taskTitle}}',
      htmlBodyTemplate:
        '<p>Merhaba {{firstName}},</p><p><strong>{{taskTitle}}</strong> adımı için görev atandı. Süreç: {{displayId}}</p>',
      textBodyTemplate: 'Merhaba {{firstName}}, {{taskTitle}} görevi atandı. Süreç {{displayId}}.',
      requiredVariables: ['firstName', 'taskTitle', 'displayId'],
    },
    {
      eventType: 'TASK_CLAIMED_BY_PEER',
      subjectTemplate: 'Görev üstlenildi: {{displayId}}',
      htmlBodyTemplate:
        '<p>Merhaba {{firstName}},</p><p>{{displayId}} sürecinde görevi başka bir aday üstlendi.</p>',
      textBodyTemplate: 'Merhaba {{firstName}}, {{displayId}} — görev başka kullanıcıda.',
      requiredVariables: ['firstName', 'displayId'],
    },
    {
      eventType: 'SLA_WARNING',
      subjectTemplate: 'SLA uyarısı: {{taskTitle}}',
      htmlBodyTemplate:
        '<p>Merhaba {{firstName}},</p><p>{{taskTitle}} görevi için SLA süresi yaklaşıyor ({{displayId}}).</p>',
      textBodyTemplate: 'Merhaba {{firstName}}, {{taskTitle}} SLA uyarısı. {{displayId}}',
      requiredVariables: ['firstName', 'taskTitle', 'displayId'],
    },
    {
      eventType: 'SLA_BREACH',
      subjectTemplate: 'SLA aşımı: {{taskTitle}}',
      htmlBodyTemplate:
        '<p>Merhaba {{firstName}},</p><p>{{taskTitle}} görevinde SLA aşıldı. Süreç: {{displayId}}.</p>',
      textBodyTemplate: 'Merhaba {{firstName}}, {{taskTitle}} SLA aşımı. {{displayId}}',
      requiredVariables: ['firstName', 'taskTitle', 'displayId'],
    },
    {
      eventType: 'PROCESS_COMPLETED',
      subjectTemplate: 'Süreç tamamlandı: {{displayId}}',
      htmlBodyTemplate:
        '<p>Merhaba {{firstName}},</p><p>{{displayId}} Kaizen süreci onaylandı ve tamamlandı.</p>',
      textBodyTemplate: 'Merhaba {{firstName}}, {{displayId}} süreci tamamlandı.',
      requiredVariables: ['firstName', 'displayId'],
    },
    {
      eventType: 'PROCESS_REJECTED',
      subjectTemplate: 'Süreç reddedildi: {{displayId}}',
      htmlBodyTemplate:
        '<p>Merhaba {{firstName}},</p><p>{{displayId}} Kaizen süreci reddedildi.</p>',
      textBodyTemplate: 'Merhaba {{firstName}}, {{displayId}} süreci reddedildi.',
      requiredVariables: ['firstName', 'displayId'],
    },
    {
      eventType: 'PROCESS_CANCELLED',
      subjectTemplate: 'Süreç iptal: {{displayId}}',
      htmlBodyTemplate: '<p>Merhaba {{firstName}},</p><p>{{displayId}} süreci iptal edildi.</p>',
      textBodyTemplate: 'Merhaba {{firstName}}, {{displayId}} iptal edildi.',
      requiredVariables: ['firstName', 'displayId'],
    },
    {
      eventType: 'ROLLBACK_PERFORMED',
      subjectTemplate: 'Geri alma: {{displayId}}',
      htmlBodyTemplate:
        '<p>Merhaba {{firstName}},</p><p>{{displayId}} sürecinde geri alma uygulandı.</p>',
      textBodyTemplate: 'Merhaba {{firstName}}, {{displayId}} geri alındı.',
      requiredVariables: ['firstName', 'displayId'],
    },
    {
      eventType: 'PASSWORD_RESET_REQUESTED',
      subjectTemplate: 'Şifre sıfırlama talebi',
      htmlBodyTemplate:
        '<p>Merhaba {{firstName}},</p><p>Şifre sıfırlama için bağlantı: {{resetLink}}</p>',
      textBodyTemplate: 'Merhaba {{firstName}}, şifre sıfırlama: {{resetLink}}',
      requiredVariables: ['firstName', 'resetLink'],
    },
    {
      eventType: 'PASSWORD_CHANGED',
      subjectTemplate: 'Şifreniz güncellendi',
      htmlBodyTemplate: '<p>Merhaba {{firstName}},</p><p>Hesap şifreniz değiştirildi.</p>',
      textBodyTemplate: 'Merhaba {{firstName}}, şifreniz değiştirildi.',
      requiredVariables: ['firstName'],
    },
    {
      eventType: 'USER_LOGIN_WELCOME',
      subjectTemplate: 'Lean Management’a hoş geldiniz',
      htmlBodyTemplate:
        '<p>Merhaba {{firstName}},</p><p>Hesabınız oluşturuldu. Giriş: {{loginUrl}}</p>',
      textBodyTemplate: 'Merhaba {{firstName}}, hoş geldiniz. Giriş: {{loginUrl}}',
      requiredVariables: ['firstName', 'loginUrl'],
    },
    {
      eventType: 'DAILY_DIGEST',
      subjectTemplate: 'Günlük özet — {{digestDate}}',
      htmlBodyTemplate:
        '<p>Merhaba {{firstName}},</p><p>{{digestDate}} için özet:</p><p>{{digestBodyHtml}}</p>',
      textBodyTemplate: 'Merhaba {{firstName}},\n{{digestDate}}\n{{digestBodyText}}',
      requiredVariables: ['firstName', 'digestDate', 'digestBodyHtml', 'digestBodyText'],
    },
  ];

  for (const t of defaultEmailTemplates) {
    await prisma.emailTemplate.upsert({
      where: { eventType: t.eventType },
      create: {
        eventType: t.eventType,
        subjectTemplate: t.subjectTemplate,
        htmlBodyTemplate: t.htmlBodyTemplate,
        textBodyTemplate: t.textBodyTemplate,
        requiredVariables: t.requiredVariables,
        updatedByUserId: superadmin.id,
      },
      update: {},
    });
  }

  const genesisHash = chainHashPlaceholder(
    'GENESIS',
    JSON.stringify({ event: 'seed', at: new Date().toISOString() }),
  );
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
