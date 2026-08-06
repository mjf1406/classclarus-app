import { useMutation } from "@tanstack/react-query";
import { useConvexMutation } from "@convex-dev/react-query";

import { api } from "../../../convex/_generated/api";

export function useEnsureTrialGrant() {
  const ensureTrialGrant = useConvexMutation(api.billing.ensureTrialGrant);

  return useMutation({
    mutationFn: () => ensureTrialGrant({}),
  });
}
