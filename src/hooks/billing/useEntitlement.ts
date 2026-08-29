import { useMemo } from "react";

import { api } from "../../../convex/_generated/api";
import { useAuthedQuery } from "@/hooks/useAuthedQuery";
import { deriveEntitlement } from "@/lib/billing/entitlement";
import { GC_TIME } from "@/lib/queryCache";

/** Security-adjacent — keep cache short so gates stay fresh after checkout. */
export function useEntitlement() {
  const query = useAuthedQuery(api.billing.getEntitlement, {}, { gcTime: GC_TIME.realtime });

  const entitlement = useMemo(() => {
    if (!query.data) {
      return null;
    }
    return deriveEntitlement(query.data);
  }, [query.data]);

  return {
    ...query,
    entitlement,
  };
}
