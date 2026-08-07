import { useConvexMutation } from "@convex-dev/react-query";
import { useTranslation } from "react-i18next";

import { api } from "../../../convex/_generated/api";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import { toast } from "@/components/ui/toast-manager";
import { classDetailQueryKey } from "@/hooks/classes/useClass";
import { classesListQueryKey } from "@/hooks/classes/useClasses";
import { groupsBoardQueryKey } from "@/hooks/groups/useGroupsBoard";
import { useOptimisticMutation } from "@/hooks/useOptimisticMutation";
import type { ClassPublic } from "@/lib/classes/classes";
import { messageFromError } from "@/lib/errors/convexError";
import { patchDoc } from "@/lib/optimistic";
import type { RosterNameOrder } from "@/lib/roster/roster";

type ClassDoc = Doc<"classes">;

type SetRosterNameFormatArgs = {
  classId: Id<"classes">;
  rosterNameOrder: RosterNameOrder;
  rosterNameSpace: boolean;
};

export function useSetRosterNameFormat() {
  const { t } = useTranslation("classes");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.classes.setRosterNameFormat);
  const listKey = classesListQueryKey();

  return useOptimisticMutation({
    mutationFn: (args: SetRosterNameFormatArgs) => mutationFn(args),
    queryKeys: (args) => [
      listKey,
      classDetailQueryKey(args.classId),
      groupsBoardQueryKey(args.classId),
    ],
    applyOptimisticUpdate: (queryClient, args) => {
      const detailKey = classDetailQueryKey(args.classId);
      const now = Date.now();
      const patch = {
        rosterNameOrder: args.rosterNameOrder,
        rosterNameSpace: args.rosterNameSpace,
        updatedAt: now,
      };
      queryClient.setQueryData<ClassPublic[]>(listKey, (old) => {
        if (!old) return old;
        return old.map((classDoc) =>
          classDoc._id === args.classId ? { ...classDoc, ...patch } : classDoc,
        );
      });
      queryClient.setQueryData<ClassDoc | null>(detailKey, (old) =>
        patchDoc(old ?? null, (doc) => ({ ...doc, ...patch })),
      );
    },
    onError: (error) => {
      toast.add({
        title: messageFromError(error, t("rosterNameFormatSaveFailed"), tCommon("rateLimited")),
        type: "error",
      });
    },
  });
}
