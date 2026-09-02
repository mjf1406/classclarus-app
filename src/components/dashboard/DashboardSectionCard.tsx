import { Link } from "@tanstack/react-router";
import { ExternalLink } from "lucide-react";
import type { ReactNode } from "react";

import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type DashboardSectionCardProps = {
  title: string;
  viewAllLabel: string;
  viewAllTo: string;
  viewAllParams: Record<string, string>;
  viewAllOpenInNewTab?: boolean;
  isPending?: boolean;
  isError?: boolean;
  errorTitle?: string;
  errorDescription?: string;
  onRetry?: () => void;
  empty?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  pendingFallback?: ReactNode;
  headerAction?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function DashboardSectionCard({
  title,
  viewAllLabel,
  viewAllTo,
  viewAllParams,
  viewAllOpenInNewTab = false,
  isPending = false,
  isError = false,
  errorTitle,
  errorDescription,
  onRetry,
  empty = false,
  emptyTitle,
  emptyDescription,
  pendingFallback,
  headerAction,
  children,
  className,
}: DashboardSectionCardProps) {
  return (
    <Card className={cn("h-full", className)}>
      <CardHeader className="border-b">
        <CardTitle>{title}</CardTitle>
        <CardAction>
          <div className="flex items-center gap-2">
            {headerAction}
            <Link
              to={viewAllTo}
              params={viewAllParams}
              target={viewAllOpenInNewTab ? "_blank" : undefined}
              rel={viewAllOpenInNewTab ? "noopener noreferrer" : undefined}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
            >
              {viewAllLabel}
              {viewAllOpenInNewTab ? <ExternalLink className="size-3.5" aria-hidden /> : null}
            </Link>
          </div>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 py-4">
        {isPending
          ? (pendingFallback ?? (
              <div className="flex flex-col gap-2">
                <Skeleton className="h-10 w-full rounded-lg" />
                <Skeleton className="h-10 w-full rounded-lg" />
                <Skeleton className="h-10 w-full rounded-lg" />
              </div>
            ))
          : null}
        {!isPending && isError ? (
          <ErrorState title={errorTitle ?? ""} description={errorDescription} onRetry={onRetry} />
        ) : null}
        {!isPending && !isError && empty ? (
          <Empty className="border-none p-0">
            <EmptyHeader>
              <EmptyTitle>{emptyTitle}</EmptyTitle>
              {emptyDescription ? <EmptyDescription>{emptyDescription}</EmptyDescription> : null}
            </EmptyHeader>
          </Empty>
        ) : null}
        {!isPending && !isError && !empty ? children : null}
      </CardContent>
    </Card>
  );
}
