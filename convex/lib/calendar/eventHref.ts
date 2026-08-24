/** App path for a class calendar event detail page. */
export function calendarEventHref(classId: string, eventId: string): string {
  return `/class/${classId}/calendar/event/${eventId}`;
}
