import { api } from "../../../convex/_generated/api";
import { useAuthedQuery } from "@/hooks/useAuthedQuery";
import { ONE_DAY } from "@/lib/queryCache";

/** Product catalog rarely changes — long gcTime is fine. */
export function useBillingProducts() {
  return useAuthedQuery(api.polar.getConfiguredProducts, {}, { gcTime: ONE_DAY });
}
