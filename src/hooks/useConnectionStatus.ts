import { useEffect, useMemo, useRef, useState } from "react";
import { useConvexConnectionState } from "convex/react";

export type ConnectionStatus = "connected" | "connecting" | "reconnecting" | "offline";

const DISCONNECTED_DEBOUNCE_MS = 2000;

export function useConnectionStatus() {
  const connectionState = useConvexConnectionState();
  const { isWebSocketConnected, hasEverConnected } = connectionState;

  const [status, setStatus] = useState<ConnectionStatus>(() => {
    if (isWebSocketConnected) {
      return "connected";
    }
    return hasEverConnected ? "reconnecting" : "connecting";
  });

  const hasRealOutageRef = useRef(false);
  const disconnectTimerRef = useRef<number | null>(null);
  const [restoredNonce, setRestoredNonce] = useState(0);

  const clearDisconnectTimer = () => {
    if (disconnectTimerRef.current !== null) {
      window.clearTimeout(disconnectTimerRef.current);
      disconnectTimerRef.current = null;
    }
  };

  useEffect(() => {
    // Always clear on render path changes.
    clearDisconnectTimer();

    if (isWebSocketConnected) {
      if (hasRealOutageRef.current) {
        setRestoredNonce((n) => n + 1);
      }
      hasRealOutageRef.current = false;
      setStatus("connected");
      return;
    }

    if (!hasEverConnected) {
      setStatus("connecting");
      return;
    }

    // Disconnected after a successful initial connection: debounce the UI so
    // brief blips don't show a warning.
    setStatus("reconnecting");
    disconnectTimerRef.current = window.setTimeout(() => {
      hasRealOutageRef.current = true;
      setStatus("offline");
      disconnectTimerRef.current = null;
    }, DISCONNECTED_DEBOUNCE_MS);
  }, [hasEverConnected, isWebSocketConnected]);

  // Avoid re-renders from unrelated fields.
  return useMemo(
    () => ({
      status,
      restoredNonce,
      connectionState,
    }),
    [status, restoredNonce, connectionState],
  );
}
