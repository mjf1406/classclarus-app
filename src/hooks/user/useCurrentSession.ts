import { api } from "../../../convex/_generated/api";
import { useAuthedQuery } from "@/hooks/useAuthedQuery";
import { GC_TIME } from "@/lib/queryCache";

export function useCurrentSession() {
  return useAuthedQuery(api.users.currentSession, {}, { gcTime: GC_TIME.realtime });
}
