import PendingComponent from "@/components/loading/PendingComponent";
import { useEntitlement } from "@/hooks/billing/useEntitlement";
import { useEnsureTrialGrant } from "@/hooks/billing/useEnsureTrialGrant";
import { Navigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

const ALLOWLIST_PREFIXES = ["/billing", "/account"] as const;

function isAllowlisted(pathname: string): boolean {
  return ALLOWLIST_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/**
 * Hard gate: expired trial (no active subscription) may only visit
 * `/billing` and `/account`.
 */
export function BillingGate({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data, entitlement, isPending, isAuthLoading, refetch } = useEntitlement();
  const { mutateAsync: ensureTrialGrant } = useEnsureTrialGrant();
  const [ensureSettled, setEnsureSettled] = useState(false);

  useEffect(() => {
    if (isAuthLoading || isPending || !data) {
      return;
    }
    if (data.trialEndsAt !== null || data.subscriptionStatus !== null) {
      setEnsureSettled(true);
      return;
    }
    let cancelled = false;
    void ensureTrialGrant()
      .then(async () => {
        await refetch();
      })
      .catch(() => {
        // Fall through — treat as expired if still no grant.
      })
      .finally(() => {
        if (!cancelled) {
          setEnsureSettled(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [data, ensureTrialGrant, isAuthLoading, isPending, refetch]);

  if (isAuthLoading || isPending || !ensureSettled) {
    return <PendingComponent inset />;
  }

  if (entitlement?.status === "expired" && !isAllowlisted(pathname)) {
    return <Navigate to="/billing" replace />;
  }

  return children;
}
