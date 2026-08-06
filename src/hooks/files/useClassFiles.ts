import { convexQuery } from "@convex-dev/react-query";

import type { Id } from "../../../convex/_generated/dataModel";
import { api } from "../../../convex/_generated/api";
import { useAuthedQuery } from "@/hooks/useAuthedQuery";
import { FIVE_MINUTES } from "@/lib/queryCache";

export function classFilesListQueryKey(classId: Id<"classes">) {
  return convexQuery(api.files.listClassFiles, { classId }).queryKey;
}

/**
 * Class file library metadata (no bytes).
 * gcTime: 5 minutes — list is reactive via Convex; moderate cache after unmount.
 */
export function useClassFiles(classId: Id<"classes">) {
  return useAuthedQuery(api.files.listClassFiles, { classId }, { gcTime: FIVE_MINUTES });
}
