import { convexQuery } from "@convex-dev/react-query";

import { api } from "../../../convex/_generated/api";
import { useAuthedQuery } from "@/hooks/useAuthedQuery";
import { GC_TIME } from "@/lib/queryCache";

export function accountDeletionBlockersQueryKey() {
  return convexQuery(api.account.getDeletionBlockers, {}).queryKey;
}

/** Deletion preconditions — keep short so blockers stay fresh after class/billing changes. */
export function useAccountDeletionBlockers() {
  return useAuthedQuery(api.account.getDeletionBlockers, {}, { gcTime: GC_TIME.realtime });
}
