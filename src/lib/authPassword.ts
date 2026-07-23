import { z } from "zod";

/** Build-time flag baked into the SPA (self-host Docker sets from AUTH_PASSWORD_ENABLED). */
export function isPasswordAuthEnabled(): boolean {
  return import.meta.env.VITE_AUTH_PASSWORD_ENABLED === "true";
}

export const passwordSignInSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8),
});

export const passwordSignUpSchema = passwordSignInSchema
  .extend({
    name: z.string().trim().optional(),
    confirmPassword: z.string().min(8),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "mismatch",
  });

export type PasswordSignInValues = z.infer<typeof passwordSignInSchema>;
export type PasswordSignUpValues = z.infer<typeof passwordSignUpSchema>;
