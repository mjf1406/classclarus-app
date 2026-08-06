import { api } from "../../../convex/_generated/api";
import { useAuthedQuery } from "@/hooks/useAuthedQuery";

const ONE_MINUTE = 60_000;

export function useAdminUsers() {
  return useAuthedQuery(api.adminUsers.listUsers, {}, { gcTime: ONE_MINUTE });
}
