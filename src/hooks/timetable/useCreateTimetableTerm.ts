import { useConvexMutation } from "@convex-dev/react-query";
import { useTranslation } from "react-i18next";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { toast } from "@/components/ui/toast-manager";
import { timetableTermsQueryKey } from "@/hooks/timetable/useTimetableQueries";
import { useOptimisticMutation } from "@/hooks/useOptimisticMutation";
import { messageFromError } from "@/lib/errors/convexError";
import { randomClientId } from "@/lib/optimistic";
import type { TimetableTerm, TimetableTermKind } from "@/lib/timetable/timetable";

type CreateTermArgs = {
  classId: Id<"classes">;
  name: string;
  kind: TimetableTermKind;
  startDateKey: string;
  endDateKey: string;
  days: Array<string>;
  startTime: string;
  endTime: string;
  copySlotsFromTermId?: Id<"timetableTerms">;
};

export function useCreateTimetableTerm() {
  const { t } = useTranslation("timetable");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.timetable.createTerm);

  return useOptimisticMutation({
    mutationFn: (args: CreateTermArgs) => mutationFn(args),
    queryKeys: (args) => [timetableTermsQueryKey(args.classId)],
    applyOptimisticUpdate: (queryClient, args) => {
      const key = timetableTermsQueryKey(args.classId);
      const now = Date.now();
      const optimistic: TimetableTerm = {
        _id: `optimistic:${randomClientId()}` as Id<"timetableTerms">,
        _creationTime: now,
        classId: args.classId,
        name: args.name,
        kind: args.kind,
        startDateKey: args.startDateKey,
        endDateKey: args.endDateKey,
        days: args.days,
        startTime: args.startTime,
        endTime: args.endTime,
        createdBy: `optimistic:${randomClientId()}` as Id<"users">,
        createdAt: now,
        updatedAt: now,
      };
      queryClient.setQueryData<Array<TimetableTerm>>(key, (old) => [...(old ?? []), optimistic]);
    },
    onError: (error) => {
      toast.add({
        title: messageFromError(error, t("saveFailed"), tCommon("rateLimited")),
        type: "error",
      });
    },
  });
}
