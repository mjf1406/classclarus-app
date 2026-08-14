import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type DropAnimation,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { SmilePlus } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { BehaviorCard } from "@/components/behaviors/BehaviorCard";
import { BehaviorFormCredenza } from "@/components/behaviors/BehaviorFormCredenza";
import { BehaviorPointsApplyCredenza } from "@/components/behaviors/BehaviorPointsApplyCredenza";
import { BehaviorsToolbar } from "@/components/behaviors/BehaviorsToolbar";
import { ImportBehaviorsCredenza } from "@/components/behaviors/ImportBehaviorsCredenza";
import { FolderCard } from "@/components/folders/FolderCard";
import { FolderFormCredenza } from "@/components/folders/FolderFormCredenza";
import { FolderedCardGrid } from "@/components/folders/FolderedCardGrid";
import { DeleteNamedCredenza } from "@/components/groups/DeleteNamedCredenza";
import { Button } from "@/components/ui/button";
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
import { useCreateBehaviorFolder } from "@/hooks/behaviorFolders/useCreateBehaviorFolder";
import { useBehaviorFolders } from "@/hooks/behaviorFolders/useBehaviorFolders";
import { useRemoveBehaviorFolder } from "@/hooks/behaviorFolders/useRemoveBehaviorFolder";
import { useUpdateBehaviorFolder } from "@/hooks/behaviorFolders/useUpdateBehaviorFolder";
import { useCreateBehavior } from "@/hooks/behaviors/useCreateBehavior";
import { useBehaviors } from "@/hooks/behaviors/useBehaviors";
import { useImportBehaviorsFromClass } from "@/hooks/behaviors/useImportBehaviorsFromClass";
import { useRemoveBehavior } from "@/hooks/behaviors/useRemoveBehavior";
import { useUpdateBehavior } from "@/hooks/behaviors/useUpdateBehavior";
import { useCan } from "@/hooks/permissions/useCan";
import {
  filterBehaviorsByName,
  partitionBehaviorsByFolder,
  type BehaviorFolderListItem,
  type BehaviorFormValues,
  type BehaviorListItem,
  type PointsApplyMode,
} from "@/lib/behaviors/behaviors";
import { parseBehaviorDragId, parseFolderDropTarget } from "@/lib/folders/folderDnd";
import type { FolderFormValues } from "@/lib/folders/folders";
import type { Id } from "../../../convex/_generated/dataModel";

type BehaviorsPageProps = {
  classId: Id<"classes">;
};

/** Match DragOverlay settle so the source stays hidden until the drop lands. */
const DROP_ANIMATION_MS = 200;

export function BehaviorsPage({ classId }: BehaviorsPageProps) {
  const { t } = useTranslation("behaviors");
  const { can, isPending: permissionsPending } = useCan();
  const canManage = can("behaviors:manage");

  const foldersQuery = useBehaviorFolders(classId);
  const behaviorsQuery = useBehaviors(classId);
  const createBehavior = useCreateBehavior();
  const updateBehavior = useUpdateBehavior();
  const removeBehavior = useRemoveBehavior();
  const createFolder = useCreateBehaviorFolder();
  const updateFolder = useUpdateBehaviorFolder();
  const removeFolder = useRemoveBehaviorFolder();
  const importBehaviors = useImportBehaviorsFromClass();

  const [searchQuery, setSearchQuery] = useState("");
  const [createBehaviorOpen, setCreateBehaviorOpen] = useState(false);
  const [editingBehavior, setEditingBehavior] = useState<BehaviorListItem | null>(null);
  const [deletingBehavior, setDeletingBehavior] = useState<BehaviorListItem | null>(null);
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<BehaviorFolderListItem | null>(null);
  const [deletingFolder, setDeletingFolder] = useState<BehaviorFolderListItem | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [pendingPointsUpdate, setPendingPointsUpdate] = useState<{
    behavior: BehaviorListItem;
    values: BehaviorFormValues;
  } | null>(null);
  const [activeBehavior, setActiveBehavior] = useState<BehaviorListItem | null>(null);
  const [hiddenBehaviorId, setHiddenBehaviorId] = useState<Id<"behaviors"> | null>(null);
  const [pinnedFolderId, setPinnedFolderId] = useState<Id<"behaviorFolders"> | null>(null);
  const overRectRef = useRef<{ left: number; top: number } | null>(null);
  /** Unfiled is a sorted grid — flying to the zone origin looks like a ghost at index 0. */
  const fadeDropInPlaceRef = useRef(false);
  const dropSettleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const clearDragVisuals = useCallback(() => {
    if (dropSettleTimeoutRef.current !== null) {
      clearTimeout(dropSettleTimeoutRef.current);
      dropSettleTimeoutRef.current = null;
    }
    setActiveBehavior(null);
    setHiddenBehaviorId(null);
    setPinnedFolderId(null);
    overRectRef.current = null;
    fadeDropInPlaceRef.current = false;
  }, []);

  useEffect(() => {
    return () => {
      if (dropSettleTimeoutRef.current !== null) {
        clearTimeout(dropSettleTimeoutRef.current);
      }
    };
  }, []);

  // Animate the overlay into the droppable instead of back to the drag origin
  // (important when dragging out of a folder popover). Unfiled drops fade in place
  // so we don't land on the zone's top-left before the card appears in sort order.
  const dropAnimation = useMemo<DropAnimation>(
    () => ({
      duration: DROP_ANIMATION_MS,
      easing: "ease-out",
      keyframes({ transform: { initial }, dragOverlay }) {
        const over = overRectRef.current;
        if (!over || fadeDropInPlaceRef.current) {
          return [
            { transform: CSS.Translate.toString(initial), opacity: "1" },
            { transform: CSS.Translate.toString(initial), opacity: "0" },
          ];
        }
        const final = {
          x: initial.x + over.left - dragOverlay.rect.left + 8,
          y: initial.y + over.top - dragOverlay.rect.top + 8,
          scaleX: 1,
          scaleY: 1,
        };
        return [
          { transform: CSS.Translate.toString(initial), opacity: "1" },
          { transform: CSS.Translate.toString(final), opacity: "0" },
        ];
      },
    }),
    [],
  );

  const isPending = foldersQuery.isPending || behaviorsQuery.isPending || permissionsPending;
  const isError = foldersQuery.isError || behaviorsQuery.isError;

  const folders = foldersQuery.data;
  const behaviors = behaviorsQuery.data;

  const filteredBehaviors = useMemo(
    () => filterBehaviorsByName(behaviors ?? [], searchQuery),
    [behaviors, searchQuery],
  );

  const unfiledBehaviors = useMemo(
    () => partitionBehaviorsByFolder(filteredBehaviors, null),
    [filteredBehaviors],
  );

  const visibleFolders = useMemo(() => {
    const folderList = folders ?? [];
    if (!searchQuery.trim()) return folderList;
    return folderList.filter((folder) => {
      const nameMatch = folder.name.toLowerCase().includes(searchQuery.trim().toLowerCase());
      const hasMatchingItems = partitionBehaviorsByFolder(filteredBehaviors, folder._id).length > 0;
      return nameMatch || hasMatchingItems;
    });
  }, [filteredBehaviors, folders, searchQuery]);

  const isEmpty = !isPending && (folders?.length ?? 0) === 0 && (behaviors?.length ?? 0) === 0;
  const searchEmpty =
    !isPending &&
    !isEmpty &&
    visibleFolders.length === 0 &&
    unfiledBehaviors.length === 0 &&
    Boolean(searchQuery.trim());

  const moveBehaviorToFolder = useCallback(
    (behavior: BehaviorListItem, folderId: Id<"behaviorFolders"> | undefined) => {
      if (behavior.folderId === folderId) return;
      void updateBehavior.mutateAsync({
        classId,
        behaviorId: behavior._id,
        name: behavior.name,
        description: behavior.description,
        icon: behavior.icon,
        points: behavior.points,
        folderId,
      });
    },
    [classId, updateBehavior],
  );

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      if (!canManage) return;
      const behaviorId = parseBehaviorDragId(event.active.id);
      if (!behaviorId) return;
      if (dropSettleTimeoutRef.current !== null) {
        clearTimeout(dropSettleTimeoutRef.current);
        dropSettleTimeoutRef.current = null;
      }
      fadeDropInPlaceRef.current = false;
      const behavior = (behaviors ?? []).find((item) => item._id === behaviorId) ?? null;
      setActiveBehavior(behavior);
      setHiddenBehaviorId(behavior?._id ?? null);
      setPinnedFolderId(behavior?.folderId ?? null);
    },
    [behaviors, canManage],
  );

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const rect = event.over?.rect;
    overRectRef.current = rect ? { left: rect.left, top: rect.top } : null;
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const behaviorId = parseBehaviorDragId(event.active.id);
      const behavior =
        behaviorId != null
          ? ((behaviors ?? []).find((item) => item._id === behaviorId) ?? null)
          : null;

      const finishWithoutMove = () => {
        clearDragVisuals();
      };

      if (!canManage || !behavior || !event.over) {
        finishWithoutMove();
        return;
      }

      const target =
        (event.over.data.current?.type === "folder" || event.over.data.current?.type === "unfiled"
          ? event.over.data.current.type === "folder"
            ? {
                kind: "folder" as const,
                folderId: String(event.over.data.current.folderId),
              }
            : { kind: "unfiled" as const }
          : null) ?? parseFolderDropTarget(event.over.id);

      if (!target) {
        finishWithoutMove();
        return;
      }

      const nextFolderId =
        target.kind === "unfiled" ? undefined : (target.folderId as Id<"behaviorFolders">);
      if (behavior.folderId === nextFolderId) {
        finishWithoutMove();
        return;
      }

      const overRect = event.over.rect;
      // Unfiled items sort into a grid. Animating to the zone's top-left reads as a
      // ghost at index 0, then the real card pops in at its alphabetical slot.
      // Fade at the pointer instead; folder drops still fly into the folder card.
      const fadeInPlace = target.kind === "unfiled";
      fadeDropInPlaceRef.current = fadeInPlace;
      overRectRef.current = fadeInPlace ? null : { left: overRect.left, top: overRect.top };

      // Apply the move now so the card mounts hidden in its sorted slot. The overlay
      // fades at the pointer (unfiled) or into the folder card — not to zone origin —
      // so unmounting the folder source does not create a top-left ghost.
      moveBehaviorToFolder(behavior, nextFolderId);
      dropSettleTimeoutRef.current = setTimeout(() => {
        dropSettleTimeoutRef.current = null;
        setActiveBehavior(null);
        setHiddenBehaviorId(null);
        setPinnedFolderId(null);
        overRectRef.current = null;
        fadeDropInPlaceRef.current = false;
      }, DROP_ANIMATION_MS);
    },
    [behaviors, canManage, clearDragVisuals, moveBehaviorToFolder],
  );

  const submitBehavior = async (
    values: BehaviorFormValues,
    mode: "create" | "edit",
    existing?: BehaviorListItem | null,
  ) => {
    if (mode === "create") {
      await createBehavior.mutateAsync({
        classId,
        name: values.name,
        description: values.description,
        icon: values.icon,
        points: values.points,
        folderId: values.folderId,
      });
      return;
    }
    if (!existing) return;

    const pointsChanged = existing.points !== values.points;
    if (pointsChanged && existing.applicationCount > 0 && !values.pointsApplyMode) {
      setPendingPointsUpdate({ behavior: existing, values });
      return;
    }

    await updateBehavior.mutateAsync({
      classId,
      behaviorId: existing._id,
      name: values.name,
      description: values.description,
      icon: values.icon,
      points: values.points,
      folderId: values.folderId,
      pointsApplyMode: values.pointsApplyMode ?? "future",
    });
  };

  const confirmPointsApply = async (mode: PointsApplyMode) => {
    if (!pendingPointsUpdate) return;
    const { behavior, values } = pendingPointsUpdate;
    setPendingPointsUpdate(null);
    await updateBehavior.mutateAsync({
      classId,
      behaviorId: behavior._id,
      name: values.name,
      description: values.description,
      icon: values.icon,
      points: values.points,
      folderId: values.folderId,
      pointsApplyMode: mode,
    });
  };

  const submitFolder = async (
    values: FolderFormValues,
    mode: "create" | "edit",
    existing?: BehaviorFolderListItem | null,
  ) => {
    if (mode === "create") {
      await createFolder.mutateAsync({
        classId,
        name: values.name,
        description: values.description,
        icon: values.icon,
      });
      return;
    }
    if (!existing) return;
    await updateFolder.mutateAsync({
      classId,
      folderId: existing._id,
      name: values.name,
      description: values.description,
      icon: values.icon,
    });
  };

  return (
    <div className="flex w-full flex-col gap-4 px-4 py-8 sm:px-8">
      <BehaviorsToolbar
        searchQuery={searchQuery}
        resultCount={filteredBehaviors.length}
        canManage={canManage}
        onSearchChange={setSearchQuery}
        onCreateBehavior={() => setCreateBehaviorOpen(true)}
        onCreateFolder={() => setCreateFolderOpen(true)}
        onImport={() => setImportOpen(true)}
      />

      {isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-36 rounded-xl" />
          ))}
        </div>
      ) : null}

      {isError ? (
        <ErrorState
          title={t("loadFailed")}
          description={t("loadFailedDescription")}
          onRetry={() => {
            void foldersQuery.refetch();
            void behaviorsQuery.refetch();
          }}
        />
      ) : null}

      {!isPending && !isError && isEmpty ? (
        <Empty card>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <SmilePlus />
            </EmptyMedia>
            <EmptyTitle>{t("emptyTitle")}</EmptyTitle>
            <EmptyDescription>{t("emptyDescription")}</EmptyDescription>
          </EmptyHeader>
          {canManage ? (
            <EmptyContent>
              <Button type="button" onClick={() => setCreateBehaviorOpen(true)}>
                {t("createAction")}
              </Button>
            </EmptyContent>
          ) : null}
        </Empty>
      ) : null}

      {!isPending && !isError && searchEmpty ? (
        <Empty card>
          <EmptyHeader>
            <EmptyTitle>{t("searchEmptyTitle")}</EmptyTitle>
            <EmptyDescription>{t("searchEmptyDescription")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : null}

      {!isPending && !isError && !isEmpty && !searchEmpty ? (
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDragCancel={clearDragVisuals}
        >
          <FolderedCardGrid
            folders={visibleFolders}
            unfiledItems={unfiledBehaviors}
            getItemKey={(item) => item._id}
            unfiledDropZone={
              visibleFolders.length > 0
                ? {
                    enabled: canManage,
                    title: t("unfiledTitle"),
                    hint: t("unfiledDropHint"),
                    emptyLabel: t("unfiledEmpty"),
                  }
                : undefined
            }
            renderFolder={(folder) => (
              <FolderCard
                folder={folder}
                items={partitionBehaviorsByFolder(filteredBehaviors, folder._id)}
                managePermission="behaviors:manage"
                namespace="behaviors"
                emptyLabel={t("folderEmptyItems")}
                canDrop={canManage}
                keepOpen={pinnedFolderId === folder._id}
                onEdit={() => setEditingFolder(folder)}
                onDelete={() => setDeletingFolder(folder)}
                renderItem={(behavior) => (
                  <BehaviorCard
                    key={behavior._id}
                    behavior={behavior}
                    compact
                    canDrag={canManage}
                    hidden={hiddenBehaviorId === behavior._id}
                    onEdit={setEditingBehavior}
                    onDelete={setDeletingBehavior}
                  />
                )}
              />
            )}
            renderItem={(behavior) => (
              <BehaviorCard
                behavior={behavior}
                canDrag={canManage}
                hidden={hiddenBehaviorId === behavior._id}
                onEdit={setEditingBehavior}
                onDelete={setDeletingBehavior}
              />
            )}
          />
          <DragOverlay dropAnimation={dropAnimation}>
            {activeBehavior ? (
              <BehaviorCard
                behavior={activeBehavior}
                canDrag={false}
                onEdit={() => undefined}
                onDelete={() => undefined}
              />
            ) : null}
          </DragOverlay>
        </DndContext>
      ) : null}

      <BehaviorFormCredenza
        open={createBehaviorOpen}
        onOpenChange={setCreateBehaviorOpen}
        mode="create"
        folders={folders ?? []}
        onSubmit={async (values) => {
          await submitBehavior(values, "create");
        }}
      />

      <BehaviorFormCredenza
        open={editingBehavior !== null}
        onOpenChange={(open) => {
          if (!open) setEditingBehavior(null);
        }}
        mode="edit"
        folders={folders ?? []}
        initial={editingBehavior}
        onSubmit={async (values) => {
          await submitBehavior(values, "edit", editingBehavior);
          setEditingBehavior(null);
        }}
      />

      <BehaviorPointsApplyCredenza
        open={pendingPointsUpdate !== null}
        onOpenChange={(open) => {
          if (!open) setPendingPointsUpdate(null);
        }}
        applicationCount={pendingPointsUpdate?.behavior.applicationCount ?? 0}
        onConfirm={confirmPointsApply}
      />

      <FolderFormCredenza
        open={createFolderOpen}
        onOpenChange={setCreateFolderOpen}
        mode="create"
        namespace="behaviors"
        onSubmit={async (values) => {
          await submitFolder(values, "create");
        }}
      />

      <FolderFormCredenza
        open={editingFolder !== null}
        onOpenChange={(open) => {
          if (!open) setEditingFolder(null);
        }}
        mode="edit"
        namespace="behaviors"
        initial={editingFolder}
        onSubmit={async (values) => {
          await submitFolder(values, "edit", editingFolder);
          setEditingFolder(null);
        }}
      />

      <ImportBehaviorsCredenza
        open={importOpen}
        onOpenChange={setImportOpen}
        targetClassId={classId}
        onSubmit={async (sourceClassId) => {
          await importBehaviors.mutateAsync({ classId, sourceClassId });
        }}
      />

      <DeleteNamedCredenza
        open={deletingBehavior !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingBehavior(null);
        }}
        title={t("deleteConfirmTitle", { name: deletingBehavior?.name ?? "" })}
        description={t("deleteConfirmDescription")}
        confirmLabel={t("deleteAction")}
        onConfirm={async () => {
          if (!deletingBehavior) return;
          await removeBehavior.mutateAsync({
            classId,
            behaviorId: deletingBehavior._id,
          });
          setDeletingBehavior(null);
        }}
      />

      <DeleteNamedCredenza
        open={deletingFolder !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingFolder(null);
        }}
        title={t("folderDeleteConfirmTitle", { name: deletingFolder?.name ?? "" })}
        description={t("folderDeleteConfirmDescription")}
        confirmLabel={t("folderDeleteAction")}
        onConfirm={async () => {
          if (!deletingFolder) return;
          await removeFolder.mutateAsync({
            classId,
            folderId: deletingFolder._id,
          });
          setDeletingFolder(null);
        }}
      />
    </div>
  );
}
