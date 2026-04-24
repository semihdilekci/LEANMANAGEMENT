import { z } from 'zod';

/** docs/03_API_CONTRACTS.md §9.1 — şifre politikası (bcrypt cost 12 ile uyumlu) */
export const PasswordPolicySchema = z
  .string()
  .min(12, 'En az 12 karakter olmalı')
  .max(128)
  .regex(/[A-Z]/, 'En az 1 büyük harf olmalı')
  .regex(/[a-z]/, 'En az 1 küçük harf olmalı')
  .regex(/\d/, 'En az 1 rakam olmalı')
  .regex(/[!@#$%^&*()_+\-=[\]{};:'"\\|,.<>/?]/, 'En az 1 özel karakter olmalı')
  .refine((v) => !/\s/.test(v), 'Boşluk içeremez');

export const LoginSchema = z
  .object({
    email: z
      .string()
      .email()
      .max(254)
      .transform((e) => e.toLowerCase().trim()),
    password: z.string().min(1),
  })
  .strict();

export type LoginInput = z.infer<typeof LoginSchema>;

export const PasswordResetRequestSchema = z
  .object({
    email: z
      .string()
      .email()
      .max(254)
      .transform((e) => e.toLowerCase().trim()),
  })
  .strict();

export type PasswordResetRequestInput = z.infer<typeof PasswordResetRequestSchema>;

/** docs/03 — token 32 byte base64url ≈ 43 karakter */
export const PasswordResetConfirmSchema = z
  .object({
    token: z.string().min(40).max(48),
    newPassword: PasswordPolicySchema,
  })
  .strict();

export type PasswordResetConfirmInput = z.infer<typeof PasswordResetConfirmSchema>;

export const ChangePasswordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: PasswordPolicySchema,
  })
  .strict();

export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>;

/** Ekran formu — API yalnızca current+new alır; eşleşme UI doğrulaması */
export const ChangePasswordFormSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: PasswordPolicySchema,
    confirmPassword: z.string().min(1),
  })
  .strict()
  .refine((val) => val.newPassword === val.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Yeni şifreler eşleşmiyor',
  });

export type ChangePasswordFormInput = z.infer<typeof ChangePasswordFormSchema>;

export const ConsentAcceptSchema = z
  .object({
    consentVersionId: z.string().min(1),
  })
  .strict();

export type ConsentAcceptInput = z.infer<typeof ConsentAcceptSchema>;

/** URL param: GET /consent-versions/:id */
export const ConsentVersionIdParamSchema = z
  .string()
  .cuid('Geçerli bir rıza sürümü kimliği gerekli');
