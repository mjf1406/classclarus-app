import { z } from "zod";

export const MIN_CLASS_YEAR = 1900;
export const MAX_CLASS_YEAR = 2100;
export const MAX_CLASS_NAME_LENGTH = 100;
export const MAX_CLASS_DESCRIPTION_LENGTH = 500;
export const MAX_CLASS_ICON_LENGTH = 32;

const fontAwesomeIconIdSchema = z
  .string()
  .regex(/^(fas|far):[a-z0-9-]+$/i, "Invalid Font Awesome icon id");

const emojiIconSchema = z
  .string()
  .min(1)
  .max(MAX_CLASS_ICON_LENGTH)
  .refine((value) => !value.includes(":") && /\p{Extended_Pictographic}/u.test(value), {
    message: "Icon must be a Font Awesome id or emoji",
  });

export const classIconSchema = z.union([fontAwesomeIconIdSchema, emojiIconSchema]);

export const classFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Class name is required")
    .max(MAX_CLASS_NAME_LENGTH, `Class name must be at most ${MAX_CLASS_NAME_LENGTH} characters`),
  year: z
    .string()
    .trim()
    .min(1, "Year is required")
    .refine((value) => /^\d{4}$/.test(value), "Year must be a 4-digit number")
    .transform((value) => Number(value))
    .refine(
      (value) => value >= MIN_CLASS_YEAR && value <= MAX_CLASS_YEAR,
      `Year must be between ${MIN_CLASS_YEAR} and ${MAX_CLASS_YEAR}`,
    ),
  description: z
    .string()
    .trim()
    .max(
      MAX_CLASS_DESCRIPTION_LENGTH,
      `Description must be at most ${MAX_CLASS_DESCRIPTION_LENGTH} characters`,
    )
    .transform((value) => (value.length > 0 ? value : undefined)),
  icon: z
    .string()
    .trim()
    .transform((value) => (value.length > 0 ? value : undefined))
    .pipe(z.union([classIconSchema, z.undefined()])),
});

export type ClassFormInput = z.input<typeof classFormSchema>;
export type ClassFormValues = z.output<typeof classFormSchema>;

export function deleteConfirmationPhrase(name: string): string {
  return `delete ${name}`;
}

export function isFontAwesomeIconId(value: string): boolean {
  return /^(fas|far):[a-z0-9-]+$/i.test(value.trim());
}

export function isEmojiIcon(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length > 0 && !trimmed.includes(":") && /\p{Extended_Pictographic}/u.test(trimmed);
}
