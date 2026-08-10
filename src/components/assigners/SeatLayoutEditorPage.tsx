import { useBlocker, useNavigate } from "@tanstack/react-router";
import { Minus, Plus } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  SeatLayoutPrintCredenza,
  type SeatLayoutPrintSelection,
} from "@/components/assigners/SeatLayoutPrintCredenza";
import { SeatLayoutToolbar } from "@/components/assigners/SeatLayoutToolbar";
import { SeatLayoutUnsavedChangesDialog } from "@/components/assigners/SeatLayoutUnsavedChangesDialog";
import { DeleteNamedCredenza } from "@/components/groups/DeleteNamedCredenza";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { HelpTip } from "@/components/ui/help-tip";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast-manager";
import { APP_CONFIG } from "@/config/app";
import { useLogClassAccess } from "@/hooks/activity/useLogClassAccess";
import { useSaveSeatLayoutItems } from "@/hooks/assigners/useSaveSeatLayoutItems";
import { useSeatLayout } from "@/hooks/assigners/useSeatLayout";
import { useClass } from "@/hooks/classes/useClass";
import { useGroupsBoard } from "@/hooks/groups/useGroupsBoard";
import { useCan } from "@/hooks/permissions/useCan";
import {
  cloneSeatSnapshot,
  emptySeatHistory,
  pushSeatHistory,
  redoSeatHistory,
  seatSnapshotsEqual,
  undoSeatHistory,
  type SeatEditorHistory,
  type SeatEditorSnapshot,
} from "@/lib/assigners/seatHistory";
import {
  buildDeskGrid,
  canvasResizePanDelta,
  clampDeskGridDims,
  DEFAULT_CANVAS_HEIGHT,
  DEFAULT_CANVAS_WIDTH,
  defaultSizeForKind,
  newItemId,
  nextPlacementOrigin,
  resizeSeatCanvas,
  topLeftPlacementOrigin,
  listZoneNames,
  resolveTeamLabel,
  SEAT_CANVAS_GRID_SIZE,
  SEAT_ORIENTATION_DEGREES,
  SEAT_ORIENTATION_LABEL_KEYS,
  seatItemDisplayLabel,
  sharedTeamNames,
  type SeatCanvasEdge,
  type SeatLayoutItem,
  type SeatOrientation,
  type SeatTeamAssignment,
} from "@/lib/assigners/seatLayouts";
import { snapRect, snapRectToGrid, type SeatSnapGuide } from "@/lib/assigners/seatSnap";
import { printSeatLayout } from "@/lib/assigners/seatsPrint";
import { cn } from "@/lib/utils";
import type { Id } from "../../../convex/_generated/dataModel";

function isEditableKeyboardTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

type SeatLayoutEditorPageProps = {
  classId: Id<"classes">;
  layoutId: Id<"seatLayouts">;
};

type DragState =
  | {
      mode: "move";
      itemId: string;
      offsetX: number;
      offsetY: number;
      shiftKey: boolean;
      moveIds: Array<string>;
      origins: Record<string, { x: number; y: number }>;
    }
  | {
      mode: "resize";
      itemId: string;
      edge: "n" | "e" | "s" | "w";
      startX: number;
      startY: number;
      origin: SeatLayoutItem;
      shiftKey: boolean;
    };

function isMultiSelectModifier(event: { ctrlKey: boolean; metaKey: boolean }): boolean {
  return event.ctrlKey || event.metaKey;
}

function applyTeamAssignment(
  item: SeatLayoutItem,
  teamAssignment: SeatTeamAssignment | undefined,
): SeatLayoutItem {
  if (teamAssignment) {
    return { ...item, teamAssignment };
  }
  const { teamAssignment: _removed, ...rest } = item;
  void _removed;
  return rest;
}

function applyZoneName(item: SeatLayoutItem, zoneName: string | undefined): SeatLayoutItem {
  if (zoneName) {
    return { ...item, zoneName };
  }
  const { zoneName: _removed, ...rest } = item;
  void _removed;
  return rest;
}

function cloneItems(items: Array<SeatLayoutItem>): Array<SeatLayoutItem> {
  return items.map((item) => ({
    ...item,
    teamAssignment: item.teamAssignment,
    zoneName: item.zoneName,
  }));
}

const PAN_VISIBLE_MARGIN = 48;

type PanDragState = {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  originX: number;
  originY: number;
  moved: boolean;
};

function clampPanOffset(
  x: number,
  y: number,
  canvasW: number,
  canvasH: number,
  viewportW: number,
  viewportH: number,
): { x: number; y: number } {
  const minX = PAN_VISIBLE_MARGIN - canvasW;
  const maxX = viewportW - PAN_VISIBLE_MARGIN;
  const minY = PAN_VISIBLE_MARGIN - canvasH;
  const maxY = viewportH - PAN_VISIBLE_MARGIN;
  return {
    x: Math.min(maxX, Math.max(minX, x)),
    y: Math.min(maxY, Math.max(minY, y)),
  };
}

const CANVAS_EDGE_LABEL_KEYS = {
  n: { expand: "expandCanvasNorth", shrink: "shrinkCanvasNorth" },
  e: { expand: "expandCanvasEast", shrink: "shrinkCanvasEast" },
  s: { expand: "expandCanvasSouth", shrink: "shrinkCanvasSouth" },
  w: { expand: "expandCanvasWest", shrink: "shrinkCanvasWest" },
} as const;

export function SeatLayoutEditorPage({ classId, layoutId }: SeatLayoutEditorPageProps) {
  const { t } = useTranslation("assigners");
  const navigate = useNavigate();
  const { can } = useCan();
  const canManage = can("assigners:manage");
  const { data: layout, isPending, isError, refetch } = useSeatLayout(classId, layoutId);
  const { data: classDoc } = useClass(classId);
  const { data: board } = useGroupsBoard(classId);
  const saveItems = useSaveSeatLayoutItems();
  const logAccess = useLogClassAccess();

  const [items, setItems] = useState<Array<SeatLayoutItem>>([]);
  const [nextDeskNumber, setNextDeskNumber] = useState(1);
  const [canvasWidth, setCanvasWidth] = useState(DEFAULT_CANVAS_WIDTH);
  const [canvasHeight, setCanvasHeight] = useState(DEFAULT_CANVAS_HEIGHT);
  const [selectedIds, setSelectedIds] = useState<Array<string>>([]);
  const [orientation, setOrientation] = useState<SeatOrientation>("front");
  const [guides, setGuides] = useState<Array<SeatSnapGuide>>([]);
  const [deskGridCols, setDeskGridCols] = useState(4);
  const [deskGridRows, setDeskGridRows] = useState(1);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [clearCanvasOpen, setClearCanvasOpen] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [labelDraft, setLabelDraft] = useState("");
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);

  const dragRef = useRef<DragState | null>(null);
  const dragBaselineRef = useRef<SeatEditorSnapshot | null>(null);
  const historyRef = useRef<SeatEditorHistory>(emptySeatHistory());
  const stageRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const panDragRef = useRef<PanDragState | null>(null);
  const panRef = useRef(pan);
  const labelInputRef = useRef<HTMLInputElement | null>(null);
  const editingIdRef = useRef<string | null>(null);
  const labelDraftRef = useRef("");
  const latestRef = useRef({
    items,
    nextDeskNumber,
    canvasWidth,
    canvasHeight,
  });
  const selectedIdsRef = useRef(selectedIds);
  const layoutSnapshotRef = useRef<SeatEditorSnapshot | null>(null);

  useEffect(() => {
    latestRef.current = { items, nextDeskNumber, canvasWidth, canvasHeight };
  }, [items, nextDeskNumber, canvasWidth, canvasHeight]);

  useEffect(() => {
    selectedIdsRef.current = selectedIds;
  }, [selectedIds]);

  useEffect(() => {
    panRef.current = pan;
  }, [pan]);

  const syncHistoryButtons = (history: SeatEditorHistory) => {
    setCanUndo(history.past.length > 0);
    setCanRedo(history.future.length > 0);
  };

  const resetHistory = useCallback(() => {
    historyRef.current = emptySeatHistory();
    dragBaselineRef.current = null;
    setCanUndo(false);
    setCanRedo(false);
  }, []);

  const currentSnapshot = (): SeatEditorSnapshot =>
    cloneSeatSnapshot({
      items: latestRef.current.items,
      nextDeskNumber: latestRef.current.nextDeskNumber,
      canvasWidth: latestRef.current.canvasWidth,
      canvasHeight: latestRef.current.canvasHeight,
    });

  const applySnapshot = (snapshot: SeatEditorSnapshot, markFromSaved: boolean) => {
    const cloned = cloneSeatSnapshot(snapshot);
    setItems(cloned.items);
    setNextDeskNumber(cloned.nextDeskNumber);
    setCanvasWidth(cloned.canvasWidth);
    setCanvasHeight(cloned.canvasHeight);
    latestRef.current = {
      items: cloned.items,
      nextDeskNumber: cloned.nextDeskNumber,
      canvasWidth: cloned.canvasWidth,
      canvasHeight: cloned.canvasHeight,
    };
    setSelectedIds((prev) => prev.filter((id) => cloned.items.some((item) => item.id === id)));
    if (markFromSaved) {
      const saved = layoutSnapshotRef.current;
      setDirty(!saved || !seatSnapshotsEqual(cloned, saved));
    } else {
      setDirty(true);
    }
  };

  const beginDragHistory = () => {
    dragBaselineRef.current = currentSnapshot();
  };

  useEffect(() => {
    setHydrated(false);
    setDirty(false);
    setSelectedIds([]);
    setClearCanvasOpen(false);
    setPan({ x: 0, y: 0 });
    setIsPanning(false);
    panDragRef.current = null;
    editingIdRef.current = null;
    labelDraftRef.current = "";
    setEditingId(null);
    setLabelDraft("");
    layoutSnapshotRef.current = null;
    resetHistory();
  }, [layoutId, resetHistory]);

  useEffect(() => {
    if (!layout || dirty || saveItems.isPending) return;
    const snapshot = {
      items: cloneItems(layout.items),
      nextDeskNumber: layout.nextDeskNumber,
      canvasWidth: layout.canvasWidth,
      canvasHeight: layout.canvasHeight,
    };
    layoutSnapshotRef.current = cloneSeatSnapshot(snapshot);
    setItems(snapshot.items);
    setNextDeskNumber(snapshot.nextDeskNumber);
    setCanvasWidth(snapshot.canvasWidth);
    setCanvasHeight(snapshot.canvasHeight);
    setHydrated(true);
  }, [layout, dirty, saveItems.isPending]);

  const markDirty = () => {
    if (!canManage) return;
    setDirty(true);
  };

  const persistLayout = async (): Promise<boolean> => {
    if (!canManage || !dirty || saveItems.isPending) return false;
    const latest = latestRef.current;
    try {
      await saveItems.mutateAsync({
        classId,
        layoutId,
        canvasWidth: latest.canvasWidth,
        canvasHeight: latest.canvasHeight,
        nextDeskNumber: latest.nextDeskNumber,
        items: latest.items,
      });
      layoutSnapshotRef.current = cloneSeatSnapshot({
        items: latest.items,
        nextDeskNumber: latest.nextDeskNumber,
        canvasWidth: latest.canvasWidth,
        canvasHeight: latest.canvasHeight,
      });
      resetHistory();
      setDirty(false);
      return true;
    } catch {
      return false;
    }
  };

  const handleSave = () => {
    void persistLayout();
  };

  const dirtyNavRef = useRef(false);
  dirtyNavRef.current = canManage && dirty;
  const shouldBlockNavigation = useCallback(() => dirtyNavRef.current, []);
  const blocker = useBlocker({
    shouldBlockFn: shouldBlockNavigation,
    withResolver: true,
    enableBeforeUnload: () => dirtyNavRef.current,
    disabled: !canManage,
  });

  const updateItems = (
    updater: (prev: Array<SeatLayoutItem>) => Array<SeatLayoutItem>,
    extras?: Partial<{ nextDeskNumber: number }>,
  ) => {
    const before = currentSnapshot();
    const nextItems = updater(before.items);
    const nextDesk = extras?.nextDeskNumber ?? before.nextDeskNumber;
    const after = {
      items: nextItems,
      nextDeskNumber: nextDesk,
      canvasWidth: before.canvasWidth,
      canvasHeight: before.canvasHeight,
    };
    if (seatSnapshotsEqual(before, after)) return;

    historyRef.current = pushSeatHistory(historyRef.current, before);
    syncHistoryButtons(historyRef.current);
    setItems(nextItems);
    setNextDeskNumber(nextDesk);
    latestRef.current = {
      items: nextItems,
      nextDeskNumber: nextDesk,
      canvasWidth: latestRef.current.canvasWidth,
      canvasHeight: latestRef.current.canvasHeight,
    };
    markDirty();
  };

  const handleCanvasResize = (edge: SeatCanvasEdge, deltaCells: number) => {
    if (!canManage) return;
    const before = currentSnapshot();
    const result = resizeSeatCanvas({
      width: before.canvasWidth,
      height: before.canvasHeight,
      items: before.items,
      edge,
      deltaCells,
    });
    if (!result) return;
    const after = {
      items: result.items,
      nextDeskNumber: before.nextDeskNumber,
      canvasWidth: result.width,
      canvasHeight: result.height,
    };
    if (seatSnapshotsEqual(before, after)) return;
    historyRef.current = pushSeatHistory(historyRef.current, before);
    syncHistoryButtons(historyRef.current);
    setItems(result.items);
    setCanvasWidth(result.width);
    setCanvasHeight(result.height);
    latestRef.current = {
      items: result.items,
      nextDeskNumber: before.nextDeskNumber,
      canvasWidth: result.width,
      canvasHeight: result.height,
    };
    const panDelta = canvasResizePanDelta(edge, deltaCells, orientation);
    if (panDelta.x !== 0 || panDelta.y !== 0) {
      setPan((prev) => ({ x: prev.x + panDelta.x, y: prev.y + panDelta.y }));
    }
    markDirty();
  };

  const undoEdit = () => {
    if (!canManage) return;
    const result = undoSeatHistory(historyRef.current, currentSnapshot());
    if (!result) return;
    historyRef.current = result.history;
    syncHistoryButtons(result.history);
    applySnapshot(result.snapshot, true);
  };

  const redoEdit = () => {
    if (!canManage) return;
    const result = redoSeatHistory(historyRef.current, currentSnapshot());
    if (!result) return;
    historyRef.current = result.history;
    syncHistoryButtons(result.history);
    applySnapshot(result.snapshot, true);
  };

  const selectedIdSet = new Set(selectedIds);
  const selectedItems = items.filter((item) => selectedIdSet.has(item.id));
  const selectedDesks = selectedItems.filter((item) => item.kind === "desk");
  const soleSelected = selectedItems.length === 1 ? (selectedItems[0] ?? null) : null;
  const groups = board?.groups ?? [];

  const deleteSelectedItems = () => {
    if (!canManage) return;
    const ids = selectedIdsRef.current;
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    updateItems((prev) => prev.filter((item) => !idSet.has(item.id)));
    setSelectedIds([]);
    editingIdRef.current = null;
    labelDraftRef.current = "";
    setEditingId(null);
    setLabelDraft("");
  };

  const clearCanvas = () => {
    if (!canManage || items.length === 0) return;
    updateItems(() => [], { nextDeskNumber: 1 });
    setSelectedIds([]);
    editingIdRef.current = null;
    labelDraftRef.current = "";
    setEditingId(null);
    setLabelDraft("");
  };

  const deleteSelectedItemsRef = useRef(deleteSelectedItems);
  deleteSelectedItemsRef.current = deleteSelectedItems;
  const undoEditRef = useRef(undoEdit);
  undoEditRef.current = undoEdit;
  const redoEditRef = useRef(redoEdit);
  redoEditRef.current = redoEdit;

  useEffect(() => {
    if (!canManage) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableKeyboardTarget(event.target)) return;

      const key = event.key.toLowerCase();
      const mod = event.ctrlKey || event.metaKey;
      if (mod && key === "z" && !event.shiftKey) {
        event.preventDefault();
        undoEditRef.current();
        return;
      }
      if (mod && (key === "y" || (key === "z" && event.shiftKey))) {
        event.preventDefault();
        redoEditRef.current();
        return;
      }

      if (event.key !== "Delete" && event.key !== "Backspace") return;
      if (selectedIdsRef.current.length === 0) return;
      event.preventDefault();
      deleteSelectedItemsRef.current();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [canManage]);

  const addItem = (kind: SeatLayoutItem["kind"]) => {
    if (!canManage) return;
    const startDesk = nextDeskNumber;
    const size = defaultSizeForKind(kind);
    const origin = topLeftPlacementOrigin();
    updateItems(
      (prev) => {
        if (kind === "desk") {
          return [
            ...prev,
            {
              id: newItemId(),
              kind: "desk",
              label: "",
              deskNumber: startDesk,
              x: origin.x,
              y: origin.y,
              width: size.width,
              height: size.height,
            },
          ];
        }
        return [
          ...prev,
          {
            id: newItemId(),
            kind,
            label: "",
            x: origin.x,
            y: origin.y,
            width: size.width,
            height: size.height,
          },
        ];
      },
      kind === "desk" ? { nextDeskNumber: startDesk + 1 } : undefined,
    );
  };

  const addDeskGrid = () => {
    if (!canManage) return;
    const dims = clampDeskGridDims(deskGridCols, deskGridRows);
    setDeskGridCols(dims.cols);
    setDeskGridRows(dims.rows);
    const startDesk = nextDeskNumber;
    updateItems(
      (prev) => {
        const origin = nextPlacementOrigin(prev);
        return [
          ...prev,
          ...buildDeskGrid({
            cols: dims.cols,
            rows: dims.rows,
            startDeskNumber: startDesk,
            originX: origin.x,
            originY: origin.y,
          }),
        ];
      },
      { nextDeskNumber: startDesk + dims.cols * dims.rows },
    );
  };

  const applyClampedPan = (x: number, y: number) => {
    const viewport = viewportRef.current;
    if (!viewport) {
      setPan({ x, y });
      return;
    }
    const next = clampPanOffset(
      x,
      y,
      canvasWidth,
      canvasHeight,
      viewport.clientWidth,
      viewport.clientHeight,
    );
    setPan(next);
  };

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    setPan((prev) =>
      clampPanOffset(
        prev.x,
        prev.y,
        canvasWidth,
        canvasHeight,
        viewport.clientWidth,
        viewport.clientHeight,
      ),
    );
  }, [canvasWidth, canvasHeight]);

  const onStagePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    if (editingIdRef.current) {
      commitLabelEdit();
    }
    setSelectedIds([]);
    panDragRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      originX: panRef.current.x,
      originY: panRef.current.y,
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onStagePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const panDrag = panDragRef.current;
    if (panDrag && panDrag.pointerId === event.pointerId) {
      const dx = event.clientX - panDrag.startClientX;
      const dy = event.clientY - panDrag.startClientY;
      if (!panDrag.moved && (Math.abs(dx) > 2 || Math.abs(dy) > 2)) {
        panDrag.moved = true;
        setIsPanning(true);
      }
      if (panDrag.moved) {
        applyClampedPan(panDrag.originX + dx, panDrag.originY + dy);
      }
      return;
    }
    onItemPointerMove(event);
  };

  const onStagePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const panDrag = panDragRef.current;
    if (panDrag && panDrag.pointerId === event.pointerId) {
      panDragRef.current = null;
      setIsPanning(false);
      return;
    }
    endDrag();
  };

  const onItemPointerMove = (event: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag || !stageRef.current) return;
    const rect = stageRef.current.getBoundingClientRect();
    const scaleX = canvasWidth / rect.width;
    const scaleY = canvasHeight / rect.height;
    const pointerX = (event.clientX - rect.left) * scaleX;
    const pointerY = (event.clientY - rect.top) * scaleY;
    const shiftKey = event.shiftKey || drag.shiftKey;

    setItems((prev) => {
      const index = prev.findIndex((item) => item.id === drag.itemId);
      if (index < 0) return prev;
      const current = prev[index];
      if (!current) return prev;

      if (drag.mode === "move") {
        const moveSet = new Set(drag.moveIds);
        const originPrimary = drag.origins[drag.itemId];
        if (!originPrimary) return prev;
        const others = prev.filter((item) => !moveSet.has(item.id));
        const raw = {
          ...current,
          x: pointerX - drag.offsetX,
          y: pointerY - drag.offsetY,
        };
        const snapped =
          snapToGrid && !shiftKey
            ? snapRectToGrid(raw, { gridSize: SEAT_CANVAS_GRID_SIZE })
            : snapRect(raw, others, {
                canvasWidth,
                canvasHeight,
                enabled: !shiftKey,
              });
        setGuides(snapped.guides);
        const dx = Math.round(snapped.x) - originPrimary.x;
        const dy = Math.round(snapped.y) - originPrimary.y;
        const next = prev.map((item) => {
          if (!moveSet.has(item.id)) return item;
          const origin = drag.origins[item.id];
          if (!origin) return item;
          return {
            ...item,
            x: origin.x + dx,
            y: origin.y + dy,
          };
        });
        latestRef.current = { ...latestRef.current, items: next };
        return next;
      }

      const others = prev.filter((item) => item.id !== current.id);
      let x = drag.origin.x;
      let y = drag.origin.y;
      let width = drag.origin.width;
      let height = drag.origin.height;
      if (drag.edge === "e") width = Math.max(24, pointerX - x);
      if (drag.edge === "s") height = Math.max(24, pointerY - y);
      if (drag.edge === "w") {
        const right = drag.origin.x + drag.origin.width;
        x = Math.min(pointerX, right - 24);
        width = right - x;
      }
      if (drag.edge === "n") {
        const bottom = drag.origin.y + drag.origin.height;
        y = Math.min(pointerY, bottom - 24);
        height = bottom - y;
      }
      const rawResize = { id: current.id, x, y, width, height };
      const snapped =
        snapToGrid && !shiftKey
          ? snapRectToGrid(rawResize, {
              gridSize: SEAT_CANVAS_GRID_SIZE,
              resizeEdge: drag.edge,
            })
          : snapRect(rawResize, others, {
              canvasWidth,
              canvasHeight,
              enabled: !shiftKey,
              resizeEdge: drag.edge,
            });
      setGuides(snapped.guides);
      const nextItem: SeatLayoutItem = {
        ...current,
        x: Math.round(snapped.x),
        y: Math.round(snapped.y),
        width: Math.round(snapped.width),
        height: Math.round(snapped.height),
      };
      const next = [...prev];
      next[index] = nextItem;
      latestRef.current = { ...latestRef.current, items: next };
      return next;
    });
  };

  const endDrag = () => {
    if (!dragRef.current) return;
    dragRef.current = null;
    setGuides([]);
    const baseline = dragBaselineRef.current;
    dragBaselineRef.current = null;
    if (!baseline) return;
    const current = currentSnapshot();
    if (seatSnapshotsEqual(baseline, current)) return;
    historyRef.current = pushSeatHistory(historyRef.current, baseline);
    syncHistoryButtons(historyRef.current);
    markDirty();
  };

  const itemDefaults = {
    teacherDesk: t("defaultTeacherDeskLabel"),
    board: t("defaultBoardLabel"),
    rect: t("defaultRectLabel"),
  };

  const beginLabelEdit = (item: SeatLayoutItem) => {
    if (!canManage) return;
    dragRef.current = null;
    setGuides([]);
    setSelectedIds([item.id]);
    const draft = seatItemDisplayLabel(item, itemDefaults);
    editingIdRef.current = item.id;
    labelDraftRef.current = draft;
    setEditingId(item.id);
    setLabelDraft(draft);
    requestAnimationFrame(() => {
      labelInputRef.current?.focus();
      labelInputRef.current?.select();
    });
  };

  const commitLabelEdit = () => {
    const id = editingIdRef.current;
    if (!id) return;
    const label = labelDraftRef.current;
    editingIdRef.current = null;
    labelDraftRef.current = "";
    setEditingId(null);
    setLabelDraft("");
    updateItems((prev) => prev.map((item) => (item.id === id ? { ...item, label } : item)));
  };

  const cancelLabelEdit = () => {
    editingIdRef.current = null;
    labelDraftRef.current = "";
    setEditingId(null);
    setLabelDraft("");
  };

  const handlePrint = async (selection: SeatLayoutPrintSelection) => {
    try {
      const printItems = items.map((item) => {
        const team = resolveTeamLabel(item.teamAssignment, groups);
        const zoneName = item.zoneName?.trim();
        return {
          ...item,
          label: seatItemDisplayLabel(item, itemDefaults),
          teamLabel: team && !team.stale ? team.label : team?.stale ? t("teamStale") : undefined,
          zoneLabel: zoneName || undefined,
        };
      });
      const orientationLabels = {
        front: `${t("orientationLabel")}: ${t(SEAT_ORIENTATION_LABEL_KEYS.front)}`,
        back: `${t("orientationLabel")}: ${t(SEAT_ORIENTATION_LABEL_KEYS.back)}`,
        left: `${t("orientationLabel")}: ${t(SEAT_ORIENTATION_LABEL_KEYS.left)}`,
        right: `${t("orientationLabel")}: ${t(SEAT_ORIENTATION_LABEL_KEYS.right)}`,
      } as const;
      await printSeatLayout(
        {
          canvasWidth,
          canvasHeight,
          orientations: selection.orientations,
          perPage: selection.perPage,
          items: printItems,
        },
        {
          documentTitle: `${layout?.name ?? t("printHeading")} — ${APP_CONFIG.name}`,
          heading: layout?.name ?? t("printHeading"),
          subtitle: classDoc?.name ?? "",
          logoAlt: t("printLogoAlt"),
          orientationLabels,
        },
      );
      logAccess.mutate({
        classId,
        resourceType: "seatLayout",
        resourceId: layoutId,
        summary: "Exported seat layout PDF",
        summaryKey: "activitySummary_exportedSeatLayoutPdf",
        metadata: {
          name: layout?.name ?? "",
          orientations: selection.orientations.join(","),
          perPage: String(selection.perPage),
        },
      });
    } catch {
      toast.add({ title: t("printPdfFailed"), type: "error" });
      throw new Error("print failed");
    }
  };

  if (isPending || !hydrated) {
    return (
      <div className="flex w-full flex-col gap-4 px-4 py-8 sm:px-8">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-[480px] w-full rounded-xl" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="px-4 py-8 sm:px-8">
        <ErrorState
          title={t("loadFailed")}
          description={t("loadFailedDescription")}
          onRetry={() => void refetch()}
        />
      </div>
    );
  }

  if (!layout) {
    return (
      <div className="px-4 py-8 sm:px-8">
        <ErrorState
          title={t("layoutNotFound")}
          description={t("layoutNotFoundDescription")}
          onRetry={() => {
            void navigate({
              to: "/class/$classId/assigners/seats/layouts",
              params: { classId },
            });
          }}
        />
      </div>
    );
  }

  const sharedNames = sharedTeamNames(groups);
  const degrees = SEAT_ORIENTATION_DEGREES[orientation];
  const textDegrees = -degrees;
  const textTransformStyle =
    textDegrees !== 0
      ? ({
          transform: `rotate(${textDegrees}deg)`,
          transformOrigin: "center center",
        } as const)
      : undefined;
  const saveLabel = saveItems.isPending
    ? t("editorSaveStatusSaving")
    : dirty
      ? t("editorSaveStatusUnsaved")
      : t("editorSaveStatusSaved");

  const canvasEdges = (["n", "e", "s", "w"] as const).map((edge) => ({
    edge,
    canExpand:
      resizeSeatCanvas({
        width: canvasWidth,
        height: canvasHeight,
        items,
        edge,
        deltaCells: 1,
      }) !== null,
    canShrink:
      resizeSeatCanvas({
        width: canvasWidth,
        height: canvasHeight,
        items,
        edge,
        deltaCells: -1,
      }) !== null,
  }));

  return (
    <div className="flex min-h-[calc(100svh-5rem)] w-full flex-col gap-3 px-4 py-6 sm:px-8">
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <h1 className="truncate text-2xl font-semibold tracking-tight">{layout.name}</h1>
          {canManage ? (
            <HelpTip title={t("multiSelectHint")} description={t("deleteKeyHint")} />
          ) : null}
        </div>
        {canManage ? <p className="text-sm text-muted-foreground">{saveLabel}</p> : null}
      </div>

      <div className="relative min-h-0 min-w-0 flex-1">
        <div
          ref={viewportRef}
          className={cn(
            "absolute inset-0 overflow-hidden rounded-xl border bg-muted/20 touch-none",
            isPanning ? "cursor-grabbing" : "cursor-grab",
          )}
          onPointerDown={onStagePointerDown}
          onPointerMove={onStagePointerMove}
          onPointerUp={onStagePointerUp}
          onPointerCancel={onStagePointerUp}
        >
          <div
            className="absolute top-0 left-0"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px)`,
            }}
          >
            <div
              className="relative p-10"
              style={{
                transform: `rotate(${degrees}deg)`,
                transformOrigin: "center center",
              }}
            >
              {canManage
                ? canvasEdges.map(({ edge, canExpand, canShrink }) => (
                    <div
                      key={edge}
                      className={cn(
                        "absolute z-30 flex gap-0.5 rounded-md border bg-background/95 p-0.5 shadow-sm",
                        edge === "n" && "top-2 left-1/2 -translate-x-1/2 flex-row",
                        edge === "s" && "bottom-2 left-1/2 -translate-x-1/2 flex-row",
                        edge === "e" && "top-1/2 right-2 -translate-y-1/2 flex-col",
                        edge === "w" && "top-1/2 left-2 -translate-y-1/2 flex-col",
                      )}
                      onPointerDown={(event) => event.stopPropagation()}
                    >
                      <Button
                        type="button"
                        size="icon-xs"
                        variant="outline"
                        disabled={!canShrink}
                        aria-label={t(CANVAS_EDGE_LABEL_KEYS[edge].shrink)}
                        onClick={() => handleCanvasResize(edge, -1)}
                      >
                        <Minus />
                      </Button>
                      <Button
                        type="button"
                        size="icon-xs"
                        variant="outline"
                        disabled={!canExpand}
                        aria-label={t(CANVAS_EDGE_LABEL_KEYS[edge].expand)}
                        onClick={() => handleCanvasResize(edge, 1)}
                      >
                        <Plus />
                      </Button>
                    </div>
                  ))
                : null}
              <div
                style={{
                  width: canvasWidth,
                  height: canvasHeight,
                }}
              >
                <div
                  ref={stageRef}
                  className="relative h-full w-full touch-none bg-background shadow-sm"
                  style={{
                    backgroundImage: `
                  linear-gradient(color-mix(in oklab, var(--border) 55%, transparent) 1px, transparent 1px),
                  linear-gradient(90deg, color-mix(in oklab, var(--border) 55%, transparent) 1px, transparent 1px)
                `,
                    backgroundSize: `${SEAT_CANVAS_GRID_SIZE}px ${SEAT_CANVAS_GRID_SIZE}px`,
                  }}
                >
                  {guides.map((guide, index) => (
                    <div
                      key={`${guide.orientation}-${guide.position}-${index}`}
                      className="pointer-events-none absolute z-20 bg-sky-500/70"
                      style={
                        guide.orientation === "vertical"
                          ? { left: guide.position, top: 0, width: 1, height: "100%" }
                          : { top: guide.position, left: 0, height: 1, width: "100%" }
                      }
                    />
                  ))}
                  {items.map((item) => {
                    const team = resolveTeamLabel(item.teamAssignment, groups);
                    return (
                      <div
                        key={item.id}
                        className={cn(
                          "absolute box-border cursor-default select-none border bg-card text-xs shadow-sm",
                          item.kind === "desk" && "border-sky-400 bg-sky-50 dark:bg-sky-950/40",
                          item.kind === "teacherDesk" &&
                            "border-amber-400 bg-amber-50 dark:bg-amber-950/40",
                          item.kind === "board" && "border-lime-500 bg-lime-50 dark:bg-lime-950/40",
                          item.kind === "rect" && "border-border",
                          selectedIdSet.has(item.id) && "ring-2 ring-primary",
                        )}
                        style={{
                          left: item.x,
                          top: item.y,
                          width: item.width,
                          height: item.height,
                        }}
                        onPointerDown={(event) => {
                          event.stopPropagation();
                          if (editingIdRef.current === item.id) return;
                          if (editingIdRef.current) {
                            commitLabelEdit();
                          }
                          const multi = isMultiSelectModifier(event);
                          if (multi) {
                            setSelectedIds((prev) =>
                              prev.includes(item.id)
                                ? prev.filter((id) => id !== item.id)
                                : [...prev, item.id],
                            );
                            return;
                          }
                          // Avoid starting a drag on the second click of a double-click.
                          if (event.detail > 1) {
                            setSelectedIds([item.id]);
                            return;
                          }
                          if (!canManage || !stageRef.current) {
                            setSelectedIds([item.id]);
                            return;
                          }
                          const nextSelection =
                            selectedIdSet.has(item.id) && selectedIds.length > 1
                              ? selectedIds
                              : [item.id];
                          setSelectedIds(nextSelection);
                          const rect = stageRef.current.getBoundingClientRect();
                          const scaleX = canvasWidth / rect.width;
                          const scaleY = canvasHeight / rect.height;
                          const pointerX = (event.clientX - rect.left) * scaleX;
                          const pointerY = (event.clientY - rect.top) * scaleY;
                          const moveIds = nextSelection;
                          const origins: Record<string, { x: number; y: number }> = {};
                          for (const moveItem of items) {
                            if (!moveIds.includes(moveItem.id)) continue;
                            origins[moveItem.id] = { x: moveItem.x, y: moveItem.y };
                          }
                          beginDragHistory();
                          dragRef.current = {
                            mode: "move",
                            itemId: item.id,
                            offsetX: pointerX - item.x,
                            offsetY: pointerY - item.y,
                            shiftKey: event.shiftKey,
                            moveIds,
                            origins,
                          };
                          event.currentTarget.setPointerCapture(event.pointerId);
                        }}
                        onPointerMove={(event) => {
                          if (!dragRef.current) return;
                          onItemPointerMove(event);
                        }}
                        onPointerUp={() => {
                          if (!dragRef.current) return;
                          endDrag();
                        }}
                        onPointerCancel={() => {
                          if (!dragRef.current) return;
                          endDrag();
                        }}
                        onDoubleClick={(event) => {
                          event.stopPropagation();
                          beginLabelEdit(item);
                        }}
                      >
                        {item.kind === "desk" && item.deskNumber !== undefined ? (
                          <span
                            className="absolute top-0.5 left-1 font-semibold tabular-nums"
                            style={textTransformStyle}
                          >
                            {item.deskNumber}
                          </span>
                        ) : null}
                        {editingId === item.id ? (
                          <input
                            ref={labelInputRef}
                            aria-label={t("editLabel")}
                            className="absolute inset-0 z-20 size-full bg-background/95 px-1 text-center text-xs outline-none ring-2 ring-primary"
                            style={textTransformStyle}
                            value={labelDraft}
                            onChange={(event) => {
                              labelDraftRef.current = event.target.value;
                              setLabelDraft(event.target.value);
                            }}
                            onBlur={() => {
                              commitLabelEdit();
                            }}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault();
                                event.currentTarget.blur();
                              } else if (event.key === "Escape") {
                                event.preventDefault();
                                cancelLabelEdit();
                              }
                              event.stopPropagation();
                            }}
                            onPointerDown={(event) => event.stopPropagation()}
                            onDoubleClick={(event) => event.stopPropagation()}
                          />
                        ) : (
                          <div
                            className="flex h-full flex-col items-center justify-center gap-0.5 px-1 pt-3 text-center"
                            style={textTransformStyle}
                          >
                            <span className="line-clamp-2 break-words">
                              {seatItemDisplayLabel(item, itemDefaults)}
                            </span>
                            {team ? (
                              <span
                                className={cn(
                                  "line-clamp-1 text-[10px] text-muted-foreground",
                                  team.stale && "text-destructive",
                                )}
                              >
                                {team.stale ? t("teamStale") : team.label}
                              </span>
                            ) : null}
                            {item.kind === "desk" && item.zoneName?.trim() ? (
                              <span className="line-clamp-1 text-[10px] text-muted-foreground">
                                {item.zoneName.trim()}
                              </span>
                            ) : null}
                          </div>
                        )}
                        {canManage && soleSelected?.id === item.id && editingId !== item.id
                          ? (["n", "e", "s", "w"] as const).map((edge) => (
                              <button
                                key={edge}
                                type="button"
                                aria-label={
                                  edge === "n"
                                    ? t("resizeEdgeNorth")
                                    : edge === "s"
                                      ? t("resizeEdgeSouth")
                                      : edge === "e"
                                        ? t("resizeEdgeEast")
                                        : t("resizeEdgeWest")
                                }
                                className={cn(
                                  "absolute z-10 size-2.5 rounded-full bg-primary",
                                  edge === "n" &&
                                    "top-0 left-1/2 -translate-x-1/2 -translate-y-1/2",
                                  edge === "s" &&
                                    "bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2",
                                  edge === "e" &&
                                    "top-1/2 right-0 translate-x-1/2 -translate-y-1/2",
                                  edge === "w" &&
                                    "top-1/2 left-0 -translate-x-1/2 -translate-y-1/2",
                                )}
                                onPointerDown={(event) => {
                                  event.stopPropagation();
                                  setSelectedIds([item.id]);
                                  beginDragHistory();
                                  dragRef.current = {
                                    mode: "resize",
                                    itemId: item.id,
                                    edge,
                                    startX: event.clientX,
                                    startY: event.clientY,
                                    origin: item,
                                    shiftKey: event.shiftKey,
                                  };
                                  (event.currentTarget as HTMLElement).setPointerCapture(
                                    event.pointerId,
                                  );
                                }}
                                onPointerMove={(event) => {
                                  if (!dragRef.current) return;
                                  onItemPointerMove(event);
                                }}
                                onPointerUp={() => {
                                  if (!dragRef.current) return;
                                  endDrag();
                                }}
                                onPointerCancel={() => {
                                  if (!dragRef.current) return;
                                  endDrag();
                                }}
                              />
                            ))
                          : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-3 z-40 flex justify-center px-3">
          <div className="pointer-events-auto max-w-full overflow-x-auto rounded-xl border bg-background/95 p-1.5 shadow-md backdrop-blur-sm">
            <SeatLayoutToolbar
              canManage={canManage}
              snapToGrid={snapToGrid}
              onSnapToGridChange={setSnapToGrid}
              orientation={orientation}
              onOrientationChange={setOrientation}
              onPrint={() => setPrintOpen(true)}
              canUndo={canUndo}
              canRedo={canRedo}
              onUndo={undoEdit}
              onRedo={redoEdit}
              onSave={handleSave}
              saving={saveItems.isPending}
              dirty={dirty}
              onAddItem={addItem}
              deskGridCols={deskGridCols}
              deskGridRows={deskGridRows}
              onDeskGridColsChange={setDeskGridCols}
              onDeskGridRowsChange={setDeskGridRows}
              onAddDeskGrid={addDeskGrid}
              selectedDesks={selectedDesks}
              groups={groups}
              sharedNames={sharedNames}
              onTeamAssignmentChange={(teamAssignment) => {
                const deskIds = new Set(selectedDesks.map((desk) => desk.id));
                updateItems((prev) =>
                  prev.map((item) =>
                    deskIds.has(item.id) ? applyTeamAssignment(item, teamAssignment) : item,
                  ),
                );
              }}
              zoneSuggestions={listZoneNames(items)}
              onZoneNameChange={(zoneName) => {
                const deskIds = new Set(selectedDesks.map((desk) => desk.id));
                updateItems((prev) =>
                  prev.map((item) => (deskIds.has(item.id) ? applyZoneName(item, zoneName) : item)),
                );
              }}
              hasSelection={selectedItems.length > 0}
              onDeleteSelected={deleteSelectedItems}
              canClear={items.length > 0}
              onClearCanvas={() => setClearCanvasOpen(true)}
            />
          </div>
        </div>
      </div>

      <SeatLayoutPrintCredenza
        open={printOpen}
        onOpenChange={setPrintOpen}
        currentOrientation={orientation}
        onConfirm={handlePrint}
      />

      <SeatLayoutUnsavedChangesDialog
        open={blocker.status === "blocked"}
        saving={saveItems.isPending}
        onCancel={() => {
          blocker.reset?.();
        }}
        onDiscard={() => {
          blocker.proceed?.();
        }}
        onSaveAndLeave={() => {
          void (async () => {
            const saved = await persistLayout();
            if (saved) {
              blocker.proceed?.();
            }
          })();
        }}
      />

      {canManage ? (
        <DeleteNamedCredenza
          open={clearCanvasOpen}
          onOpenChange={setClearCanvasOpen}
          title={t("clearCanvasTitle")}
          description={t("clearCanvasDescription")}
          confirmLabel={t("clearCanvasConfirm")}
          onConfirm={async () => {
            clearCanvas();
          }}
        />
      ) : null}
    </div>
  );
}
