import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { AuditChainIntegrityPanel } from '@/components/admin/AuditChainIntegrityPanel';

const hoisted = vi.hoisted(() => {
  const mutateAsync = vi.fn().mockResolvedValue({
    lastCheckAt: '2026-01-01T00:00:00.000Z',
    totalRecordsChecked: 10,
    chainIntact: true,
    firstBrokenAt: null,
    firstBrokenRecordId: null,
    nextScheduledCheckAt: '2026-01-02T00:00:00.000Z',
  });
  const toastSuccess = vi.fn();
  return { mutateAsync, toastSuccess };
});

vi.mock('@/lib/queries/admin-audit-logs', () => ({
  useAuditChainIntegrityQuery: () => ({
    data: {
      lastCheckAt: '2026-01-01T00:00:00.000Z',
      totalRecordsChecked: 42,
      chainIntact: true,
      firstBrokenAt: null,
      firstBrokenRecordId: null,
      nextScheduledCheckAt: '2026-01-02T00:00:00.000Z',
    },
    isPending: false,
    error: null,
    refetch: vi.fn(),
  }),
  useVerifyAuditChainMutation: () => ({
    mutateAsync: hoisted.mutateAsync,
    isPending: false,
  }),
}));

vi.mock('sonner', () => ({
  toast: { success: hoisted.toastSuccess, error: vi.fn() },
}));

vi.mock('@/components/shared/PermissionGate', () => ({
  PermissionGate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('AuditChainIntegrityPanel', () => {
  it('özet metni ve doğrula tetiklemesi', async () => {
    const user = userEvent.setup();
    render(<AuditChainIntegrityPanel showDetailLink={false} />);
    expect(screen.getByText(/Sağlam/)).toBeTruthy();
    expect(screen.getByText(/Taranan kayıt:\s*42/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Şimdi doğrula' }));
    expect(hoisted.mutateAsync).toHaveBeenCalledTimes(1);
    expect(hoisted.toastSuccess).toHaveBeenCalled();
  });
});
