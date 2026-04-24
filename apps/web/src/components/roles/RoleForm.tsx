'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { useCreateRoleMutation } from '@/lib/queries/roles';

interface FormValues {
  code: string;
  name: string;
  description: string;
}

export function RoleForm() {
  const router = useRouter();
  const createMutation = useCreateRoleMutation();
  const [formError, setFormError] = useState<string | null>(null);
  const { register, handleSubmit } = useForm<FormValues>({
    defaultValues: { code: '', name: '', description: '' },
  });

  const onSubmit = async (data: FormValues) => {
    setFormError(null);
    try {
      const created = await createMutation.mutateAsync({
        code: data.code.trim().toUpperCase(),
        name: data.name.trim(),
        description: data.description.trim() || undefined,
      });
      router.push(`/roles/${created.id}`);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: { message?: string } } } };
      setFormError(err.response?.data?.error?.message ?? 'Rol oluşturulamadı.');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mx-auto max-w-xl space-y-[var(--space-4)]">
      <div>
        <label
          htmlFor="role-code"
          className="mb-1 block text-sm font-medium text-[var(--color-neutral-700)]"
        >
          Rol kodu *
        </label>
        <input
          id="role-code"
          className="ls-input w-full font-mono"
          {...register('code', { required: true })}
        />
        <p className="mt-1 text-xs text-[var(--color-neutral-500)]">
          Örn. KTI_INITIATOR — büyük harf, rakam ve _
        </p>
      </div>
      <div>
        <label
          htmlFor="role-name"
          className="mb-1 block text-sm font-medium text-[var(--color-neutral-700)]"
        >
          Ad *
        </label>
        <input
          id="role-name"
          className="ls-input w-full"
          {...register('name', { required: true })}
        />
      </div>
      <div>
        <label
          htmlFor="role-desc"
          className="mb-1 block text-sm font-medium text-[var(--color-neutral-700)]"
        >
          Açıklama
        </label>
        <textarea
          id="role-desc"
          className="ls-input min-h-[5rem] w-full"
          {...register('description')}
        />
      </div>
      {formError ? (
        <p role="alert" className="text-sm text-[var(--color-error-600)]">
          {formError}
        </p>
      ) : null}
      <div className="flex gap-2">
        <button
          type="submit"
          className="ls-btn ls-btn--primary"
          disabled={createMutation.isPending}
        >
          {createMutation.isPending ? 'Kaydediliyor…' : 'Oluştur'}
        </button>
        <button
          type="button"
          className="ls-btn ls-btn--neutral"
          onClick={() => router.push('/roles')}
        >
          Vazgeç
        </button>
      </div>
    </form>
  );
}
