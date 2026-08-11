import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  type DragEndEvent,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import type { ReactNode } from "react";

import { rowFocusKeyProps } from "@/hooks/usePendingRowFocus";

function useAssignmentFormSortableSensors() {
  return useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
}

export function SortableVerticalList({
  itemIds,
  onReorder,
  children,
}: {
  itemIds: string[];
  onReorder: (event: DragEndEvent) => void;
  children: ReactNode;
}) {
  const sensors = useAssignmentFormSortableSensors();

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onReorder}>
      <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  );
}

export function SortableFormItem({
  id,
  disabled = false,
  dragLabel,
  className,
  rowFocusKey,
  children,
}: {
  id: string;
  disabled?: boolean;
  dragLabel: string;
  className?: string;
  rowFocusKey?: string;
  children: (dragHandle: ReactNode) => ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled,
  });

  const dragHandle = disabled ? null : (
    <button
      type="button"
      className="inline-flex shrink-0 cursor-grab touch-none text-muted-foreground active:cursor-grabbing"
      aria-label={dragLabel}
      {...attributes}
      {...listeners}
    >
      <GripVertical className="size-4" aria-hidden />
    </button>
  );

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.7 : 1,
      }}
      className={className}
      data-dragging={isDragging || undefined}
      {...(rowFocusKey ? rowFocusKeyProps(rowFocusKey) : {})}
    >
      {children(dragHandle)}
    </div>
  );
}
