import { convexQuery } from "@convex-dev/react-query";

import type { Id } from "../../../convex/_generated/dataModel";
import { useAuthedQuery } from "@/hooks/useAuthedQuery";
import { ONE_HOUR } from "@/lib/queryCache";
import { api } from "../../../convex/_generated/api";

export function classUserSettingsQueryKey(classId: Id<"classes">) {
  return convexQuery(api.classUserSettings.get, { classId }).queryKey;
}

/** gcTime: 1 hour — prefs change infrequently; reactive via Convex. */
export function useClassUserSettings(classId: Id<"classes">) {
  return useAuthedQuery(api.classUserSettings.get, { classId }, { gcTime: ONE_HOUR });
}
