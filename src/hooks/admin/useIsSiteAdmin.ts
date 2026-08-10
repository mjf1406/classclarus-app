import { useIsAppAdmin } from "@/hooks/admin/useIsAppAdmin";
import { useIsFeedbackAdmin } from "@/hooks/feedback/useIsFeedbackAdmin";
import { isSelfHosted } from "@/lib/selfHosted";

/**
 * Whether the signed-in user is a site admin for tooling UI.
 * Self-host: `admin:manageUsers`. Cloud: `admin:viewFeedback`.
 */
export function useIsSiteAdmin() {
  const selfHosted = isSelfHosted();
  const selfHostAdmin = useIsAppAdmin();
  const feedbackAdmin = useIsFeedbackAdmin();

  const isAdmin = selfHosted ? selfHostAdmin.isAdmin : feedbackAdmin.isAdmin;
  const isPending = selfHosted ? selfHostAdmin.isPending : feedbackAdmin.isPending;

  return {
    isAdmin,
    isPending,
    isSelfHosted: selfHosted,
  };
}
