import { useEffect, useRef, useState } from "react";
import { CheckIcon, CopyIcon, LinkIcon } from "lucide-react";
import type { Button as ButtonPrimitive } from "@base-ui/react/button";
import { useTranslation } from "react-i18next";

import { cn } from "@/lib/utils";
import { copyText } from "@/lib/clipboard";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast-manager";

const SUCCESS_DURATION_MS = 750;

const SUCCESS_CLASSNAME =
  "border-green-600 bg-[color-mix(in_oklab,var(--background)_80%,var(--color-green-500)_20%)] text-green-700 hover:bg-[color-mix(in_oklab,var(--background)_80%,var(--color-green-500)_20%)] hover:text-green-700 dark:border-green-400 dark:text-green-400 dark:hover:text-green-400";

type CopyButtonProps = Omit<ButtonPrimitive.Props, "type" | "onClick" | "children"> & {
  type: "text" | "link";
  value: string;
};

function CopyButton({
  type,
  value,
  className,
  disabled,
  "aria-label": ariaLabel,
  ...props
}: CopyButtonProps) {
  const { t } = useTranslation("common");
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const defaultLabel = type === "link" ? t("copyLink") : t("copy");

  const handleClick = async () => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    try {
      await copyText(value);
      setCopied(true);
      timeoutRef.current = setTimeout(() => {
        setCopied(false);
        timeoutRef.current = null;
      }, SUCCESS_DURATION_MS);
    } catch {
      setCopied(false);
      toast.add({
        title: t("copyFailed"),
        description: t("copyFailedDescription"),
        type: "error",
      });
    }
  };

  const IdleIcon = type === "link" ? LinkIcon : CopyIcon;

  return (
    <Button
      variant="outline"
      size="icon"
      disabled={disabled}
      aria-label={copied ? t("copied") : (ariaLabel ?? defaultLabel)}
      className={cn(copied && SUCCESS_CLASSNAME, className)}
      onClick={() => {
        void handleClick();
      }}
      {...props}
    >
      {copied ? (
        <CheckIcon aria-hidden="true" className="animate-in fade-in-0 zoom-in-95 duration-200" />
      ) : (
        <IdleIcon aria-hidden="true" />
      )}
    </Button>
  );
}

export { CopyButton };
export type { CopyButtonProps };
