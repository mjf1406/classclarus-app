import { convexQuery } from "@convex-dev/react-query";

import { useAuthedQuery } from "@/hooks/useAuthedQuery";
import { api } from "../../../convex/_generated/api";
import { GC_TIME } from "@/lib/queryCache";

export function ownedClassesQueryKey() {
  return convexQuery(api.classes.listOwned, {}).queryKey;
}

/**
 * Classes the current user owns.
 * gcTime: 1 hour — ownership changes only on create/delete/transfer.
 */
export function useOwnedClasses() {
  return useAuthedQuery(api.classes.listOwned, {}, { gcTime: GC_TIME.stable });
}
