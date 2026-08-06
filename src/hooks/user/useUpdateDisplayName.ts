import { useConvexMutation } from "@convex-dev/react-query";
import { useTranslation } from "react-i18next";

import { api } from "../../../convex/_generated/api";
import type { Doc } from "../../../convex/_generated/dataModel";
import { toast } from "@/components/ui/toast-manager";
import { useOptimisticMutation } from "@/hooks/useOptimisticMutation";
import { currentUserQueryKey } from "@/hooks/user/useCurrentUser";
import { fullNameFromParts } from "@/lib/user/userName";

type CurrentUser = Doc<"users"> & {
  settings: Doc<"userSettings"> | null;
  providers: Array<string>;
};

type UpdateDisplayNameArgs = {
  firstName: string;
  lastName: string;
};

/**
 * Optimistic profile name update (self-host / Electron).
 * Shares `currentUserQueryKey` with `useCurrentUser` (gcTime: 1 hour).
 */
export function useUpdateDisplayName() {
  const { t } = useTranslation("account");
  const mutationFn = useConvexMutation(api.users.updateDisplayName);
  const queryKey = currentUserQueryKey();

  return useOptimisticMutation({
    mutationFn: (args: UpdateDisplayNameArgs) => mutationFn(args),
    queryKeys: [queryKey],
    applyOptimisticUpdate: (queryClient, { firstName, lastName }) => {
      const name = fullNameFromParts(firstName, lastName);
      queryClient.setQueryData<CurrentUser | null>(queryKey, (old) => {
        if (!old) return old;
        return { ...old, name };
      });
    },
    onError: (error) => {
      toast.add({
        type: "error",
        title: error instanceof Error ? error.message : t("profileSaveFailed"),
      });
    },
  });
}
