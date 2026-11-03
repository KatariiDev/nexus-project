import type { ReactNode } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CalendarDays, GripVertical } from 'lucide-react';
import { useApp, userById } from '../../store/AppContext';
import type { Task, User } from '../../types';
import { Badge, PriorityBadge } from '../../components/ui/badge';
import { AvatarStack } from '../../components/ui/avatar';
import { ColorDot } from '../../components/ui/color-dot';
import { Progress } from '../../components/ui/progress';
import { dueLabel } from '../../lib/format';
import { cn } from '../../lib/utils';
import { dueToneClass } from './helpers';

/* Nội dung chung của một thẻ nhiệm vụ — dùng chung cho thẻ trong cột
 * (kéo được qua nút grip) và bản xem trước trong DragOverlay (tĩnh). */
function TaskCardContent({ task, dragHandle }: { task: Task; dragHandle?: ReactNode }) {
  const { state } = useApp();

  const items = state.checklists.filter((c) => c.taskId === task.id);
  const doneCount = items.filter((c) => c.done).length;
  const due = dueLabel(task.dueDate, task.status);
  const assignees = task.assigneeIds
    .map((id) => userById(state.users, id))
    .filter((u): u is User => Boolean(u));
  const labels = state.labels.filter((l) => task.labelIds.includes(l.id));

  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] text-muted-foreground">{task.code}</span>
        {dragHandle}
      </div>
      <p className="line-clamp-2 mt-1 text-sm font-medium leading-snug">{task.title}</p>
      {task.declinedBy && (
        <div className="mt-1.5">
          <Badge tone="destructive">Đã từ chối</Badge>
        </div>
      )}
      <div className="mt-2 flex items-center justify-between gap-2">
        <PriorityBadge priority={task.priority} />
        <span className={cn('inline-flex items-center gap-1 text-xs', dueToneClass[due.tone])}>
          <CalendarDays className="h-3.5 w-3.5" />
          {due.text}
        </span>
      </div>
      <div className="mt-2.5 flex items-center justify-between gap-2">
        {assignees.length > 0 ? (
          <AvatarStack users={assignees} size="xs" />
        ) : (
          <span className="text-xs text-muted-foreground">Chưa giao</span>
        )}
        <div className="flex items-center gap-1.5">
          {labels.map((l) => (
            <ColorDot key={l.id} title={l.name} color={l.color} />
          ))}
          {items.length > 0 && (
            <span className="ml-1 text-xs text-muted-foreground">{doneCount}/{items.length}</span>
          )}
        </div>
      </div>
      {items.length > 0 && <Progress value={(doneCount / items.length) * 100} className="mt-2 h-1" />}
    </>
  );
}

export function TaskCard({ task, onOpen }: { task: Task; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id });

  return (
    <div
      ref={setNodeRef}
      onClick={onOpen}
      className={cn(
        'cursor-pointer rounded-lg border bg-card p-3 shadow-soft transition-shadow hover:shadow-lift',
        // Đang kéo: thẻ gốc ở lại trong cột làm placeholder mờ, KHÔNG áp transform
        // (bản xem trước trong DragOverlay mới là thứ đi theo con trỏ).
        isDragging && 'opacity-40',
      )}
    >
      <TaskCardContent
        task={task}
        dragHandle={
          <button
            {...attributes}
            {...listeners}
            onClick={(e) => e.stopPropagation()}
            className="cursor-grab rounded p-1 text-muted-foreground hover:bg-accent active:cursor-grabbing"
            aria-label="Kéo để di chuyển"
          >
            <GripVertical className="h-4 w-4" />
          </button>
        }
      />
    </div>
  );
}


/* Bản xem trước của task đang kéo — nổi lên trên mọi thứ qua DragOverlay,
 * rộng đúng bằng thẻ trong cột (cột 280px trừ padding 2 bên). */
export function TaskCardPreview({ task }: { task: Task }) {
  return (
    <div className="w-[260px] cursor-grabbing rounded-lg border bg-card p-3 shadow-lift">
      <TaskCardContent task={task} />
    </div>
  );
}
