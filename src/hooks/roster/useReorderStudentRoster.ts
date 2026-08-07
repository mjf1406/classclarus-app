import { useConvexMutation } from "@convex-dev/react-query";
import { useTranslation } from "react-i18next";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { toast } from "@/components/ui/toast-manager";
import { studentRosterQueryKey } from "@/hooks/roster/useStudentRoster";
import { useOptimisticMutation } from "@/hooks/useOptimisticMutation";
import { messageFromError } from "@/lib/errors/convexError";
import type { StudentRosterEntry } from "@/lib/roster/roster";

export type ReorderStudentRosterArgs = {
  classId: Id<"classes">;
  userIds: Id<"users">[];
};

export function useReorderStudentRoster() {
  const { t } = useTranslation("classes");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.studentRosters.reorder);

  return useOptimisticMutation({
    mutationFn: (args: ReorderStudentRosterArgs) =>
      mutationFn({ classId: args.classId, userIds: args.userIds }),
    queryKeys: (args) => [studentRosterQueryKey(args.classId)],
    applyOptimisticUpdate: (queryClient, args) => {
      const key = studentRosterQueryKey(args.classId);
      queryClient.setQueryData<StudentRosterEntry[]>(key, (old) => {
        if (!old) return old;
        const byId = new Map(old.map((entry) => [entry.userId, entry] as const));
        const next: StudentRosterEntry[] = [];
        for (let i = 0; i < args.userIds.length; i++) {
          const entry = byId.get(args.userIds[i]);
          if (!entry) continue;
          next.push({ ...entry, rosterNumber: i + 1 });
        }
        return next;
      });
    },
    onError: (error) => {
      toast.add({
        title: messageFromError(error, t("rosterReorderFailed"), tCommon("rateLimited")),
        type: "error",
      });
    },
  });
}
