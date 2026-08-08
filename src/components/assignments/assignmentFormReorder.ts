import { arrayMove } from "@dnd-kit/sortable";

export function reorderByKey<T extends { key: string }>(
  items: T[],
  activeId: string | number,
  overId: string | number,
): T[] | null {
  const oldIndex = items.findIndex((item) => item.key === activeId);
  const newIndex = items.findIndex((item) => item.key === overId);
  if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return null;
  return arrayMove(items, oldIndex, newIndex);
}
