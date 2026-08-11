import type { SeatingAlgorithmInput, SeatingAlgorithmResult } from "./types.js";

export class SeatingAlgorithmNotImplementedError extends Error {
  readonly code = "SEATING_ALGORITHM_NOT_IMPLEMENTED" as const;

  constructor() {
    super("Seating algorithm is not implemented yet.");
    this.name = "SeatingAlgorithmNotImplementedError";
  }
}

/** Client-run solver — called via `runClientSeatingAlgorithm`. Implement here. */
export function solveSeating(_input: SeatingAlgorithmInput): SeatingAlgorithmResult {
  console.log("solveSeating called with input:", _input);
  throw new SeatingAlgorithmNotImplementedError();
}
