import { useEffect, useState } from "react";

import { isElectronClassroom, type AppUpdateStatus } from "@/lib/classroom/classroomSession";

/**
 * IPC-only desktop update status (Electron). No Convex query — no gcTime.
 * Returns null outside the Electron shell.
 */
export function useAppUpdate(): AppUpdateStatus | null {
  const [status, setStatus] = useState<AppUpdateStatus | null>(null);

  useEffect(() => {
    if (!isElectronClassroom() || !window.classroom?.getUpdateStatus) {
      return;
    }
    let cancelled = false;
    void window.classroom.getUpdateStatus().then((next) => {
      if (!cancelled) setStatus(next);
    });
    const unsubscribe = window.classroom.onUpdate((next) => {
      setStatus(next);
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  return status;
}
