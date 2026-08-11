import { useConvexMutation } from "@convex-dev/react-query";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { toast } from "@/components/ui/toast-manager";
import { seatAlgorithmSettingsQueryKey } from "@/hooks/assigners/useSeatAlgorithmSettings";
import { messageFromError } from "@/lib/errors/convexError";

type ImportSeatAlgorithmSettingsArgs = {
  classId: Id<"classes">;
  sourceClassId: Id<"classes">;
};

export function useImportSeatAlgorithmSettings() {
  const { t } = useTranslation("assigners");
  const { t: tCommon } = useTranslation("common");
  const queryClient = useQueryClient();
  const mutationFn = useConvexMutation(api.seatAlgorithmSettings.importFromClass);

  return useMutation({
    mutationFn: (args: ImportSeatAlgorithmSettingsArgs) => mutationFn(args),
    onSuccess: async (_result, args) => {
      await queryClient.invalidateQueries({
        queryKey: seatAlgorithmSettingsQueryKey(args.classId),
      });
    },
    onError: (error) => {
      toast.add({
        title: messageFromError(error, t("settingsImportFailed"), tCommon("rateLimited")),
        type: "error",
      });
    },
  });
}
