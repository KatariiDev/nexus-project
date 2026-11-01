import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { DndContext, DragOverlay, useDraggable, useDroppable } from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import {
  AlertTriangle, ArrowDown, ArrowUp, CalendarDays, CheckCheck, ChevronsUpDown,
  Clock, GripVertical, Inbox, Plus, Search, SquareKanban, Table as TableIcon, Trash2,
} from 'lucide-react';
import { projectById, useApp, useCurrentUser, userById } from '../../store/AppContext';
import { canManageTaskForProject, visibleProjects } from '../../lib/roles';
import { useUI } from '../../components/layout/UIContext';
import type { Priority, Task, TaskStatus, User } from '../../types';
import { PRIORITIES, TASK_STATUSES, priorityLabel, taskStatusLabel } from '../../types';
import { Button } from '../../components/ui/button';
import { Badge, PriorityBadge, TaskStatusBadge } from '../../components/ui/badge';
import { Input, Select } from '../../components/ui/input';
import { Tabs } from '../../components/ui/tabs';
import { AvatarStack } from '../../components/ui/avatar';
import { Checkbox } from '../../components/ui/controls';
import { Progress } from '../../components/ui/progress';
import { ConfirmDialog, EmptyState, PageHeader } from '../../components/ui/feedback';
import { toast } from '../../components/ui/toast';
import { dueLabel, isOverdue } from '../../lib/format';
import { cn, newId } from '../../lib/utils';
import { nextTaskCode } from './helpers';
import { TaskForm } from './TaskForm';

const dueToneClass: Record<string, string> = {
  overdue: 'text-destructive',
  today: 'text-warning',
  tomorrow: 'text-sky-600 dark:text-sky-400',
  soon: 'text-muted-foreground',
  normal: 'text-muted-foreground',
  done: 'text-success',
};

const statusDot: Record<TaskStatus, string> = {
  todo: 'bg-muted-foreground',
  in_progress: 'bg-primary',
  in_review: 'bg-warning',
  done: 'bg-success',
};

/* ---------------- Kanban ---------------- */

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
            <span key={l.id} title={l.name} className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: l.color }} />
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

function TaskCard({ task, onOpen }: { task: Task; onOpen: () => void }) {
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
function TaskCardPreview({ task }: { task: Task }) {
  return (
    <div className="w-[260px] cursor-grabbing rounded-lg border bg-card p-3 shadow-lift">
      <TaskCardContent task={task} />
    </div>
  );
}

function QuickAdd({ status, projectId }: { status: TaskStatus; projectId?: string }) {
  const { state, dispatch } = useApp();
  const me = useCurrentUser();
  const [value, setValue] = useState('');
  const project = projectId ? projectById(state.projects, projectId) : undefined;
  if (!project) return null;

  const submit = () => {
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
    dispatch({ type: 'TASK_ADD', task });
    toast('Đã tạo nhiệm vụ', `${task.code} · ${title}`);
    setValue('');
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

function KanbanColumn({ status, tasks, quickProjectId, onOpenTask }: {
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

/* ---------------- Table ---------------- */

type SortKey = 'title' | 'priority' | 'dueDate' | 'status';
const priorityOrder: Record<Priority, number> = { low: 0, medium: 1, high: 2, urgent: 3 };
const statusOrder: Record<TaskStatus, number> = { todo: 0, in_progress: 1, in_review: 2, done: 3 };

function TaskTable({ tasks, onOpenTask, canManage }: { tasks: Task[]; onOpenTask: (id: string) => void; canManage: boolean }) {
  const { state, dispatch } = useApp();
  const [sortKey, setSortKey] = useState<SortKey>('dueDate');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkStatus, setBulkStatus] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const rows = useMemo(() => {
    let list = tasks;
    if (statusFilter !== 'all') list = list.filter((t) => t.status === statusFilter);
    if (priorityFilter !== 'all') list = list.filter((t) => t.priority === priorityFilter);
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
      switch (sortKey) {
        case 'title':
          return a.title.localeCompare(b.title, 'vi') * dir;
        case 'priority':
          return (priorityOrder[a.priority] - priorityOrder[b.priority]) * dir;
        case 'status':
          return (statusOrder[a.status] - statusOrder[b.status]) * dir;
        case 'dueDate': {
          const x = a.dueDate ? new Date(a.dueDate).getTime() : Number.POSITIVE_INFINITY;
          const y = b.dueDate ? new Date(b.dueDate).getTime() : Number.POSITIVE_INFINITY;
          return (x - y) * dir;
        }
      }
    });
  }, [tasks, statusFilter, priorityFilter, sortKey, sortDir]);

  const toggleSort = (k: SortKey) => {
    if (k === sortKey) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(k);
      setSortDir('asc');
    }
  };

  const SortBtn = ({ label, k }: { label: string; k: SortKey }) => {
    const active = sortKey === k;
    return (
      <button onClick={() => toggleSort(k)} className="inline-flex items-center gap-1 font-medium hover:text-foreground">
        {label}
        {active ? (
          sortDir === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />
        ) : (
          <ChevronsUpDown className="h-3.5 w-3.5 opacity-40" />
        )}
      </button>
    );
  };

  const allSelected = rows.length > 0 && rows.every((t) => selected.includes(t.id));
  const toggleSelect = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const applyBulkStatus = async () => {
    if (!bulkStatus) return;
    const st = bulkStatus as TaskStatus;
    const results = await Promise.all(selected.map((id) => dispatch({ type: 'TASK_MOVE', id, status: st })));
    const okCount = results.filter(Boolean).length;
    if (okCount === selected.length) {
      toast('Đã cập nhật hàng loạt', `${selected.length} nhiệm vụ → ${taskStatusLabel(st)}`);
    } else if (okCount > 0) {
      toast('Đã cập nhật hàng loạt', `Đã cập nhật ${okCount}/${selected.length} nhiệm vụ → ${taskStatusLabel(st)}`);
    }
    setSelected([]);
    setBulkStatus('');
  };

  const bulkDelete = async () => {
    const results = await Promise.all(selected.map((id) => dispatch({ type: 'TASK_DELETE', id })));
    const okCount = results.filter(Boolean).length;
    if (okCount === selected.length) {
      toast('Đã xóa', `${selected.length} nhiệm vụ đã được xóa`);
    } else if (okCount > 0) {
      toast('Đã xóa', `Đã xóa ${okCount}/${selected.length} nhiệm vụ`);
    }
    setSelected([]);
    setConfirmDelete(false);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-44" aria-label="Lọc trạng thái">
          <option value="all">Mọi trạng thái</option>
          {TASK_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </Select>
        <Select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} className="w-44" aria-label="Lọc ưu tiên">
          <option value="all">Mọi ưu tiên</option>
          {PRIORITIES.map((p) => (
            <option key={p.value} value={p.value}>{priorityLabel(p.value)}</option>
          ))}
        </Select>
      </div>

      {canManage && selected.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-2.5 shadow-soft">
          <span className="text-sm font-medium">Đã chọn {selected.length}</span>
          <Select value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value)} className="w-44" aria-label="Đổi trạng thái hàng loạt">
            <option value="">Đổi trạng thái...</option>
            {TASK_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </Select>
          <Button size="sm" disabled={!bulkStatus} onClick={applyBulkStatus}>
            <CheckCheck className="h-4 w-4" />Áp dụng
          </Button>
          <Button size="sm" variant="destructive" onClick={() => setConfirmDelete(true)}>
            <Trash2 className="h-4 w-4" />Xóa
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected([])}>Bỏ chọn</Button>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full min-w-[940px] text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-left text-muted-foreground">
              {canManage && (
                <th className="w-10 p-3">
                  <Checkbox checked={allSelected} onChange={() => setSelected(allSelected ? [] : rows.map((t) => t.id))} />
                </th>
              )}
              <th className="p-3"><SortBtn label="Nhiệm vụ" k="title" /></th>
              <th className="p-3">Dự án</th>
              <th className="p-3">Người thực hiện</th>
              <th className="p-3"><SortBtn label="Ưu tiên" k="priority" /></th>
              <th className="p-3"><SortBtn label="Trạng thái" k="status" /></th>
              <th className="p-3"><SortBtn label="Hạn" k="dueDate" /></th>
              <th className="p-3">Checklist</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => {
              const due = dueLabel(t.dueDate, t.status);
              const project = projectById(state.projects, t.projectId);
              const items = state.checklists.filter((c) => c.taskId === t.id);
              const doneItems = items.filter((c) => c.done).length;
              const assignees = t.assigneeIds
                .map((id) => userById(state.users, id))
                .filter((u): u is User => Boolean(u));
              return (
                <tr key={t.id} onClick={() => onOpenTask(t.id)} className="cursor-pointer border-b last:border-0 hover:bg-accent/50">
                  {canManage && (
                    <td className="p-3" onClick={(e) => e.stopPropagation()}>
                      <Checkbox checked={selected.includes(t.id)} onChange={() => toggleSelect(t.id)} />
                    </td>
                  )}
                  <td className="p-3">
                    <p className="font-medium">{t.title}</p>
                    <p className="font-mono text-xs text-muted-foreground">{t.code}</p>
                  </td>
                  <td className="p-3 text-muted-foreground">{project?.name ?? '—'}</td>
                  <td className="p-3">
                    {assignees.length > 0 ? <AvatarStack users={assignees} size="xs" /> : <span className="text-xs text-muted-foreground">—</span>}
                  </td>
                  <td className="p-3"><PriorityBadge priority={t.priority} /></td>
                  <td className="p-3"><TaskStatusBadge status={t.status} /></td>
                  <td className={cn('whitespace-nowrap p-3', dueToneClass[due.tone])}>{due.text}</td>
                  <td className="p-3 text-muted-foreground">{items.length > 0 ? `${doneItems}/${items.length}` : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && (
          <div className="p-6">
            <EmptyState
              icon={<Inbox className="h-6 w-6" />}
              title="Không tìm thấy nhiệm vụ"
              desc="Thử điều chỉnh từ khóa tìm kiếm hoặc bộ lọc."
            />
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Xóa nhiệm vụ"
        desc={`Bạn chắc chắn muốn xóa ${selected.length} nhiệm vụ đã chọn? Hành động này không thể hoàn tác.`}
        onConfirm={bulkDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}

/* ---------------- ProjectTaskBoard ---------------- */

/**
 * Bảng nhiệm vụ của MỘT dự án (Kanban + Bảng) — dùng trong tab Nhiệm vụ
 * của chi tiết dự án. Tab Nhiệm vụ chính ngoài sidebar đã bỏ.
 */
export function ProjectTaskBoard({ projectId }: { projectId: string }) {
  const { state, dispatch } = useApp();
  const { openTask } = useUI();
  const me = useCurrentUser();
  const [view, setView] = useState<'kanban' | 'table'>('kanban');
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  // Task đang được kéo — dùng để hiển thị bản xem trước trong DragOverlay.
  const [activeId, setActiveId] = useState<string | null>(null);
  const activeTask = activeId ? state.tasks.find((t) => t.id === activeId) : undefined;

  const project = projectById(state.projects, projectId);
  // Chỉ Leader của dự án + Admin được tạo nhiệm vụ; thành viên chỉ xem
  // (ngoại trừ đổi trạng thái nhiệm vụ được giao cho mình).
  const canManage = !!project && canManageTaskForProject(project, me);

  const tasks = useMemo(() => {
    let list = state.tasks.filter((t) => t.projectId === projectId);
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((t) => t.title.toLowerCase().includes(q) || t.code.toLowerCase().includes(q));
    return list;
  }, [state.tasks, projectId, search]);

  const handleDragStart = (e: DragStartEvent) => {
    setActiveId(String(e.active.id));
  };

  const handleDragCancel = () => {
    setActiveId(null);
  };

  const handleDragEnd = async (e: DragEndEvent) => {
    setActiveId(null);
    const id = String(e.active.id);
    const overStatus = e.over ? String(e.over.id) : null;
    const task = state.tasks.find((t) => t.id === id);
    if (!task || !overStatus || task.status === overStatus) return;
    // Thành viên chỉ được kéo-thả nhiệm vụ được giao cho mình.
    if (!canManage && !task.assigneeIds.includes(me.id)) {
      toast('Không thể di chuyển nhiệm vụ', 'Chỉ Chủ dự án hoặc Admin mới được đổi trạng thái nhiệm vụ của người khác.', 'info');
      return;
    }
    // dispatch là async, trả false khi guard chặn (đồng thời tự hiện toast lỗi)
    // nên chỉ hiện toast thành công khi đổi trạng thái thật sự thành công.
    const ok = await dispatch({ type: 'TASK_MOVE', id, status: overStatus as TaskStatus });
    if (ok) toast('Đã chuyển trạng thái', `${task.code} → ${taskStatusLabel(overStatus as TaskStatus)}`);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo tiêu đề hoặc mã..."
            className="w-64 pl-9"
            aria-label="Tìm kiếm nhiệm vụ"
          />
        </div>
        {canManage && (
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4" />Tạo nhiệm vụ
          </Button>
        )}
        <Tabs
          value={view}
          onChange={setView}
          className="ml-auto"
          tabs={[
            { value: 'kanban', label: 'Kanban', icon: <SquareKanban className="h-4 w-4" /> },
            { value: 'table', label: 'Bảng', icon: <TableIcon className="h-4 w-4" /> },
          ]}
        />
      </div>

      {view === 'kanban' ? (
        tasks.length === 0 ? (
          <EmptyState
            icon={<SquareKanban className="h-6 w-6" />}
            title="Chưa có nhiệm vụ"
            desc="Tạo nhiệm vụ mới hoặc điều chỉnh từ khóa tìm kiếm."
            action={
              canManage ? (
                <Button onClick={() => setFormOpen(true)}>
                  <Plus className="h-4 w-4" />Tạo nhiệm vụ
                </Button>
              ) : undefined
            }
          />
        ) : (
          <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={handleDragCancel}>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {TASK_STATUSES.map((s) => (
                <KanbanColumn
                  key={s.value}
                  status={s}
                  tasks={tasks.filter((t) => t.status === s.value)}
                  quickProjectId={canManage ? projectId : undefined}
                  onOpenTask={openTask}
                />
              ))}
            </div>
            {/* Bản xem trước của task đang kéo — render qua portal nên luôn
              nổi lên trên mọi cột, không bị cắt bởi overflow của cột. */}
            <DragOverlay>
              {activeTask ? <TaskCardPreview task={activeTask} /> : null}
            </DragOverlay>
          </DndContext>
        )
      ) : (
        <TaskTable tasks={tasks} onOpenTask={openTask} canManage={canManage} />
      )}

      <TaskForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        defaultProjectId={projectId}
      />
    </div>
  );
}

/* ---------------- MyTasksPage ---------------- */

function MyTaskRow({ task, onOpen }: { task: Task; onOpen: () => void }) {
  const { state, dispatch } = useApp();
  const project = projectById(state.projects, task.projectId);
  const due = dueLabel(task.dueDate, task.status);
  const isDone = task.status === 'done';

  return (
    <div
      onClick={onOpen}
      className="flex cursor-pointer items-center gap-3 rounded-lg border bg-card p-3 shadow-soft transition-shadow hover:shadow-lift"
    >
      <Checkbox
        checked={isDone}
        onChange={async () => {
          const ok = await dispatch({ type: 'TASK_MOVE', id: task.id, status: isDone ? 'todo' : 'done' });
          if (ok) toast(isDone ? 'Đã mở lại nhiệm vụ' : 'Hoàn thành nhiệm vụ', task.title);
        }}
      />
      <div className="min-w-0 flex-1">
        <p className={cn('truncate text-sm font-medium', isDone && 'text-muted-foreground line-through')}>{task.title}</p>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <span className="font-mono">{task.code}</span>
          <span>{project?.name ?? '—'}</span>
          <PriorityBadge priority={task.priority} />
        </p>
      </div>
      <span className={cn('shrink-0 text-xs', dueToneClass[due.tone])}>{due.text}</span>
    </div>
  );
}

export function MyTasksPage() {
  const { state } = useApp();
  const { openTask } = useUI();
  const me = useCurrentUser();

  const groups = useMemo(() => {
    // Chỉ tính nhiệm vụ trong các dự án mình được thấy (đã tham gia; Admin thấy tất cả).
    const visibleIds = new Set(visibleProjects(state.projects, me).map((p) => p.id));
    const mine = state.tasks.filter((t) => t.assigneeIds.includes(me.id) && visibleIds.has(t.projectId));
    const g: Record<'overdue' | 'today' | 'upcoming' | 'done', Task[]> = { overdue: [], today: [], upcoming: [], done: [] };
    for (const t of mine) {
      if (t.status === 'done') g.done.push(t);
      else if (isOverdue(t.dueDate, t.status)) g.overdue.push(t);
      else if (dueLabel(t.dueDate, t.status).tone === 'today') g.today.push(t);
      else g.upcoming.push(t);
    }
    const byDue = (a: Task, b: Task) => (a.dueDate ?? 'zzz').localeCompare(b.dueDate ?? 'zzz');
    (Object.keys(g) as (keyof typeof g)[]).forEach((k) => g[k].sort(byDue));
    return g;
  }, [state.tasks, state.projects, me]);

  const total = groups.overdue.length + groups.today.length + groups.upcoming.length + groups.done.length;

  const sections = [
    { key: 'overdue', title: 'Quá hạn', icon: <AlertTriangle className="h-4 w-4 text-destructive" /> },
    { key: 'today', title: 'Hôm nay', icon: <CalendarDays className="h-4 w-4 text-warning" /> },
    { key: 'upcoming', title: 'Sắp đến hạn', icon: <Clock className="h-4 w-4 text-primary" /> },
    { key: 'done', title: 'Đã hoàn thành', icon: <CheckCheck className="h-4 w-4 text-success" /> },
  ] as const;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Công việc của tôi" desc={`${total} nhiệm vụ được giao cho bạn`} />

      {total === 0 ? (
        <EmptyState
          icon={<Inbox className="h-6 w-6" />}
          title="Chưa có nhiệm vụ nào"
          desc="Các nhiệm vụ được giao cho bạn sẽ xuất hiện tại đây."
        />
      ) : (
        sections.map(
          (s) =>
            groups[s.key].length > 0 && (
              <section key={s.key}>
                <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                  {s.icon}
                  {s.title}
                  <Badge tone="muted">{groups[s.key].length}</Badge>
                </h2>
                <div className="flex flex-col gap-2">
                  {groups[s.key].map((t) => (
                    <MyTaskRow key={t.id} task={t} onOpen={() => openTask(t.id)} />
                  ))}
                </div>
              </section>
            ),
        )
      )}
    </div>
  );
}
