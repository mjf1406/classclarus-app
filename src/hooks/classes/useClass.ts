import { convexQuery } from "@convex-dev/react-query";

import type { Id } from "../../../convex/_generated/dataModel";
import { useAuthedQuery } from "@/hooks/useAuthedQuery";
import { api } from "../../../convex/_generated/api";
import { ONE_HOUR } from "@/lib/queryCache";

export function classDetailQueryKey(classId: Id<"classes">) {
  return convexQuery(api.classes.get, { classId }).queryKey;
}

export function useClass(classId: Id<"classes">) {
  return useAuthedQuery(api.classes.get, { classId }, { gcTime: ONE_HOUR });
}
