import { convexQuery } from "@convex-dev/react-query";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useAuthedQuery } from "@/hooks/useAuthedQuery";
import { GC_TIME } from "@/lib/queryCache";

export function staffForPermissionsQueryKey(classId: Id<"classes">) {
  return convexQuery(api.classPermissions.listStaffForPermissions, { classId }).queryKey;
}

/** gcTime: GC_TIME.realtime — same as member lists; Convex keeps mounted data live. */
export function useStaffForPermissions(classId: Id<"classes">) {
  return useAuthedQuery(
    api.classPermissions.listStaffForPermissions,
    { classId },
    { gcTime: GC_TIME.realtime },
  );
}
