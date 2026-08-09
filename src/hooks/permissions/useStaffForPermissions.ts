import { convexQuery } from "@convex-dev/react-query";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useAuthedQuery } from "@/hooks/useAuthedQuery";
import { ONE_HOUR } from "@/lib/queryCache";

export function staffForPermissionsQueryKey(classId: Id<"classes">) {
  return convexQuery(api.classPermissions.listStaffForPermissions, { classId }).queryKey;
}

/** gcTime: ONE_HOUR — same as member lists; Convex keeps mounted data live. */
export function useStaffForPermissions(classId: Id<"classes">) {
  return useAuthedQuery(
    api.classPermissions.listStaffForPermissions,
    { classId },
    { gcTime: ONE_HOUR },
  );
}
