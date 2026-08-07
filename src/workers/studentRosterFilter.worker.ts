import {
  filterStudentRosterIds,
  type StudentRosterFilterRequest,
  type StudentRosterFilterResponse,
} from "../lib/students/studentRosterFilter";

function isStudentRosterFilterRequest(data: unknown): data is StudentRosterFilterRequest {
  if (typeof data !== "object" || data === null) {
    return false;
  }
  const candidate = data as Partial<StudentRosterFilterRequest>;
  return (
    candidate.type === "filter" &&
    typeof candidate.requestId === "number" &&
    Array.isArray(candidate.items) &&
    typeof candidate.membershipByUserId === "object" &&
    candidate.membershipByUserId !== null &&
    typeof candidate.criteria === "object" &&
    candidate.criteria !== null
  );
}

self.onmessage = (event: MessageEvent<unknown>) => {
  if (!isStudentRosterFilterRequest(event.data)) {
    return;
  }

  const { requestId, items, membershipByUserId, criteria } = event.data;
  const response: StudentRosterFilterResponse = {
    type: "filterResult",
    requestId,
    ids: filterStudentRosterIds(items, membershipByUserId, criteria),
  };
  self.postMessage(response);
};
