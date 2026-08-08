import {
  filterAndSortPointsLedgerIds,
  type PointsLedgerFilterRequest,
  type PointsLedgerFilterResponse,
} from "../lib/points/pointsLedgerFilter";

function isPointsLedgerFilterRequest(data: unknown): data is PointsLedgerFilterRequest {
  if (typeof data !== "object" || data === null) {
    return false;
  }
  const candidate = data as Partial<PointsLedgerFilterRequest>;
  return (
    candidate.type === "filter" &&
    typeof candidate.requestId === "number" &&
    Array.isArray(candidate.items) &&
    typeof candidate.criteria === "object" &&
    candidate.criteria !== null
  );
}

self.onmessage = (event: MessageEvent<unknown>) => {
  if (!isPointsLedgerFilterRequest(event.data)) {
    return;
  }

  const { requestId, items, criteria } = event.data;
  const response: PointsLedgerFilterResponse = {
    type: "filterResult",
    requestId,
    ids: filterAndSortPointsLedgerIds(items, criteria),
  };
  self.postMessage(response);
};
