'use client';

import { useEffect, useRef } from 'react';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** true: kırmızı birincil buton (silme / hassas onay) */
  destructive?: boolean;
  confirmDisabled?: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void | Promise<void>;
  children?: React.ReactNode;
}

/**
 * Radix yok — native dialog; odak yönetimi ve ESC için showModal kullanımı.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Onayla',
  cancelLabel = 'Vazgeç',
  destructive,
  confirmDisabled,
  onOpenChange,
  onConfirm,
  children,
}: ConfirmDialogProps) {
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
      className="max-w-lg rounded-[var(--radius-md)] border border-[var(--color-neutral-200)] bg-[var(--color-neutral-0)] p-[var(--space-5)] shadow-lg backdrop:bg-black/40"
      onClose={() => onOpenChange(false)}
      onCancel={(e) => {
        e.preventDefault();
        onOpenChange(false);
      }}
    >
      <div className="space-y-[var(--space-3)]">
        <h2
          id="confirm-dialog-title"
          className="text-lg font-semibold text-[var(--color-neutral-900)]"
        >
          {title}
        </h2>
        {description ? (
          <p className="text-sm text-[var(--color-neutral-600)]">{description}</p>
        ) : null}
        {children}
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            className="ls-btn ls-btn--neutral ls-btn--sm"
            onClick={() => onOpenChange(false)}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={confirmDisabled}
            className={
              destructive
                ? 'ls-btn ls-btn--sm border border-[var(--color-error-600)] bg-[var(--color-error-50)] text-[var(--color-error-800)] hover:bg-[var(--color-error-100)]'
                : 'ls-btn ls-btn--primary ls-btn--sm'
            }
            onClick={() => {
              void (async () => {
                try {
                  await onConfirm();
                  onOpenChange(false);
                } catch {
                  /* hata üst bileşende; dialog açık kalsın */
                }
              })();
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
