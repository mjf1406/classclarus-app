import { useConvexMutation } from "@convex-dev/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { studentRosterQueryKey } from "@/hooks/roster/useStudentRoster";

/**
 * Idempotent backfill of missing roster rows. Runs once per classId when enabled.
 */
export function useEnsureStudentRosters(classId: Id<"classes">, enabled: boolean) {
  const mutationFn = useConvexMutation(api.studentRosters.ensureForClass);
  const queryClient = useQueryClient();
  const ranForClassRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    if (ranForClassRef.current === classId) return;
    ranForClassRef.current = classId;

    void mutationFn({ classId })
      .then(() => {
        void queryClient.invalidateQueries({ queryKey: studentRosterQueryKey(classId) });
      })
      .catch(() => {
        // Allow retry on next mount if ensure failed.
        ranForClassRef.current = null;
      });
  }, [classId, enabled, mutationFn, queryClient]);
}
