import { convexQuery } from "@convex-dev/react-query";

import { api } from "../../../convex/_generated/api";
import { useAuthedQuery } from "@/hooks/useAuthedQuery";
import { GC_TIME } from "@/lib/queryCache";

export function currentUserQueryKey() {
  return convexQuery(api.users.currentUser, {}).queryKey;
}

export function useCurrentUser() {
  return useAuthedQuery(api.users.currentUser, {}, { gcTime: GC_TIME.stable });
}
