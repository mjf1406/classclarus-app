import {
  filterActivityIds,
  type ActivityLogFilterRequest,
  type ActivityLogFilterResponse,
} from "../lib/activity/activityLogFilter";

function isActivityLogFilterRequest(data: unknown): data is ActivityLogFilterRequest {
  if (typeof data !== "object" || data === null) {
    return false;
  }
  const candidate = data as Partial<ActivityLogFilterRequest>;
  return (
    candidate.type === "filter" &&
    typeof candidate.requestId === "number" &&
    Array.isArray(candidate.items) &&
    typeof candidate.criteria === "object" &&
    candidate.criteria !== null
  );
}

self.onmessage = (event: MessageEvent<unknown>) => {
  if (!isActivityLogFilterRequest(event.data)) {
    return;
  }

  const { requestId, items, criteria } = event.data;
  const response: ActivityLogFilterResponse = {
    type: "filterResult",
    requestId,
    ids: filterActivityIds(items, criteria),
  };
  self.postMessage(response);
};
