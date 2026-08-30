import { useState } from "react";
import { MoreHorizontal, Plus, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { CreateRotationDialog } from "@/components/classroomScreen/CreateRotationDialog";
import { DeleteConfirmDialog } from "@/components/classroomScreen/DeleteConfirmDialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDeleteClassroomRotation } from "@/hooks/classroomScreen/useClassroomScreenMutations";
import {
  useClassroomRotations,
  type ClassroomRotation,
} from "@/hooks/classroomScreen/useClassroomScreenQueries";
import type { Id } from "../../../convex/_generated/dataModel";
import { formatDurationLabel } from "@/lib/classroomScreen/timerUtils";

interface RotationsPageProps {
  classId: Id<"classes">;
}

export function RotationsPage({ classId }: RotationsPageProps) {
  const { t } = useTranslation("classroomScreen");
  const { data, isLoading } = useClassroomRotations(classId);
  const deleteRotation = useDeleteClassroomRotation();
  const rotations = data ?? [];
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRotation, setEditingRotation] = useState<ClassroomRotation | null>(null);
  const [deletingRotation, setDeletingRotation] = useState<ClassroomRotation | null>(null);

  const openCreateDialog = () => {
    setEditingRotation(null);
    setDialogOpen(true);
  };

  const openEditDialog = (rotation: ClassroomRotation) => {
    setEditingRotation(rotation);
    setDialogOpen(true);
  };

  const handleCardClick = (e: React.MouseEvent, rotation: ClassroomRotation) => {
    if (
      (e.target as HTMLElement).closest('[role="menu"]') ||
      (e.target as HTMLElement).closest("button")
    ) {
      return;
    }
    openEditDialog(rotation);
  };

  return (
    <div className="mx-auto w-full max-w-5xl p-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">{t("rotationsTitle")}</h1>
        <Button onClick={openCreateDialog}>
          <Plus />
          {t("createRotation")}
        </Button>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">{t("rotationsLoading")}</p>
      ) : rotations.length === 0 ? (
        <div className="rounded-xl border border-dashed p-12 text-center">
          <p className="text-muted-foreground">{t("rotationsEmpty")}</p>
          <Button className="mt-4" variant="outline" onClick={openCreateDialog}>
            <Plus />
            {t("rotationsCreateFirst")}
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rotations.map((rotation) => (
            <div
              key={rotation._id}
              className="relative cursor-pointer overflow-hidden rounded-xl ring-1 ring-foreground/10 transition-opacity hover:opacity-90"
              onClick={(e) => handleCardClick(e, rotation)}
            >
              <div
                className="absolute inset-0 opacity-20"
                style={{ backgroundColor: rotation.rotationBgColor }}
              />
              <div className="relative flex flex-col gap-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate font-medium">{rotation.name}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {t("rotationCardSummary", {
                        count: rotation.numberOfRotations,
                        duration: formatDurationLabel(rotation.rotationDurationSeconds, t),
                      })}
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
                          setDeletingRotation(rotation);
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

      <CreateRotationDialog
        classId={classId}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        rotation={editingRotation}
      />

      <DeleteConfirmDialog
        open={deletingRotation !== null}
        onOpenChange={(open) => !open && setDeletingRotation(null)}
        itemName={deletingRotation?.name ?? ""}
        onConfirm={async () => {
          if (deletingRotation) {
            await deleteRotation.mutateAsync({
              classId,
              rotationId: deletingRotation._id,
            });
          }
        }}
      />
    </div>
  );
}
