import { useState } from "react";
import type { MouseEvent, MouseEventHandler } from "react";

type PendingClickHandler = (event: MouseEvent<HTMLButtonElement>) => void | Promise<void>;

function usePendingClick({
  pending: pendingProp,
  disabled,
  onClick,
}: {
  pending?: boolean;
  disabled?: boolean;
  onClick?: PendingClickHandler;
}): {
  pending: boolean;
  disabled: boolean | undefined;
  onClick: MouseEventHandler<HTMLButtonElement> | undefined;
} {
  const [internalPending, setInternalPending] = useState(false);
  const controlled = pendingProp !== undefined;
  const pending = controlled ? pendingProp : internalPending;

  const handleClick: MouseEventHandler<HTMLButtonElement> | undefined = onClick
    ? (event) => {
        if (pending || disabled) {
          return;
        }

        const result = onClick(event);
        if (!controlled && result instanceof Promise) {
          setInternalPending(true);
          void result.finally(() => {
            setInternalPending(false);
          });
        }
      }
    : undefined;

  return {
    pending,
    disabled: disabled || pending || undefined,
    onClick: handleClick,
  };
}

export { usePendingClick };
export type { PendingClickHandler };
