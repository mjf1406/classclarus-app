import { convexQuery } from "@convex-dev/react-query";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useAuthedQuery } from "@/hooks/useAuthedQuery";
import { ONE_HOUR } from "@/lib/queryCache";

export function seatAlgorithmSettingsQueryKey(classId: Id<"classes">) {
  return convexQuery(api.seatAlgorithmSettings.get, { classId }).queryKey;
}

export function useSeatAlgorithmSettings(classId: Id<"classes">) {
  return useAuthedQuery(api.seatAlgorithmSettings.get, { classId }, { gcTime: ONE_HOUR });
}
