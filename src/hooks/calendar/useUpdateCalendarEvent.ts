import { useConvexMutation } from "@convex-dev/react-query";
import { useTranslation } from "react-i18next";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { toast } from "@/components/ui/toast-manager";
import { calendarEventQueryKey } from "@/hooks/calendar/useCalendarEvent";
import {
  findCalendarRangeQueryKeys,
  patchCalendarRanges,
} from "@/hooks/calendar/useCalendarEventsInRange";
import { useOptimisticMutation } from "@/hooks/useOptimisticMutation";
import type { CalendarEvent } from "@/lib/calendar/calendar";
import { messageFromError } from "@/lib/errors/convexError";
import type { CalendarEventFormValues } from "../../../convex/lib/calendar/calendarEventSchema";
import { normalizeCalendarEventInput } from "../../../convex/lib/calendar/calendarEventSchema";

type UpdateCalendarEventArgs = CalendarEventFormValues & {
  classId: Id<"classes">;
  eventId: Id<"calendarEvents">;
  classTimeZone?: string;
  attachmentFileIds?: Array<Id<"files">>;
};

export function useUpdateCalendarEvent() {
  const { t } = useTranslation("calendar");
  const { t: tCommon } = useTranslation("common");
  const mutationFn = useConvexMutation(api.calendar.update);

  return useOptimisticMutation({
    mutationFn: (args: UpdateCalendarEventArgs) =>
      mutationFn({
        classId: args.classId,
        eventId: args.eventId,
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
    queryKeys: (args, queryClient) => [
      ...findCalendarRangeQueryKeys(queryClient, args.classId),
      calendarEventQueryKey(args.classId, args.eventId),
    ],
    applyOptimisticUpdate: (queryClient, args) => {
      let normalized;
      try {
        normalized = normalizeCalendarEventInput(args, args.classTimeZone);
      } catch {
        return;
      }
      const now = Date.now();
      const patchEvent = (event: CalendarEvent): CalendarEvent => {
        const attachmentFileIds = args.attachmentFileIds ?? event.attachmentFileIds;
        return {
          ...event,
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
          attachments: attachmentFileIds.map((fileId) => {
            const existing = event.attachments.find((item) => item.fileId === fileId);
            return (
              existing ?? {
                fileId,
                name: "",
                contentType: "application/octet-stream",
                size: 0,
                preset: "documents",
              }
            );
          }),
          updatedAt: now,
          reminders: normalized.reminders.map((reminder, index) => ({
            _id:
              event.reminders[index]?._id ??
              (`optimistic:${index}` as Id<"calendarEventReminders">),
            amount: reminder.amount,
            unit: reminder.unit,
            notifyRoles: reminder.notifyRoles,
            notifyAt: event.reminders[index]?.notifyAt ?? now,
            status: "scheduled" as const,
          })),
        };
      };
      patchCalendarRanges(queryClient, args.classId, (old) =>
        old.map((event) => (event._id !== args.eventId ? event : patchEvent(event))),
      );
      queryClient.setQueryData<CalendarEvent | null>(
        calendarEventQueryKey(args.classId, args.eventId),
        (old) => (old ? patchEvent(old) : old),
      );
    },
    onError: (error) => {
      toast.add({
        title: messageFromError(error, t("saveFailed"), tCommon("rateLimited")),
        type: "error",
      });
    },
  });
}
