import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, CheckCheck, ChevronsUpDown, Inbox, Trash2 } from 'lucide-react';
import { projectById, useApp, userById } from '../../store/AppContext';
import type { Priority, Task, TaskStatus, User } from '../../types';
import { PRIORITIES, TASK_STATUSES, priorityLabel, taskStatusLabel } from '../../types';
import { Button } from '../../components/ui/button';
import { Badge, PriorityBadge, TaskStatusBadge } from '../../components/ui/badge';
import { Select } from '../../components/ui/input';
import { Checkbox } from '../../components/ui/controls';
import { ConfirmDialog, EmptyState } from '../../components/ui/feedback';
import { AvatarStack } from '../../components/ui/avatar';
import { toast } from '../../components/ui/toast';
import { dueLabel } from '../../lib/format';
import { cn } from '../../lib/utils';
import { dueToneClass } from './helpers';

type SortKey = 'title' | 'priority' | 'dueDate' | 'status';
const priorityOrder: Record<Priority, number> = { low: 0, medium: 1, high: 2, urgent: 3 };
const statusOrder: Record<TaskStatus, number> = { todo: 0, in_progress: 1, in_review: 2, done: 3 };

export function TaskTable({ tasks, onOpenTask, canManage }: { tasks: Task[]; onOpenTask: (id: string) => void; canManage: boolean }) {
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
                    <p className="flex flex-wrap items-center gap-2 font-medium">
                      {t.title}
                      {t.declinedBy && <Badge tone="destructive">Đã từ chối</Badge>}
                    </p>
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
