import {
  filterPointsCatalogIds,
  type PointsCatalogSearchRequest,
  type PointsCatalogSearchResponse,
} from "../lib/points/pointsCatalogSearch";

function isPointsCatalogSearchRequest(data: unknown): data is PointsCatalogSearchRequest {
  if (typeof data !== "object" || data === null) {
    return false;
  }
  const candidate = data as Partial<PointsCatalogSearchRequest>;
  return (
    candidate.type === "search" &&
    typeof candidate.requestId === "number" &&
    typeof candidate.query === "string" &&
    Array.isArray(candidate.items)
  );
}

self.onmessage = (event: MessageEvent<unknown>) => {
  if (!isPointsCatalogSearchRequest(event.data)) {
    return;
  }

  const { requestId, query, items } = event.data;
  const response: PointsCatalogSearchResponse = {
    type: "searchResult",
    requestId,
    ids: filterPointsCatalogIds(items, query),
  };
  self.postMessage(response);
};
