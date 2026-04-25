'use client';

import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { isAxiosError } from 'axios';
import { Loader2 } from 'lucide-react';
import { useForm, type FieldErrors, type UseFormRegister } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import type { TaskDetail } from '@/lib/queries/tasks';
import { useTaskClaimMutation, useTaskCompleteMutation } from '@/lib/queries/tasks';

import { KtiRevisionTaskForm } from './KtiRevisionTaskForm';
import { TaskForm } from './TaskForm';

const KTI_MANAGER = 'KTI_MANAGER_APPROVAL';
const KTI_REVISION = 'KTI_REVISION';

const managerFormSchema = z
  .object({
    action: z.enum(['APPROVE', 'REJECT', 'REQUEST_REVISION']),
    reason: z.string().optional(),
    comment: z.string().max(1000).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.action === 'REJECT' || data.action === 'REQUEST_REVISION') {
      const r = data.reason?.trim() ?? '';
      if (r.length < 10) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['reason'],
          message: 'Gerekçe en az 10 karakter olmalıdır',
        });
      }
    }
  });

type ManagerFormValues = z.infer<typeof managerFormSchema>;

interface TaskActionsProps {
  task: TaskDetail;
  onRefetch: () => void;
}

export function TaskActions({ task, onRefetch }: TaskActionsProps) {
  const router = useRouter();
  const claimMutation = useTaskClaimMutation(task.id);
  const completeMutation = useTaskCompleteMutation(task.id, task.process.displayId);

  const defaultAction =
    (task.allowedActions.includes('APPROVE')
      ? 'APPROVE'
      : (task.allowedActions[0] as ManagerFormValues['action'] | undefined)) ?? 'APPROVE';

  const managerForm = useForm<ManagerFormValues>({
    resolver: zodResolver(managerFormSchema),
    defaultValues: {
      action: defaultAction,
      reason: '',
      comment: '',
    },
  });

  const showClaim = task.assignmentMode === 'CLAIM' && task.status === 'PENDING';
  const showManagerPanel =
    task.stepKey === KTI_MANAGER &&
    (task.status === 'PENDING' || task.status === 'CLAIMED' || task.status === 'IN_PROGRESS') &&
    task.allowedActions.length > 0 &&
    !(task.assignmentMode === 'CLAIM' && task.status === 'PENDING');
  const showRevision = task.stepKey === KTI_REVISION && task.status === 'PENDING';
  const readOnlyCompleted =
    task.status === 'COMPLETED' ||
    task.status === 'SKIPPED_BY_PEER' ||
    task.status === 'SKIPPED_BY_ROLLBACK';

  const handleClaim = async () => {
    try {
      await claimMutation.mutateAsync();
      toast.success('Görevi üstlendiniz');
      onRefetch();
    } catch (e) {
      if (isAxiosError(e)) {
        const code = e.response?.data?.error?.code as string | undefined;
        if (code === 'TASK_CLAIM_LOST') {
          toast.error('Bu görev başka biri tarafından üstlenildi');
          onRefetch();
          return;
        }
        toast.error(e.response?.data?.error?.message ?? 'Üstlenilemedi');
        return;
      }
      toast.error('Üstlenilemedi');
    }
  };

  const onManagerSubmit = async (values: ManagerFormValues) => {
    try {
      const res = await completeMutation.mutateAsync({
        action: values.action,
        reason: values.reason?.trim() || undefined,
        formData: { comment: values.comment?.trim() || undefined },
      });
      if (values.action === 'APPROVE') {
        toast.success('Süreç onaylandı');
        router.push(`/processes/${encodeURIComponent(task.process.displayId)}`);
      } else if (values.action === 'REJECT') {
        toast.success('Süreç reddedildi');
        router.push(`/processes/${encodeURIComponent(task.process.displayId)}`);
      } else if (values.action === 'REQUEST_REVISION') {
        toast.success('Revize için başlatıcıya gönderildi');
        router.push('/tasks?tab=completed');
      } else {
        toast.success('Görev tamamlandı');
        if (res.nextTaskId) {
          router.push(`/tasks/${encodeURIComponent(res.nextTaskId)}`);
        } else {
          router.push(`/processes/${encodeURIComponent(task.process.displayId)}`);
        }
      }
    } catch (e) {
      if (isAxiosError(e)) {
        const code = e.response?.data?.error?.code as string | undefined;
        if (code === 'TASK_REASON_REQUIRED') {
          managerForm.setError('reason', { message: 'Gerekçe zorunludur' });
          return;
        }
        if (code === 'VALIDATION_FAILED') {
          toast.error(e.response?.data?.error?.message ?? 'Doğrulama hatası');
          return;
        }
        toast.error(e.response?.data?.error?.message ?? 'Tamamlanamadı');
        return;
      }
      toast.error('Tamamlanamadı');
    }
  };

  if (readOnlyCompleted) {
    return (
      <div className="ls-card p-[var(--space-4)] text-sm text-[var(--color-neutral-700)]">
        Bu görev tamamlandı veya atlandı; yeni işlem yapılamaz.
      </div>
    );
  }

  if (showClaim) {
    return (
      <div className="ls-card space-y-[var(--space-4)] p-[var(--space-5)]">
        <p className="text-sm text-[var(--color-neutral-700)]">
          Bu görev üstlenilebilir. Üstlendiğinizde diğer adaylar için görev kapanır.
        </p>
        <button
          type="button"
          className="ls-btn ls-btn--primary"
          disabled={claimMutation.isPending}
          onClick={() => void handleClaim()}
        >
          {claimMutation.isPending ? (
            <>
              <Loader2 className="mr-2 inline h-4 w-4 animate-spin" aria-hidden />
              İşleniyor…
            </>
          ) : (
            'Üstlen'
          )}
        </button>
      </div>
    );
  }

  if (showRevision) {
    return <KtiRevisionTaskForm task={task} />;
  }

  if (showManagerPanel) {
    return (
      <form
        onSubmit={managerForm.handleSubmit(onManagerSubmit)}
        className="ls-card space-y-[var(--space-5)] p-[var(--space-5)]"
      >
        <fieldset className="space-y-[var(--space-3)]">
          <legend className="text-sm font-medium text-[var(--color-neutral-900)]">Karar</legend>
          <div className="flex flex-wrap gap-[var(--space-4)]">
            {task.allowedActions.includes('APPROVE') ? (
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input type="radio" value="APPROVE" {...managerForm.register('action')} />
                Onayla
              </label>
            ) : null}
            {task.allowedActions.includes('REJECT') ? (
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input type="radio" value="REJECT" {...managerForm.register('action')} />
                Reddet
              </label>
            ) : null}
            {task.allowedActions.includes('REQUEST_REVISION') ? (
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input type="radio" value="REQUEST_REVISION" {...managerForm.register('action')} />
                Revize iste
              </label>
            ) : null}
          </div>
          {managerForm.formState.errors.action ? (
            <p className="text-sm text-[var(--color-error-700)]">
              {managerForm.formState.errors.action.message}
            </p>
          ) : null}
        </fieldset>

        {task.reasonRequiredFor.includes(managerForm.watch('action')) ? (
          <div>
            <label
              htmlFor="task-reason"
              className="mb-[var(--space-1)] block text-sm font-medium text-[var(--color-neutral-900)]"
            >
              Gerekçe <span className="text-[var(--color-error-600)]">*</span>
            </label>
            <textarea
              id="task-reason"
              rows={4}
              className="ls-input min-h-[6rem] w-full"
              placeholder="En az 10 karakter"
              {...managerForm.register('reason')}
            />
            {managerForm.formState.errors.reason ? (
              <p className="mt-1 text-sm text-[var(--color-error-700)]">
                {managerForm.formState.errors.reason.message}
              </p>
            ) : null}
          </div>
        ) : null}

        <TaskForm
          fields={task.formSchema.fields}
          register={managerForm.register as unknown as UseFormRegister<Record<string, unknown>>}
          errors={managerForm.formState.errors as FieldErrors<Record<string, unknown>>}
          disabled={completeMutation.isPending}
        />

        <div className="flex justify-end">
          <button
            type="submit"
            className="ls-btn ls-btn--primary"
            disabled={completeMutation.isPending}
          >
            {completeMutation.isPending ? (
              <>
                <Loader2 className="mr-2 inline h-4 w-4 animate-spin" aria-hidden />
                Kaydediliyor…
              </>
            ) : (
              'Kaydet ve Tamamla'
            )}
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="ls-card p-[var(--space-4)] text-sm text-[var(--color-neutral-600)]">
      Bu görev için şu anda bir aksiyon tanımlı değil veya erişiminiz yok.
    </div>
  );
}
