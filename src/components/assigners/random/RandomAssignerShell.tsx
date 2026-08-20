import { Link } from "@tanstack/react-router";
import { ArrowLeft, Pencil, Play } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import {
  RandomAssignerTabs,
  type RandomAssignerTab,
} from "@/components/assigners/random/RandomAssignerTabs";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useRandomAssigner } from "@/hooks/assigners/random/useRandomAssigners";
import { useCan } from "@/hooks/permissions/useCan";
import type { Id } from "../../../../convex/_generated/dataModel";

type RandomAssignerShellProps = {
  classId: Id<"classes">;
  assignerId: Id<"randomAssigners">;
  tab: RandomAssignerTab;
  description: string;
  onRunClick?: () => void;
  children: ReactNode;
};

export function RandomAssignerShell({
  classId,
  assignerId,
  tab,
  description,
  onRunClick,
  children,
}: RandomAssignerShellProps) {
  const { t } = useTranslation("assigners");
  const { can } = useCan();
  const canManage = can("assigners:manage");
  const { data: assigner, isPending, isError, refetch } = useRandomAssigner(classId, assignerId);

  if (isError) {
    return (
      <div className="flex w-full flex-col gap-4 px-4 py-8 sm:px-8">
        <ErrorState
          title={t("randomLoadFailed")}
          description={t("randomLoadFailedDescription")}
          onRetry={() => void refetch()}
        />
      </div>
    );
  }

  if (isPending || !assigner) {
    return (
      <div className="flex w-full flex-col gap-4 px-4 py-8 sm:px-8">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-10 w-full max-w-md" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-6 px-4 py-8 sm:px-8">
      <div className="flex flex-wrap items-start gap-3">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          nativeButton={false}
          render={
            <Link
              to="/class/$classId/assigners/random"
              params={{ classId }}
              aria-label={t("randomBackToList")}
            />
          }
        >
          <ArrowLeft className="size-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold tracking-tight">{assigner.name}</h1>
          <p className="mt-1 hidden text-sm text-muted-foreground sm:block">{description}</p>
        </div>
        {canManage ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              nativeButton={false}
              render={
                <Link
                  to="/class/$classId/assigners/random/$assignerId/edit"
                  params={{ classId, assignerId }}
                />
              }
            >
              <Pencil className="size-4" />
              {t("randomEdit")}
            </Button>
            {onRunClick ? (
              <Button type="button" onClick={onRunClick}>
                <Play className="size-4" />
                {t("randomRunAction")}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      <RandomAssignerTabs classId={classId} assignerId={assignerId} value={tab} />

      <p className="text-sm text-muted-foreground sm:hidden">{description}</p>

      {children}
    </div>
  );
}
