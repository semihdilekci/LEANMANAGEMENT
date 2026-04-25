/**
 * Yıldız Holding benzeri master data + toplu kullanıcı (geliştirme / yük testi).
 *
 * Önkoşul: `pnpm prisma:seed` (veya `prisma db seed`) ile temel sistem + rıza sürümü yüklü olmalı.
 *
 * Ortam:
 * - `DATABASE_URL`, `APP_PII_ENCRYPTION_KEY`, `APP_PII_PEPPER` — ana seed ile aynı
 * - `YILDIZ_BULK_USER_COUNT` — varsayılan 1000
 * - `YILDIZ_BULK_REPLACE=1` — mevcut YILDIZ şirketi kullanıcılarını siler (bağımlı kayıt varsa hata verir)
 *
 * Giriş: tüm toplu kullanıcılar için ortak test şifresi konsolda yazdırılır (yalnızca dev).
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

import type { Prisma } from '../src/generated/prisma/client.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL gerekli');
}

const prisma = createPrismaClient(databaseUrl);

const BCRYPT_COST = 12;
const DEFAULT_BULK_COUNT = 1000;
const COMPANY_CODE = 'YILDIZ';
const EMAIL_DOMAIN = 'yildizholding.com';

const FIRST_NAMES = [
  'Ahmet',
  'Mehmet',
  'Ayşe',
  'Fatma',
  'Mustafa',
  'Zeynep',
  'Ali',
  'Elif',
  'Hasan',
  'Merve',
  'Emre',
  'Burak',
  'Cansu',
  'Deniz',
  'Ece',
  'Gizem',
  'Hakan',
  'İrem',
  'Kaan',
  'Leyla',
  'Murat',
  'Nihan',
  'Onur',
  'Pınar',
  'Serkan',
  'Tuğba',
  'Uğur',
  'Volkan',
  'Yasin',
  'Zehra',
  'Barış',
  'Can',
  'Derya',
  'Ebru',
  'Furkan',
  'Gökhan',
  'Hande',
  'İsmail',
  'Jale',
  'Kemal',
  'Lale',
  'Osman',
  'Rıdvan',
  'Selin',
  'Tolga',
  'Umut',
  'Vildan',
  'Yeliz',
  'Zafer',
  'Arda',
  'Berk',
];

const LAST_NAMES = [
  'Yılmaz',
  'Kaya',
  'Demir',
  'Şahin',
  'Çelik',
  'Yıldız',
  'Yıldırım',
  'Öztürk',
  'Aydın',
  'Özdemir',
  'Arslan',
  'Doğan',
  'Kılıç',
  'Aslan',
  'Çetin',
  'Kara',
  'Koç',
  'Kurt',
  'Özkan',
  'Şimşek',
  'Polat',
  'Erdoğan',
  'Bulut',
  'Güneş',
  'Tekin',
  'Acar',
  'Aktaş',
  'Bozkurt',
  'Duran',
  'Eren',
  'Güler',
  'Işık',
  'Karaca',
  'Mutlu',
  'Turan',
  'Uçar',
  'Vural',
  'Yavuz',
  'Aksoy',
  'Çiftçi',
  'Deniz',
  'Filiz',
  'Gencer',
  'Hacıoğlu',
  'İpek',
  'Korkmaz',
  'Lütfi',
  'Mertoğlu',
  'Nalbant',
  'Orhan',
];

/** Sicil 8 hane — seed’deki 0000000x aralığıyla çakışmaması için 91xxxxxx */
function sicilForIndex(index1Based: number): string {
  const n = 91000000 + index1Based;
  return String(n).slice(0, 8);
}

function requireEnv32Hex(name: string): Buffer {
  const v = process.env[name];
  if (!v || v.length !== 64 || !/^[0-9a-fA-F]+$/.test(v)) {
    throw new Error(`${name} zorunlu: 64 hex karakter (32 byte)`);
  }
  return Buffer.from(v, 'hex');
}

function trAsciiSlug(s: string): string {
  const map: Record<string, string> = {
    ç: 'c',
    Ç: 'c',
    ğ: 'g',
    Ğ: 'g',
    ı: 'i',
    İ: 'i',
    i: 'i',
    I: 'i',
    ö: 'o',
    Ö: 'o',
    ş: 's',
    Ş: 's',
    ü: 'u',
    Ü: 'u',
    â: 'a',
    Â: 'a',
    ê: 'e',
    Ê: 'e',
    î: 'i',
    Î: 'i',
    ô: 'o',
    Ô: 'o',
    û: 'u',
    Û: 'u',
  };
  return s
    .split('')
    .map((ch) => map[ch] ?? ch)
    .join('')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '')
    .slice(0, 40);
}

function emailForPerson(firstName: string, lastName: string, sicil: string): string {
  const base = `${trAsciiSlug(firstName)}.${trAsciiSlug(lastName)}.${sicil.slice(-4)}`;
  return `${base}@${EMAIL_DOMAIN}`.toLowerCase();
}

function randomPick<T>(arr: T[], seed: number): T {
  return arr[Math.abs(seed) % arr.length]!;
}

function employeeTypeForIndex(i: number): 'WHITE_COLLAR' | 'BLUE_COLLAR' | 'INTERN' {
  const r = i % 100;
  if (r < 5) return 'INTERN';
  if (r < 30) return 'BLUE_COLLAR';
  return 'WHITE_COLLAR';
}

type MasterIds = {
  companyId: string;
  locationIds: string[];
  departmentIds: string[];
  positionIds: string[];
  levelIds: string[];
  teamIds: string[];
  workAreaIds: string[];
  workSubAreaIds: string[];
};

async function ensureYildizMasterData(): Promise<MasterIds> {
  let company = await prisma.company.findUnique({ where: { code: COMPANY_CODE } });
  if (!company) {
    company = await prisma.company.create({
      data: {
        code: COMPANY_CODE,
        name: 'Yıldız Holding A.Ş.',
      },
    });
  }

  const locationsSeed = [
    { code: 'YILDIZ-HQ', name: 'Gayrettepe Genel Merkez' },
    { code: 'YILDIZ-GEBZE', name: 'Gebze Üretim Kampüsü' },
    { code: 'YILDIZ-BURSA', name: 'Bursa Fabrika' },
    { code: 'YILDIZ-MALATYA', name: 'Malatya Gıda Tesisi' },
    { code: 'YILDIZ-IZMIR', name: 'İzmir Bölge Müdürlüğü' },
    { code: 'YILDIZ-ANKARA', name: 'Ankara Bölge Müdürlüğü' },
    { code: 'YILDIZ-ANTALYA', name: 'Antalya Lojistik Merkezi' },
    { code: 'YILDIZ-TRABZON', name: 'Trabzon Paketleme' },
  ] as const;

  const locationIds: string[] = [];
  for (const loc of locationsSeed) {
    const existing = await prisma.location.findUnique({ where: { code: loc.code } });
    if (existing) {
      locationIds.push(existing.id);
    } else {
      const row = await prisma.location.create({
        data: { code: loc.code, name: loc.name, companyId: company.id },
      });
      locationIds.push(row.id);
    }
  }

  const departmentsSeed = [
    { code: 'YILDIZ-IK', name: 'İnsan Kaynakları' },
    { code: 'YILDIZ-FIN', name: 'Finans ve Mali İşler' },
    { code: 'YILDIZ-BTI', name: 'Bilgi Teknolojileri' },
    { code: 'YILDIZ-URE', name: 'Üretim' },
    { code: 'YILDIZ-KAL', name: 'Kalite ve Süreç İyileştirme' },
    { code: 'YILDIZ-MUH', name: 'Mühendislik' },
    { code: 'YILDIZ-SAT', name: 'Satış' },
    { code: 'YILDIZ-LOJ', name: 'Lojistik ve Tedarik Zinciri' },
    { code: 'YILDIZ-SAT-AL', name: 'Satınalma' },
    { code: 'YILDIZ-HUK', name: 'Hukuk ve Uyum' },
    { code: 'YILDIZ-ARGE', name: 'Ar-Ge' },
    { code: 'YILDIZ-PAZ', name: 'Pazarlama ve İletişim' },
  ] as const;

  const departmentIds: string[] = [];
  for (const dep of departmentsSeed) {
    const existing = await prisma.department.findUnique({ where: { code: dep.code } });
    if (existing) {
      departmentIds.push(existing.id);
    } else {
      const row = await prisma.department.create({ data: { code: dep.code, name: dep.name } });
      departmentIds.push(row.id);
    }
  }

  const levelsSeed = [
    { code: 'YILDIZ-L1', name: 'Genel Müdür Yardımcısı' },
    { code: 'YILDIZ-L2', name: 'Direktör' },
    { code: 'YILDIZ-L3', name: 'Müdür' },
    { code: 'YILDIZ-L4', name: 'Müdür Yardımcısı' },
    { code: 'YILDIZ-L5', name: 'Kıdemli Uzman' },
    { code: 'YILDIZ-L6', name: 'Uzman' },
    { code: 'YILDIZ-L7', name: 'Uzman Yardımcısı' },
    { code: 'YILDIZ-L8', name: 'Operasyonel Personel' },
  ] as const;

  const levelIds: string[] = [];
  for (const lv of levelsSeed) {
    const existing = await prisma.level.findUnique({ where: { code: lv.code } });
    if (existing) {
      levelIds.push(existing.id);
    } else {
      const row = await prisma.level.create({ data: { code: lv.code, name: lv.name } });
      levelIds.push(row.id);
    }
  }

  const positionsSeed = [
    { code: 'YILDIZ-P-IK', name: 'İK Uzmanı' },
    { code: 'YILDIZ-P-FIN', name: 'Finans Kontrolörü' },
    { code: 'YILDIZ-P-DEV', name: 'Yazılım Geliştirici' },
    { code: 'YILDIZ-P-OPS', name: 'Üretim Operatörü' },
    { code: 'YILDIZ-P-KAL', name: 'Kalite Mühendisi' },
    { code: 'YILDIZ-P-PRO', name: 'Proses Mühendisi' },
    { code: 'YILDIZ-P-SAT', name: 'Bölge Satış Temsilcisi' },
    { code: 'YILDIZ-P-LOJ', name: 'Depo Sorumlusu' },
    { code: 'YILDIZ-P-SA', name: 'Satınalma Uzmanı' },
    { code: 'YILDIZ-P-HUK', name: 'Hukuk Müşaviri' },
    { code: 'YILDIZ-P-AR', name: 'Ar-Ge Kimyageri' },
    { code: 'YILDIZ-P-PM', name: 'Ürün Müdürü' },
    { code: 'YILDIZ-P-PLN', name: 'Planlama Uzmanı' },
    { code: 'YILDIZ-P-BAK', name: 'Bakım Teknisyeni' },
    { code: 'YILDIZ-P-ELK', name: 'Elektrik Teknisyeni' },
    { code: 'YILDIZ-P-ISG', name: 'İSG Uzmanı' },
    { code: 'YILDIZ-P-LOJ2', name: 'Sevkiyat Şefi' },
    { code: 'YILDIZ-P-DAT', name: 'Veri Analisti' },
    { code: 'YILDIZ-P-DON', name: 'Donanım Uzmanı' },
    { code: 'YILDIZ-P-STJ', name: 'Stajyer' },
  ] as const;

  const positionIds: string[] = [];
  for (const p of positionsSeed) {
    const existing = await prisma.position.findUnique({ where: { code: p.code } });
    if (existing) {
      positionIds.push(existing.id);
    } else {
      const row = await prisma.position.create({ data: { code: p.code, name: p.name } });
      positionIds.push(row.id);
    }
  }

  const teamsSeed = [
    { code: 'YILDIZ-T-KAIZEN', name: 'Kaizen Takımı' },
    { code: 'YILDIZ-T-OTOM', name: 'Otomasyon Takımı' },
    { code: 'YILDIZ-T-ERP', name: 'ERP ve Süreç' },
    { code: 'YILDIZ-T-URE-A', name: 'Üretim Hattı A' },
    { code: 'YILDIZ-T-URE-B', name: 'Üretim Hattı B' },
    { code: 'YILDIZ-T-KAL-LAB', name: 'Kalite Laboratuvarı' },
    { code: 'YILDIZ-T-LOJ-GECE', name: 'Gece Vardiyası Lojistik' },
    { code: 'YILDIZ-T-SAT-MAR', name: 'Marmara Satış' },
    { code: 'YILDIZ-T-SAT-EGE', name: 'Ege Satış' },
    { code: 'YILDIZ-T-ARGE-GID', name: 'Gıda Ar-Ge' },
    { code: 'YILDIZ-T-BTI-GUV', name: 'Siber Güvenlik' },
    { code: 'YILDIZ-T-IK-ODUL', name: 'Ödül ve Yan Haklar' },
    { code: 'YILDIZ-T-FIN-RAP', name: 'Konsolidasyon Raporlama' },
    { code: 'YILDIZ-T-PAZ-DIJ', name: 'Dijital Pazarlama' },
    { code: 'YILDIZ-T-MUH-MEX', name: 'Mekanik Tasarım' },
  ] as const;

  const teamIds: string[] = [];
  for (const t of teamsSeed) {
    const existing = await prisma.team.findUnique({ where: { code: t.code } });
    if (existing) {
      teamIds.push(existing.id);
    } else {
      const row = await prisma.team.create({ data: { code: t.code, name: t.name } });
      teamIds.push(row.id);
    }
  }

  const workAreasSeed = [
    { code: 'YILDIZ-WA-FAB', name: 'Fabrika ve Üretim' },
    { code: 'YILDIZ-WA-OFIS', name: 'Ofis ve Yönetim' },
    { code: 'YILDIZ-WA-DEPO', name: 'Depo ve Sevkiyat' },
  ] as const;

  const workAreaIds: string[] = [];
  for (const wa of workAreasSeed) {
    const existing = await prisma.workArea.findUnique({ where: { code: wa.code } });
    if (existing) {
      workAreaIds.push(existing.id);
    } else {
      const row = await prisma.workArea.create({ data: { code: wa.code, name: wa.name } });
      workAreaIds.push(row.id);
    }
  }

  const subSeed = [
    { code: 'YILDIZ-WS-HAT1', name: 'Üretim Hattı 1', parent: 'YILDIZ-WA-FAB' as const },
    { code: 'YILDIZ-WS-HAT2', name: 'Üretim Hattı 2', parent: 'YILDIZ-WA-FAB' as const },
    { code: 'YILDIZ-WS-KAL', name: 'Kalite İstasyonu', parent: 'YILDIZ-WA-FAB' as const },
    { code: 'YILDIZ-WS-YON', name: 'Yönetim Katı', parent: 'YILDIZ-WA-OFIS' as const },
    { code: 'YILDIZ-WS-ORT', name: 'Açık Ofis Alanı', parent: 'YILDIZ-WA-OFIS' as const },
    { code: 'YILDIZ-WS-DEPO-A', name: 'Soğuk Hava Deposu A', parent: 'YILDIZ-WA-DEPO' as const },
    { code: 'YILDIZ-WS-DEPO-B', name: 'Kuru Depo B', parent: 'YILDIZ-WA-DEPO' as const },
  ] as const;

  const workSubAreaIds: string[] = [];
  for (const ws of subSeed) {
    const existing = await prisma.workSubArea.findUnique({ where: { code: ws.code } });
    if (existing) {
      workSubAreaIds.push(existing.id);
    } else {
      const row = await prisma.workSubArea.create({
        data: {
          code: ws.code,
          name: ws.name,
          parentWorkAreaCode: ws.parent,
        },
      });
      workSubAreaIds.push(row.id);
    }
  }

  return {
    companyId: company.id,
    locationIds,
    departmentIds,
    positionIds,
    levelIds,
    teamIds,
    workAreaIds,
    workSubAreaIds,
  };
}

async function removeExistingYildizUsers(): Promise<void> {
  const company = await prisma.company.findUnique({
    where: { code: COMPANY_CODE },
    select: { id: true },
  });
  if (!company) return;

  const yildizUsers = await prisma.user.findMany({
    where: { companyId: company.id },
    select: { id: true },
  });
  const ids = yildizUsers.map((u) => u.id);
  if (ids.length === 0) return;

  await prisma.user.updateMany({
    where: { managerUserId: { in: ids } },
    data: { managerUserId: null },
  });

  await prisma.user.deleteMany({ where: { companyId: company.id } });
}

async function main(): Promise<void> {
  const piiKey = requireEnv32Hex('APP_PII_ENCRYPTION_KEY');
  const pepper = requireEnv32Hex('APP_PII_PEPPER');
  const pepperHex = process.env.APP_PII_PEPPER!;

  const countRaw = process.env.YILDIZ_BULK_USER_COUNT;
  const bulkCount = Math.min(
    50000,
    Math.max(1, countRaw ? Number.parseInt(countRaw, 10) : DEFAULT_BULK_COUNT),
  );
  if (!Number.isFinite(bulkCount)) {
    throw new Error('YILDIZ_BULK_USER_COUNT geçersiz');
  }

  if (process.env.YILDIZ_BULK_REPLACE === '1') {
    console.log('YILDIZ_BULK_REPLACE=1 — mevcut YILDIZ şirketi kullanıcıları siliniyor...');
    await removeExistingYildizUsers();
  }

  const master = await ensureYildizMasterData();

  const existingYildizCount = await prisma.user.count({
    where: { companyId: master.companyId },
  });
  if (existingYildizCount > 0 && process.env.YILDIZ_BULK_REPLACE !== '1') {
    if (existingYildizCount === bulkCount) {
      console.log(
        `YILDIZ şirketinde zaten ${bulkCount} kullanıcı var. Atlanıyor. Yeniden yüklemek için YILDIZ_BULK_REPLACE=1 kullanın.`,
      );
      return;
    }
    throw new Error(
      `YILDIZ şirketinde ${existingYildizCount} kullanıcı var; hedef ${bulkCount}. ` +
        `Kısmi/yarım veri — YILDIZ_BULK_REPLACE=1 ile silip baştan yükleyin veya hedef sayıyı mevcutla eşleştirin.`,
    );
  }

  const bulkPassword = process.env.YILDIZ_BULK_USER_PASSWORD ?? 'YildizBulkDev123!@#';
  const passwordHash = await bcrypt.hash(bulkPassword, BCRYPT_COST);

  const publishedConsent = await prisma.consentVersion.findFirst({
    where: { status: 'PUBLISHED' },
    orderBy: { version: 'desc' },
  });

  const rows: Prisma.UserCreateManyInput[] = [];
  const hireBase = new Date('2014-06-01T00:00:00.000Z').getTime();

  for (let i = 1; i <= bulkCount; i += 1) {
    const sicil = sicilForIndex(i);
    const firstName = randomPick(FIRST_NAMES, i * 17);
    const lastName = randomPick(LAST_NAMES, i * 31);
    const email = emailForPerson(firstName, lastName, sicil);

    const sicilEnc = encryptAes256GcmDeterministic(sicil, piiKey, 'user:sicil:v1');
    const sicilBlind = hmacBlindIndexHex(sicil, pepper);
    const emailNorm = email.toLowerCase();
    const emailEnc = encryptAes256GcmDeterministic(emailNorm, piiKey, 'user:email:v1');
    const emailBlind = hmacBlindIndexHex(emailNorm, pepper);

    const hasPhone = i % 10 !== 0;
    let phoneEncrypted: Buffer | null = null;
    let phoneDek: Buffer | null = null;
    if (hasPhone) {
      const digits = `5${(300000000 + ((i * 7919) % 699999999)).toString().padStart(9, '0')}`.slice(
        0,
        10,
      );
      const { ciphertext, dek } = encryptAes256GcmProbabilistic(digits);
      phoneEncrypted = ciphertext;
      phoneDek = dek;
    }

    const hireDate = new Date(hireBase + i * 3600_000);

    rows.push({
      sicilEncrypted: bufferToPrismaBytes(sicilEnc),
      sicilBlindIndex: sicilBlind,
      firstName,
      lastName,
      emailEncrypted: bufferToPrismaBytes(emailEnc),
      emailBlindIndex: emailBlind,
      phoneEncrypted: phoneEncrypted ? bufferToPrismaBytes(phoneEncrypted) : null,
      phoneDek: phoneDek ? bufferToPrismaBytes(phoneDek) : null,
      passwordHash,
      employeeType: employeeTypeForIndex(i),
      companyId: master.companyId,
      locationId: randomPick(master.locationIds, i * 7),
      departmentId: randomPick(master.departmentIds, i * 11),
      positionId: randomPick(master.positionIds, i * 13),
      levelId: randomPick(master.levelIds, i * 3),
      teamId: i % 5 === 0 ? null : randomPick(master.teamIds, i * 19),
      workAreaId: randomPick(master.workAreaIds, i * 23),
      workSubAreaId: i % 8 === 0 ? null : randomPick(master.workSubAreaIds, i * 29),
      hireDate,
      isActive: i % 37 !== 0,
      passwordChangedAt: new Date(),
    });
  }

  const chunkSize = 200;
  for (let offset = 0; offset < rows.length; offset += chunkSize) {
    const chunk = rows.slice(offset, offset + chunkSize);
    await prisma.user.createMany({ data: chunk });
  }

  const ordered = await prisma.user.findMany({
    where: { companyId: master.companyId },
    orderBy: { hireDate: 'asc' },
    select: { id: true },
    take: bulkCount,
  });

  const managerPoolSize = Math.min(50, Math.max(10, Math.floor(ordered.length / 20)));
  const managerIds = ordered.slice(0, managerPoolSize).map((u) => u.id);

  const batch = 100;
  for (let idx = managerPoolSize; idx < ordered.length; idx += batch) {
    const slice = ordered.slice(idx, idx + batch);
    await prisma.$transaction(
      slice.map((row, j) => {
        const uid = row.id;
        const globalIdx = idx + j;
        const mgr = managerIds[globalIdx % managerIds.length]!;
        return prisma.user.update({
          where: { id: uid },
          data: { managerUserId: mgr },
        });
      }),
    );
  }

  if (publishedConsent) {
    const userIds = ordered.map((u) => u.id);
    const consentRows: Prisma.UserConsentCreateManyInput[] = userIds.map((userId) => ({
      userId,
      consentVersionId: publishedConsent.id,
      ipHash: createHash('sha256').update(`yildiz-bulk:${userId}`).digest('hex'),
      userAgent: 'seed-yildiz-holding-bulk',
      signature: createHash('sha256')
        .update(`${userId}:${publishedConsent.id}:${pepperHex}`)
        .digest('hex'),
    }));
    for (let offset = 0; offset < consentRows.length; offset += chunkSize) {
      await prisma.userConsent.createMany({
        data: consentRows.slice(offset, offset + chunkSize),
        skipDuplicates: true,
      });
    }
  }

  console.log('Yıldız Holding bulk seed tamamlandı.');
  console.log(`  Şirket kodu: ${COMPANY_CODE}`);
  console.log(`  Kullanıcı sayısı: ${bulkCount}`);
  console.log(`  E-posta alanı: @${EMAIL_DOMAIN}`);
  console.log(`  Sicil aralığı: ${sicilForIndex(1)} – ${sicilForIndex(bulkCount)}`);
  console.log(`  Ortak test şifresi (yalnızca dev): ${bulkPassword}`);
  if (!publishedConsent) {
    console.log(
      '  Uyarı: Yayınlanmış rıza sürümü yok; kullanıcı rıza kaydı oluşturulmadı. Önce ana seed çalıştırın.',
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
