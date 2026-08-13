import { runClientSeatingAlgorithm } from "../lib/assigners/seating/runClientSeatingAlgorithm";
import {
  isSeatingSolveRequest,
  type SeatingSolveResponse,
} from "../lib/assigners/seating/seatingSolveWorkerProtocol";

self.onmessage = (event: MessageEvent<unknown>) => {
  if (!isSeatingSolveRequest(event.data)) return;
  const { requestId, args } = event.data;
  const response: SeatingSolveResponse = {
    type: "solveResult",
    requestId,
    result: runClientSeatingAlgorithm(args),
  };
  self.postMessage(response);
};
