import type { OptimisticLocalStore } from "convex/browser";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import {
  applyBehaviorItemsToBoard,
  applyRewardRedemptionsToBoard,
  type PointsBoard,
} from "@/lib/points/points";

type PointsBoardItemDelta = {
  points: number;
  quantity: number;
};

function patchMountedPointsBoards(
  localStore: OptimisticLocalStore,
  classId: Id<"classes">,
  nextBoard: (board: PointsBoard) => PointsBoard,
) {
  for (const entry of localStore.getAllQueries(api.points.board)) {
    if (entry.value === undefined || entry.args.classId !== classId) continue;
    localStore.setQuery(api.points.board, entry.args, nextBoard(entry.value));
  }
}

/** Convex local-store overlay so live board watches keep optimistic points. */
export function optimisticApplyBehaviorsToBoardQueries(
  localStore: OptimisticLocalStore,
  classId: Id<"classes">,
  studentUserIds: ReadonlyArray<Id<"users">>,
  items: ReadonlyArray<PointsBoardItemDelta>,
) {
  patchMountedPointsBoards(localStore, classId, (board) =>
    applyBehaviorItemsToBoard(board, studentUserIds, items),
  );
}

export function optimisticApplyRedemptionsToBoardQueries(
  localStore: OptimisticLocalStore,
  classId: Id<"classes">,
  studentUserIds: ReadonlyArray<Id<"users">>,
  items: ReadonlyArray<PointsBoardItemDelta>,
) {
  patchMountedPointsBoards(localStore, classId, (board) =>
    applyRewardRedemptionsToBoard(board, studentUserIds, items),
  );
}
