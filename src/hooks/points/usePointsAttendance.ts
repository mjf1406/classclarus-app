import { useConvexMutation } from "@convex-dev/react-query";
import { useTranslation } from "react-i18next";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { toast } from "@/components/ui/toast-manager";
import { attendanceForDateQueryKey } from "@/hooks/attendance/useAttendanceForDate";
import { pointsBoardQueryKey } from "@/hooks/points/usePointsBoard";
import { useOptimisticMutation } from "@/hooks/useOptimisticMutation";
import { messageFromError } from "@/lib/errors/convexError";
import type { PointsBoard } from "@/lib/points/points";

type AttendanceArgs = {
  classId: Id<"classes">;
  studentUserId: Id<"users">;
  dateKey: string;
};

export function usePointsMarkAbsent() {
  const { t } = useTranslation("points");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.attendance.markStudentAbsent);

  return useOptimisticMutation({
    mutationFn: (args: AttendanceArgs) => mutationFn(args),
    queryKeys: (args) => [
      pointsBoardQueryKey(args.classId, args.dateKey),
      attendanceForDateQueryKey(args.classId, args.dateKey),
    ],
    applyOptimisticUpdate: (queryClient, args) => {
      const queryKey = pointsBoardQueryKey(args.classId, args.dateKey);
      queryClient.setQueryData<PointsBoard>(queryKey, (old) => {
        if (!old) return old;
        return old.map((student) =>
          student.userId === args.studentUserId
            ? { ...student, attendanceStatus: "absent" as const }
            : student,
        );
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

export function usePointsMarkPresent() {
  const { t } = useTranslation("points");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.attendance.markStudentPresent);

  return useOptimisticMutation({
    mutationFn: (args: AttendanceArgs) => mutationFn(args),
    queryKeys: (args) => [
      pointsBoardQueryKey(args.classId, args.dateKey),
      attendanceForDateQueryKey(args.classId, args.dateKey),
    ],
    applyOptimisticUpdate: (queryClient, args) => {
      const queryKey = pointsBoardQueryKey(args.classId, args.dateKey);
      queryClient.setQueryData<PointsBoard>(queryKey, (old) => {
        if (!old) return old;
        return old.map((student) =>
          student.userId === args.studentUserId
            ? { ...student, attendanceStatus: "present" as const }
            : student,
        );
      });
    },
    onError: (error) => {
      toast.add({
        title: messageFromError(error, t("markPresentFailed"), tCommon("rateLimited")),
        type: "error",
      });
    },
  });
}
