import { useEffect, useRef, useState } from "react";
import { CheckIcon } from "lucide-react";
import type { Button as ButtonPrimitive } from "@base-ui/react/button";
import type { VariantProps } from "class-variance-authority";

import { Button } from "@/components/ui/button";
import { usePendingClick, type PendingClickHandler } from "@/components/ui/button-pending";
import { buttonVariants } from "@/components/ui/button-variants";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

const SUCCESS_DURATION_MS = 750;

type ProgressButtonProps = Omit<ButtonPrimitive.Props, "onClick"> &
  VariantProps<typeof buttonVariants> & {
    pending?: boolean;
    progress: number;
    onClick?: PendingClickHandler;
    /** Called when the success checkmark is shown. */
    onSuccess?: () => void;
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
  onSuccess,
  className,
  children,
  size,
  ...props
}: ProgressButtonProps) {
  const [succeeded, setSucceeded] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const iconOnly = size === "icon" || size === "icon-sm";

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const showSuccess = () => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
    }
    setSucceeded(true);
    onSuccess?.();
    timeoutRef.current = setTimeout(() => {
      setSucceeded(false);
      timeoutRef.current = null;
    }, SUCCESS_DURATION_MS);
  };

  const wrappedOnClick: PendingClickHandler | undefined = onClick
    ? (event) => {
        if (timeoutRef.current !== null) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        setSucceeded(false);

        const result = onClick(event);
        // Only auto-success for async clicks; sync / fire-and-forget stay idle.
        if (result instanceof Promise) {
          return result.then(
            (value) => {
              if (value === false) {
                return false;
              }
              showSuccess();
            },
            () => {
              // Leave idle — no success checkmark on rejection.
            },
          );
        }
        return result;
      }
    : undefined;

  const {
    pending,
    disabled: resolvedDisabled,
    onClick: handleClick,
  } = usePendingClick({
    pending: pendingProp,
    disabled,
    onClick: wrappedOnClick,
  });

  const clamped = clampProgress(progress);
  const displayPercent = Math.round(clamped);
  const showProgress = pending && !succeeded;

  return (
    <Button
      disabled={resolvedDisabled || succeeded}
      aria-busy={pending || undefined}
      onClick={handleClick}
      size={size}
      className={cn("relative overflow-hidden", className)}
      {...props}
    >
      {showProgress ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 bg-primary-foreground/20 transition-[width]"
          style={{ width: `${clamped}%` }}
        />
      ) : null}
      <span
        className={cn(
          "relative inline-flex items-center gap-1.5",
          (showProgress || succeeded) && "invisible",
        )}
      >
        {children}
      </span>
      {showProgress ? (
        <span className="absolute inset-0 z-10 flex items-center justify-center gap-1.5">
          <Spinner />
          {iconOnly ? null : (
            <span data-slot="progress-label" className="tabular-nums">
              {displayPercent}%
            </span>
          )}
        </span>
      ) : null}
      {succeeded ? (
        <span className="absolute inset-0 z-10 flex items-center justify-center">
          <CheckIcon aria-hidden="true" className="animate-in fade-in-0 zoom-in-95 duration-200" />
        </span>
      ) : null}
    </Button>
  );
}

export { ProgressButton };
export type { ProgressButtonProps };
