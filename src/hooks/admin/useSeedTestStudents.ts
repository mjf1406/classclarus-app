import { useConvexMutation } from "@convex-dev/react-query";
import type { QueryKey } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { toast } from "@/components/ui/toast-manager";
import { classMemberCountsQueryKey } from "@/hooks/members/useClassMemberCounts";
import { classMembersByRoleQueryKey } from "@/hooks/members/useClassMembersByRole";
import { studentRosterQueryKey } from "@/hooks/roster/useStudentRoster";
import { useOptimisticMutation } from "@/hooks/useOptimisticMutation";
import { messageFromError } from "@/lib/errors/convexError";

export type SeedTestStudentsArgs = {
  classId: Id<"classes">;
  boyCount: number;
  girlCount: number;
  namePrefix?: string;
  replaceExistingSeed?: boolean;
};

export type SeedTestStudentsResult = {
  created: number;
  removed: number;
  boyCount: number;
  girlCount: number;
};

/**
 * Admin-only bulk seed. No optimistic roster patch — invalidates member/roster caches on settle.
 * No dedicated query / gcTime (uses existing admin soft-checks at 1 minute).
 */
export function useSeedTestStudents() {
  const { t } = useTranslation("admin");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.adminSeed.seedTestStudents);

  return useOptimisticMutation({
    mutationFn: (args: SeedTestStudentsArgs) => mutationFn(args),
    queryKeys: (args) => {
      const keys: QueryKey[] = [
        studentRosterQueryKey(args.classId),
        classMembersByRoleQueryKey(args.classId, "student"),
        classMemberCountsQueryKey(args.classId),
      ];
      return keys;
    },
    onError: (error) => {
      toast.add({
        title: messageFromError(error, t("seedFailed"), tCommon("rateLimited")),
        type: "error",
      });
    },
  });
}
