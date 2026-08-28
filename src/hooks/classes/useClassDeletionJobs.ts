import { convexQuery } from "@convex-dev/react-query";

import { api } from "../../../convex/_generated/api";
import { useAuthedQuery } from "@/hooks/useAuthedQuery";
import { FIVE_MINUTES } from "@/lib/queryCache";

export function classDeletionJobsQueryKey() {
  return convexQuery(api.classDeletion.listForRequester, {}).queryKey;
}

/** Active and recently completed class deletion jobs for progress toasts. */
export function useClassDeletionJobs() {
  return useAuthedQuery(api.classDeletion.listForRequester, {}, { gcTime: FIVE_MINUTES });
}
