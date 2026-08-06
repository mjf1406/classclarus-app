import type { Doc, Id } from "../../../convex/_generated/dataModel";
import { classroomJoinOrigin, type ClassroomSession } from "@/lib/classroom/classroomSession";
import { randomClientId } from "@/lib/optimistic";

export type JoinCodePublic = Omit<Doc<"joinCodes">, "expirationJobId"> & {
  _pending?: boolean;
};

/** Optional Electron LAN origin override for share / display URLs. */
let joinOriginOverride: string | null = null;

export function setJoinOriginOverride(origin: string | null): void {
  joinOriginOverride = origin;
}

export function syncJoinOriginFromClassroom(session: ClassroomSession | null): void {
  setJoinOriginOverride(classroomJoinOrigin(session));
}

export function isPendingJoinCode(code: JoinCodePublic): boolean {
  return code._pending === true || String(code._id).startsWith("optimistic:");
}

export function remainingUses(code: Pick<JoinCodePublic, "maxUses" | "useCount">): number {
  return Math.max(0, code.maxUses - code.useCount);
}

/** Display form: `ABCDEF` → `ABC-DEF`. Passes through incomplete/pending strings unchanged. */
export function formatJoinCodeDisplay(code: string): string {
  if (code.length !== 6) {
    return code;
  }
  return `${code.slice(0, 3)}–${code.slice(3)}`;
}

export function createOptimisticJoinCodeId(): Id<"joinCodes"> {
  return `optimistic:${randomClientId()}` as Id<"joinCodes">;
}

/**
 * Query param for join-code share links (`/join?jc=…`).
 * Must not be `code` — that collides with Convex Auth's OAuth/magic-link handler.
 */
export const JOIN_CODE_PARAM = "jc";

function joinAppBaseUrl(): string {
  const base = import.meta.env.BASE_URL.endsWith("/")
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`;
  const origin = joinOriginOverride ?? window.location.origin;
  return `${origin.replace(/\/$/, "")}${base.startsWith("/") ? base : `/${base}`}`;
}

/** Absolute join page URL: `{origin}{BASE_URL}join` */
export function joinPageUrl(): string {
  return new URL("join", joinAppBaseUrl()).href;
}

/** Absolute share URL: `{origin}{BASE_URL}join?jc=…` */
export function joinCodeShareUrl(code: string): string {
  return new URL(`join?${JOIN_CODE_PARAM}=${encodeURIComponent(code)}`, joinAppBaseUrl()).href;
}

/** Absolute projector/display URL: `{origin}{BASE_URL}join-display?jc=…` */
export function joinCodeDisplayUrl(code: string): string {
  return new URL(`join-display?${JOIN_CODE_PARAM}=${encodeURIComponent(code)}`, joinAppBaseUrl())
    .href;
}
