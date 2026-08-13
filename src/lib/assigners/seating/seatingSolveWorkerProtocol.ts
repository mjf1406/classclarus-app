import type {
  RunClientSeatingAlgorithmArgs,
  RunClientSeatingAlgorithmResult,
} from "./runClientSeatingAlgorithm";

export type SeatingSolveRequest = {
  type: "solve";
  requestId: number;
  args: RunClientSeatingAlgorithmArgs;
};

export type SeatingSolveResponse = {
  type: "solveResult";
  requestId: number;
  result: RunClientSeatingAlgorithmResult;
};

export function isSeatingSolveRequest(data: unknown): data is SeatingSolveRequest {
  if (typeof data !== "object" || data === null) return false;
  const candidate = data as Partial<SeatingSolveRequest>;
  return (
    candidate.type === "solve" && typeof candidate.requestId === "number" && candidate.args != null
  );
}

export function isSeatingSolveResponse(data: unknown): data is SeatingSolveResponse {
  if (typeof data !== "object" || data === null) return false;
  const candidate = data as Partial<SeatingSolveResponse>;
  return (
    candidate.type === "solveResult" &&
    typeof candidate.requestId === "number" &&
    candidate.result != null
  );
}
