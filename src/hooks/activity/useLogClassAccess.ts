import { useEffect, useRef } from "react";
import { useConvexMutation } from "@convex-dev/react-query";
import { useMutation } from "@tanstack/react-query";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

export type LogClassAccessArgs = {
  classId: Id<"classes">;
  resourceType: string;
  summary: string;
  resourceId?: string;
  metadata?: Record<string, string>;
};

/**
 * Fire-and-forget intentional access logging. Failures are swallowed so UX never breaks.
 */
export function useLogClassAccess() {
  const mutationFn = useConvexMutation(api.activity.logAccess);

  return useMutation({
    mutationFn: (args: LogClassAccessArgs) => mutationFn(args),
    retry: false,
    onError: () => {
      // Silent — access logging must not interrupt the user.
    },
  });
}

/**
 * Log once per mount when `ready` becomes true (pairs with server 15m dedupe).
 */
export function useLogClassAccessOnce(ready: boolean, args: LogClassAccessArgs | null): void {
  const { mutate } = useLogClassAccess();
  const loggedKeyRef = useRef<string | null>(null);

  const classId = args?.classId;
  const resourceType = args?.resourceType;
  const summary = args?.summary;
  const resourceId = args?.resourceId;
  const metadataKey = args?.metadata ? JSON.stringify(args.metadata) : "";

  useEffect(() => {
    if (!ready || !classId || !resourceType || !summary) {
      return;
    }
    const key = [classId, resourceType, resourceId ?? "", summary, metadataKey].join("|");
    if (loggedKeyRef.current === key) {
      return;
    }
    loggedKeyRef.current = key;
    mutate({
      classId,
      resourceType,
      summary,
      ...(resourceId !== undefined ? { resourceId } : {}),
      ...(metadataKey ? { metadata: JSON.parse(metadataKey) as Record<string, string> } : {}),
    });
  }, [ready, classId, resourceType, summary, resourceId, metadataKey, mutate]);
}
