import { Link, useNavigate } from "@tanstack/react-router";
import { MoreVertical, Plus, RockingChair } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { SeatLayoutNameCredenza } from "@/components/assigners/SeatLayoutNameCredenza";
import { DeleteNamedCredenza } from "@/components/groups/DeleteNamedCredenza";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useCreateSeatLayout } from "@/hooks/assigners/useCreateSeatLayout";
import { useRemoveSeatLayout } from "@/hooks/assigners/useRemoveSeatLayout";
import { useRenameSeatLayout } from "@/hooks/assigners/useRenameSeatLayout";
import { useSeatLayouts } from "@/hooks/assigners/useSeatLayouts";
import { useCan } from "@/hooks/permissions/useCan";
import type { SeatLayoutListItem } from "@/lib/assigners/seatLayouts";
import type { Id } from "../../../convex/_generated/dataModel";

const SEATS_GRID_CLASS = "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3";

type AssignersSeatsPageProps = {
  classId: Id<"classes">;
};

export function AssignersSeatsPage({ classId }: AssignersSeatsPageProps) {
  const { t } = useTranslation("assigners");
  const navigate = useNavigate();
  const { can } = useCan();
  const canManage = can("assigners:manage");
  const { data, isPending, isError, refetch } = useSeatLayouts(classId);
  const createLayout = useCreateSeatLayout();
  const renameLayout = useRenameSeatLayout();
  const removeLayout = useRemoveSeatLayout();
  const [createOpen, setCreateOpen] = useState(false);
  const [renaming, setRenaming] = useState<SeatLayoutListItem | null>(null);
  const [deleting, setDeleting] = useState<SeatLayoutListItem | null>(null);

  return (
    <div className="flex w-full flex-col gap-4 px-4 py-8 sm:px-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t("seatsTitle")}</h1>
          <p className="hidden text-muted-foreground sm:block">{t("seatsDescription")}</p>
        </div>
        {canManage ? (
          <Button type="button" onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            {t("createLayout")}
          </Button>
        ) : null}
      </div>

      {isPending ? (
        <div className={SEATS_GRID_CLASS}>
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-28 w-full rounded-2xl" />
          ))}
        </div>
      ) : null}

      {isError ? (
        <ErrorState
          title={t("loadFailed")}
          description={t("loadFailedDescription")}
          onRetry={() => void refetch()}
        />
      ) : null}

      {!isPending && !isError && data && data.length === 0 ? (
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <RockingChair />
            </EmptyMedia>
            <EmptyTitle>{t("emptyTitle")}</EmptyTitle>
            <EmptyDescription>{t("emptyDescription")}</EmptyDescription>
          </EmptyHeader>
          {canManage ? (
            <EmptyContent>
              <Button type="button" onClick={() => setCreateOpen(true)}>
                <Plus className="size-4" />
                {t("createLayout")}
              </Button>
            </EmptyContent>
          ) : null}
        </Empty>
      ) : null}

      {!isPending && !isError && data && data.length > 0 ? (
        <ul className={SEATS_GRID_CLASS}>
          {data.map((layout) => (
            <li key={layout._id}>
              <Card size="sm" className="relative transition-colors hover:bg-accent/40">
                <Link
                  to="/class/$classId/assigners/seats/$layoutId"
                  params={{ classId, layoutId: layout._id }}
                  className="absolute inset-0 z-0 rounded-[inherit] outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  aria-label={t("openLayout", { name: layout.name })}
                />
                <CardHeader className="relative z-10 flex flex-row items-start gap-3 pointer-events-none">
                  <div className="min-w-0 flex-1">
                    <CardTitle className="truncate text-base font-semibold">
                      {layout.name}
                    </CardTitle>
                    <CardDescription className="mt-1">
                      {t("deskCount", { count: layout.deskCount })}
                    </CardDescription>
                  </div>
                  {canManage ? (
                    <div className="shrink-0 pointer-events-auto">
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={<Button type="button" variant="ghost" size="icon-sm" />}
                        >
                          <MoreVertical className="size-4" />
                          <span className="sr-only">{t("layoutActions")}</span>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setRenaming(layout)}>
                            {t("renameLayout")}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => setDeleting(layout)}
                          >
                            {t("deleteLayout")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ) : null}
                </CardHeader>
              </Card>
            </li>
          ))}
        </ul>
      ) : null}

      {canManage ? (
        <>
          <SeatLayoutNameCredenza
            open={createOpen}
            onOpenChange={setCreateOpen}
            title={t("createLayoutTitle")}
            description={t("createLayoutDescription")}
            onSubmit={async (name) => {
              const layoutId = await createLayout.mutateAsync({ classId, name });
              await navigate({
                to: "/class/$classId/assigners/seats/$layoutId",
                params: { classId, layoutId },
              });
            }}
          />
          <SeatLayoutNameCredenza
            open={renaming !== null}
            onOpenChange={(open) => {
              if (!open) setRenaming(null);
            }}
            title={t("renameLayoutTitle")}
            description={t("createLayoutDescription")}
            initialName={renaming?.name ?? ""}
            onSubmit={async (name) => {
              if (!renaming) return;
              await renameLayout.mutateAsync({
                classId,
                layoutId: renaming._id,
                name,
              });
            }}
          />
          <DeleteNamedCredenza
            open={deleting !== null}
            onOpenChange={(open) => {
              if (!open) setDeleting(null);
            }}
            title={t("deleteLayoutTitle")}
            description={t("deleteLayoutDescription", { name: deleting?.name ?? "" })}
            confirmLabel={t("confirmDelete")}
            onConfirm={async () => {
              if (!deleting) return;
              await removeLayout.mutateAsync({ classId, layoutId: deleting._id });
            }}
          />
        </>
      ) : null}
    </div>
  );
}
