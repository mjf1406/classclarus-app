import { useConvexMutation } from "@convex-dev/react-query";
import { useTranslation } from "react-i18next";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { toast } from "@/components/ui/toast-manager";
import { seatAlgorithmSettingsQueryKey } from "@/hooks/assigners/useSeatAlgorithmSettings";
import { useOptimisticMutation } from "@/hooks/useOptimisticMutation";
import { messageFromError } from "@/lib/errors/convexError";

type UpdateSeatAlgorithmSettingsArgs = {
  classId: Id<"classes">;
  weights: {
    seat: number;
    zone: number;
    team: number;
    neighbor: number;
    gender: number;
    combination: number;
  };
  genderParity: {
    mode: "off" | "oddEven";
  };
};

export function useUpdateSeatAlgorithmSettings() {
  const { t } = useTranslation("assigners");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.seatAlgorithmSettings.update);

  return useOptimisticMutation({
    mutationFn: (args: UpdateSeatAlgorithmSettingsArgs) => mutationFn(args),
    queryKeys: (args) => [seatAlgorithmSettingsQueryKey(args.classId)],
    applyOptimisticUpdate: (queryClient, args) => {
      const now = Date.now();
      queryClient.setQueryData(seatAlgorithmSettingsQueryKey(args.classId), (old) =>
        old
          ? {
              ...old,
              weights: args.weights,
              genderParity: args.genderParity,
              updatedAt: now,
            }
          : old,
      );
    },
    onError: (error) => {
      toast.add({
        title: messageFromError(error, t("settingsSaveFailed"), tCommon("rateLimited")),
        type: "error",
      });
    },
  });
}
