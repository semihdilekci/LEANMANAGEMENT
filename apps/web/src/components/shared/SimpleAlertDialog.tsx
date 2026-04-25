'use client';

import { useEffect, useRef } from 'react';

export interface SimpleAlertDialogProps {
  open: boolean;
  title: string;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

/** Bilgilendirme — yalnız Tamam; native dialog. */
export function SimpleAlertDialog({ open, title, onOpenChange, children }: SimpleAlertDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open) {
      if (!el.open) el.showModal();
    } else if (el.open) {
      el.close();
    }
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
      <h2 className="text-lg font-semibold text-[var(--color-neutral-900)]">{title}</h2>
      <div className="mt-3 text-sm text-[var(--color-neutral-700)]">{children}</div>
      <div className="mt-4 flex justify-end">
        <button
          type="button"
          className="ls-btn ls-btn--primary ls-btn--sm"
          onClick={() => onOpenChange(false)}
        >
          Tamam
        </button>
      </div>
    </dialog>
  );
}
