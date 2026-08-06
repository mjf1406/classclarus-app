import { useMemo, type ReactNode } from "react";

import {
  ClassPresenceContext,
  EMPTY_CLASS_PRESENCE,
  type ClassPresenceContextValue,
} from "@/components/presence/classPresenceContext";
import { useClassPresence } from "@/hooks/presence/useClassPresence";
import { useCurrentUser } from "@/hooks/user/useCurrentUser";
import type { Id } from "../../../convex/_generated/dataModel";

type ClassPresenceProviderProps = {
  classId: Id<"classes">;
  children: ReactNode;
};

/**
 * Single presence session for the class layout — shared by the header facepile
 * and member cards so we do not open duplicate heartbeat sessions.
 */
export function ClassPresenceProvider({ classId, children }: ClassPresenceProviderProps) {
  const { data: user } = useCurrentUser();
  if (!user?._id) {
    return (
      <ClassPresenceContext.Provider value={EMPTY_CLASS_PRESENCE}>
        {children}
      </ClassPresenceContext.Provider>
    );
  }
  return (
    <ClassPresenceProviderInner classId={classId} userId={user._id}>
      {children}
    </ClassPresenceProviderInner>
  );
}

function ClassPresenceProviderInner({
  classId,
  userId,
  children,
}: {
  classId: Id<"classes">;
  userId: Id<"users">;
  children: ReactNode;
}) {
  const presenceState = useClassPresence(classId, userId);
  const value = useMemo((): ClassPresenceContextValue => {
    const onlineUserIds = new Set(
      (presenceState ?? []).filter((entry) => entry.online).map((entry) => entry.userId),
    );
    return { presenceState, onlineUserIds };
  }, [presenceState]);

  return <ClassPresenceContext.Provider value={value}>{children}</ClassPresenceContext.Provider>;
}
