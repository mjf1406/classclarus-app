import { messageFromError } from "@/lib/errors/convexError";

/** @deprecated Prefer `messageFromError` — kept for any remaining call sites. */
export function mutationErrorMessage(
  error: unknown,
  fallback: string,
  rateLimitedMessage: string,
): string {
  return messageFromError(error, fallback, rateLimitedMessage);
}
