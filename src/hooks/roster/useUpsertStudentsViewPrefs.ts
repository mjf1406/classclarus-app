import { useConvexMutation } from "@convex-dev/react-query";
import { useTranslation } from "react-i18next";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { toast } from "@/components/ui/toast-manager";
import { classUserSettingsQueryKey } from "@/hooks/roster/useClassUserSettings";
import { useOptimisticMutation } from "@/hooks/useOptimisticMutation";
import { messageFromError } from "@/lib/errors/convexError";
import type { ClassUserSettingsPublic, StudentsViewMode } from "@/lib/roster/roster";

export type UpsertStudentsViewPrefsArgs = {
  classId: Id<"classes">;
  studentsViewMode?: StudentsViewMode;
  studentsColumnOrder?: string[];
  studentsColumnVisibility?: Record<string, boolean>;
};

export function useUpsertStudentsViewPrefs() {
  const { t } = useTranslation("classes");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.classUserSettings.upsertStudentsView);

  return useOptimisticMutation({
    mutationFn: (args: UpsertStudentsViewPrefsArgs) =>
      mutationFn({
        classId: args.classId,
        studentsViewMode: args.studentsViewMode,
        studentsColumnOrder: args.studentsColumnOrder,
        studentsColumnVisibility: args.studentsColumnVisibility,
      }),
    queryKeys: (args) => [classUserSettingsQueryKey(args.classId)],
    applyOptimisticUpdate: (queryClient, args) => {
      const key = classUserSettingsQueryKey(args.classId);
      queryClient.setQueryData<ClassUserSettingsPublic | null>(key, (old) => {
        const base: ClassUserSettingsPublic = old ?? {};
        return {
          ...base,
          ...(args.studentsViewMode !== undefined
            ? { studentsViewMode: args.studentsViewMode }
            : {}),
          ...(args.studentsColumnOrder !== undefined
            ? { studentsColumnOrder: args.studentsColumnOrder }
            : {}),
          ...(args.studentsColumnVisibility !== undefined
            ? { studentsColumnVisibility: args.studentsColumnVisibility }
            : {}),
        };
      });
    },
    onError: (error) => {
      toast.add({
        title: messageFromError(error, t("rosterPrefsFailed"), tCommon("rateLimited")),
        type: "error",
      });
    },
  });
}
