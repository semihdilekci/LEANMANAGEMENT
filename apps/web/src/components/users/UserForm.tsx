'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import {
  CreateUserSchema,
  UpdateUserSchema,
  type CreateUserInput,
  type UpdateUserInput,
} from '@leanmgmt/shared-schemas';

import { useAllMasterDataQuery } from '@/lib/queries/master-data';
import { useCreateUserMutation, useUpdateUserMutation, type UserDetail } from '@/lib/queries/users';

interface MasterDataSelectProps {
  id: string;
  label: string;
  required?: boolean;
  options?: Array<{ id: string; name: string }>;
  error?: string;
  registration: ReturnType<ReturnType<typeof useForm>['register']>;
}

function MasterDataSelect({
  id,
  label,
  required,
  options,
  error,
  registration,
}: MasterDataSelectProps) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-[var(--color-neutral-700)]">
        {label} {required && <span aria-hidden>*</span>}
      </label>
      <select
        id={id}
        aria-required={required}
        className="ls-input mt-[var(--space-1)] w-full"
        {...registration}
      >
        <option value="">{label} seçin</option>
        {options?.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
      {error && (
        <p role="alert" className="mt-[var(--space-1)] text-xs text-[var(--color-error-600)]">
          {error}
        </p>
      )}
    </div>
  );
}

export function UserCreateForm() {
  const router = useRouter();

  const { data: companies } = useAllMasterDataQuery('companies');
  const { data: locations } = useAllMasterDataQuery('locations');
  const { data: departments } = useAllMasterDataQuery('departments');
  const { data: positions } = useAllMasterDataQuery('positions');
  const { data: levels } = useAllMasterDataQuery('levels');
  const { data: workAreas } = useAllMasterDataQuery('work-areas');

  const createMutation = useCreateUserMutation();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateUserInput>({ resolver: zodResolver(CreateUserSchema) });

  const onSubmit = async (data: CreateUserInput) => {
    try {
      const created = await createMutation.mutateAsync(data as unknown as Record<string, unknown>);
      toast.success('Kullanıcı başarıyla oluşturuldu');
      router.push(`/users/${(created as UserDetail).id}`);
    } catch {
      toast.error('İşlem başarısız. Lütfen tekrar deneyin.');
    }
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-[var(--space-6)]"
      aria-label="Yeni kullanıcı formu"
      noValidate
    >
      <div className="grid gap-[var(--space-4)] sm:grid-cols-2">
        <div>
          <label
            htmlFor="sicil"
            className="block text-sm font-medium text-[var(--color-neutral-700)]"
          >
            Sicil <span aria-hidden>*</span>
          </label>
          <input
            id="sicil"
            type="text"
            inputMode="numeric"
            maxLength={8}
            aria-required="true"
            aria-invalid={!!errors.sicil}
            aria-describedby={errors.sicil ? 'sicil-error' : undefined}
            className="ls-input mt-[var(--space-1)] w-full"
            {...register('sicil')}
          />
          {errors.sicil && (
            <p
              id="sicil-error"
              role="alert"
              className="mt-[var(--space-1)] text-xs text-[var(--color-error-600)]"
            >
              {errors.sicil.message}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="firstName"
            className="block text-sm font-medium text-[var(--color-neutral-700)]"
          >
            Ad <span aria-hidden>*</span>
          </label>
          <input
            id="firstName"
            type="text"
            aria-required="true"
            aria-invalid={!!errors.firstName}
            className="ls-input mt-[var(--space-1)] w-full"
            {...register('firstName')}
          />
          {errors.firstName && (
            <p role="alert" className="mt-[var(--space-1)] text-xs text-[var(--color-error-600)]">
              {errors.firstName.message}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="lastName"
            className="block text-sm font-medium text-[var(--color-neutral-700)]"
          >
            Soyad <span aria-hidden>*</span>
          </label>
          <input
            id="lastName"
            type="text"
            aria-required="true"
            aria-invalid={!!errors.lastName}
            className="ls-input mt-[var(--space-1)] w-full"
            {...register('lastName')}
          />
          {errors.lastName && (
            <p role="alert" className="mt-[var(--space-1)] text-xs text-[var(--color-error-600)]">
              {errors.lastName.message}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-[var(--color-neutral-700)]"
          >
            E-posta <span aria-hidden>*</span>
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            aria-required="true"
            className="ls-input mt-[var(--space-1)] w-full"
            {...register('email')}
          />
          {errors.email && (
            <p role="alert" className="mt-[var(--space-1)] text-xs text-[var(--color-error-600)]">
              {errors.email.message}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="employeeType"
            className="block text-sm font-medium text-[var(--color-neutral-700)]"
          >
            Çalışan Tipi <span aria-hidden>*</span>
          </label>
          <select
            id="employeeType"
            aria-required="true"
            className="ls-input mt-[var(--space-1)] w-full"
            {...register('employeeType')}
          >
            <option value="WHITE_COLLAR">Beyaz Yaka</option>
            <option value="BLUE_COLLAR">Mavi Yaka</option>
            <option value="INTERN">Stajyer</option>
          </select>
        </div>

        <MasterDataSelect
          id="companyId"
          label="Şirket"
          required
          options={companies}
          error={errors.companyId?.message}
          registration={register('companyId')}
        />
        <MasterDataSelect
          id="locationId"
          label="Lokasyon"
          required
          options={locations}
          error={errors.locationId?.message}
          registration={register('locationId')}
        />
        <MasterDataSelect
          id="departmentId"
          label="Departman"
          required
          options={departments}
          error={errors.departmentId?.message}
          registration={register('departmentId')}
        />
        <MasterDataSelect
          id="positionId"
          label="Pozisyon"
          required
          options={positions}
          error={errors.positionId?.message}
          registration={register('positionId')}
        />
        <MasterDataSelect
          id="levelId"
          label="Seviye"
          required
          options={levels}
          error={errors.levelId?.message}
          registration={register('levelId')}
        />
        <MasterDataSelect
          id="workAreaId"
          label="Çalışma Alanı"
          required
          options={workAreas}
          error={errors.workAreaId?.message}
          registration={register('workAreaId')}
        />
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
          {isSubmitting ? 'Kaydediliyor...' : 'Oluştur'}
        </button>
      </div>
    </form>
  );
}

interface UserEditFormProps {
  userId: string;
  defaultValues: Partial<UserDetail>;
}

export function UserEditForm({ userId, defaultValues }: UserEditFormProps) {
  const router = useRouter();

  const { data: companies } = useAllMasterDataQuery('companies');
  const { data: locations } = useAllMasterDataQuery('locations');
  const { data: departments } = useAllMasterDataQuery('departments');
  const { data: positions } = useAllMasterDataQuery('positions');
  const { data: levels } = useAllMasterDataQuery('levels');
  const { data: workAreas } = useAllMasterDataQuery('work-areas');

  const updateMutation = useUpdateUserMutation(userId);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<UpdateUserInput>({
    resolver: zodResolver(UpdateUserSchema),
    defaultValues: {
      firstName: defaultValues.firstName,
      lastName: defaultValues.lastName,
      email: defaultValues.email ?? undefined,
      employeeType: defaultValues.employeeType as UpdateUserInput['employeeType'],
    },
  });

  const onSubmit = async (data: UpdateUserInput) => {
    try {
      await updateMutation.mutateAsync(data as unknown as Record<string, unknown>);
      toast.success('Kullanıcı başarıyla güncellendi');
      router.push(`/users/${userId}`);
    } catch {
      toast.error('İşlem başarısız. Lütfen tekrar deneyin.');
    }
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-[var(--space-6)]"
      aria-label="Kullanıcı düzenleme formu"
      noValidate
    >
      <div className="grid gap-[var(--space-4)] sm:grid-cols-2">
        <div>
          <label
            htmlFor="firstName"
            className="block text-sm font-medium text-[var(--color-neutral-700)]"
          >
            Ad
          </label>
          <input
            id="firstName"
            type="text"
            className="ls-input mt-[var(--space-1)] w-full"
            {...register('firstName')}
          />
          {errors.firstName && (
            <p role="alert" className="mt-[var(--space-1)] text-xs text-[var(--color-error-600)]">
              {errors.firstName.message}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="lastName"
            className="block text-sm font-medium text-[var(--color-neutral-700)]"
          >
            Soyad
          </label>
          <input
            id="lastName"
            type="text"
            className="ls-input mt-[var(--space-1)] w-full"
            {...register('lastName')}
          />
          {errors.lastName && (
            <p role="alert" className="mt-[var(--space-1)] text-xs text-[var(--color-error-600)]">
              {errors.lastName.message}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-[var(--color-neutral-700)]"
          >
            E-posta
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            className="ls-input mt-[var(--space-1)] w-full"
            {...register('email')}
          />
          {errors.email && (
            <p role="alert" className="mt-[var(--space-1)] text-xs text-[var(--color-error-600)]">
              {errors.email.message}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="employeeType"
            className="block text-sm font-medium text-[var(--color-neutral-700)]"
          >
            Çalışan Tipi
          </label>
          <select
            id="employeeType"
            className="ls-input mt-[var(--space-1)] w-full"
            {...register('employeeType')}
          >
            <option value="">Seçin</option>
            <option value="WHITE_COLLAR">Beyaz Yaka</option>
            <option value="BLUE_COLLAR">Mavi Yaka</option>
            <option value="INTERN">Stajyer</option>
          </select>
        </div>

        <MasterDataSelect
          id="companyId"
          label="Şirket"
          options={companies}
          error={errors.companyId?.message}
          registration={register('companyId')}
        />
        <MasterDataSelect
          id="locationId"
          label="Lokasyon"
          options={locations}
          error={errors.locationId?.message}
          registration={register('locationId')}
        />
        <MasterDataSelect
          id="departmentId"
          label="Departman"
          options={departments}
          error={errors.departmentId?.message}
          registration={register('departmentId')}
        />
        <MasterDataSelect
          id="positionId"
          label="Pozisyon"
          options={positions}
          error={errors.positionId?.message}
          registration={register('positionId')}
        />
        <MasterDataSelect
          id="levelId"
          label="Seviye"
          options={levels}
          error={errors.levelId?.message}
          registration={register('levelId')}
        />
        <MasterDataSelect
          id="workAreaId"
          label="Çalışma Alanı"
          options={workAreas}
          error={errors.workAreaId?.message}
          registration={register('workAreaId')}
        />
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

/** Backward-compat alias — düz kullanım için */
export function UserForm(
  props: { mode: 'create' } | { mode: 'edit'; userId: string; defaultValues: Partial<UserDetail> },
) {
  if (props.mode === 'create') return <UserCreateForm />;
  return <UserEditForm userId={props.userId} defaultValues={props.defaultValues} />;
}
