import { convexQuery } from "@convex-dev/react-query";

import { api } from "../../../convex/_generated/api";
import { useAuthedQuery } from "@/hooks/useAuthedQuery";
import { ONE_HOUR } from "@/lib/queryCache";

export function notificationsListQueryKey() {
  return convexQuery(api.notifications.list, {}).queryKey;
}

export function notificationsCountsQueryKey() {
  return convexQuery(api.notifications.counts, {}).queryKey;
}

/** gcTime: 1 hour — user-confirmed for inbox queries. */
export function useNotificationsList() {
  return useAuthedQuery(api.notifications.list, {}, { gcTime: ONE_HOUR });
}

export function useNotificationCounts() {
  return useAuthedQuery(api.notifications.counts, {}, { gcTime: ONE_HOUR });
}
