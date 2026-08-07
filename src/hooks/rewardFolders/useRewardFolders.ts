import { convexQuery } from "@convex-dev/react-query";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useAuthedQuery } from "@/hooks/useAuthedQuery";
import { FIVE_MINUTES } from "@/lib/queryCache";

export function rewardFoldersListQueryKey(classId: Id<"classes">) {
  return convexQuery(api.rewardFolders.list, { classId }).queryKey;
}

/** gcTime: 5 minutes — reactive via Convex; moderate cache after unmount. */
export function useRewardFolders(classId: Id<"classes">) {
  return useAuthedQuery(api.rewardFolders.list, { classId }, { gcTime: FIVE_MINUTES });
}
