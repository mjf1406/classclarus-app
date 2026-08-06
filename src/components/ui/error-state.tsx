import type { ReactNode } from "react";
import { AlertTriangleIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import { AsyncButton } from "@/components/ui/async-button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

type ErrorStateProps = {
  icon?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  retryLabel?: ReactNode;
  onRetry?: () => void | Promise<void>;
  card?: boolean;
  className?: string;
};

function ErrorState({
  icon,
  title,
  description,
  retryLabel,
  onRetry,
  card = false,
  className,
}: ErrorStateProps) {
  const { t } = useTranslation("common");

  return (
    <Empty card={card} className={className} role="alert">
      <EmptyHeader>
        <EmptyMedia variant="icon" size="20">
          {icon ?? <AlertTriangleIcon aria-hidden="true" />}
        </EmptyMedia>
        <EmptyTitle>{title ?? t("errorTitle")}</EmptyTitle>
        <EmptyDescription>{description ?? t("errorDescription")}</EmptyDescription>
      </EmptyHeader>
      {onRetry ? (
        <EmptyContent>
          <AsyncButton onClick={onRetry}>{retryLabel ?? t("tryAgain")}</AsyncButton>
        </EmptyContent>
      ) : null}
    </Empty>
  );
}

export { ErrorState };
export type { ErrorStateProps };
