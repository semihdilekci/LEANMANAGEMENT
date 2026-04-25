'use client';

import type { FieldErrors, UseFormRegister } from 'react-hook-form';

import type { TaskFormSchemaField } from '@/lib/queries/tasks';

interface TaskFormProps {
  fields: TaskFormSchemaField[];
  register: UseFormRegister<Record<string, unknown>>;
  errors: FieldErrors<Record<string, unknown>>;
  disabled?: boolean;
}

export function TaskForm({ fields, register, errors, disabled }: TaskFormProps) {
  if (fields.length === 0) {
    return null;
  }
  return (
    <div className="space-y-[var(--space-4)]">
      {fields.map((f) => {
        const err = errors[f.name]?.message as string | undefined;
        if (f.type === 'textarea') {
          return (
            <div key={f.name}>
              <label
                htmlFor={`task-field-${f.name}`}
                className="mb-[var(--space-1)] block text-sm font-medium text-[var(--color-neutral-900)]"
              >
                {f.label}
                {f.required ? <span className="text-[var(--color-error-600)]"> *</span> : null}
              </label>
              <textarea
                id={`task-field-${f.name}`}
                rows={4}
                maxLength={f.maxLength}
                className="ls-input min-h-[6rem] w-full"
                disabled={disabled}
                {...register(f.name)}
              />
              {err ? <p className="mt-1 text-sm text-[var(--color-error-700)]">{err}</p> : null}
            </div>
          );
        }
        return (
          <div key={f.name}>
            <label
              htmlFor={`task-field-${f.name}`}
              className="mb-[var(--space-1)] block text-sm font-medium text-[var(--color-neutral-900)]"
            >
              {f.label}
            </label>
            <input
              id={`task-field-${f.name}`}
              type="text"
              className="ls-input w-full max-w-md"
              disabled={disabled}
              {...register(f.name)}
            />
            {err ? <p className="mt-1 text-sm text-[var(--color-error-700)]">{err}</p> : null}
          </div>
        );
      })}
    </div>
  );
}
