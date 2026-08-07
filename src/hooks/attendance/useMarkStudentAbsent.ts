import { useConvexMutation } from "@convex-dev/react-query";
import { useTranslation } from "react-i18next";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { toast } from "@/components/ui/toast-manager";
import { attendanceForDateQueryKey } from "@/hooks/attendance/useAttendanceForDate";
import { useOptimisticMutation } from "@/hooks/useOptimisticMutation";
import type { AttendanceForDate } from "@/lib/attendance/attendance";
import { messageFromError } from "@/lib/errors/convexError";
import { randomClientId } from "@/lib/optimistic";

type MarkStudentAbsentArgs = {
  classId: Id<"classes">;
  studentUserId: Id<"users">;
  dateKey: string;
};

/** Optimistic mark-absent for student card ActionMenus (wired elsewhere). */
export function useMarkStudentAbsent() {
  const { t } = useTranslation("attendance");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.attendance.markStudentAbsent);

  return useOptimisticMutation({
    mutationFn: (args: MarkStudentAbsentArgs) => mutationFn(args),
    queryKeys: (args) => [attendanceForDateQueryKey(args.classId, args.dateKey)],
    applyOptimisticUpdate: (queryClient, args) => {
      const queryKey = attendanceForDateQueryKey(args.classId, args.dateKey);
      const now = Date.now();
      queryClient.setQueryData<AttendanceForDate>(queryKey, (old) => {
        const sessionId =
          old?.session?._id ?? (`optimistic:${randomClientId()}` as Id<"attendanceSessions">);
        const takenBy = old?.session?.takenBy ?? (`optimistic:${randomClientId()}` as Id<"users">);
        const createdAt = old?.session?.createdAt ?? now;
        const records = [...(old?.records ?? [])];
        const index = records.findIndex((record) => record.studentUserId === args.studentUserId);
        const nextRecord = {
          _id:
            index >= 0
              ? records[index]!._id
              : (`optimistic:${randomClientId()}` as Id<"attendanceRecords">),
          _creationTime: index >= 0 ? records[index]!._creationTime : now,
          classId: args.classId,
          sessionId,
          dateKey: args.dateKey,
          studentUserId: args.studentUserId,
          status: "absent" as const,
          updatedAt: now,
          updatedBy: takenBy,
        };
        if (index >= 0) {
          records[index] = nextRecord;
        } else {
          records.push(nextRecord);
        }
        return {
          session: {
            _id: sessionId,
            _creationTime: old?.session?._creationTime ?? now,
            classId: args.classId,
            dateKey: args.dateKey,
            takenBy,
            createdAt,
            updatedAt: now,
          },
          records,
        };
      });
    },
    onError: (error) => {
      toast.add({
        title: messageFromError(error, t("markAbsentFailed"), tCommon("rateLimited")),
        type: "error",
      });
    },
  });
}
