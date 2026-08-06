import { api } from "../../../convex/_generated/api";
import { FIVE_MINUTES } from "@/lib/queryCache";
import { useAuthedQuery } from "@/hooks/useAuthedQuery";

export function useCurrentSession() {
  return useAuthedQuery(api.users.currentSession, {}, { gcTime: FIVE_MINUTES });
}
