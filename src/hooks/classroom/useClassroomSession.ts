import { useEffect, useState } from "react";

import { isElectronClassroom, type ClassroomSession } from "@/lib/classroom/classroomSession";

/**
 * IPC-only classroom server status (Electron). No Convex query — no gcTime.
 * Returns null outside the Electron shell.
 */
export function useClassroomSession(): ClassroomSession | null {
  const [session, setSession] = useState<ClassroomSession | null>(null);

  useEffect(() => {
    if (!isElectronClassroom() || !window.classroom) {
      return;
    }
    let cancelled = false;
    void window.classroom.getSession().then((next) => {
      if (!cancelled) setSession(next);
    });
    const unsubscribe = window.classroom.onSession((next) => {
      setSession(next);
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  return session;
}
