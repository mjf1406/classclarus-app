import { convexQuery } from "@convex-dev/react-query";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useAuthedQuery } from "@/hooks/useAuthedQuery";
import { GC_TIME } from "@/lib/queryCache";

export function expectationDetailQueryKey(
  classId: Id<"classes">,
  expectationId: Id<"expectations">,
) {
  return convexQuery(api.expectations.get, { classId, expectationId }).queryKey;
}

/** gcTime: 5 minutes — reactive via Convex; moderate cache after unmount. */
export function useExpectation(classId: Id<"classes">, expectationId: Id<"expectations">) {
  return useAuthedQuery(
    api.expectations.get,
    { classId, expectationId },
    { gcTime: GC_TIME.realtime },
  );
}
