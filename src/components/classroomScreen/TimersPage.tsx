import { useState } from "react";
import { MoreHorizontal, Plus, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { CreateTimerDialog } from "@/components/classroomScreen/CreateTimerDialog";
import { DeleteConfirmDialog } from "@/components/classroomScreen/DeleteConfirmDialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDeleteClassroomTimer } from "@/hooks/classroomScreen/useClassroomScreenMutations";
import {
  useClassroomTimers,
  type ClassroomTimer,
} from "@/hooks/classroomScreen/useClassroomScreenQueries";
import type { Id } from "../../../convex/_generated/dataModel";
import { formatDurationLabel } from "@/lib/classroomScreen/timerUtils";

interface TimersPageProps {
  classId: Id<"classes">;
}

export function TimersPage({ classId }: TimersPageProps) {
  const { t } = useTranslation("classroomScreen");
  const { data, isLoading } = useClassroomTimers(classId);
  const deleteTimer = useDeleteClassroomTimer();
  const timers = data ?? [];
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTimer, setEditingTimer] = useState<ClassroomTimer | null>(null);
  const [deletingTimer, setDeletingTimer] = useState<ClassroomTimer | null>(null);

  const openCreateDialog = () => {
    setEditingTimer(null);
    setDialogOpen(true);
  };

  const openEditDialog = (timer: ClassroomTimer) => {
    setEditingTimer(timer);
    setDialogOpen(true);
  };

  const handleCardClick = (e: React.MouseEvent, timer: ClassroomTimer) => {
    if (
      (e.target as HTMLElement).closest('[role="menu"]') ||
      (e.target as HTMLElement).closest("button")
    ) {
      return;
    }
    openEditDialog(timer);
  };

  return (
    <div className="mx-auto w-full max-w-5xl p-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">{t("timersTitle")}</h1>
        <Button onClick={openCreateDialog}>
          <Plus />
          {t("createTimer")}
        </Button>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">{t("timersLoading")}</p>
      ) : timers.length === 0 ? (
        <div className="rounded-xl border border-dashed p-12 text-center">
          <p className="text-muted-foreground">{t("timersEmpty")}</p>
          <Button className="mt-4" variant="outline" onClick={openCreateDialog}>
            <Plus />
            {t("timersCreateFirst")}
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {timers.map((timer) => (
            <div
              key={timer._id}
              className="relative cursor-pointer overflow-hidden rounded-xl ring-1 ring-foreground/10 transition-opacity hover:opacity-90"
              onClick={(e) => handleCardClick(e, timer)}
            >
              <div
                className="absolute inset-0 opacity-20"
                style={{ backgroundColor: timer.bgColor }}
              />
              <div className="relative flex flex-col gap-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate font-medium">{timer.name}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {timer.endTime
                        ? t("timerEndsAt", { time: timer.endTime })
                        : formatDurationLabel(timer.durationSeconds, t)}
                    </p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        />
                      }
                    >
                      <MoreHorizontal />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeletingTimer(timer);
                        }}
                      >
                        <Trash2 />
                        {t("delete")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <CreateTimerDialog
        classId={classId}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        timer={editingTimer}
      />

      <DeleteConfirmDialog
        open={deletingTimer !== null}
        onOpenChange={(open) => !open && setDeletingTimer(null)}
        itemName={deletingTimer?.name ?? ""}
        onConfirm={async () => {
          if (deletingTimer) {
            await deleteTimer.mutateAsync({
              classId,
              timerId: deletingTimer._id,
            });
          }
        }}
      />
    </div>
  );
}
