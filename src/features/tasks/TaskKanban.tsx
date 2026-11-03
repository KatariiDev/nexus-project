import { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { useApp, useCurrentUser, projectById } from '../../store/AppContext';
import type { Task, TaskStatus } from '../../types';
import { TASK_STATUSES } from '../../types';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { toast } from '../../components/ui/toast';
import { cn, newId } from '../../lib/utils';
import { nextTaskCode } from './helpers';
import { TaskCard } from './TaskCard';

const statusDot: Record<TaskStatus, string> = {
  todo: 'bg-muted-foreground',
  in_progress: 'bg-primary',
  in_review: 'bg-warning',
  done: 'bg-success',
};

function QuickAdd({ status, projectId }: { status: TaskStatus; projectId?: string }) {
  const { state, dispatch } = useApp();
  const me = useCurrentUser();
  const [value, setValue] = useState('');
  const project = projectId ? projectById(state.projects, projectId) : undefined;
  if (!project) return null;

  const submit = async () => {
    const title = value.trim();
    if (!title) return;
    const now = new Date().toISOString();
    const task: Task = {
      id: newId(),
      code: nextTaskCode(project.code, state.tasks),
      title,
      description: '',
      projectId: project.id,
      status,
      priority: 'medium',
      assigneeIds: [],
      creatorId: me.id,
      watcherIds: [],
      labelIds: [],
      createdAt: now,
      updatedAt: now,
    };
    const ok = await dispatch({ type: 'TASK_ADD', task });
    if (ok) {
      toast('Đã tạo nhiệm vụ', `${task.code} · ${title}`);
      setValue('');
    }
  };

  return (
    <div className="mt-2">
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
        placeholder="Thêm nhanh + Enter"
        className="bg-card"
        aria-label="Thêm nhanh nhiệm vụ"
      />
    </div>
  );
}

export function KanbanColumn({ status, tasks, quickProjectId, onOpenTask }: {
  status: (typeof TASK_STATUSES)[number];
  tasks: Task[];
  quickProjectId?: string;
  onOpenTask: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status.value });
  return (
    <div
      ref={setNodeRef}
      className={cn('flex w-[280px] shrink-0 flex-col rounded-xl border bg-muted/50 p-2.5 transition-colors', isOver && 'border-primary bg-primary/5')}
    >
      <div className="mb-2 flex items-center justify-between px-1">
        <span className="flex items-center gap-2 text-sm font-semibold">
          <span className={cn('h-2.5 w-2.5 rounded-full', statusDot[status.value])} />
          {status.label}
        </span>
        <Badge tone="muted">{tasks.length}</Badge>
      </div>
      <div className="flex max-h-[calc(100vh-340px)] min-h-[60px] flex-col gap-2 overflow-y-auto">
        {tasks.map((t) => (
          <TaskCard key={t.id} task={t} onOpen={() => onOpenTask(t.id)} />
        ))}
        {tasks.length === 0 && (
          <p className="rounded-md border border-dashed p-3 text-center text-xs text-muted-foreground">Kéo nhiệm vụ vào đây</p>
        )}
      </div>
      <QuickAdd status={status.value} projectId={quickProjectId} />
    </div>
  );
}
