import { CalendarDays, X, XCircle } from 'lucide-react';
import { Badge, PriorityBadge, TaskStatusBadge } from '../../components/ui/badge';
import { Select } from '../../components/ui/input';
import { toast } from '../../components/ui/toast';
import { fmtDateTime } from '../../lib/format';
import { cn } from '../../lib/utils';
import { PRIORITIES, TASK_STATUSES } from '../../types';
import type { Priority, Task, TaskStatus } from '../../types';
import { dueToneClass } from './helpers';

export function DrawerHeader({ task, canEdit, title, onTitleChange, onTitleBlur, onClose }: {
  task: Task;
  canEdit: boolean;
  title: string;
  onTitleChange: (v: string) => void;
  onTitleBlur: () => void;
  onClose: () => void;
}) {
  return (
      <div className="flex items-start justify-between gap-3 border-b p-4">
        <div className="min-w-0 flex-1">
          <Badge tone="muted" className="font-mono">{task.code}</Badge>
          {canEdit ? (
            <input
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              onBlur={onTitleBlur}
              onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
              className="mt-2 w-full rounded-md bg-transparent px-2 py-1 text-lg font-semibold outline-none hover:bg-accent/50 focus:bg-accent/50"
              aria-label="Tiêu đề nhiệm vụ"
            />
          ) : (
            <h2 className="mt-2 px-2 py-1 text-lg font-semibold">{task.title}</h2>
          )}
        </div>
        <button onClick={onClose} className="rounded-md p-1.5 text-muted-foreground hover:bg-accent" aria-label="Đóng">
          <X className="h-5 w-5" />
        </button>
      </div>
  );
}

export function DrawerStatusRow({ task, canChangeStatus, canManage, canEdit, editing, due, onUpdate }: {
  task: Task;
  canChangeStatus: boolean;
  canManage: boolean;
  canEdit: boolean;
  editing: boolean;
  due: { text: string; tone: string };
  onUpdate: (patch: Partial<Task>) => Promise<boolean>;
}) {
  return (
      <div className="flex flex-wrap items-center gap-2 border-b p-4">
        {canChangeStatus && (!canManage || editing) ? (
          <Select value={task.status} onChange={async (e) => { const ok = await onUpdate({ status: e.target.value as TaskStatus }); if (ok) toast('Đã cập nhật trạng thái'); }} className="w-auto" aria-label="Trạng thái">
            {TASK_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </Select>
        ) : (
          <TaskStatusBadge status={task.status} />
        )}
        {canEdit ? (
          <Select value={task.priority} onChange={async (e) => { const ok = await onUpdate({ priority: e.target.value as Priority }); if (ok) toast('Đã cập nhật mức ưu tiên'); }} className="w-auto" aria-label="Ưu tiên">
            {PRIORITIES.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </Select>
        ) : (
          <PriorityBadge priority={task.priority} />
        )}
        <span className={cn('ml-auto inline-flex items-center gap-1.5 text-sm', dueToneClass[due.tone])}>
          <CalendarDays className="h-4 w-4" />
          {due.text}
        </span>
      </div>
  );
}

export function DrawerDeclineBanner({ task, declinerName }: { task: Task; declinerName: string | null }) {
  return task.declinedBy ? (
    <div className="border-b border-destructive/30 bg-destructive/5 p-4">
          <p className="flex items-center gap-2 text-sm font-medium text-destructive">
            <XCircle className="h-4 w-4" />
            Đã từ chối nhận nhiệm vụ
          </p>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {declinerName}
            {task.declinedAt ? ` · ${fmtDateTime(task.declinedAt)}` : ''}
          </p>
          {task.declinedReason && <p className="mt-1 text-sm">Lý do: {task.declinedReason}</p>}
          <p className="mt-1.5 text-xs text-muted-foreground">
            Leader có thể dời deadline hoặc đổi người thực hiện ở mục Thông tin bên dưới.
          </p>
        </div>
  ) : null;
}
