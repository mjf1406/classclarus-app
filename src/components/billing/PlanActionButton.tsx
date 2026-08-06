import { PolarEmbedCheckout } from "@polar-sh/checkout/embed";

import type { VariantProps } from "class-variance-authority";
import type { ReactNode } from "react";

import { AsyncButton } from "@/components/ui/async-button";
import { buttonVariants } from "@/components/ui/button-variants";
import { useChangeSubscription } from "@/hooks/billing/useChangeSubscription";
import { useCreateCheckoutLink } from "@/hooks/billing/useCreateCheckoutLink";
import { assertSafePolarCheckoutUrl } from "@/lib/billing/polarUrl";

type PlanActionButtonProps = {
  productId: string;
  theme: "dark" | "light";
  children: ReactNode;
  className?: string;
  variant?: VariantProps<typeof buttonVariants>["variant"];
  /** When true, switches the existing subscription instead of opening checkout. */
  changeExisting?: boolean;
};

/**
 * Checkout for new subscribers, or in-place plan change when already subscribed.
 */
export function PlanActionButton({
  productId,
  theme,
  children,
  className,
  variant = "secondary",
  changeExisting = false,
}: PlanActionButtonProps) {
  const createCheckoutLink = useCreateCheckoutLink();
  const changeSubscription = useChangeSubscription();

  return (
    <AsyncButton
      type="button"
      variant={variant}
      className={className}
      pending={changeExisting ? changeSubscription.isPending : undefined}
      onClick={async () => {
        if (changeExisting) {
          await changeSubscription.mutateAsync({ productId });
          return;
        }

        PolarEmbedCheckout.init();
        const { url } = await createCheckoutLink.mutateAsync({ productId });
        await PolarEmbedCheckout.create(assertSafePolarCheckoutUrl(url), { theme });
      }}
    >
      {children}
    </AsyncButton>
  );
}
