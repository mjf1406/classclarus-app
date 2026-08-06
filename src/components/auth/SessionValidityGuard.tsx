import { useEffect, useRef } from "react";
import { useAuthActions, useConvexAuth } from "@convex-dev/auth/react";
import { useNavigate } from "@tanstack/react-router";

import { useCurrentSession } from "@/hooks/user/useCurrentSession";

/**
 * Convex Auth JWTs stay valid until expiry even after `invalidateSessions`
 * deletes the session row. Watch the live session document and force a local
 * sign-out + redirect when the JWT is still present but the session is gone
 * (e.g. admin password reset).
 */
export function SessionValidityGuard() {
  const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth();
  const session = useCurrentSession();
  const { signOut } = useAuthActions();
  const navigate = useNavigate();
  const signingOutRef = useRef(false);

  useEffect(() => {
    if (
      !isAuthenticated ||
      isAuthLoading ||
      session.isPending ||
      session.isError ||
      session.data !== null ||
      signingOutRef.current
    ) {
      return;
    }

    signingOutRef.current = true;
    void (async () => {
      try {
        await signOut();
        await navigate({ to: "/login" });
      } finally {
        signingOutRef.current = false;
      }
    })();
  }, [
    isAuthenticated,
    isAuthLoading,
    navigate,
    session.data,
    session.isError,
    session.isPending,
    signOut,
  ]);

  return null;
}
