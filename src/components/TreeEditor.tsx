"use client";

import { useState, useMemo } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

/* ─── Types ─── */
export interface TreeNode {
  id: string;
  label: string;
  code: string;
  parent_id: string | null;
  position: number;
  is_active: boolean;
  ref?: string;
  [key: string]: string | number | boolean | null | undefined;
}

interface TreeEditorProps {
  items: TreeNode[];
  onReorder: (items: { id: string; parent_id: string | null; position: number }[]) => void;
  onAdd: (parentId: string | null) => void;
  onEdit: (item: TreeNode) => void;
  onDelete: (id: string) => void;
  showRef?: boolean;
  flat?: boolean;
}

/* ─── Build children map ─── */
function buildChildrenMap(items: TreeNode[]): Map<string | null, TreeNode[]> {
  const map = new Map<string | null, TreeNode[]>();
  map.set(null, []);
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const key = item.parent_id || null;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item);
  }
  Array.from(map.keys()).forEach((key) => {
    map.get(key)!.sort((a, b) => a.position - b.position);
  });
  return map;
}

/* ─── Flatten ordered tree into {id, parent_id, position}[] ─── */
function flattenOrdered(
  map: Map<string | null, TreeNode[]>,
  parentId: string | null = null
): { id: string; parent_id: string | null; position: number }[] {
  const result: { id: string; parent_id: string | null; position: number }[] = [];
  const children = map.get(parentId) || [];
  children.forEach((child, idx) => {
    result.push({ id: child.id, parent_id: parentId, position: idx });
    result.push(...flattenOrdered(map, child.id));
  });
  return result;
}

/* ─── Get all descendant IDs ─── */
function getDescendants(map: Map<string | null, TreeNode[]>, id: string): Set<string> {
  const set = new Set<string>();
  const stack = [id];
  while (stack.length) {
    const cur = stack.pop()!;
    const children = map.get(cur) || [];
    for (let i = 0; i < children.length; i++) {
      set.add(children[i].id);
      stack.push(children[i].id);
    }
  }
  return set;
}

/* ─── Build flat render order with depth info ─── */
interface FlatRow {
  node: TreeNode;
  depth: number;
  isLast: boolean;
  prefixChars: string;
}

function buildFlatRows(
  map: Map<string | null, TreeNode[]>,
  parentId: string | null = null,
  depth: number = 0,
  parentPrefix: string = "",
  collapsed: Set<string> = new Set()
): FlatRow[] {
  const children = map.get(parentId) || [];
  const rows: FlatRow[] = [];

  children.forEach((child, idx) => {
    const isLast = idx === children.length - 1;
    let prefixChars = "";
    if (depth > 0) {
      prefixChars = parentPrefix + (isLast ? "\u2514\u2500 " : "\u251C\u2500 ");
    }
    rows.push({ node: child, depth, isLast, prefixChars });

    if (!collapsed.has(child.id)) {
      const childPrefix = depth > 0
        ? parentPrefix + (isLast ? "   " : "\u2502  ")
        : "";
      rows.push(...buildFlatRows(map, child.id, depth + 1, childPrefix, collapsed));
    }
  });

  return rows;
}

/* ═══════════════════════════════════════════════
   SORTABLE ROW
   ═══════════════════════════════════════════════ */
function SortableRow({
  row,
  isOver,
  overPosition,
  showRef,
  flat,
  hasChildren,
  isCollapsed,
  onToggle,
  onAdd,
  onEdit,
  onDelete,
}: {
  row: FlatRow;
  isOver: boolean;
  overPosition: "before" | "inside" | "after" | null;
  showRef?: boolean;
  flat?: boolean;
  hasChildren: boolean;
  isCollapsed: boolean;
  onToggle: () => void;
  onAdd: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: row.node.id });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  let dropIndicator = "";
  if (isOver && !isDragging) {
    if (overPosition === "before") dropIndicator = "border-t-2 border-t-[#FF8C00]";
    else if (overPosition === "after") dropIndicator = "border-b-2 border-b-[#FF8C00]";
    else if (overPosition === "inside") dropIndicator = "bg-[#FF8C00]/10 border-l-2 border-l-[#FF8C00]";
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center group py-1 px-2 transition-colors
        ${isDragging ? "opacity-30 bg-[#00FF00]/5" : "hover:bg-[#00FF00]/5"}
        ${dropIndicator}
      `}
    >
      {/* Drag handle */}
      <span
        {...attributes}
        {...listeners}
        className="text-[#00FF00]/20 text-[10px] cursor-grab active:cursor-grabbing mr-1 shrink-0 select-none"
        title="DEPLACER"
      >
        {"\u2630"}
      </span>

      {/* Tree lines */}
      {!flat && (
        <span className="text-[#00FF00]/25 text-[11px] whitespace-pre font-mono select-none shrink-0">
          {row.prefixChars}
        </span>
      )}

      {/* Collapse toggle */}
      {!flat && (hasChildren ? (
        <button
          onClick={(e) => { e.stopPropagation(); onToggle(); }}
          className="text-[#00FF00]/50 text-[9px] w-4 text-center shrink-0 hover:text-[#00FF00]"
        >
          {isCollapsed ? "\u25B6" : "\u25BC"}
        </button>
      ) : (
        <span className="w-4 shrink-0" />
      ))}

      {/* Status dot */}
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 mr-1.5 ${
        row.node.is_active ? "bg-[#00FF00]" : "bg-red-500/50"
      }`} />

      {/* Label */}
      <span className="text-[10px] text-white/80 tracking-wider truncate flex-1">
        {row.node.code}
        {row.node.code !== row.node.label && (
          <span className="text-white/30 ml-1">({row.node.label})</span>
        )}
        {showRef && row.node.ref && (
          <span className="text-[#00FF00]/30 ml-2">{row.node.ref}</span>
        )}
      </span>

      {/* Actions */}
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2">
        {!flat && (
          <button
            onClick={onAdd}
            className="text-[#00FF00]/50 text-[9px] border border-[#00FF00]/20 px-1.5 py-0 hover:bg-[#00FF00]/10 hover:text-[#00FF00]"
            title="AJOUTER ENFANT"
          >
            +
          </button>
        )}
        <button
          onClick={onEdit}
          className="text-[#FF8C00]/50 text-[9px] border border-[#FF8C00]/20 px-1.5 py-0 hover:bg-[#FF8C00]/10 hover:text-[#FF8C00]"
          title="MODIFIER"
        >
          E
        </button>
        <button
          onClick={onDelete}
          className="text-red-500/50 text-[9px] border border-red-500/20 px-1.5 py-0 hover:bg-red-500/10 hover:text-red-500"
          title="SUPPRIMER"
        >
          X
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   MAIN TREE EDITOR
   ═══════════════════════════════════════════════ */
export default function TreeEditor({ items, onReorder, onAdd, onEdit, onDelete, showRef, flat }: TreeEditorProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [overPosition, setOverPosition] = useState<"before" | "inside" | "after" | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  const childrenMap = useMemo(() => buildChildrenMap(items), [items]);

  const flatRows = useMemo(
    () => buildFlatRows(childrenMap, null, 0, "", collapsed),
    [childrenMap, collapsed]
  );

  const sortableIds = useMemo(() => flatRows.map((r) => r.node.id), [flatRows]);

  const toggleCollapse = (id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const activeItem = activeId ? items.find((i) => i.id === activeId) : null;

  /* ─── Drag handlers ─── */
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { over, active } = event;
    if (!over || over.id === active.id) {
      setOverId(null);
      setOverPosition(null);
      return;
    }

    setOverId(String(over.id));

    // Determine position based on pointer Y relative to the over element
    const overRect = event.over?.rect;
    const pointerY = event.activatorEvent instanceof MouseEvent
      ? event.activatorEvent.clientY + (event.delta?.y || 0)
      : null;

    if (overRect && pointerY !== null) {
      const relY = pointerY - overRect.top;
      const height = overRect.height;
      if (flat) {
        setOverPosition(relY < height * 0.5 ? "before" : "after");
      } else {
        if (relY < height * 0.25) setOverPosition("before");
        else if (relY > height * 0.75) setOverPosition("after");
        else setOverPosition("inside");
      }
    } else {
      setOverPosition("after");
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setOverId(null);
    setOverPosition(null);

    if (!over || active.id === over.id) return;

    const sourceId = String(active.id);
    const targetId = String(over.id);

    // Prevent dropping into own descendants
    const descendants = getDescendants(childrenMap, sourceId);
    if (descendants.has(targetId)) return;

    // Clone the map
    const newMap = new Map<string | null, TreeNode[]>();
    Array.from(childrenMap.keys()).forEach((key) => {
      newMap.set(key, [...childrenMap.get(key)!]);
    });

    const sourceItem = items.find((i) => i.id === sourceId)!;
    const targetItem = items.find((i) => i.id === targetId)!;

    // Remove source from its current parent
    const sourceParent = sourceItem.parent_id || null;
    const sourceList = newMap.get(sourceParent) || [];
    newMap.set(sourceParent, sourceList.filter((i) => i.id !== sourceId));

    const pos = overPosition || "after";

    if (pos === "inside") {
      // Drop as child of target
      if (!newMap.has(targetId)) newMap.set(targetId, []);
      newMap.get(targetId)!.push({ ...sourceItem, parent_id: targetId });
    } else {
      // Drop before/after target in target's parent group
      const targetParent = targetItem.parent_id || null;
      if (!newMap.has(targetParent)) newMap.set(targetParent, []);
      const targetList = newMap.get(targetParent)!;
      const targetIndex = targetList.findIndex((i) => i.id === targetId);
      const insertIdx = pos === "before" ? targetIndex : targetIndex + 1;
      targetList.splice(insertIdx, 0, { ...sourceItem, parent_id: targetParent });
      newMap.set(targetParent, targetList);
    }

    const flat = flattenOrdered(newMap);
    onReorder(flat);
  };

  return (
    <div className="border border-[#00FF00]/20 bg-black">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-[#00FF00]/15 bg-[#00FF00]/[0.03]">
        <span className="text-[9px] text-[#00FF00]/40 tracking-wider">
          {flat ? "LISTE — DRAG & DROP" : "ARBORESCENCE — DRAG & DROP"}
        </span>
        <button
          onClick={() => onAdd(null)}
          className="text-[9px] text-[#00FF00] border border-[#00FF00]/30 px-2 py-0.5 hover:bg-[#00FF00]/10 transition-colors"
        >
          + {flat ? "AJOUTER" : "RACINE"}
        </button>
      </div>

      {/* Tree */}
      <div className="py-1 min-h-[100px]">
        {flatRows.length === 0 ? (
          <p className="text-white/20 text-[10px] text-center py-6 tracking-wider">
            AUCUN ELEMENT
          </p>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
              {flatRows.map((row) => {
                const children = childrenMap.get(row.node.id) || [];
                return (
                  <SortableRow
                    key={row.node.id}
                    row={row}
                    isOver={overId === row.node.id}
                    overPosition={overId === row.node.id ? overPosition : null}
                    showRef={showRef}
                    flat={flat}
                    hasChildren={children.length > 0}
                    isCollapsed={collapsed.has(row.node.id)}
                    onToggle={() => toggleCollapse(row.node.id)}
                    onAdd={() => onAdd(row.node.id)}
                    onEdit={() => onEdit(row.node)}
                    onDelete={() => onDelete(row.node.id)}
                  />
                );
              })}
            </SortableContext>

            {/* Drag overlay */}
            <DragOverlay>
              {activeItem ? (
                <div className="flex items-center py-1 px-2 bg-black border border-[#FF8C00]/50 opacity-90">
                  <span className="text-[#FF8C00]/30 text-[10px] mr-2">{"\u2630"}</span>
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 mr-1.5 ${
                    activeItem.is_active ? "bg-[#00FF00]" : "bg-red-500/50"
                  }`} />
                  <span className="text-[10px] text-white/80 tracking-wider">
                    {activeItem.code}
                  </span>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
      </div>
    </div>
  );
}
