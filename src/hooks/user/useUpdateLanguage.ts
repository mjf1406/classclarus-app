import { useConvexMutation } from "@convex-dev/react-query";

import { api } from "../../../convex/_generated/api";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import type { AppLanguage } from "@/lib/languages";
import { useOptimisticMutation } from "@/hooks/useOptimisticMutation";
import { currentUserQueryKey } from "@/hooks/user/useCurrentUser";

type CurrentUser = Doc<"users"> & {
  settings: Doc<"userSettings"> | null;
  providers: Array<string>;
};

export function useUpdateLanguage() {
  const mutationFn = useConvexMutation(api.users.updateLanguage);
  const queryKey = currentUserQueryKey();

  return useOptimisticMutation({
    mutationFn: (args: { language: AppLanguage }) => mutationFn(args),
    queryKeys: [queryKey],
    applyOptimisticUpdate: (queryClient, { language }) => {
      queryClient.setQueryData<CurrentUser | null>(queryKey, (old) => {
        if (!old) {
          return old;
        }
        if (old.settings) {
          return {
            ...old,
            settings: {
              ...old.settings,
              language,
            },
          };
        }
        return {
          ...old,
          settings: {
            _id: "optimistic" as Id<"userSettings">,
            _creationTime: Date.now(),
            userId: old._id,
            language,
          },
        };
      });
    },
  });
}
