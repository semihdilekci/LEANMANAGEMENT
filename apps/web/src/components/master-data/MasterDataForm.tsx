'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import {
  CreateMasterDataSchema,
  UpdateMasterDataSchema,
  type CreateMasterDataInput,
  type UpdateMasterDataInput,
} from '@leanmgmt/shared-schemas';
import type { MasterDataType } from '@leanmgmt/shared-schemas';

import {
  MASTER_DATA_TYPE_LABELS,
  useAllMasterDataQuery,
  useCreateMasterDataMutation,
  useUpdateMasterDataMutation,
  type MasterDataItem,
} from '@/lib/queries/master-data';

interface MasterDataCreateFormProps {
  type: MasterDataType;
}

export function MasterDataCreateForm({ type }: MasterDataCreateFormProps) {
  const router = useRouter();
  const isWorkSubArea = type === 'work-sub-areas';
  const { data: workAreas } = useAllMasterDataQuery('work-areas');
  const createMutation = useCreateMasterDataMutation(type);
  const typeName = MASTER_DATA_TYPE_LABELS[type] ?? type;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateMasterDataInput>({ resolver: zodResolver(CreateMasterDataSchema) });

  const onSubmit = async (data: CreateMasterDataInput) => {
    try {
      const created = await createMutation.mutateAsync(data);
      toast.success(`${typeName} kaydı oluşturuldu`);
      router.push(`/master-data/${type}/${(created as MasterDataItem).id}`);
    } catch {
      toast.error('İşlem başarısız. Lütfen tekrar deneyin.');
    }
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-[var(--space-5)]"
      aria-label={`Yeni ${typeName} formu`}
      noValidate
    >
      <div>
        <label htmlFor="code" className="block text-sm font-medium text-[var(--color-neutral-700)]">
          Kod <span aria-hidden>*</span>
        </label>
        <input
          id="code"
          type="text"
          aria-required="true"
          aria-invalid={!!errors.code}
          aria-describedby={errors.code ? 'code-error' : 'code-hint'}
          className="ls-input mt-[var(--space-1)] w-full"
          {...register('code')}
        />
        <p id="code-hint" className="mt-[var(--space-1)] text-xs text-[var(--color-neutral-500)]">
          2-32 karakter. Oluşturulduktan sonra değiştirilemez.
        </p>
        {errors.code && (
          <p
            id="code-error"
            role="alert"
            className="mt-[var(--space-1)] text-xs text-[var(--color-error-600)]"
          >
            {errors.code.message}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="name" className="block text-sm font-medium text-[var(--color-neutral-700)]">
          Ad <span aria-hidden>*</span>
        </label>
        <input
          id="name"
          type="text"
          aria-required="true"
          aria-invalid={!!errors.name}
          className="ls-input mt-[var(--space-1)] w-full"
          {...register('name')}
        />
        {errors.name && (
          <p role="alert" className="mt-[var(--space-1)] text-xs text-[var(--color-error-600)]">
            {errors.name.message}
          </p>
        )}
      </div>

      {isWorkSubArea && (
        <div>
          <label
            htmlFor="parentWorkAreaCode"
            className="block text-sm font-medium text-[var(--color-neutral-700)]"
          >
            Üst Çalışma Alanı <span aria-hidden>*</span>
          </label>
          <select
            id="parentWorkAreaCode"
            aria-required="true"
            className="ls-input mt-[var(--space-1)] w-full"
            {...register('parentWorkAreaCode')}
          >
            <option value="">Üst alan seçin</option>
            {workAreas?.map((wa) => (
              <option key={wa.id} value={wa.code}>
                {wa.name} ({wa.code})
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex items-center justify-end gap-[var(--space-3)]">
        <button type="button" className="ls-btn ls-btn--neutral" onClick={() => router.back()}>
          İptal
        </button>
        <button
          type="submit"
          className="ls-btn ls-btn--primary"
          disabled={isSubmitting}
          aria-busy={isSubmitting}
        >
          {isSubmitting ? 'Kaydediliyor...' : 'Oluştur'}
        </button>
      </div>
    </form>
  );
}

interface MasterDataEditFormProps {
  type: MasterDataType;
  itemId: string;
  defaultValues: MasterDataItem;
}

export function MasterDataEditForm({ type, itemId, defaultValues }: MasterDataEditFormProps) {
  const router = useRouter();
  const updateMutation = useUpdateMasterDataMutation(type, itemId);
  const typeName = MASTER_DATA_TYPE_LABELS[type] ?? type;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<UpdateMasterDataInput>({
    resolver: zodResolver(UpdateMasterDataSchema),
    defaultValues: { name: defaultValues.name },
  });

  const onSubmit = async (data: UpdateMasterDataInput) => {
    try {
      await updateMutation.mutateAsync(data);
      toast.success(`${typeName} kaydı güncellendi`);
      router.push(`/master-data/${type}`);
    } catch {
      toast.error('İşlem başarısız. Lütfen tekrar deneyin.');
    }
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-[var(--space-5)]"
      aria-label={`${typeName} düzenleme formu`}
      noValidate
    >
      <div>
        <label className="block text-sm font-medium text-[var(--color-neutral-500)]">
          Kod (değiştirilemez)
        </label>
        <p className="mt-[var(--space-1)] font-mono text-sm text-[var(--color-neutral-800)]">
          {defaultValues.code}
        </p>
      </div>

      <div>
        <label htmlFor="name" className="block text-sm font-medium text-[var(--color-neutral-700)]">
          Ad <span aria-hidden>*</span>
        </label>
        <input
          id="name"
          type="text"
          aria-required="true"
          aria-invalid={!!errors.name}
          className="ls-input mt-[var(--space-1)] w-full"
          {...register('name')}
        />
        {errors.name && (
          <p role="alert" className="mt-[var(--space-1)] text-xs text-[var(--color-error-600)]">
            {errors.name.message}
          </p>
        )}
      </div>

      <div className="flex items-center justify-end gap-[var(--space-3)]">
        <button type="button" className="ls-btn ls-btn--neutral" onClick={() => router.back()}>
          İptal
        </button>
        <button
          type="submit"
          className="ls-btn ls-btn--primary"
          disabled={isSubmitting}
          aria-busy={isSubmitting}
        >
          {isSubmitting ? 'Kaydediliyor...' : 'Güncelle'}
        </button>
      </div>
    </form>
  );
}

/** Discriminated union - tek giriş noktası */
export function MasterDataForm(
  props:
    | { mode: 'create'; type: MasterDataType }
    | { mode: 'edit'; type: MasterDataType; itemId: string; defaultValues: MasterDataItem },
) {
  if (props.mode === 'create') return <MasterDataCreateForm type={props.type} />;
  return (
    <MasterDataEditForm
      type={props.type}
      itemId={props.itemId}
      defaultValues={props.defaultValues}
    />
  );
}
