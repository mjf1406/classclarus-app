import { z } from "zod";

import { isAppLanguage, type AppLanguage } from "@/lib/languages";

export const GUARDIAN_INVITE_TTL_OPTIONS = [
  { value: "1d", ttlMs: 24 * 60 * 60 * 1000 },
  { value: "3d", ttlMs: 3 * 24 * 60 * 60 * 1000 },
  { value: "7d", ttlMs: 7 * 24 * 60 * 60 * 1000 },
] as const;

export type GuardianInviteTtlOption = (typeof GUARDIAN_INVITE_TTL_OPTIONS)[number]["value"];

export const GUARDIAN_INVITE_USE_PRESETS = [1, 2, 5, 10] as const;

export function guardianInviteTtlMs(option: GuardianInviteTtlOption): number {
  const match = GUARDIAN_INVITE_TTL_OPTIONS.find((entry) => entry.value === option);
  if (!match) {
    throw new Error("Invalid TTL option");
  }
  return match.ttlMs;
}

export const printGuardianInvitesFormSchema = z
  .object({
    ttlOption: z.enum(["1d", "3d", "7d"] as const satisfies ReadonlyArray<GuardianInviteTtlOption>),
    usesPreset: z.string(),
    sheetLanguage: z.string().refine((value): value is AppLanguage => isAppLanguage(value), {
      message: "Select a language",
    }),
  })
  .superRefine((value, ctx) => {
    const parsed = Number(value.usesPreset);
    if (
      !GUARDIAN_INVITE_USE_PRESETS.includes(parsed as (typeof GUARDIAN_INVITE_USE_PRESETS)[number])
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["usesPreset"],
        message: "Select a uses option",
      });
    }
  })
  .transform((value) => ({
    ttlMs: guardianInviteTtlMs(value.ttlOption),
    maxUses: Number(value.usesPreset),
    sheetLanguage: value.sheetLanguage,
  }));

export type PrintGuardianInvitesFormInput = z.input<typeof printGuardianInvitesFormSchema>;
export type PrintGuardianInvitesFormValues = z.output<typeof printGuardianInvitesFormSchema>;
