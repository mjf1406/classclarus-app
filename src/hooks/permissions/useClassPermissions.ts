import { convexQuery } from "@convex-dev/react-query";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useAuthedQuery } from "@/hooks/useAuthedQuery";
import { GC_TIME } from "@/lib/queryCache";

export function classPermissionsQueryKey(classId: Id<"classes">) {
  return convexQuery(api.permissions.forClass, { classId }).queryKey;
}

export function classPermissionsQueryOptions(classId: Id<"classes">) {
  return convexQuery(api.permissions.forClass, { classId });
}

export function useClassPermissions(classId: Id<"classes">) {
  return useAuthedQuery(api.permissions.forClass, { classId }, { gcTime: GC_TIME.stable });
}
