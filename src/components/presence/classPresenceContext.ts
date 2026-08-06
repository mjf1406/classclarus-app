import { createContext, useContext } from "react";

import type { PresenceState } from "@/hooks/presence/useClassPresence";

export type ClassPresenceContextValue = {
  presenceState: PresenceState[] | undefined;
  onlineUserIds: ReadonlySet<string>;
};

const EMPTY_ONLINE = new Set<string>();

export const EMPTY_CLASS_PRESENCE: ClassPresenceContextValue = {
  presenceState: undefined,
  onlineUserIds: EMPTY_ONLINE,
};

export const ClassPresenceContext = createContext<ClassPresenceContextValue | null>(null);

export function useClassPresenceContext(): ClassPresenceContextValue {
  return useContext(ClassPresenceContext) ?? EMPTY_CLASS_PRESENCE;
}

export function useIsClassMemberOnline(userId: string): boolean {
  return useClassPresenceContext().onlineUserIds.has(userId);
}
