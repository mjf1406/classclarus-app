import { useAction } from "convex/react";

import { api } from "../../../convex/_generated/api";

export function useCheckAssignmentLinkAccessibility() {
  const checkPublicAccess = useAction(api.linkAccessibility.checkPublicAccess);

  return {
    check: (url: string) => checkPublicAccess({ url }),
  };
}
