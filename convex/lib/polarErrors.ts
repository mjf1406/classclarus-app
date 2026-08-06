import { ConvexError } from "convex/values";

type PolarLikeError = {
  name?: string;
  error?: string;
  detail?: string;
  message?: string;
  statusCode?: number;
  status?: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Pull Polar's stable error code from SDK / Convex-wrapped failures. */
export function polarErrorCode(error: unknown): string | undefined {
  if (!isRecord(error)) {
    return undefined;
  }

  const named = typeof error.name === "string" ? error.name : undefined;
  const coded = typeof error.error === "string" ? error.error : undefined;
  if (coded && coded.trim()) {
    return coded;
  }
  if (named && named !== "Error" && named !== "PolarError") {
    return named;
  }

  const message = typeof error.message === "string" ? error.message : "";
  const fromMessage =
    /AlreadyCanceledSubscription|AlreadyActiveSubscriptionError|SubscriptionLocked|NotPermitted|ResourceNotFound/.exec(
      message,
    );
  return fromMessage?.[0];
}

export function isAlreadyCanceledError(error: unknown): boolean {
  return polarErrorCode(error) === "AlreadyCanceledSubscription";
}

/** Redact email-like substrings from strings that may reach logs or clients. */
export function scrubDetail(value: string): string {
  return value.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]");
}

function correlationId(): string {
  return `bill_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function httpStatus(error: unknown): number | undefined {
  if (!isRecord(error)) {
    return undefined;
  }
  if (typeof error.statusCode === "number") {
    return error.statusCode;
  }
  if (typeof error.status === "number") {
    return error.status;
  }
  return undefined;
}

/**
 * Convert Polar / unexpected billing failures into a stable ConvexError.
 * Keeps raw SDK dumps (and PII) out of logs and the client toast path.
 */
export function throwBillingError(
  error: unknown,
  fallbackCode: string,
  fallbackMessage: string,
  operation = "billing",
): never {
  const code = polarErrorCode(error) ?? fallbackCode;
  const polar = isRecord(error) ? (error as PolarLikeError) : undefined;
  const rawDetail =
    (typeof polar?.detail === "string" && polar.detail.trim()) ||
    (typeof polar?.message === "string" && !polar.message.includes("{")
      ? polar.message.trim()
      : undefined);
  const id = correlationId();

  console.error("Billing action failed", {
    code,
    operation,
    status: httpStatus(error),
    correlationId: id,
  });

  const safeDetail = rawDetail ? scrubDetail(rawDetail) : undefined;

  throw new ConvexError({
    code,
    message: safeDetail && safeDetail.length < 160 ? safeDetail : fallbackMessage,
    correlationId: id,
  });
}
