"use client";

import type { ReactNode } from "react";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type Identifiable = { id: string };

// A single draggable card. The card body (image + controls) is provided by the
// caller; this wrapper only adds the drag affordance. The grip is the *only*
// drag activator and is `touch-none`, so touch-dragging the grip never scrolls
// the page while the rest of the card (and the page) scrolls normally and its
// buttons/links stay tappable.
function SortableImageCard({
  children,
  disabled,
  id,
}: {
  children: ReactNode;
  disabled?: boolean;
  id: string;
}) {
  const {
    attributes,
    isDragging,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ disabled, id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      className={
        isDragging
          ? "relative z-10 overflow-hidden rounded-2xl border border-[#ff003c] bg-neutral-950 opacity-80"
          : "relative overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950"
      }
      ref={setNodeRef}
      style={style}
    >
      {disabled ? null : (
        <button
          aria-label="Arrastrar para reordenar"
          className="absolute left-2 top-2 z-10 flex h-8 w-8 cursor-grab touch-none items-center justify-center rounded-full bg-black/70 text-sm text-[#ff003c] transition hover:bg-[#ff003c]/20 active:cursor-grabbing"
          ref={setActivatorNodeRef}
          type="button"
          {...attributes}
          {...listeners}
        >
          ⠿
        </button>
      )}
      {children}
    </div>
  );
}

export default function SortableImageGrid<T extends Identifiable>({
  className,
  disabled,
  items,
  onReorder,
  renderItem,
}: {
  className?: string;
  disabled?: boolean;
  items: T[];
  onReorder: (oldIndex: number, newIndex: number) => void;
  renderItem: (item: T, index: number) => ReactNode;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = items.findIndex((item) => item.id === active.id);
    const newIndex = items.findIndex((item) => item.id === over.id);

    if (oldIndex === -1 || newIndex === -1) {
      return;
    }

    onReorder(oldIndex, newIndex);
  }

  return (
    <DndContext
      collisionDetection={closestCenter}
      onDragEnd={disabled ? undefined : handleDragEnd}
      sensors={sensors}
    >
      <SortableContext
        items={items.map((item) => item.id)}
        strategy={rectSortingStrategy}
      >
        <div
          className={["grid grid-cols-2 gap-2 sm:grid-cols-3", className]
            .filter(Boolean)
            .join(" ")}
        >
          {items.map((item, index) => (
            <SortableImageCard disabled={disabled} id={item.id} key={item.id}>
              {renderItem(item, index)}
            </SortableImageCard>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
