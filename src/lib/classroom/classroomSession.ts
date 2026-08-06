import type { AppUpdateStatus } from "../../../shared/appUpdate";
import type { ClassroomSession } from "../../../shared/classroomSession";

export type { ClassroomSession } from "../../../shared/classroomSession";
export type { AppUpdateStatus } from "../../../shared/appUpdate";

declare global {
  interface Window {
    classroom?: {
      getSession: () => Promise<ClassroomSession>;
      onSession: (listener: (session: ClassroomSession) => void) => () => void;
      getUpdateStatus: () => Promise<AppUpdateStatus>;
      onUpdate: (listener: (status: AppUpdateStatus) => void) => () => void;
      checkForUpdates: () => Promise<void>;
      quitAndInstall: () => Promise<void>;
    };
  }
}

/** True when running inside the Electron shell with classroom preload. */
export function isElectronClassroom(): boolean {
  return typeof window !== "undefined" && typeof window.classroom?.getSession === "function";
}

/**
 * Preferred public origin for join links / QR in Electron (LAN URL).
 * Falls back to null so callers use window.location.origin.
 */
export function classroomJoinOrigin(session: ClassroomSession | null | undefined): string | null {
  if (!session) return null;
  return session.lanBaseUrl ?? session.loopbackBaseUrl ?? null;
}
