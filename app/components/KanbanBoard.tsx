"use client";

import {
  useCallback,
  useEffect,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { GripVertical } from "lucide-react";
import { useTranslation } from "react-i18next";

import { cn } from "@/lib/utils";

export type KanbanStatus = "todo" | "in_progress" | "done";

type Column = {
  id: KanbanStatus;
  titleKey: string;
  tone: string;
};

const COLUMNS: Column[] = [
  { id: "todo", titleKey: "components.kanban.todo", tone: "border-border" },
  {
    id: "in_progress",
    titleKey: "components.kanban.inProgress",
    tone: "border-amber-500/40",
  },
  {
    id: "done",
    titleKey: "components.kanban.done",
    tone: "border-emerald-500/40",
  },
];

const COLUMN_ORDER: KanbanStatus[] = ["todo", "in_progress", "done"];

export type KanbanItem = {
  id: string;
  status: KanbanStatus;
};

type RenderCardArgs<T extends KanbanItem> = {
  item: T;
  isDragging: boolean;
};

type Props<T extends KanbanItem> = {
  items: T[];
  onMove?: (itemId: string, nextStatus: KanbanStatus) => void;
  renderCard: (args: RenderCardArgs<T>) => ReactNode;
  emptyMessage?: string;
  columnExtras?: Partial<Record<KanbanStatus, ReactNode>>;
};

export function KanbanBoard<T extends KanbanItem>({
  items: incoming,
  onMove,
  renderCard,
  emptyMessage,
  columnExtras,
}: Props<T>) {
  // Mirror incoming items into local state so DnD moves feel instant.
  // When the parent refetches and pushes new `items`, we sync.
  const [items, setItems] = useState<T[]>(incoming);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    setItems(incoming);
  }, [incoming]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const grouped: Record<KanbanStatus, T[]> = {
    todo: items.filter((i) => i.status === "todo"),
    in_progress: items.filter((i) => i.status === "in_progress"),
    done: items.filter((i) => i.status === "done"),
  };

  function onDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function onDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;
    const itemId = String(active.id);
    const overId = String(over.id);
    const nextStatus = COLUMNS.find((c) => c.id === overId)?.id;
    if (!nextStatus) return;
    moveItem(itemId, nextStatus);
  }

  const moveItem = useCallback(
    (itemId: string, nextStatus: KanbanStatus) => {
      setItems((prev) => {
        const current = prev.find((i) => i.id === itemId);
        if (!current || current.status === nextStatus) return prev;
        return prev.map((i) =>
          i.id === itemId ? ({ ...i, status: nextStatus } as T) : i
        );
      });
      onMove?.(itemId, nextStatus);
    },
    [onMove]
  );

  const moveItemByDelta = useCallback(
    (itemId: string, delta: number) => {
      const current = items.find((i) => i.id === itemId);
      if (!current) return;
      const idx = COLUMN_ORDER.indexOf(current.status);
      const nextIdx = Math.min(
        COLUMN_ORDER.length - 1,
        Math.max(0, idx + delta)
      );
      if (nextIdx === idx) return;
      moveItem(itemId, COLUMN_ORDER[nextIdx]);
    },
    [items, moveItem]
  );

  const activeItem = activeId ? items.find((i) => i.id === activeId) : null;

  return (
    <DndContext
      sensors={sensors}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {COLUMNS.map((col) => (
          <KanbanColumn
            key={col.id}
            column={col}
            count={grouped[col.id].length}
            extras={columnExtras?.[col.id]}
          >
            {grouped[col.id].length === 0 && emptyMessage ? (
              <li className="rounded-md border border-dashed border-border px-4 py-6 text-center text-xs text-muted-foreground">
                {emptyMessage}
              </li>
            ) : null}
            {grouped[col.id].map((item) => (
              <DraggableCard
                key={item.id}
                id={item.id}
                isActive={activeId === item.id}
                onMoveLeft={() => moveItemByDelta(item.id, -1)}
                onMoveRight={() => moveItemByDelta(item.id, 1)}
              >
                {renderCard({ item, isDragging: activeId === item.id })}
              </DraggableCard>
            ))}
          </KanbanColumn>
        ))}
      </div>

      <DragOverlay dropAnimation={null}>
        {activeItem ? (
          <div className="rotate-1 opacity-95 shadow-[0_8px_24px_rgba(0,0,0,0.35)]">
            {renderCard({ item: activeItem, isDragging: true })}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function KanbanColumn({
  column,
  count,
  children,
  extras,
}: {
  column: Column;
  count: number;
  children: ReactNode;
  extras?: ReactNode;
}) {
  const { t } = useTranslation();
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  return (
    <div className="flex flex-col gap-3">
      <div
        className={cn(
          "flex items-center justify-between rounded-md border bg-card px-4 py-3",
          column.tone
        )}
      >
        <span className="text-sm font-medium text-foreground">
          {t(column.titleKey)}
        </span>
        <span className="grid h-7 w-7 place-items-center rounded-md bg-muted text-xs text-foreground">
          {count}
        </span>
      </div>

      <ul
        ref={setNodeRef}
        className={cn(
          "flex min-h-[120px] flex-col gap-2 rounded-md p-1 transition-colors",
          isOver && "bg-primary/5 ring-1 ring-primary/40"
        )}
      >
        {children}
      </ul>

      {extras}
    </div>
  );
}

function DraggableCard({
  id,
  isActive,
  children,
  onMoveLeft,
  onMoveRight,
}: {
  id: string;
  isActive: boolean;
  children: ReactNode;
  onMoveLeft: () => void;
  onMoveRight: () => void;
}) {
  const { t } = useTranslation();
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({
    id,
  });

  function onKeyDown(e: ReactKeyboardEvent<HTMLButtonElement>) {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      onMoveLeft();
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      onMoveRight();
    }
  }

  return (
    <li
      ref={setNodeRef}
      className={cn(
        "relative group",
        (isDragging || isActive) && "opacity-30"
      )}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        onKeyDown={onKeyDown}
        aria-label={t("components.kanban.moveTaskAria")}
        className="absolute left-1 top-1/2 z-10 grid h-6 w-4 -translate-y-1/2 cursor-grab place-items-center rounded text-muted-foreground/40 transition-opacity hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing md:opacity-0 md:group-hover:opacity-100"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      {children}
    </li>
  );
}
