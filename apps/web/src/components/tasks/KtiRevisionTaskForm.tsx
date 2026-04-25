'use client';

import { useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { isAxiosError } from 'axios';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { KtiStartBodySchema, type KtiStartInput } from '@leanmgmt/shared-schemas';
import { Permission } from '@leanmgmt/shared-types';

import { DocumentUpload } from '@/components/documents/DocumentUpload';
import { PermissionGate } from '@/components/shared/PermissionGate';
import { useUnsavedChangesWarning } from '@/hooks/useUnsavedChangesWarning';
import { useMasterDataListQuery } from '@/lib/queries/master-data';
import type { TaskDetail } from '@/lib/queries/tasks';
import { useTaskCompleteMutation } from '@/lib/queries/tasks';
import { useAuthStore } from '@/stores/auth-store';

export function KtiRevisionTaskForm({ task }: { task: TaskDetail }) {
  const router = useRouter();
  const user = useAuthStore((s) => s.currentUser);
  const complete = useTaskCompleteMutation(task.id, task.process.displayId);
  const { data: companiesData, isLoading: companiesLoading } = useMasterDataListQuery('companies', {
    isActive: 'true',
  });
  const companies = companiesData?.items ?? [];
  const companiesForUser = useMemo(
    () => (user?.company?.id ? companies.filter((c) => c.id === user.company!.id) : companies),
    [companies, user?.company?.id],
  );
  const defaultCompanyId = task.process.company.id;

  const initial = (task.formData as Partial<KtiStartInput> | null | undefined) ?? {};

  const form = useForm<KtiStartInput>({
    resolver: zodResolver(KtiStartBodySchema),
    defaultValues: {
      companyId: initial.companyId ?? defaultCompanyId,
      beforePhotoDocumentIds: initial.beforePhotoDocumentIds ?? [],
      afterPhotoDocumentIds: initial.afterPhotoDocumentIds ?? [],
      savingAmount: initial.savingAmount ?? 0,
      description: initial.description ?? '',
    },
    mode: 'onChange',
  });

  useEffect(() => {
    if (defaultCompanyId && !form.getValues('companyId')) {
      form.setValue('companyId', defaultCompanyId);
    }
  }, [defaultCompanyId, form]);

  useUnsavedChangesWarning(form.formState.isDirty);

  const beforeIds = form.watch('beforePhotoDocumentIds');
  const afterIds = form.watch('afterPhotoDocumentIds');
  const description = form.watch('description');

  const onSubmit = async (values: KtiStartInput) => {
    try {
      await complete.mutateAsync({ formData: values });
      toast.success('Revize gönderildi');
      router.push(`/processes/${encodeURIComponent(task.process.displayId)}`);
    } catch (e) {
      if (isAxiosError(e)) {
        const code = e.response?.data?.error?.code as string | undefined;
        if (code === 'DOCUMENT_SCAN_PENDING' || e.response?.status === 425) {
          toast.error('Dokümanlar hâlâ taramada, lütfen bekleyin.');
          return;
        }
        if (code === 'DOCUMENT_INFECTED') {
          toast.error('Enfekte doküman var, kaldırın ve tekrar deneyin.');
          return;
        }
        toast.error(e.response?.data?.error?.message ?? 'Gönderilemedi.');
        return;
      }
      toast.error('Gönderilemedi.');
    }
  };

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="ls-card space-y-[var(--space-5)] p-[var(--space-5)]"
    >
      <p className="text-sm text-[var(--color-neutral-700)]">
        Yöneticinizin revize talebine göre formu güncelleyip yeniden gönderin.
      </p>

      <div>
        <label
          htmlFor="rev-company"
          className="mb-[var(--space-1)] block text-sm font-medium text-[var(--color-neutral-900)]"
        >
          Şirket <span className="text-[var(--color-error-600)]">*</span>
        </label>
        {companiesLoading ? (
          <p className="text-sm text-[var(--color-neutral-500)]" role="status">
            Şirketler yükleniyor…
          </p>
        ) : (
          <select
            id="rev-company"
            className="ls-input w-full max-w-md"
            {...form.register('companyId')}
          >
            <option value="">Şirket seçin</option>
            {companiesForUser.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.code})
              </option>
            ))}
          </select>
        )}
        {form.formState.errors.companyId ? (
          <p className="mt-1 text-sm text-[var(--color-error-700)]">
            {form.formState.errors.companyId.message}
          </p>
        ) : null}
      </div>

      <PermissionGate
        permission={Permission.DOCUMENT_UPLOAD}
        fallback={
          <div className="ls-alert ls-alert--danger text-sm" role="alert">
            Doküman yüklemek için <strong>DOCUMENT_UPLOAD</strong> yetkisi gerekir.
          </div>
        }
      >
        <DocumentUpload
          label="Öncesi fotoğraflar *"
          value={beforeIds}
          onChange={(ids) =>
            form.setValue('beforePhotoDocumentIds', ids, {
              shouldDirty: true,
              shouldValidate: true,
            })
          }
        />
        {form.formState.errors.beforePhotoDocumentIds ? (
          <p className="text-sm text-[var(--color-error-700)]">
            {form.formState.errors.beforePhotoDocumentIds.message as string}
          </p>
        ) : null}

        <DocumentUpload
          label="Sonrası fotoğraflar *"
          value={afterIds}
          onChange={(ids) =>
            form.setValue('afterPhotoDocumentIds', ids, { shouldDirty: true, shouldValidate: true })
          }
        />
        {form.formState.errors.afterPhotoDocumentIds ? (
          <p className="text-sm text-[var(--color-error-700)]">
            {form.formState.errors.afterPhotoDocumentIds.message as string}
          </p>
        ) : null}
      </PermissionGate>

      <div>
        <label
          htmlFor="rev-saving"
          className="mb-[var(--space-1)] block text-sm font-medium text-[var(--color-neutral-900)]"
        >
          Kazanç tutarı (TL) <span className="text-[var(--color-error-600)]">*</span>
        </label>
        <input
          id="rev-saving"
          type="number"
          min={0}
          step={1}
          className="ls-input max-w-xs"
          {...form.register('savingAmount', { valueAsNumber: true })}
        />
        {form.formState.errors.savingAmount ? (
          <p className="mt-1 text-sm text-[var(--color-error-700)]">
            {form.formState.errors.savingAmount.message}
          </p>
        ) : null}
      </div>

      <div>
        <label
          htmlFor="rev-desc"
          className="mb-[var(--space-1)] block text-sm font-medium text-[var(--color-neutral-900)]"
        >
          Açıklama <span className="text-[var(--color-error-600)]">*</span>
        </label>
        <textarea
          id="rev-desc"
          rows={6}
          maxLength={5000}
          className="ls-input min-h-[8rem] w-full"
          aria-describedby="rev-desc-count"
          {...form.register('description')}
        />
        <p id="rev-desc-count" className="mt-1 text-xs text-[var(--color-neutral-500)]">
          {description.length} / 5000
        </p>
        {form.formState.errors.description ? (
          <p className="mt-1 text-sm text-[var(--color-error-700)]">
            {form.formState.errors.description.message}
          </p>
        ) : null}
      </div>

      <div className="flex justify-end">
        <button type="submit" className="ls-btn ls-btn--primary" disabled={complete.isPending}>
          {complete.isPending ? 'Gönderiliyor…' : 'Yeniden Gönder'}
        </button>
      </div>
    </form>
  );
}
