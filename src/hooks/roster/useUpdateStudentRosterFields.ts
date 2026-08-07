import { useConvexMutation } from "@convex-dev/react-query";
import { useTranslation } from "react-i18next";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { toast } from "@/components/ui/toast-manager";
import { studentRosterQueryKey } from "@/hooks/roster/useStudentRoster";
import { useOptimisticMutation } from "@/hooks/useOptimisticMutation";
import { messageFromError } from "@/lib/errors/convexError";
import type { GenderOption, PronounOption, StudentRosterEntry } from "@/lib/roster/roster";

export type UpdateStudentRosterFieldsArgs = {
  classId: Id<"classes">;
  userId: Id<"users">;
  firstName?: string | null;
  lastName?: string | null;
  gender?: GenderOption | null;
  genderSelfDescribe?: string | null;
  pronouns?: PronounOption | null;
  pronounsSelfDescribe?: string | null;
};

export function useUpdateStudentRosterFields() {
  const { t } = useTranslation("classes");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.studentRosters.updateFields);

  return useOptimisticMutation({
    mutationFn: (args: UpdateStudentRosterFieldsArgs) =>
      mutationFn({
        classId: args.classId,
        userId: args.userId,
        firstName: args.firstName,
        lastName: args.lastName,
        gender: args.gender,
        genderSelfDescribe: args.genderSelfDescribe,
        pronouns: args.pronouns,
        pronounsSelfDescribe: args.pronounsSelfDescribe,
      }),
    queryKeys: (args) => [studentRosterQueryKey(args.classId)],
    applyOptimisticUpdate: (queryClient, args) => {
      const key = studentRosterQueryKey(args.classId);
      queryClient.setQueryData<StudentRosterEntry[]>(key, (old) => {
        if (!old) return old;
        return old.map((entry) => {
          if (entry.userId !== args.userId) return entry;
          const next: StudentRosterEntry = { ...entry };
          if (args.firstName !== undefined) {
            next.firstName = args.firstName === null ? undefined : args.firstName;
          }
          if (args.lastName !== undefined) {
            next.lastName = args.lastName === null ? undefined : args.lastName;
          }
          if (args.gender !== undefined) {
            if (args.gender === null) {
              next.gender = undefined;
              next.genderSelfDescribe = undefined;
            } else {
              next.gender = args.gender;
              if (args.gender !== "selfDescribe") {
                next.genderSelfDescribe = undefined;
              }
            }
          }
          if (args.genderSelfDescribe !== undefined) {
            next.genderSelfDescribe =
              args.genderSelfDescribe === null ? undefined : args.genderSelfDescribe;
          }
          if (args.pronouns !== undefined) {
            if (args.pronouns === null) {
              next.pronouns = undefined;
              next.pronounsSelfDescribe = undefined;
            } else {
              next.pronouns = args.pronouns;
              if (args.pronouns !== "askSelfDescribe") {
                next.pronounsSelfDescribe = undefined;
              }
            }
          }
          if (args.pronounsSelfDescribe !== undefined) {
            next.pronounsSelfDescribe =
              args.pronounsSelfDescribe === null ? undefined : args.pronounsSelfDescribe;
          }
          return next;
        });
      });
    },
    onError: (error) => {
      toast.add({
        title: messageFromError(error, t("rosterUpdateFailed"), tCommon("rateLimited")),
        type: "error",
      });
    },
  });
}
