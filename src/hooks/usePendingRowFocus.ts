import { useCallback, useEffect, useState } from "react";

const DEFAULT_ROW_ATTRIBUTE = "data-row-focus-key";
export const ROW_FOCUS_TARGET_ATTR = "data-row-focus-target";
const DEFAULT_FOCUS_SELECTOR = `[${ROW_FOCUS_TARGET_ATTR}], textarea, input:not([type="hidden"])`;
const DEFAULT_MAX_ATTEMPTS = 12;

export type UsePendingRowFocusOptions = {
  /** Row wrapper attribute name (without brackets). */
  rowAttribute?: string;
  /** Selector for the focusable control within the matched row. */
  focusSelector?: string;
  maxAttempts?: number;
};

type PendingFocusRequest = {
  rowKey: string;
  focusSelector?: string;
};

/**
 * After adding a dynamic form row, queue focus on its primary field once the row mounts.
 * Defers with setTimeout(0) so Enter on an Add button does not steal focus back.
 */
export function usePendingRowFocus(options?: UsePendingRowFocusOptions) {
  const rowAttribute = options?.rowAttribute ?? DEFAULT_ROW_ATTRIBUTE;
  const defaultFocusSelector = options?.focusSelector ?? DEFAULT_FOCUS_SELECTOR;
  const maxAttempts = options?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;

  const [pendingFocus, setPendingFocus] = useState<PendingFocusRequest | null>(null);

  const queueRowFocus = useCallback(
    (rowKey: string, requestOptions?: { focusSelector?: string }) => {
      setPendingFocus({ rowKey, focusSelector: requestOptions?.focusSelector });
    },
    [],
  );

  const clearPendingRowFocus = useCallback(() => {
    setPendingFocus(null);
  }, []);

  useEffect(() => {
    if (pendingFocus === null) return;

    const focusSelector = pendingFocus.focusSelector ?? defaultFocusSelector;

    let cancelled = false;
    let attempts = 0;

    const tryFocus = () => {
      if (cancelled) return;
      const row = document.querySelector<HTMLElement>(`[${rowAttribute}="${pendingFocus.rowKey}"]`);
      const target = row?.querySelector<HTMLElement>(focusSelector);
      if (target) {
        target.focus();
        target.scrollIntoView({ block: "nearest" });
        setPendingFocus(null);
        return;
      }
      attempts += 1;
      if (attempts < maxAttempts) {
        requestAnimationFrame(tryFocus);
      }
    };

    const timeoutId = window.setTimeout(tryFocus, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [defaultFocusSelector, maxAttempts, pendingFocus, rowAttribute]);

  return { queueRowFocus, clearPendingRowFocus, pendingRowKey: pendingFocus?.rowKey ?? null };
}

/** Attribute for row wrappers consumed by {@link usePendingRowFocus}. */
export const ROW_FOCUS_KEY_ATTR = DEFAULT_ROW_ATTRIBUTE;

export function rowFocusKeyProps(rowKey: string): { [ROW_FOCUS_KEY_ATTR]: string } {
  return { [ROW_FOCUS_KEY_ATTR]: rowKey };
}

/** Marks the primary field to receive focus when its row is queued. */
export function rowFocusTargetProps(): { [ROW_FOCUS_TARGET_ATTR]: true } {
  return { [ROW_FOCUS_TARGET_ATTR]: true };
}
