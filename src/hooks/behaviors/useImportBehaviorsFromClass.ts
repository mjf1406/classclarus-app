import { useConvexMutation } from "@convex-dev/react-query";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { toast } from "@/components/ui/toast-manager";
import { behaviorFoldersListQueryKey } from "@/hooks/behaviorFolders/useBehaviorFolders";
import { behaviorsListQueryKey } from "@/hooks/behaviors/useBehaviors";
import { messageFromError } from "@/lib/errors/convexError";

type ImportBehaviorsArgs = {
  classId: Id<"classes">;
  sourceClassId: Id<"classes">;
};

export function useImportBehaviorsFromClass() {
  const { t } = useTranslation("behaviors");
  const { t: tCommon } = useTranslation("common");
  const queryClient = useQueryClient();
  const mutationFn = useConvexMutation(api.behaviors.importFromClass);

  return useMutation({
    mutationFn: (args: ImportBehaviorsArgs) => mutationFn(args),
    onSuccess: async (_result, args) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: behaviorsListQueryKey(args.classId) }),
        queryClient.invalidateQueries({ queryKey: behaviorFoldersListQueryKey(args.classId) }),
      ]);
    },
    onError: (error) => {
      toast.add({
        title: messageFromError(error, t("importFailed"), tCommon("rateLimited")),
        type: "error",
      });
    },
  });
}
