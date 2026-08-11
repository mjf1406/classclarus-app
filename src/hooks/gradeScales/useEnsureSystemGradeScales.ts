import { useConvexMutation } from "@convex-dev/react-query";
import { useEffect, useRef } from "react";

import { api } from "../../../convex/_generated/api";

/** Idempotently seeds shared system grade scales once per app session. */
export function useEnsureSystemGradeScales(enabled: boolean) {
  const mutationFn = useConvexMutation(api.gradeScales.ensureSystemDefaults);
  const ranRef = useRef(false);

  useEffect(() => {
    if (!enabled || ranRef.current) return;
    ranRef.current = true;
    void mutationFn({}).catch(() => {
      ranRef.current = false;
    });
  }, [enabled, mutationFn]);
}
