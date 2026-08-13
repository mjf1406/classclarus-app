import { runClientSeatingAlgorithm } from "@/lib/assigners/seating/runClientSeatingAlgorithm";
import type {
  RunClientSeatingAlgorithmArgs,
  RunClientSeatingAlgorithmResult,
} from "@/lib/assigners/seating/runClientSeatingAlgorithm";
import {
  isSeatingSolveResponse,
  type SeatingSolveRequest,
} from "@/lib/assigners/seating/seatingSolveWorkerProtocol";

/**
 * Run the seating solver off the main thread when Worker is available.
 * Falls back to a synchronous call in tests and environments without workers.
 */
export function runClientSeatingAlgorithmAsync(
  args: RunClientSeatingAlgorithmArgs,
): Promise<RunClientSeatingAlgorithmResult> {
  if (typeof Worker === "undefined") {
    return Promise.resolve(runClientSeatingAlgorithm(args));
  }

  return new Promise((resolve) => {
    const worker = new Worker(new URL("../../workers/seatingSolve.worker.ts", import.meta.url), {
      type: "module",
    });
    const requestId = 1;
    const fallback = () => {
      worker.terminate();
      resolve(runClientSeatingAlgorithm(args));
    };

    worker.onmessage = (event: MessageEvent<unknown>) => {
      if (!isSeatingSolveResponse(event.data) || event.data.requestId !== requestId) {
        return;
      }
      worker.terminate();
      resolve(event.data.result);
    };
    worker.onerror = () => {
      fallback();
    };

    const message: SeatingSolveRequest = { type: "solve", requestId, args };
    worker.postMessage(message);
  });
}
