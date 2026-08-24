import { useConvexMutation } from "@convex-dev/react-query";
import { useTranslation } from "react-i18next";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { toast } from "@/components/ui/toast-manager";
import {
  findCalendarRangeQueryKeys,
  patchCalendarRanges,
} from "@/hooks/calendar/useCalendarEventsInRange";
import { useOptimisticMutation } from "@/hooks/useOptimisticMutation";
import type { CalendarEvent } from "@/lib/calendar/calendar";
import { messageFromError } from "@/lib/errors/convexError";
import { randomClientId } from "@/lib/optimistic";
import type { CalendarEventFormValues } from "../../../convex/lib/calendar/calendarEventSchema";
import { normalizeCalendarEventInput } from "../../../convex/lib/calendar/calendarEventSchema";

type CreateCalendarEventArgs = CalendarEventFormValues & {
  classId: Id<"classes">;
  classTimeZone?: string;
  attachmentFileIds?: Array<Id<"files">>;
};

export function useCreateCalendarEvent() {
  const { t } = useTranslation("calendar");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.calendar.create);

  return useOptimisticMutation({
    mutationFn: (args: CreateCalendarEventArgs) =>
      mutationFn({
        classId: args.classId,
        title: args.title,
        description: args.description,
        allDay: args.allDay,
        startDateKey: args.startDateKey,
        startTime: args.startTime,
        endDateKey: args.endDateKey,
        endTime: args.endTime,
        audienceKind: args.audienceKind,
        audienceRoles: args.audienceRoles,
        reminders: args.reminders,
        attachmentFileIds: args.attachmentFileIds,
      }),
    queryKeys: (args, queryClient) => findCalendarRangeQueryKeys(queryClient, args.classId),
    applyOptimisticUpdate: (queryClient, args) => {
      let normalized;
      try {
        normalized = normalizeCalendarEventInput(args, args.classTimeZone);
      } catch {
        return;
      }
      const now = Date.now();
      const attachmentFileIds = args.attachmentFileIds ?? [];
      const next: CalendarEvent = {
        _id: `optimistic:${randomClientId()}` as Id<"calendarEvents">,
        _creationTime: now,
        classId: args.classId,
        title: normalized.title,
        description: normalized.description,
        allDay: normalized.allDay,
        timezone: normalized.timezone,
        startAt: normalized.startAt,
        endAt: normalized.endAt,
        startDateKey: normalized.startDateKey,
        endDateKey: normalized.endDateKey,
        audienceKind: normalized.audienceKind,
        audienceRoles: normalized.audienceRoles,
        attachmentFileIds,
        attachments: attachmentFileIds.map((fileId) => ({
          fileId,
          name: "",
          contentType: "application/octet-stream",
          size: 0,
          preset: "documents",
        })),
        createdBy: `optimistic:${randomClientId()}` as Id<"users">,
        createdAt: now,
        updatedAt: now,
        reminders: normalized.reminders.map((reminder) => ({
          _id: `optimistic:${randomClientId()}` as Id<"calendarEventReminders">,
          amount: reminder.amount,
          unit: reminder.unit,
          notifyRoles: reminder.notifyRoles,
          notifyAt: now,
          status: "scheduled",
        })),
      };
      patchCalendarRanges(queryClient, args.classId, (old) => [next, ...old]);
    },
    onError: (error) => {
      toast.add({
        title: messageFromError(error, t("saveFailed"), tCommon("rateLimited")),
        type: "error",
      });
    },
  });
}
