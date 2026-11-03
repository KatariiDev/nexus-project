import { useEffect, useMemo } from 'react';
import { AlertTriangle, CalendarDays, CheckCheck, Clock, Inbox } from 'lucide-react';
import { runAutoAcceptCheck, useApp, useCurrentUser } from '../../store/AppContext';
import { visibleProjects } from '../../lib/roles';
import { useUI } from '../../components/layout/UIContext';
import type { Task } from '../../types';
import { Badge } from '../../components/ui/badge';
import { EmptyState, PageHeader } from '../../components/ui/feedback';
import { dueLabel, isOverdue } from '../../lib/format';
import { MyTaskRow } from './MyTaskRow';

export { ProjectTaskBoard } from './ProjectTaskBoard';

export function MyTasksPage() {
  const { state, dispatch } = useApp();
  const { openTask } = useUI();
  const me = useCurrentUser();

  // Tự động nhận sau 12h — kiểm tra lại khi mở tab (phòng phiên làm việc dài
  // quá 12h mà không có thay đổi dữ liệu nào kích hoạt kiểm tra ở AppProvider).
  // Chỉ chạy lúc mount nên cố tình không đưa state.tasks vào deps.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    void runAutoAcceptCheck(state.tasks, dispatch);
  }, [dispatch]);

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
