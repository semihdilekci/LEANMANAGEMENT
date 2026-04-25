'use client';

import { useEffect, useRef, useState } from 'react';

import { useRoleListQuery } from '@/lib/queries/roles';

type UserRoleAssignDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Henüz doğrudan atanmamış roller (bunlardan biri seçilir) */
  availableRoleOptions: { id: string; code: string; name: string }[];
  onConfirm: (roleId: string) => void | Promise<void>;
  isSubmitting: boolean;
};

/**
 * S-USER-ROLES — “Yeni Rol Ata” (docs/06_SCREEN_CATALOG) — natif dialog.
 */
export function UserRoleAssignDialog({
  open,
  onOpenChange,
  availableRoleOptions,
  onConfirm,
  isSubmitting,
}: UserRoleAssignDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const [roleId, setRoleId] = useState('');

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open) {
      if (!el.open) el.showModal();
    } else if (el.open) {
      el.close();
    }
  }, [open]);

  useEffect(() => {
    if (open) setRoleId('');
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="max-w-md rounded-[var(--radius-md)] border border-[var(--color-neutral-200)] bg-[var(--color-neutral-0)] p-[var(--space-5)] shadow-lg backdrop:bg-black/40"
      onClose={() => onOpenChange(false)}
      onCancel={(e) => {
        e.preventDefault();
        onOpenChange(false);
      }}
    >
      <h2
        id="user-role-assign-title"
        className="text-lg font-semibold text-[var(--color-neutral-900)]"
      >
        Yeni rol ata
      </h2>
      <p className="mt-1 text-sm text-[var(--color-neutral-600)]">
        Seçilen rol kullanıcıya doğrudan atanır. Zaten atandığı roller listelenmez.
      </p>
      <div className="mt-4">
        <label htmlFor="user-role-pick" className="text-sm text-[var(--color-neutral-700)]">
          Rol
        </label>
        <select
          id="user-role-pick"
          className="ls-input mt-1 w-full"
          value={roleId}
          onChange={(e) => setRoleId(e.target.value)}
          required
        >
          <option value="">— Seçin —</option>
          {availableRoleOptions.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name} ({r.code})
            </option>
          ))}
        </select>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          className="ls-btn ls-btn--neutral ls-btn--sm"
          onClick={() => onOpenChange(false)}
        >
          Vazgeç
        </button>
        <button
          type="button"
          className="ls-btn ls-btn--primary ls-btn--sm"
          disabled={!roleId || isSubmitting}
          onClick={async () => {
            if (!roleId) return;
            await onConfirm(roleId);
            onOpenChange(false);
          }}
        >
          {isSubmitting ? 'Atanıyor…' : 'Ata'}
        </button>
      </div>
    </dialog>
  );
}

/** Tüm roller + istemci tarafında atanan doğrudan rolleri düşmek */
export function useRoleOptionsForUserAssign(assignedDirectRoleIds: Set<string>) {
  const { data: all, isLoading } = useRoleListQuery({ isActive: 'true' });
  const options = (all ?? [])
    .filter((r) => r.isActive && !assignedDirectRoleIds.has(r.id))
    .map((r) => ({ id: r.id, code: r.code, name: r.name }));
  return { options, isLoading };
}
