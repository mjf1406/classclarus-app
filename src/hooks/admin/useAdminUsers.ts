import { api } from "../../../convex/_generated/api";
import { useAuthedQuery } from "@/hooks/useAuthedQuery";
import { GC_TIME } from "@/lib/queryCache";

export function useAdminUsers() {
  return useAuthedQuery(api.adminUsers.listUsers, {}, { gcTime: GC_TIME.realtime });
}
