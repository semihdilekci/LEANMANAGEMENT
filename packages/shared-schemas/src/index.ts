import { z } from 'zod';

/** Ortak Zod şemaları — Faz 2+ ile genişletilecek */
export const EmptyObjectSchema = z.object({}).strict();

export type EmptyObjectInput = z.infer<typeof EmptyObjectSchema>;
