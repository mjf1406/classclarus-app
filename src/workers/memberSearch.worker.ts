import {
  filterMemberIds,
  type MemberSearchRequest,
  type MemberSearchResponse,
} from "../lib/members/memberSearch";

function isMemberSearchRequest(data: unknown): data is MemberSearchRequest {
  if (typeof data !== "object" || data === null) {
    return false;
  }
  const candidate = data as Partial<MemberSearchRequest>;
  return (
    candidate.type === "search" &&
    typeof candidate.requestId === "number" &&
    typeof candidate.query === "string" &&
    Array.isArray(candidate.items)
  );
}

self.onmessage = (event: MessageEvent<unknown>) => {
  if (!isMemberSearchRequest(event.data)) {
    return;
  }

  const { requestId, query, items } = event.data;
  const response: MemberSearchResponse = {
    type: "searchResult",
    requestId,
    ids: filterMemberIds(items, query),
  };
  self.postMessage(response);
};
