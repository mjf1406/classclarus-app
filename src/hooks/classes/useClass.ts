import { useMemo } from "react";
import { convexQuery } from "@convex-dev/react-query";

import type { Id } from "../../../convex/_generated/dataModel";
import { useLogClassAccessOnce } from "@/hooks/activity/useLogClassAccess";
import { useAuthedQuery } from "@/hooks/useAuthedQuery";
import { api } from "../../../convex/_generated/api";
import { ONE_HOUR } from "@/lib/queryCache";

export function classDetailQueryKey(classId: Id<"classes">) {
  return convexQuery(api.classes.get, { classId }).queryKey;
}

export function useClass(classId: Id<"classes">) {
  const result = useAuthedQuery(api.classes.get, { classId }, { gcTime: ONE_HOUR });
  const accessArgs = useMemo(
    () =>
      result.data
        ? {
            classId,
            resourceType: "class",
            resourceId: classId,
            summary: `Viewed class "${result.data.name}"`,
            summaryKey: "activitySummary_viewedClass",
            metadata: { name: result.data.name },
          }
        : null,
    [classId, result.data],
  );
  useLogClassAccessOnce(Boolean(result.data), accessArgs);
  return result;
}
