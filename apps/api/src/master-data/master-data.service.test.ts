import { describe, it, expect, vi } from 'vitest';

import { MasterDataService } from './master-data.service.js';
import {
  MasterDataCodeDuplicateException,
  MasterDataCodeImmutableException,
  MasterDataInUseByUsersException,
  MasterDataParentInactiveException,
  MasterDataRecordNotFoundException,
  MasterDataUnknownTypeException,
} from './master-data.exceptions.js';

function makeActor(id = 'actor-1') {
  return { id, sessionId: 'sess-1', jti: 'jti-1' };
}

function makeService(prismaOverrides?: Record<string, unknown>) {
  const prisma = {
    company: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn().mockResolvedValue(0),
    },
    workArea: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn().mockResolvedValue(0),
    },
    workSubArea: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn().mockResolvedValue(0),
    },
    user: {
      count: vi.fn().mockResolvedValue(0),
      findMany: vi.fn().mockResolvedValue([]),
    },
    $transaction: vi
      .fn()
      .mockImplementation(async (fn: (tx: unknown) => Promise<void>) => fn(prisma)),
    ...prismaOverrides,
  };
  const audit = { append: vi.fn() };
  const encryption = {
    decryptSicil: vi.fn().mockReturnValue('12345678'),
    decryptEmail: vi.fn().mockReturnValue('u@example.com'),
  };
  return {
    service: new MasterDataService(prisma as never, audit as never, encryption as never),
    prisma,
    audit,
    encryption,
  };
}

describe('MasterDataService — type validation', () => {
  it('geçersiz type → MasterDataUnknownTypeException', async () => {
    const { service } = makeService();
    await expect(
      service.findAll('invalid-type', { isActive: 'all', search: undefined, usageFilter: 'all' }),
    ).rejects.toBeInstanceOf(MasterDataUnknownTypeException);
  });
});

describe('MasterDataService — create', () => {
  it('duplicate code → MasterDataCodeDuplicateException', async () => {
    const { service, prisma } = makeService();
    (prisma.company.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'existing' });

    await expect(
      service.create('companies', { code: 'ABC', name: 'ABC Şirketi' }, makeActor()),
    ).rejects.toBeInstanceOf(MasterDataCodeDuplicateException);
  });

  it('work-sub-areas parent yok → MasterDataRecordNotFoundException', async () => {
    const { service, prisma } = makeService();
    (prisma.workSubArea.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (prisma.workArea.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    await expect(
      service.create(
        'work-sub-areas',
        { code: 'LINE1', name: 'Hat 1', parentWorkAreaCode: 'UNKNOWN' },
        makeActor(),
      ),
    ).rejects.toBeInstanceOf(MasterDataRecordNotFoundException);
  });

  it('work-sub-areas parent pasif → MasterDataParentInactiveException', async () => {
    const { service, prisma } = makeService();
    (prisma.workSubArea.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (prisma.workArea.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'wa-1',
      isActive: false,
    });

    await expect(
      service.create(
        'work-sub-areas',
        { code: 'LINE1', name: 'Hat 1', parentWorkAreaCode: 'ASSEMBLY' },
        makeActor(),
      ),
    ).rejects.toBeInstanceOf(MasterDataParentInactiveException);
  });
});

describe('MasterDataService — update', () => {
  it('code alani request bodyde gelirse MasterDataCodeImmutableException', async () => {
    const { service } = makeService();

    await expect(
      service.update('companies', 'id-1', { name: 'Yeni Ad', code: 'NEW' } as never, makeActor()),
    ).rejects.toBeInstanceOf(MasterDataCodeImmutableException);
  });

  it('kayıt yoksa → MasterDataRecordNotFoundException', async () => {
    const { service } = makeService();

    await expect(
      service.update('companies', 'nonexistent', { name: 'Yeni Ad' }, makeActor()),
    ).rejects.toBeInstanceOf(MasterDataRecordNotFoundException);
  });
});

describe('MasterDataService — deactivate', () => {
  it('aktif kullanıcı varsa → MasterDataInUseByUsersException', async () => {
    const { service, prisma } = makeService();
    (prisma.company.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'comp-1',
      code: 'ABC',
      isActive: true,
    });
    (prisma.user.count as ReturnType<typeof vi.fn>).mockResolvedValue(5);

    await expect(service.deactivate('companies', 'comp-1', makeActor())).rejects.toBeInstanceOf(
      MasterDataInUseByUsersException,
    );
  });

  it('kayıt yoksa → MasterDataRecordNotFoundException', async () => {
    const { service } = makeService();

    await expect(
      service.deactivate('companies', 'nonexistent', makeActor()),
    ).rejects.toBeInstanceOf(MasterDataRecordNotFoundException);
  });
});

describe('MasterDataService — reactivate', () => {
  it('work-sub-areas parent pasifse → MasterDataParentInactiveException', async () => {
    const { service, prisma } = makeService();
    (prisma.workSubArea.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'wsa-1',
      code: 'LINE1',
      isActive: false,
      parentWorkAreaCode: 'ASSEMBLY',
    });
    (prisma.workArea.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ isActive: false });

    await expect(service.reactivate('work-sub-areas', 'wsa-1', makeActor())).rejects.toBeInstanceOf(
      MasterDataParentInactiveException,
    );
  });
});

describe('MasterDataService — getUsersForRecord', () => {
  it('sicil, email, position alanlarını ve anonim null değerlerini döndürür', async () => {
    const { service, prisma, encryption } = makeService();
    const encBuf = Buffer.from('x');
    (prisma.company.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'c1' });
    (prisma.user.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: 'u1',
        firstName: 'A',
        lastName: 'B',
        sicilEncrypted: encBuf,
        emailEncrypted: encBuf,
        anonymizedAt: null,
        isActive: true,
        position: { code: 'P1', name: 'Pozisyon' },
      },
      {
        id: 'u2',
        firstName: 'C',
        lastName: 'D',
        sicilEncrypted: encBuf,
        emailEncrypted: encBuf,
        anonymizedAt: new Date(),
        isActive: true,
        position: null,
      },
    ]);

    const result = await service.getUsersForRecord('companies', 'c1', {
      limit: 20,
      cursor: undefined,
    });

    expect(encryption.decryptSicil).toHaveBeenCalled();
    expect(encryption.decryptEmail).toHaveBeenCalled();
    expect(result.items[0]).toEqual({
      id: 'u1',
      firstName: 'A',
      lastName: 'B',
      sicil: '12345678',
      email: 'u@example.com',
      position: { code: 'P1', name: 'Pozisyon' },
      isActive: true,
    });
    expect(result.items[1]).toMatchObject({
      id: 'u2',
      sicil: null,
      email: null,
      position: null,
    });
    expect(result.pagination.hasMore).toBe(false);
  });
});
