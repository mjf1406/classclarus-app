import { useEffect, useRef } from "react";

import { activityRevisionsEqual, type ActivityRevision } from "@/lib/query/activityRevision";

const REVISION_REFRESH_DEBOUNCE_MS = 150;

/**
 * When a live revision tip diverges from the cached page revision, debounce
 * and invoke `onRefresh` once per burst (keeps mounted lists warm).
 */
export function useRevisionRefresh(
  liveRevision: ActivityRevision | undefined,
  cachedRevision: ActivityRevision | undefined,
  enabled: boolean,
  onRefresh: () => void,
): void {
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  useEffect(() => {
    if (!enabled) return;
    if (liveRevision === undefined || cachedRevision === undefined) return;
    if (activityRevisionsEqual(liveRevision, cachedRevision)) return;

    const timeoutId = window.setTimeout(() => {
      onRefreshRef.current();
    }, REVISION_REFRESH_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [liveRevision, cachedRevision, enabled]);
}
