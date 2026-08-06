import { convexQuery } from "@convex-dev/react-query";

import { api } from "../../../convex/_generated/api";
import { useAuthedQuery } from "@/hooks/useAuthedQuery";
import { ONE_HOUR } from "@/lib/queryCache";

export function currentUserQueryKey() {
  return convexQuery(api.users.currentUser, {}).queryKey;
}

export function useCurrentUser() {
  return useAuthedQuery(api.users.currentUser, {}, { gcTime: ONE_HOUR });
}
