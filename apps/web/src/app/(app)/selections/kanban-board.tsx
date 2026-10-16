"use client";

import { useState, useTransition } from "react";
import {
  DndContext,
  DragOverlay,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { Badge } from "@/components/ui/badge";
import { moveToStage } from "./actions";

type Stage = { id: string; name: string; order: number };
type SelectionCard = {
  id: string;
  applicantName: string;
  stageId: string;
  resultLabel: string;
  assigneeName: string | null;
};

function Card({ card }: { card: SelectionCard }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: card.id,
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{
        transform: transform ? `translate(${transform.x}px, ${transform.y}px)` : undefined,
      }}
      className={`cursor-grab rounded-md border border-border bg-card p-2.5 text-sm shadow-sm active:cursor-grabbing ${
        isDragging ? "opacity-40" : ""
      }`}
    >
      <div className="font-medium">{card.applicantName}</div>
      <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
        <span>{card.assigneeName ?? "未割当"}</span>
        <Badge variant="outline" className="text-[10px]">
          {card.resultLabel}
        </Badge>
      </div>
    </div>
  );
}

function Column({ stage, cards }: { stage: Stage; cards: SelectionCard[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });

  return (
    <div
      ref={setNodeRef}
      data-stage-name={stage.name}
      className={`flex w-64 shrink-0 flex-col gap-2 rounded-lg border border-border bg-secondary/40 p-3 ${
        isOver ? "bg-secondary" : ""
      }`}
    >
      <div className="flex items-center justify-between text-sm font-semibold">
        {stage.name}
        <span className="text-xs font-normal text-muted-foreground">{cards.length}</span>
      </div>
      <div className="flex flex-col gap-2">
        {cards.map((card) => (
          <Card key={card.id} card={card} />
        ))}
      </div>
    </div>
  );
}

export function KanbanBoard({
  stages,
  initialCards,
}: {
  stages: Stage[];
  initialCards: SelectionCard[];
}) {
  const [cards, setCards] = useState(initialCards);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;
    const cardId = String(active.id);
    const toStageId = String(over.id);
    const card = cards.find((c) => c.id === cardId);
    if (!card || card.stageId === toStageId) return;

    // FR096: 1つ先以外のステージへ飛ばす(スキップする)移動は、監査のため理由の
    // 入力を促す。キャンセルした場合は移動自体を取りやめる。
    const fromStage = stages.find((s) => s.id === card.stageId);
    const toStage = stages.find((s) => s.id === toStageId);
    const isForwardSkip = !!fromStage && !!toStage && toStage.order > fromStage.order + 1;

    let note: string | undefined;
    if (isForwardSkip) {
      const reason = window.prompt(
        `${fromStage!.name}の次のステージを飛ばして${toStage!.name}へ移動します。理由を入力してください(任意)`
      );
      if (reason === null) return;
      note = reason || undefined;
    }

    setCards((prev) => prev.map((c) => (c.id === cardId ? { ...c, stageId: toStageId } : c)));
    startTransition(() => {
      moveToStage(cardId, toStageId, note);
    });
  }

  const activeCard = cards.find((c) => c.id === activeId);

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {stages.map((stage) => (
          <Column key={stage.id} stage={stage} cards={cards.filter((c) => c.stageId === stage.id)} />
        ))}
      </div>
      <DragOverlay>{activeCard && <Card card={activeCard} />}</DragOverlay>
    </DndContext>
  );
}
