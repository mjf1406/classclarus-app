import type { Button as ButtonPrimitive } from "@base-ui/react/button";
import type { VariantProps } from "class-variance-authority";

import { Button } from "@/components/ui/button";
import type { PendingClickHandler } from "@/components/ui/button-pending";
import { usePendingClick } from "@/components/ui/button-pending";
import { buttonVariants } from "@/components/ui/button-variants";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

type ProgressButtonProps = Omit<ButtonPrimitive.Props, "onClick"> &
  VariantProps<typeof buttonVariants> & {
    pending?: boolean;
    progress: number;
    onClick?: PendingClickHandler;
  };

function clampProgress(progress: number): number {
  if (Number.isNaN(progress)) {
    return 0;
  }
  return Math.min(100, Math.max(0, progress));
}

function ProgressButton({
  pending: pendingProp,
  progress,
  disabled,
  onClick,
  className,
  children,
  ...props
}: ProgressButtonProps) {
  const {
    pending,
    disabled: resolvedDisabled,
    onClick: handleClick,
  } = usePendingClick({
    pending: pendingProp,
    disabled,
    onClick,
  });

  const clamped = clampProgress(progress);
  const displayPercent = Math.round(clamped);

  return (
    <Button
      disabled={resolvedDisabled}
      aria-busy={pending || undefined}
      onClick={handleClick}
      className={cn("relative overflow-hidden", className)}
      {...props}
    >
      {pending ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 bg-primary-foreground/20 transition-[width]"
          style={{ width: `${clamped}%` }}
        />
      ) : null}
      <span className={cn("relative inline-flex items-center gap-1.5", pending && "invisible")}>
        {children}
      </span>
      {pending ? (
        <span className="absolute inset-0 z-10 flex items-center justify-center gap-1.5">
          <Spinner />
          <span className="tabular-nums">{displayPercent}%</span>
        </span>
      ) : null}
    </Button>
  );
}

export { ProgressButton };
export type { ProgressButtonProps };
