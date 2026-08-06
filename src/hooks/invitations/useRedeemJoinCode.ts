import { useMutation, useQueryClient } from "@tanstack/react-query";
import { convexQuery, useConvexMutation } from "@convex-dev/react-query";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

type RedeemJoinCodeArgs = {
  code: string;
};

export function useRedeemJoinCode() {
  const queryClient = useQueryClient();
  const mutationFn = useConvexMutation(api.joinCodes.redeem);

  return useMutation({
    mutationFn: (args: RedeemJoinCodeArgs) => mutationFn(args),
    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: convexQuery(api.classes.listMine, {}).queryKey,
        }),
        queryClient.invalidateQueries({
          queryKey: convexQuery(api.classes.get, { classId: result.classId }).queryKey,
        }),
        queryClient.invalidateQueries({
          queryKey: convexQuery(api.permissions.forClass, { classId: result.classId }).queryKey,
        }),
      ]);
    },
  });
}

export type RedeemJoinCodeResult = {
  classId: Id<"classes">;
  role: string;
};
