import { convexQuery } from "@convex-dev/react-query";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useAuthedQuery } from "@/hooks/useAuthedQuery";
import { FIVE_MINUTES } from "@/lib/queryCache";

export function expectationValuesForExpectationQueryKey(
  classId: Id<"classes">,
  expectationId: Id<"expectations">,
) {
  return convexQuery(api.expectations.listValuesForExpectation, {
    classId,
    expectationId,
  }).queryKey;
}

/** gcTime: 5 minutes — reactive via Convex; moderate cache after unmount. */
export function useExpectationValuesForExpectation(
  classId: Id<"classes">,
  expectationId: Id<"expectations">,
) {
  return useAuthedQuery(
    api.expectations.listValuesForExpectation,
    { classId, expectationId },
    { gcTime: FIVE_MINUTES },
  );
}
