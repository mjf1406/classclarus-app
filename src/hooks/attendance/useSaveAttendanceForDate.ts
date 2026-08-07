import { useConvexMutation } from "@convex-dev/react-query";
import { useTranslation } from "react-i18next";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { toast } from "@/components/ui/toast-manager";
import { attendanceForDateQueryKey } from "@/hooks/attendance/useAttendanceForDate";
import { useOptimisticMutation } from "@/hooks/useOptimisticMutation";
import type { AttendanceForDate, AttendanceStatus } from "@/lib/attendance/attendance";
import { messageFromError } from "@/lib/errors/convexError";
import { randomClientId } from "@/lib/optimistic";

type SaveAttendanceForDateArgs = {
  classId: Id<"classes">;
  dateKey: string;
  records: Array<{ studentUserId: Id<"users">; status: AttendanceStatus }>;
};

export function useSaveAttendanceForDate() {
  const { t } = useTranslation("attendance");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.attendance.saveForDate);

  return useOptimisticMutation({
    mutationFn: (args: SaveAttendanceForDateArgs) => mutationFn(args),
    queryKeys: (args) => [attendanceForDateQueryKey(args.classId, args.dateKey)],
    applyOptimisticUpdate: (queryClient, args) => {
      const queryKey = attendanceForDateQueryKey(args.classId, args.dateKey);
      const now = Date.now();
      queryClient.setQueryData<AttendanceForDate>(queryKey, (old) => {
        const sessionId =
          old?.session?._id ?? (`optimistic:${randomClientId()}` as Id<"attendanceSessions">);
        const takenBy = old?.session?.takenBy ?? (`optimistic:${randomClientId()}` as Id<"users">);
        const createdAt = old?.session?.createdAt ?? now;
        const existingByStudent = new Map(
          (old?.records ?? []).map((record) => [record.studentUserId as string, record]),
        );
        const records = args.records.map((entry) => {
          const previous = existingByStudent.get(entry.studentUserId);
          return {
            _id: previous?._id ?? (`optimistic:${randomClientId()}` as Id<"attendanceRecords">),
            _creationTime: previous?._creationTime ?? now,
            classId: args.classId,
            sessionId,
            dateKey: args.dateKey,
            studentUserId: entry.studentUserId,
            status: entry.status,
            updatedAt: now,
            updatedBy: takenBy,
          };
        });
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
        title: messageFromError(error, t("saveFailed"), tCommon("rateLimited")),
        type: "error",
      });
    },
  });
}
