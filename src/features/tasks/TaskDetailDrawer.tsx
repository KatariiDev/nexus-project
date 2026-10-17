import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  CalendarDays, Eye, FileText, Flag, History, Link2, ListChecks,
  MessageSquare, Paperclip, Send, Tag, Timer, Trash2, Users, X,
} from 'lucide-react';
import { projectById, taskById, useApp, useCurrentUser, userById } from '../../store/AppContext';
import type { Priority, Task, TaskStatus, User } from '../../types';
import { PRIORITIES, TASK_STATUSES } from '../../types';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input, Select, Textarea } from '../../components/ui/input';
import { Avatar } from '../../components/ui/avatar';
import { Checkbox } from '../../components/ui/controls';
import { Progress } from '../../components/ui/progress';
import { ConfirmDialog } from '../../components/ui/feedback';
import { toast } from '../../components/ui/toast';
import { dueLabel, timeAgo } from '../../lib/format';
import { cn, newId } from '../../lib/utils';
import { dateInputToISO, isoToDateInput } from './helpers';

const dueToneClass: Record<string, string> = {
  overdue: 'text-destructive',
  today: 'text-warning',
  tomorrow: 'text-sky-600 dark:text-sky-400',
  soon: 'text-muted-foreground',
  normal: 'text-muted-foreground',
  done: 'text-success',
};

export function TaskDetailDrawer({ taskId, onClose }: { taskId: string; onClose: () => void }) {
  const { state } = useApp();
  const task = taskById(state.tasks, taskId);

  useEffect(() => {
    const fn = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [onClose]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  if (!task) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] animate-fade-in" onClick={onClose} />
      <aside className="absolute right-0 top-0 flex h-full w-[520px] max-w-[95vw] flex-col border-l bg-card shadow-lift animate-slide-in-right">
        <TaskDrawerBody key={task.id} task={task} onClose={onClose} />
      </aside>
    </div>
  );
}

function Section({ icon, title, action, children }: { icon: ReactNode; title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="border-b p-4 last:border-0">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <span className="text-muted-foreground">{icon}</span>
          {title}
        </h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function UserMultiSelect({ users, selected, onToggle }: { users: User[]; selected: string[]; onToggle: (id: string) => void }) {
  return (
    <div className="flex max-h-44 flex-col gap-0.5 overflow-y-auto">
      {users.map((u) => (
        <label key={u.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent">
          <Checkbox checked={selected.includes(u.id)} onChange={() => onToggle(u.id)} />
          <Avatar name={u.name} avatarUrl={u.avatarUrl} size="xs" />
          <span className="text-sm">{u.name}</span>
          <span className="truncate text-xs text-muted-foreground">{u.title || 'Thành viên'}</span>
        </label>
      ))}
    </div>
  );
}

function TaskDrawerBody({ task, onClose }: { task: Task; onClose: () => void }) {
  const { state, dispatch } = useApp();
  const me = useCurrentUser();
  const project = projectById(state.projects, task.projectId);

  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);
  const [checklistTitle, setChecklistTitle] = useState('');
  const [commentBody, setCommentBody] = useState('');
  const [depValue, setDepValue] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [commentToDelete, setCommentToDelete] = useState<string | null>(null);

  const update = (patch: Partial<Task>) => dispatch({ type: 'TASK_UPDATE', task: { ...task, ...patch } });
  const toggleId = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  const checklists = state.checklists.filter((c) => c.taskId === task.id);
  const doneChecklists = checklists.filter((c) => c.done).length;
  const comments = state.comments
    .filter((c) => c.taskId === task.id)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const deps = state.dependencies.filter((d) => d.taskId === task.id);
  const attachments = state.attachments.filter((a) => a.taskId === task.id);
  const logs = state.activityLogs.filter((l) => l.entityId === task.id).slice(0, 20);
  const depCandidates = state.tasks.filter(
    (t) => t.projectId === task.projectId && t.id !== task.id && !deps.some((d) => d.dependsOnId === t.id),
  );
  const due = dueLabel(task.dueDate, task.status);
  const creatorName = userById(state.users, task.creatorId)?.name ?? '—';

  const saveTitle = () => {
    const t = title.trim();
    if (t && t !== task.title) {
      update({ title: t });
      toast('Đã cập nhật tiêu đề');
    } else {
      setTitle(task.title);
    }
  };

  const saveDescription = () => {
    if (description !== task.description) {
      update({ description });
      toast('Đã lưu mô tả');
    }
  };

  const addChecklist = () => {
    const v = checklistTitle.trim();
    if (!v) return;
    dispatch({ type: 'CHECKLIST_ADD', id: newId(), taskId: task.id, title: v });
    setChecklistTitle('');
  };

  const submitComment = () => {
    const body = commentBody.trim();
    if (!body) return;
    dispatch({ type: 'COMMENT_ADD', id: newId(), taskId: task.id, body });
    setCommentBody('');
    toast('Đã gửi bình luận');
  };

  const addDependency = (dependsOnId: string) => {
    if (!dependsOnId) return;
    dispatch({ type: 'DEPENDENCY_ADD', id: newId(), taskId: task.id, dependsOnId });
    const name = taskById(state.tasks, dependsOnId)?.title ?? '';
    toast('Đã thêm nhiệm vụ phụ thuộc', name);
    setDepValue('');
  };

  const deleteTask = () => {
    dispatch({ type: 'TASK_DELETE', id: task.id });
    toast('Đã xóa nhiệm vụ', task.title);
    setConfirmDelete(false);
    onClose();
  };

  return (
    <>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 border-b p-4">
        <div className="min-w-0 flex-1">
          <Badge tone="muted" className="font-mono">{task.code}</Badge>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            className="mt-2 w-full rounded-md bg-transparent px-2 py-1 text-lg font-semibold outline-none hover:bg-accent/50 focus:bg-accent/50"
            aria-label="Tiêu đề nhiệm vụ"
          />
        </div>
        <button onClick={onClose} className="rounded-md p-1.5 text-muted-foreground hover:bg-accent" aria-label="Đóng">
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Trạng thái + ưu tiên */}
      <div className="flex flex-wrap items-center gap-2 border-b p-4">
        <Select value={task.status} onChange={(e) => { update({ status: e.target.value as TaskStatus }); toast('Đã cập nhật trạng thái'); }} className="w-auto" aria-label="Trạng thái">
          {TASK_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </Select>
        <Select value={task.priority} onChange={(e) => { update({ priority: e.target.value as Priority }); toast('Đã cập nhật mức ưu tiên'); }} className="w-auto" aria-label="Ưu tiên">
          {PRIORITIES.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </Select>
        <span className={cn('ml-auto inline-flex items-center gap-1.5 text-sm', dueToneClass[due.tone])}>
          <CalendarDays className="h-4 w-4" />
          {due.text}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Thông tin */}
        <Section icon={<Flag className="h-4 w-4" />} title="Thông tin">
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted-foreground">Dự án</dt>
              <dd className="mt-1 text-sm font-medium">
                {project ? (
                  <Link to={`/projects/${project.id}`} className="text-primary hover:underline">{project.name}</Link>
                ) : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Người tạo</dt>
              <dd className="mt-1 text-sm">{creatorName}</dd>
            </div>
            <div>
              <dt className="mb-1 flex items-center gap-1 text-xs text-muted-foreground"><Users className="h-3.5 w-3.5" />Người thực hiện</dt>
              <UserMultiSelect users={state.users} selected={task.assigneeIds} onToggle={(id) => update({ assigneeIds: toggleId(task.assigneeIds, id) })} />
            </div>
            <div>
              <dt className="mb-1 flex items-center gap-1 text-xs text-muted-foreground"><Eye className="h-3.5 w-3.5" />Người theo dõi</dt>
              <UserMultiSelect users={state.users} selected={task.watcherIds} onToggle={(id) => update({ watcherIds: toggleId(task.watcherIds, id) })} />
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Ngày bắt đầu</dt>
              <dd className="mt-1">
                <Input type="date" value={isoToDateInput(task.startDate)} onChange={(e) => update({ startDate: dateInputToISO(e.target.value) })} />
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Deadline</dt>
              <dd className="mt-1">
                <Input type="date" value={isoToDateInput(task.dueDate)} onChange={(e) => update({ dueDate: dateInputToISO(e.target.value) })} />
              </dd>
            </div>
            <div>
              <dt className="flex items-center gap-1 text-xs text-muted-foreground"><Timer className="h-3.5 w-3.5" />Giờ ước tính</dt>
              <dd className="mt-1">
                <Input type="number" min={0} step={0.5} value={task.estimateHours ?? ''} onChange={(e) => update({ estimateHours: e.target.value === '' ? undefined : Math.max(0, Number(e.target.value)) })} />
              </dd>
            </div>
            <div>
              <dt className="flex items-center gap-1 text-xs text-muted-foreground"><Timer className="h-3.5 w-3.5" />Giờ thực tế</dt>
              <dd className="mt-1">
                <Input type="number" min={0} step={0.5} value={task.actualHours ?? ''} onChange={(e) => update({ actualHours: e.target.value === '' ? undefined : Math.max(0, Number(e.target.value)) })} />
              </dd>
            </div>
          </dl>
        </Section>

        {/* Nhãn */}
        <Section icon={<Tag className="h-4 w-4" />} title="Nhãn">
          <div className="flex flex-wrap gap-2">
            {state.labels.map((l) => {
              const active = task.labelIds.includes(l.id);
              return (
                <button
                  key={l.id}
                  onClick={() => update({ labelIds: toggleId(task.labelIds, l.id) })}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                    active ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-muted-foreground hover:bg-accent',
                  )}
                >
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: l.color }} />
                  {l.name}
                </button>
              );
            })}
          </div>
        </Section>

        {/* Mô tả */}
        <Section icon={<FileText className="h-4 w-4" />} title="Mô tả" action={
          <Button size="sm" variant="outline" disabled={description === task.description} onClick={saveDescription}>Lưu</Button>
        }>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} placeholder="Thêm mô tả chi tiết..." />
        </Section>

        {/* Checklist */}
        <Section
          icon={<ListChecks className="h-4 w-4" />}
          title="Checklist"
          action={<span className="text-xs text-muted-foreground">{doneChecklists}/{checklists.length}</span>}
        >
          {checklists.length > 0 && <Progress value={(doneChecklists / checklists.length) * 100} className="mb-3" />}
          <div className="flex flex-col gap-1">
            {checklists.map((c) => (
              <div key={c.id} className="group flex items-center gap-2 rounded-md px-1 py-1.5 hover:bg-accent/50">
                <Checkbox checked={c.done} onChange={() => dispatch({ type: 'CHECKLIST_TOGGLE', id: c.id })} />
                <span className={cn('flex-1 text-sm', c.done && 'text-muted-foreground line-through')}>{c.title}</span>
                <button onClick={() => dispatch({ type: 'CHECKLIST_DELETE', id: c.id })} className="rounded p-1 text-muted-foreground opacity-0 hover:bg-accent hover:text-destructive group-hover:opacity-100" aria-label="Xóa mục">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <Input value={checklistTitle} onChange={(e) => setChecklistTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addChecklist()} placeholder="Thêm mục checklist..." />
            <Button variant="outline" onClick={addChecklist}>Thêm</Button>
          </div>
        </Section>

        {/* Phụ thuộc */}
        <Section icon={<Link2 className="h-4 w-4" />} title="Nhiệm vụ phụ thuộc">
          {deps.length === 0 ? (
            <p className="text-sm text-muted-foreground">Chưa có nhiệm vụ phụ thuộc.</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {deps.map((d) => {
                const dep = taskById(state.tasks, d.dependsOnId);
                return (
                  <div key={d.id} className="flex items-center justify-between gap-2 rounded-md border px-2.5 py-2">
                    <span className="truncate text-sm">
                      <span className="mr-2 font-mono text-xs text-muted-foreground">{dep?.code}</span>
                      {dep?.title ?? 'Nhiệm vụ không tồn tại'}
                    </span>
                    <button onClick={() => dispatch({ type: 'DEPENDENCY_DELETE', id: d.id })} className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-destructive" aria-label="Gỡ phụ thuộc">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          <Select value={depValue} onChange={(e) => addDependency(e.target.value)} className="mt-2">
            <option value="">Thêm nhiệm vụ phụ thuộc...</option>
            {depCandidates.map((t) => (
              <option key={t.id} value={t.id}>{t.code} · {t.title}</option>
            ))}
          </Select>
        </Section>

        {/* Bình luận */}
        <Section icon={<MessageSquare className="h-4 w-4" />} title={`Bình luận (${comments.length})`}>
          <div className="flex flex-col gap-3">
            {comments.map((c) => {
              const author = userById(state.users, c.authorId);
              return (
                <div key={c.id} className="group flex gap-2.5">
                  <Avatar name={author?.name ?? '?'} avatarUrl={author?.avatarUrl} size="sm" />
                  <div className="min-w-0 flex-1 rounded-lg bg-muted/60 px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold">{author?.name}</span>
                      <span className="text-[11px] text-muted-foreground">{timeAgo(c.createdAt)}</span>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-sm">{c.body}</p>
                  </div>
                  {c.authorId === me.id && (
                    <button onClick={() => setCommentToDelete(c.id)} className="self-start rounded p-1 text-muted-foreground opacity-0 hover:bg-accent hover:text-destructive group-hover:opacity-100" aria-label="Xóa bình luận">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
            {comments.length === 0 && <p className="text-sm text-muted-foreground">Chưa có bình luận nào.</p>}
          </div>
          <div className="mt-3 flex gap-2">
            <Input value={commentBody} onChange={(e) => setCommentBody(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submitComment()} placeholder="Viết bình luận..." />
            <Button onClick={submitComment} disabled={!commentBody.trim()} aria-label="Gửi bình luận">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </Section>

        {/* Tệp đính kèm */}
        <Section icon={<Paperclip className="h-4 w-4" />} title={`Tệp đính kèm (${attachments.length})`}>
          {attachments.length === 0 ? (
            <p className="text-sm text-muted-foreground">Chưa có tệp đính kèm.</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {attachments.map((a) => (
                <div key={a.id} className="flex items-center gap-2.5 rounded-md border px-3 py-2">
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="flex-1 truncate text-sm">{a.name}</span>
                  <span className="text-xs text-muted-foreground">{a.size}</span>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Lịch sử */}
        <Section icon={<History className="h-4 w-4" />} title="Lịch sử hoạt động">
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Chưa có hoạt động nào.</p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {logs.map((l) => {
                const actor = userById(state.users, l.actorId);
                return (
                  <div key={l.id} className="flex items-start gap-2.5 text-sm">
                    <Avatar name={actor?.name ?? '?'} avatarUrl={actor?.avatarUrl} size="xs" className="mt-0.5" />
                    <div className="min-w-0">
                      <span className="font-medium">{actor?.name}</span>
                      <span className="text-muted-foreground"> {l.action} </span>
                      <span className="font-medium">{l.entityName}</span>
                      <p className="text-xs text-muted-foreground">{timeAgo(l.createdAt)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Section>
      </div>

      {/* Footer */}
      <div className="border-t p-4">
        <Button variant="destructive" className="w-full" onClick={() => setConfirmDelete(true)}>
          <Trash2 className="h-4 w-4" />Xóa nhiệm vụ
        </Button>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Xóa nhiệm vụ"
        desc={`Bạn chắc chắn muốn xóa nhiệm vụ "${task.title}"? Checklist, bình luận và dữ liệu liên quan cũng sẽ bị xóa. Hành động này không thể hoàn tác.`}
        confirmLabel="Xóa nhiệm vụ"
        onConfirm={deleteTask}
        onCancel={() => setConfirmDelete(false)}
      />
      <ConfirmDialog
        open={commentToDelete !== null}
        title="Xóa bình luận"
        desc="Bạn chắc chắn muốn xóa bình luận này?"
        onConfirm={() => { if (commentToDelete) dispatch({ type: 'COMMENT_DELETE', id: commentToDelete }); setCommentToDelete(null); }}
        onCancel={() => setCommentToDelete(null)}
      />
    </>
  );
}
