import PendingComponent from "@/components/loading/PendingComponent";
import { useEntitlement } from "@/hooks/billing/useEntitlement";
import { useEnsureTrialGrant } from "@/hooks/billing/useEnsureTrialGrant";
import { useEffect, useState, type ReactNode } from "react";

/**
 * Bootstraps the card-less trial grant for new sessions.
 * Does not hard-redirect expired users — create-class and billing CTAs
 * enforce pay-to-create on the client; `classes.create` enforces on the server.
 */
export function BillingGate({ children }: { children: ReactNode }) {
  const { data, isPending, isAuthLoading, refetch } = useEntitlement();
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
        // Fall through — create stays server-gated if still no grant.
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

  return children;
}
