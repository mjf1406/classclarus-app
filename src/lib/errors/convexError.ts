import { ConvexError } from "convex/values";
import { isRateLimitError } from "@convex-dev/rate-limiter";

type ForbiddenData = {
  code?: string;
  message?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readErrorData(error: unknown): ForbiddenData | string | undefined {
  if (error instanceof ConvexError) {
    return error.data as ForbiddenData | string;
  }
  if (isRecord(error) && "data" in error) {
    const data = error.data;
    if (typeof data === "string" || isRecord(data)) {
      return data as ForbiddenData | string;
    }
  }
  return undefined;
}

/** Pull the human message out of Convex's wrapped `Uncaught Error: …` server dump. */
function cleanConvexServerMessage(message: string): string {
  const uncaught = /Uncaught Error:\s*(.+?)(?:\s+at\s+handler\b|$)/s.exec(message);
  const cleaned = uncaught?.[1]?.trim();
  return cleaned && cleaned.length > 0 ? cleaned : message;
}

export function codeFromError(error: unknown): string | undefined {
  const data = readErrorData(error);
  if (isRecord(data) && typeof data.code === "string" && data.code.trim()) {
    return data.code;
  }
  return undefined;
}

/**
 * Prefer ConvexError.data.message (e.g. authz FORBIDDEN), then Error.message, then fallback.
 * Optionally maps rate-limit errors to a localized string.
 */
export function messageFromError(
  error: unknown,
  fallback: string,
  rateLimitedMessage?: string,
): string {
  if (rateLimitedMessage !== undefined && isRateLimitError(error)) {
    return rateLimitedMessage;
  }

  const data = readErrorData(error);
  if (typeof data === "string" && data.trim()) {
    return data;
  }
  if (isRecord(data) && typeof data.message === "string" && data.message.trim()) {
    return data.message;
  }

  if (error instanceof Error && error.message.trim()) {
    return cleanConvexServerMessage(error.message);
  }

  return fallback;
}
