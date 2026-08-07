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
import { Gift } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { FolderCard } from "@/components/folders/FolderCard";
import { FolderFormCredenza } from "@/components/folders/FolderFormCredenza";
import { FolderedCardGrid } from "@/components/folders/FolderedCardGrid";
import { DeleteNamedCredenza } from "@/components/groups/DeleteNamedCredenza";
import { ImportRewardsCredenza } from "@/components/rewards/ImportRewardsCredenza";
import { RewardCard } from "@/components/rewards/RewardCard";
import { RewardFormCredenza } from "@/components/rewards/RewardFormCredenza";
import { RewardPointsApplyCredenza } from "@/components/rewards/RewardPointsApplyCredenza";
import { RewardsToolbar } from "@/components/rewards/RewardsToolbar";
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
import { useCreateRewardFolder } from "@/hooks/rewardFolders/useCreateRewardFolder";
import { useRewardFolders } from "@/hooks/rewardFolders/useRewardFolders";
import { useRemoveRewardFolder } from "@/hooks/rewardFolders/useRemoveRewardFolder";
import { useUpdateRewardFolder } from "@/hooks/rewardFolders/useUpdateRewardFolder";
import { useCreateReward } from "@/hooks/rewards/useCreateReward";
import { useImportRewardsFromClass } from "@/hooks/rewards/useImportRewardsFromClass";
import { useRemoveReward } from "@/hooks/rewards/useRemoveReward";
import { useRewards } from "@/hooks/rewards/useRewards";
import { useUpdateReward } from "@/hooks/rewards/useUpdateReward";
import { useCan } from "@/hooks/permissions/useCan";
import { parseFolderDropTarget, parseRewardDragId } from "@/lib/folders/folderDnd";
import type { FolderFormValues } from "@/lib/folders/folders";
import { formatPurchaseLimitSummary } from "@/lib/rewards/purchaseLimit";
import {
  filterRewardsByName,
  partitionRewardsByFolder,
  type PointsApplyMode,
  type RewardFolderListItem,
  type RewardFormValues,
  type RewardListItem,
} from "@/lib/rewards/rewards";
import type { Id } from "../../../convex/_generated/dataModel";

type RewardsPageProps = {
  classId: Id<"classes">;
};

/** Match DragOverlay settle so the source stays hidden until the drop lands. */
const DROP_ANIMATION_MS = 200;

export function RewardsPage({ classId }: RewardsPageProps) {
  const { t } = useTranslation("rewards");
  const { can, isPending: permissionsPending } = useCan();
  const canManage = can("rewards:manage");

  const foldersQuery = useRewardFolders(classId);
  const rewardsQuery = useRewards(classId);
  const createReward = useCreateReward();
  const updateReward = useUpdateReward();
  const removeReward = useRemoveReward();
  const createFolder = useCreateRewardFolder();
  const updateFolder = useUpdateRewardFolder();
  const removeFolder = useRemoveRewardFolder();
  const importRewards = useImportRewardsFromClass();

  const [searchQuery, setSearchQuery] = useState("");
  const [createRewardOpen, setCreateRewardOpen] = useState(false);
  const [editingReward, setEditingReward] = useState<RewardListItem | null>(null);
  const [deletingReward, setDeletingReward] = useState<RewardListItem | null>(null);
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<RewardFolderListItem | null>(null);
  const [deletingFolder, setDeletingFolder] = useState<RewardFolderListItem | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [pendingPointsUpdate, setPendingPointsUpdate] = useState<{
    reward: RewardListItem;
    values: RewardFormValues;
  } | null>(null);
  const [activeReward, setActiveReward] = useState<RewardListItem | null>(null);
  const [hiddenRewardId, setHiddenRewardId] = useState<Id<"rewards"> | null>(null);
  const [pinnedFolderId, setPinnedFolderId] = useState<Id<"rewardFolders"> | null>(null);
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
    setActiveReward(null);
    setHiddenRewardId(null);
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

  const isPending = foldersQuery.isPending || rewardsQuery.isPending || permissionsPending;
  const isError = foldersQuery.isError || rewardsQuery.isError;

  const folders = foldersQuery.data;
  const rewards = rewardsQuery.data;

  const filteredRewards = useMemo(
    () => filterRewardsByName(rewards ?? [], searchQuery),
    [rewards, searchQuery],
  );

  const unfiledRewards = useMemo(
    () => partitionRewardsByFolder(filteredRewards, null),
    [filteredRewards],
  );

  const visibleFolders = useMemo(() => {
    const folderList = folders ?? [];
    if (!searchQuery.trim()) return folderList;
    return folderList.filter((folder) => {
      const nameMatch = folder.name.toLowerCase().includes(searchQuery.trim().toLowerCase());
      const hasMatchingItems = partitionRewardsByFolder(filteredRewards, folder._id).length > 0;
      return nameMatch || hasMatchingItems;
    });
  }, [filteredRewards, folders, searchQuery]);

  const isEmpty = !isPending && (folders?.length ?? 0) === 0 && (rewards?.length ?? 0) === 0;
  const searchEmpty =
    !isPending &&
    !isEmpty &&
    visibleFolders.length === 0 &&
    unfiledRewards.length === 0 &&
    Boolean(searchQuery.trim());

  const formatFolderLimit = useCallback(
    (folder: RewardFolderListItem) => {
      if (!folder.purchaseLimit) return undefined;
      return formatPurchaseLimitSummary(folder.purchaseLimit, {
        max: (count) => t("purchaseLimitSummaryMax", { count }),
        every: (count, period) => t("purchaseLimitSummaryEvery", { count, period }),
        period: (period) =>
          t(
            `purchaseLimitPeriod_${period}` as
              | "purchaseLimitPeriod_day"
              | "purchaseLimitPeriod_week"
              | "purchaseLimitPeriod_month",
          ),
      });
    },
    [t],
  );

  const moveRewardToFolder = useCallback(
    (reward: RewardListItem, folderId: Id<"rewardFolders"> | undefined) => {
      if (reward.folderId === folderId) return;
      void updateReward.mutateAsync({
        classId,
        rewardId: reward._id,
        name: reward.name,
        description: reward.description,
        icon: reward.icon,
        points: reward.points,
        folderId,
        purchaseLimit: reward.purchaseLimit,
      });
    },
    [classId, updateReward],
  );

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      if (!canManage) return;
      const rewardId = parseRewardDragId(event.active.id);
      if (!rewardId) return;
      if (dropSettleTimeoutRef.current !== null) {
        clearTimeout(dropSettleTimeoutRef.current);
        dropSettleTimeoutRef.current = null;
      }
      fadeDropInPlaceRef.current = false;
      const reward = (rewards ?? []).find((item) => item._id === rewardId) ?? null;
      setActiveReward(reward);
      setHiddenRewardId(reward?._id ?? null);
      setPinnedFolderId(reward?.folderId ?? null);
    },
    [canManage, rewards],
  );

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const rect = event.over?.rect;
    overRectRef.current = rect ? { left: rect.left, top: rect.top } : null;
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const rewardId = parseRewardDragId(event.active.id);
      const reward =
        rewardId != null ? ((rewards ?? []).find((item) => item._id === rewardId) ?? null) : null;

      const finishWithoutMove = () => {
        clearDragVisuals();
      };

      if (!canManage || !reward || !event.over) {
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
        target.kind === "unfiled" ? undefined : (target.folderId as Id<"rewardFolders">);
      if (reward.folderId === nextFolderId) {
        finishWithoutMove();
        return;
      }

      const overRect = event.over.rect;
      const fadeInPlace = target.kind === "unfiled";
      fadeDropInPlaceRef.current = fadeInPlace;
      overRectRef.current = fadeInPlace ? null : { left: overRect.left, top: overRect.top };

      moveRewardToFolder(reward, nextFolderId);
      dropSettleTimeoutRef.current = setTimeout(() => {
        dropSettleTimeoutRef.current = null;
        setActiveReward(null);
        setHiddenRewardId(null);
        setPinnedFolderId(null);
        overRectRef.current = null;
        fadeDropInPlaceRef.current = false;
      }, DROP_ANIMATION_MS);
    },
    [canManage, clearDragVisuals, moveRewardToFolder, rewards],
  );

  const submitReward = async (
    values: RewardFormValues,
    mode: "create" | "edit",
    existing?: RewardListItem | null,
  ) => {
    if (mode === "create") {
      await createReward.mutateAsync({
        classId,
        name: values.name,
        description: values.description,
        icon: values.icon,
        points: values.points,
        folderId: values.folderId,
        purchaseLimit: values.purchaseLimit,
      });
      return;
    }
    if (!existing) return;

    const pointsChanged = existing.points !== values.points;
    if (pointsChanged && existing.purchaseCount > 0 && !values.pointsApplyMode) {
      setPendingPointsUpdate({ reward: existing, values });
      return;
    }

    await updateReward.mutateAsync({
      classId,
      rewardId: existing._id,
      name: values.name,
      description: values.description,
      icon: values.icon,
      points: values.points,
      folderId: values.folderId,
      purchaseLimit: values.purchaseLimit,
      pointsApplyMode: values.pointsApplyMode ?? "future",
    });
  };

  const confirmPointsApply = async (mode: PointsApplyMode) => {
    if (!pendingPointsUpdate) return;
    const { reward, values } = pendingPointsUpdate;
    setPendingPointsUpdate(null);
    await updateReward.mutateAsync({
      classId,
      rewardId: reward._id,
      name: values.name,
      description: values.description,
      icon: values.icon,
      points: values.points,
      folderId: values.folderId,
      purchaseLimit: values.purchaseLimit,
      pointsApplyMode: mode,
    });
  };

  const submitFolder = async (
    values: FolderFormValues,
    mode: "create" | "edit",
    existing?: RewardFolderListItem | null,
  ) => {
    if (mode === "create") {
      await createFolder.mutateAsync({
        classId,
        name: values.name,
        description: values.description,
        icon: values.icon,
        purchaseLimit: values.purchaseLimit,
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
      purchaseLimit: values.purchaseLimit,
    });
  };

  return (
    <div className="flex w-full flex-col gap-4 px-4 py-8 sm:px-8">
      <RewardsToolbar
        searchQuery={searchQuery}
        resultCount={filteredRewards.length}
        canManage={canManage}
        onSearchChange={setSearchQuery}
        onCreateReward={() => setCreateRewardOpen(true)}
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
            void rewardsQuery.refetch();
          }}
        />
      ) : null}

      {!isPending && !isError && isEmpty ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Gift />
            </EmptyMedia>
            <EmptyTitle>{t("emptyTitle")}</EmptyTitle>
            <EmptyDescription>{t("emptyDescription")}</EmptyDescription>
          </EmptyHeader>
          {canManage ? (
            <EmptyContent>
              <Button type="button" onClick={() => setCreateRewardOpen(true)}>
                {t("createAction")}
              </Button>
            </EmptyContent>
          ) : null}
        </Empty>
      ) : null}

      {!isPending && !isError && searchEmpty ? (
        <Empty>
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
            unfiledItems={unfiledRewards}
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
                items={partitionRewardsByFolder(filteredRewards, folder._id)}
                managePermission="rewards:manage"
                namespace="rewards"
                emptyLabel={t("folderEmptyItems")}
                limitSummary={formatFolderLimit(folder)}
                canDrop={canManage}
                keepOpen={pinnedFolderId === folder._id}
                onEdit={() => setEditingFolder(folder)}
                onDelete={() => setDeletingFolder(folder)}
                renderItem={(reward) => (
                  <RewardCard
                    key={reward._id}
                    reward={reward}
                    compact
                    canDrag={canManage}
                    hidden={hiddenRewardId === reward._id}
                    onEdit={setEditingReward}
                    onDelete={setDeletingReward}
                  />
                )}
              />
            )}
            renderItem={(reward) => (
              <RewardCard
                reward={reward}
                canDrag={canManage}
                hidden={hiddenRewardId === reward._id}
                onEdit={setEditingReward}
                onDelete={setDeletingReward}
              />
            )}
          />
          <DragOverlay dropAnimation={dropAnimation}>
            {activeReward ? (
              <RewardCard
                reward={activeReward}
                canDrag={false}
                onEdit={() => undefined}
                onDelete={() => undefined}
              />
            ) : null}
          </DragOverlay>
        </DndContext>
      ) : null}

      <RewardFormCredenza
        open={createRewardOpen}
        onOpenChange={setCreateRewardOpen}
        mode="create"
        folders={folders ?? []}
        onSubmit={async (values) => {
          await submitReward(values, "create");
        }}
      />

      <RewardFormCredenza
        open={editingReward !== null}
        onOpenChange={(open) => {
          if (!open) setEditingReward(null);
        }}
        mode="edit"
        folders={folders ?? []}
        initial={editingReward}
        onSubmit={async (values) => {
          await submitReward(values, "edit", editingReward);
          setEditingReward(null);
        }}
      />

      <RewardPointsApplyCredenza
        open={pendingPointsUpdate !== null}
        onOpenChange={(open) => {
          if (!open) setPendingPointsUpdate(null);
        }}
        purchaseCount={pendingPointsUpdate?.reward.purchaseCount ?? 0}
        onConfirm={confirmPointsApply}
      />

      <FolderFormCredenza
        open={createFolderOpen}
        onOpenChange={setCreateFolderOpen}
        mode="create"
        namespace="rewards"
        supportsPurchaseLimit
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
        namespace="rewards"
        supportsPurchaseLimit
        initial={editingFolder}
        onSubmit={async (values) => {
          await submitFolder(values, "edit", editingFolder);
          setEditingFolder(null);
        }}
      />

      <ImportRewardsCredenza
        open={importOpen}
        onOpenChange={setImportOpen}
        targetClassId={classId}
        onSubmit={async (sourceClassId) => {
          await importRewards.mutateAsync({ classId, sourceClassId });
        }}
      />

      <DeleteNamedCredenza
        open={deletingReward !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingReward(null);
        }}
        title={t("deleteConfirmTitle", { name: deletingReward?.name ?? "" })}
        description={t("deleteConfirmDescription")}
        confirmLabel={t("deleteAction")}
        onConfirm={async () => {
          if (!deletingReward) return;
          await removeReward.mutateAsync({
            classId,
            rewardId: deletingReward._id,
          });
          setDeletingReward(null);
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
