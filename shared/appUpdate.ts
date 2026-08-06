export type AppUpdatePhase =
  | "idle"
  | "checking"
  | "available"
  | "downloading"
  | "ready"
  | "not-available"
  | "error";

export type AppUpdateStatus = {
  phase: AppUpdatePhase;
  currentVersion: string;
  availableVersion: string | null;
  /** Download progress 0–100, when phase is downloading. */
  progress: number | null;
  errorMessage: string | null;
};

export const APP_UPDATE_IPC = {
  getStatus: "appUpdate:getStatus",
  onStatus: "appUpdate:onStatus",
  check: "appUpdate:check",
  quitAndInstall: "appUpdate:quitAndInstall",
} as const;
