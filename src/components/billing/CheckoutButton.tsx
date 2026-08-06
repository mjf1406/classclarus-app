import { PolarEmbedCheckout } from "@polar-sh/checkout/embed";

import type { VariantProps } from "class-variance-authority";
import type { ReactNode } from "react";

import { AsyncButton } from "@/components/ui/async-button";
import { buttonVariants } from "@/components/ui/button-variants";
import { useCreateCheckoutLink } from "@/hooks/billing/useCreateCheckoutLink";
import { assertSafePolarCheckoutUrl } from "@/lib/billing/polarUrl";

type CheckoutButtonProps = {
  productId: string;
  theme: "dark" | "light";
  children: ReactNode;
  className?: string;
  variant?: VariantProps<typeof buttonVariants>["variant"];
};

/**
 * App-owned checkout trigger. Unlike `@convex-dev/polar`'s `CheckoutLink`,
 * this always clears pending UI and surfaces errors via toast.
 */
export function CheckoutButton({
  productId,
  theme,
  children,
  className,
  variant = "secondary",
}: CheckoutButtonProps) {
  const createCheckoutLink = useCreateCheckoutLink();

  return (
    <AsyncButton
      type="button"
      variant={variant}
      className={className}
      onClick={async () => {
        PolarEmbedCheckout.init();
        const { url } = await createCheckoutLink.mutateAsync({ productId });
        await PolarEmbedCheckout.create(assertSafePolarCheckoutUrl(url), { theme });
      }}
    >
      {children}
    </AsyncButton>
  );
}
