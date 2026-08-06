import { z } from "zod";

import { readViteEnv } from "@/lib/runtimeEnv";

/**
 * Must be set to `true` only when a Password provider is registered in
 * `convex/auth.ts`. The Vite env flag alone must never enable the UI.
 */
export const PASSWORD_PROVIDER_REGISTERED = true;

/** Self-host Docker injects this at runtime; cloud/dev uses Vite build env. */
export function isPasswordAuthEnabled(): boolean {
  return PASSWORD_PROVIDER_REGISTERED && readViteEnv("VITE_AUTH_PASSWORD_ENABLED") === "true";
}

export const passwordSignInSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8),
});

export const passwordSignUpSchema = passwordSignInSchema
  .extend({
    firstName: z.string().trim().min(1),
    lastName: z.string().trim().min(1),
    confirmPassword: z.string().min(8),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "mismatch",
  });

export type PasswordSignInValues = z.infer<typeof passwordSignInSchema>;
export type PasswordSignUpValues = z.infer<typeof passwordSignUpSchema>;

export { fullNameFromParts } from "@/lib/user/userName";
