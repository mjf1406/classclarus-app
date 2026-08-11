import usePresence, { type PresenceState } from "@convex-dev/presence/react";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

/** 30s heartbeat → ~75s offline timeout (2.5× interval). */
export const CLASS_PRESENCE_HEARTBEAT_MS = 30_000;

/**
 * Live presence for a class room (`roomId` = classId).
 *
 * Uses `@convex-dev/presence/react` (Convex React client heartbeats + list
 * subscription) rather than TanStack Query — the library owns the session
 * lifecycle (interval, visibility, sendBeacon disconnect).
 */
export function useClassPresence(
  classId: Id<"classes">,
  userId: Id<"users">,
): PresenceState[] | undefined {
  return usePresence(api.presence, classId, userId, CLASS_PRESENCE_HEARTBEAT_MS);
}

export type { PresenceState };
