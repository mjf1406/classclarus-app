import { useMutation, useQueryClient } from "@tanstack/react-query";
import { convexQuery, useConvexMutation } from "@convex-dev/react-query";
import { useTranslation } from "react-i18next";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { toast } from "@/components/ui/toast-manager";
import { messageFromError } from "@/lib/errors/convexError";

type SetSuspendedArgs = {
  classId: Id<"classes">;
  userId: Id<"users">;
  suspended: boolean;
};

function listQueryKey() {
  return convexQuery(api.classes.listMine, {}).queryKey;
}

function permissionsQueryKey(classId: Id<"classes">) {
  return convexQuery(api.permissions.forClass, { classId }).queryKey;
}

/**
 * Suspend / unsuspend a class member.
 * People-list optimistic updates land when those pages exist; for now we invalidate
 * the class list + permission snapshot so a suspended viewer's UI reconciles.
 */
export function useSetMemberSuspended() {
  const { t } = useTranslation("classes");
  const { t: tCommon } = useTranslation("common");
  const queryClient = useQueryClient();
  const mutationFn = useConvexMutation(api.members.setSuspended);

  return useMutation({
    mutationFn: (args: SetSuspendedArgs) => mutationFn(args),
    onMutate: async (args) => {
      const listKey = listQueryKey();
      const permsKey = permissionsQueryKey(args.classId);
      await queryClient.cancelQueries({ queryKey: listKey });
      await queryClient.cancelQueries({ queryKey: permsKey });
      return { listKey, permsKey };
    },
    onError: (error) => {
      toast.add({
        title: messageFromError(error, t("suspendFailed"), tCommon("rateLimited")),
        type: "error",
      });
    },
    onSettled: (_data, _error, variables, context) => {
      if (context?.listKey) {
        void queryClient.invalidateQueries({ queryKey: context.listKey });
      }
      if (context?.permsKey) {
        void queryClient.invalidateQueries({ queryKey: context.permsKey });
      }
      if (variables?.classId) {
        void queryClient.invalidateQueries({
          queryKey: convexQuery(api.classes.get, { classId: variables.classId }).queryKey,
        });
      }
    },
  });
}
