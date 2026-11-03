import { Link } from 'react-router-dom';
import {
  Eye, FileText, Flag, History, Link2, ListChecks, MessageSquare, Paperclip, Send, Tag, Timer,
  Trash2, Users, X,
} from 'lucide-react';
import { taskById, userById } from '../../store/AppContext';
import type {
  ActivityLog, ChecklistItem, Label, Project, Task, TaskAttachment, TaskComment, TaskDependency, User,
} from '../../types';
import { Button } from '../../components/ui/button';
import { Input, Select, Textarea } from '../../components/ui/input';
import { Avatar } from '../../components/ui/avatar';
import { Checkbox } from '../../components/ui/controls';
import { Progress } from '../../components/ui/progress';
import { ColorDot } from '../../components/ui/color-dot';
import { fmtDate, timeAgo, dateInputToISO, isoToDateInput } from '../../lib/format';
import { cn } from '../../lib/utils';
import { Section, UserMultiSelect } from './TaskDrawerParts';

export function DrawerInfoSection({ task, project, creatorName, canEdit, projectMemberUsers, assignedUsers, watchedUsers, users, onUpdate, onToggleId }: {
  task: Task;
  project: Project | undefined;
  creatorName: string;
  canEdit: boolean;
  projectMemberUsers: User[];
  assignedUsers: User[];
  watchedUsers: User[];
  users: User[];
  onUpdate: (patch: Partial<Task>) => Promise<boolean>;
  onToggleId: (list: string[], id: string) => string[];
}) {
  return (
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
              {canEdit ? (
                <UserMultiSelect users={projectMemberUsers} selected={task.assigneeIds} onToggle={(id) => onUpdate({ assigneeIds: onToggleId(task.assigneeIds, id) })} />
              ) : (
                <div className="flex flex-col gap-1.5">
                  {assignedUsers.length === 0 ? (
                    <span className="text-sm text-muted-foreground">Chưa giao</span>
                  ) : (
                    assignedUsers.map((u) => (
                      <span key={u.id} className="flex items-center gap-2 text-sm">
                        <Avatar name={u.name} avatarUrl={u.avatarUrl} size="xs" />
                        {u.name}
                      </span>
                    ))
                  )}
                </div>
              )}
            </div>
            <div>
              <dt className="mb-1 flex items-center gap-1 text-xs text-muted-foreground"><Eye className="h-3.5 w-3.5" />Người theo dõi</dt>
              {canEdit ? (
                <UserMultiSelect users={users} selected={task.watcherIds} onToggle={(id) => onUpdate({ watcherIds: onToggleId(task.watcherIds, id) })} />
              ) : (
                <div className="flex flex-col gap-1.5">
                  {watchedUsers.length === 0 ? (
                    <span className="text-sm text-muted-foreground">—</span>
                  ) : (
                    watchedUsers.map((u) => (
                      <span key={u.id} className="flex items-center gap-2 text-sm">
                        <Avatar name={u.name} avatarUrl={u.avatarUrl} size="xs" />
                        {u.name}
                      </span>
                    ))
                  )}
                </div>
              )}
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Ngày bắt đầu</dt>
              <dd className="mt-1">
                {canEdit ? (
                  <Input type="date" value={isoToDateInput(task.startDate)} onChange={(e) => onUpdate({ startDate: dateInputToISO(e.target.value) })} />
                ) : (
                  <span className="text-sm">{fmtDate(task.startDate)}</span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Deadline</dt>
              <dd className="mt-1">
                {canEdit ? (
                  <Input type="date" value={isoToDateInput(task.dueDate)} onChange={(e) => onUpdate({ dueDate: dateInputToISO(e.target.value) })} />
                ) : (
                  <span className="text-sm">{fmtDate(task.dueDate)}</span>
                )}
              </dd>
            </div>
            <div>
              <dt className="flex items-center gap-1 text-xs text-muted-foreground"><Timer className="h-3.5 w-3.5" />Giờ thực tế</dt>
              <dd className="mt-1">
                {canEdit ? (
                  <Input type="number" min={0} step={0.5} value={task.actualHours ?? ''} onChange={(e) => onUpdate({ actualHours: e.target.value === '' ? undefined : Math.max(0, Number(e.target.value)) })} />
                ) : (
                  <span className="text-sm">{task.actualHours != null ? `${task.actualHours} giờ` : '—'}</span>
                )}
              </dd>
            </div>
          </dl>
        </Section>
  );
}

export function DrawerLabelsSection({ labels, labelIds, canEdit, onToggleLabel }: {
  labels: Label[];
  labelIds: string[];
  canEdit: boolean;
  onToggleLabel: (id: string) => void;
}) {
  return (
        <Section icon={<Tag className="h-4 w-4" />} title="Nhãn">
          <div className="flex flex-wrap gap-2">
            {labels.map((l) => {
              const active = labelIds.includes(l.id);
              // Chỉ xem: chỉ hiện nhãn đã gắn, không hiện nhãn chưa gắn.
              if (!canEdit && !active) return null;
              const chip = (
                <>
                  <ColorDot color={l.color} />
                  {l.name}
                </>
              );
              return canEdit ? (
                <button
                  key={l.id}
                  onClick={() => onToggleLabel(l.id)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                    active ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-muted-foreground hover:bg-accent',
                  )}
                >
                  {chip}
                </button>
              ) : (
                <span
                  key={l.id}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground"
                >
                  {chip}
                </span>
              );
            })}
            {!canEdit && labelIds.length === 0 && (
              <p className="text-sm text-muted-foreground">Chưa gắn nhãn.</p>
            )}
          </div>
        </Section>
  );
}

export function DrawerDescriptionSection({ description, savedDescription, canEdit, onDescriptionChange, onSave }: {
  description: string;
  savedDescription: string;
  canEdit: boolean;
  onDescriptionChange: (v: string) => void;
  onSave: () => void;
}) {
  return (
        <Section icon={<FileText className="h-4 w-4" />} title="Mô tả" action={
          canEdit ? (
            <Button size="sm" variant="outline" disabled={description === savedDescription} onClick={onSave}>Lưu</Button>
          ) : undefined
        }>
          {canEdit ? (
            <Textarea value={description} onChange={(e) => onDescriptionChange(e.target.value)} rows={4} placeholder="Thêm mô tả chi tiết..." />
          ) : (
            <p className="whitespace-pre-wrap text-sm">{savedDescription || 'Chưa có mô tả.'}</p>
          )}
        </Section>
  );
}

export function DrawerChecklistSection({ checklists, doneCount, title, onTitleChange, onAdd, onToggle, onDelete }: {
  checklists: ChecklistItem[];
  doneCount: number;
  title: string;
  onTitleChange: (v: string) => void;
  onAdd: () => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
        <Section
          icon={<ListChecks className="h-4 w-4" />}
          title="Checklist"
          action={<span className="text-xs text-muted-foreground">{doneCount}/{checklists.length}</span>}
        >
          {checklists.length > 0 && <Progress value={(doneCount / checklists.length) * 100} className="mb-3" />}
          <div className="flex flex-col gap-1">
            {checklists.map((c) => (
              <div key={c.id} className="group flex items-center gap-2 rounded-md px-1 py-1.5 hover:bg-accent/50">
                <Checkbox checked={c.done} onChange={() => onToggle(c.id)} />
                <span className={cn('flex-1 text-sm', c.done && 'text-muted-foreground line-through')}>{c.title}</span>
                <button onClick={() => onDelete(c.id)} className="rounded p-1 text-muted-foreground opacity-0 hover:bg-accent hover:text-destructive group-hover:opacity-100" aria-label="Xóa mục">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <Input value={title} onChange={(e) => onTitleChange(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && onAdd()} placeholder="Thêm mục checklist..." />
            <Button variant="outline" onClick={onAdd}>Thêm</Button>
          </div>
        </Section>
  );
}

export function DrawerDependenciesSection({ deps, tasks, canEdit, candidates, value, onAdd, onDelete }: {
  deps: TaskDependency[];
  tasks: Task[];
  canEdit: boolean;
  candidates: Task[];
  value: string;
  onAdd: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
        <Section icon={<Link2 className="h-4 w-4" />} title="Nhiệm vụ phụ thuộc">
          {deps.length === 0 ? (
            <p className="text-sm text-muted-foreground">Chưa có nhiệm vụ phụ thuộc.</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {deps.map((d) => {
                const dep = taskById(tasks, d.dependsOnId);
                return (
                  <div key={d.id} className="flex items-center justify-between gap-2 rounded-md border px-2.5 py-2">
                    <span className="truncate text-sm">
                      <span className="mr-2 font-mono text-xs text-muted-foreground">{dep?.code}</span>
                      {dep?.title ?? 'Nhiệm vụ không tồn tại'}
                    </span>
                    {canEdit && (
                      <button onClick={() => onDelete(d.id)} className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-destructive" aria-label="Gỡ phụ thuộc">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {canEdit && (
            <Select value={value} onChange={(e) => onAdd(e.target.value)} className="mt-2">
              <option value="">Thêm nhiệm vụ phụ thuộc...</option>
              {candidates.map((t) => (
                <option key={t.id} value={t.id}>{t.code} · {t.title}</option>
              ))}
            </Select>
          )}
        </Section>
  );
}

export function DrawerCommentsSection({ comments, users, meId, body, onBodyChange, onSubmit, onDeleteRequest }: {
  comments: TaskComment[];
  users: User[];
  meId: string;
  body: string;
  onBodyChange: (v: string) => void;
  onSubmit: () => void;
  onDeleteRequest: (id: string) => void;
}) {
  return (
        <Section icon={<MessageSquare className="h-4 w-4" />} title={`Bình luận (${comments.length})`}>
          <div className="flex flex-col gap-3">
            {comments.map((c) => {
              const author = userById(users, c.authorId);
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
                  {c.authorId === meId && (
                    <button onClick={() => onDeleteRequest(c.id)} className="self-start rounded p-1 text-muted-foreground opacity-0 hover:bg-accent hover:text-destructive group-hover:opacity-100" aria-label="Xóa bình luận">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
            {comments.length === 0 && <p className="text-sm text-muted-foreground">Chưa có bình luận nào.</p>}
          </div>
          <div className="mt-3 flex gap-2">
            <Input value={body} onChange={(e) => onBodyChange(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && onSubmit()} placeholder="Viết bình luận..." />
            <Button onClick={onSubmit} disabled={!body.trim()} aria-label="Gửi bình luận">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </Section>
  );
}

export function DrawerAttachmentsSection({ attachments }: { attachments: TaskAttachment[] }) {
  return (
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
  );
}

export function DrawerHistorySection({ logs, users }: { logs: ActivityLog[]; users: User[] }) {
  return (
        <Section icon={<History className="h-4 w-4" />} title="Lịch sử hoạt động">
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Chưa có hoạt động nào.</p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {logs.map((l) => {
                const actor = userById(users, l.actorId);
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
  );
}
