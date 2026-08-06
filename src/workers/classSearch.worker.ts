import {
  filterClassIds,
  type ClassSearchRequest,
  type ClassSearchResponse,
} from "../lib/classes/classSearch";

function isClassSearchRequest(data: unknown): data is ClassSearchRequest {
  if (typeof data !== "object" || data === null) {
    return false;
  }
  const candidate = data as Partial<ClassSearchRequest>;
  return (
    candidate.type === "search" &&
    typeof candidate.requestId === "number" &&
    typeof candidate.query === "string" &&
    Array.isArray(candidate.items)
  );
}

self.onmessage = (event: MessageEvent<unknown>) => {
  if (!isClassSearchRequest(event.data)) {
    return;
  }

  const { requestId, query, items } = event.data;
  const response: ClassSearchResponse = {
    type: "searchResult",
    requestId,
    ids: filterClassIds(items, query),
  };
  self.postMessage(response);
};
