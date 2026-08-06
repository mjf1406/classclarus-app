import { useEffect, useRef, useState } from "react";
import { CheckIcon } from "lucide-react";
import type { Button as ButtonPrimitive } from "@base-ui/react/button";
import type { VariantProps } from "class-variance-authority";

import { Button } from "@/components/ui/button";
import type { PendingClickHandler } from "@/components/ui/button-pending";
import { usePendingClick } from "@/components/ui/button-pending";
import { buttonVariants } from "@/components/ui/button-variants";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

const SUCCESS_DURATION_MS = 750;

type AsyncButtonProps = Omit<ButtonPrimitive.Props, "onClick"> &
  VariantProps<typeof buttonVariants> & {
    pending?: boolean;
    onClick?: PendingClickHandler;
  };

function AsyncButton({
  pending: pendingProp,
  disabled,
  onClick,
  className,
  children,
  ...props
}: AsyncButtonProps) {
  const [succeeded, setSucceeded] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
        if (result instanceof Promise) {
          return result.then(
            () => {
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

  const overlay = pending ? (
    <span className="absolute inset-0 flex items-center justify-center">
      <Spinner />
    </span>
  ) : succeeded ? (
    <span className="absolute inset-0 flex items-center justify-center">
      <CheckIcon aria-hidden="true" className="animate-in fade-in-0 zoom-in-95 duration-200" />
    </span>
  ) : null;

  return (
    <Button
      disabled={resolvedDisabled}
      aria-busy={pending || undefined}
      onClick={handleClick}
      className={cn("relative", className)}
      {...props}
    >
      <span
        className={cn("inline-flex items-center gap-1.5", (pending || succeeded) && "invisible")}
      >
        {children}
      </span>
      {overlay}
    </Button>
  );
}

export { AsyncButton };
export type { AsyncButtonProps };
