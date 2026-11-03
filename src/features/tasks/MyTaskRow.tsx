import { useState } from 'react';
import { projectById, useApp, useCurrentUser, userById } from '../../store/AppContext';
import { canManageTaskForProject } from '../../lib/roles';
import type { Task } from '../../types';
import { Button } from '../../components/ui/button';
import { Badge, PriorityBadge, TaskStatusBadge } from '../../components/ui/badge';
import { Dialog, DialogBody, DialogFooter, DialogHeader } from '../../components/ui/dialog';
import { Textarea } from '../../components/ui/input';
import { Checkbox } from '../../components/ui/controls';
import { toast } from '../../components/ui/toast';
import { dueLabel } from '../../lib/format';
import { cn } from '../../lib/utils';
import { dueToneClass } from './helpers';

const DECLINE_REASON_SUGGESTIONS = ['Bệnh', 'Chấn thương', 'Nhiều việc — không làm hết'];

export function MyTaskRow({ task, onOpen }: { task: Task; onOpen: () => void }) {
  const { state, dispatch } = useApp();
  const me = useCurrentUser();
  const project = projectById(state.projects, task.projectId);
  const due = dueLabel(task.dueDate, task.status);
  const isDone = task.status === 'done';
  const isPendingReview = task.status === 'in_review';
  const isDeclined = Boolean(task.declinedBy);
  // Chỉ hiện nút phản hồi với task đang chờ nhận (todo). Đổi trạng thái bằng
  // cách khác (tick/kéo/drawer) cũng tính là đã phản hồi → ẩn 2 nút.
  const showResponse = task.status === 'todo';
  // Leader/Admin được hoàn thành trực tiếp; thành viên tick thì gửi chờ duyệt
  // (guard chỉ chặn chuyển ra khỏi "Chờ duyệt", nên tick thẳng sang "done"
  // trước đây đã bỏ qua bước duyệt).
  const canCompleteDirectly = !!project && canManageTaskForProject(project, me);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState('');
  const [declineError, setDeclineError] = useState('');

  const accept = async () => {
    const ok = await dispatch({ type: 'TASK_MOVE', id: task.id, status: 'in_progress' });
    if (ok) toast('Đã nhận nhiệm vụ', task.title);
  };

  const submitDecline = async () => {
    const reason = declineReason.trim();
    if (!reason) {
      setDeclineError('Nhập lý do để Leader biết và sắp xếp lại.');
      return;
    }
    const ok = await dispatch({ type: 'TASK_DECLINE', id: task.id, reason });
    if (ok) {
      setDeclineOpen(false);
      setDeclineReason('');
      setDeclineError('');
      const leader = project ? userById(state.users, project.managerId) : undefined;
      toast('Đã gửi từ chối', leader ? `Leader ${leader.name} sẽ xem xét và sắp xếp lại.` : task.title);
    }
  };

  return (
    <>
      <div
        onClick={onOpen}
        className="flex cursor-pointer items-center gap-3 rounded-lg border bg-card p-3 shadow-soft transition-shadow hover:shadow-lift"
      >
        <Checkbox
          checked={isDone || isPendingReview}
          indeterminate={isPendingReview}
          disabled={isPendingReview || isDeclined}
          onChange={async () => {
            if (isPendingReview || isDeclined) return;
            if (isDone) {
              const ok = await dispatch({ type: 'TASK_MOVE', id: task.id, status: 'todo' });
              if (ok) toast('Đã mở lại nhiệm vụ', task.title);
              return;
            }
            const next = canCompleteDirectly ? 'done' : 'in_review';
            const ok = await dispatch({ type: 'TASK_MOVE', id: task.id, status: next });
            if (ok) toast(canCompleteDirectly ? 'Hoàn thành nhiệm vụ' : 'Đã gửi chờ duyệt', task.title);
          }}
        />
        <div className="min-w-0 flex-1">
          <p className={cn('truncate text-sm font-medium', isDone && 'text-muted-foreground line-through')}>{task.title}</p>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <span className="font-mono">{task.code}</span>
            <span>{project?.name ?? '—'}</span>
            <PriorityBadge priority={task.priority} />
            {isPendingReview && <TaskStatusBadge status="in_review" />}
            {isDeclined && <Badge tone="destructive">Đã từ chối</Badge>}
          </p>
          {isDeclined && task.declinedReason && (
            <p className="mt-1 truncate text-xs text-destructive">Lý do: {task.declinedReason}</p>
          )}
        </div>
        {showResponse && (
          <div className="flex shrink-0 items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
            <Button size="sm" onClick={accept}>Thực hiện</Button>
            {!isDeclined && (
              <Button size="sm" variant="outline" onClick={() => { setDeclineReason(''); setDeclineError(''); setDeclineOpen(true); }}>
                Từ chối
              </Button>
            )}
          </div>
        )}
        <span className={cn('hidden shrink-0 text-xs sm:block', dueToneClass[due.tone])}>{due.text}</span>
      </div>

      <Dialog open={declineOpen} onClose={() => setDeclineOpen(false)}>
        <DialogHeader title="Từ chối nhận nhiệm vụ" desc={`"${task.title}" — Leader sẽ nhận được thông báo để xem xét dời deadline hoặc phân bố lại cho thành viên khác.`} />
        <DialogBody>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {DECLINE_REASON_SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => { setDeclineReason(s); setDeclineError(''); }}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs',
                  declineReason === s ? 'border-primary bg-primary/10 text-primary' : 'border-input hover:bg-accent',
                )}
              >
                {s}
              </button>
            ))}
          </div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground" htmlFor={`decline-reason-${task.id}`}>
            Lý do từ chối (bắt buộc)
          </label>
          <Textarea
            id={`decline-reason-${task.id}`}
            value={declineReason}
            onChange={(e) => { setDeclineReason(e.target.value); setDeclineError(''); }}
            placeholder="VD: Đang ốm, không làm kịp tuần này..."
            rows={3}
          />
          {declineError && <p className="mt-1.5 text-xs text-destructive">{declineError}</p>}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => setDeclineOpen(false)}>Hủy</Button>
          <Button variant="destructive" onClick={submitDecline}>Gửi từ chối</Button>
        </DialogFooter>
      </Dialog>
    </>
  );
}
