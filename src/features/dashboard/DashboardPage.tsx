import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  FolderKanban,
  ListTodo,
  TrendingUp,
} from 'lucide-react';
import { format, isSameDay, subDays } from 'date-fns';
import { vi } from 'date-fns/locale';
import { projectProgress, useApp, useCurrentUser, userById } from '../../store/AppContext';
import { useUI } from '../../components/layout/UIContext';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge, PriorityBadge, ProjectStatusBadge, TaskStatusBadge } from '../../components/ui/badge';
import { Avatar } from '../../components/ui/avatar';
import { Progress } from '../../components/ui/progress';
import { EmptyState } from '../../components/ui/feedback';
import { dueLabel, greeting, isOverdue, timeAgo, todayLong } from '../../lib/format';
import { TASK_STATUSES } from '../../types';
import type { ActivityLog, TaskStatus } from '../../types';
import { visibleProjects } from '../../lib/roles';
import { cn } from '../../lib/utils';

const PIE_COLORS: Record<TaskStatus, string> = {
  todo: '#94A3B8',
  in_progress: '#4F46E5',
  in_review: '#F59E0B',
  done: '#22C55E',
};

const DUE_TONE_CLASS: Record<string, string> = {
  overdue: 'text-destructive',
  today: 'text-warning',
  tomorrow: 'text-primary',
  soon: 'text-primary',
  done: 'text-success',
  normal: 'text-muted-foreground',
};

const TOOLTIP_STYLE = {
  backgroundColor: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '8px',
  fontSize: 12,
};

const AXIS_TICK = { fontSize: 11, fill: 'hsl(var(--muted-foreground))' };

export function DashboardPage() {
  const { state } = useApp();
  const user = useCurrentUser();
  const { openTask } = useUI();
  const navigate = useNavigate();

  // Member chỉ thấy số liệu của các dự án đã tham gia (Admin thấy tất cả).
  const visibleProjectsList = useMemo(() => visibleProjects(state.projects, user), [state.projects, user]);
  const visibleIds = useMemo(() => new Set(visibleProjectsList.map((p) => p.id)), [visibleProjectsList]);
  const visibleTasks = useMemo(
    () => state.tasks.filter((t) => visibleIds.has(t.projectId)),
    [state.tasks, visibleIds],
  );

  const stats = useMemo(() => {
    const activeProjects = visibleProjectsList.filter((p) => p.status === 'active').length;
    const totalTasks = visibleTasks.length;
    const doneTasks = visibleTasks.filter((t) => t.status === 'done').length;
    const overdueTasks = visibleTasks.filter((t) => isOverdue(t.dueDate, t.status)).length;
    const completionRate = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
    return { activeProjects, totalTasks, doneTasks, overdueTasks, completionRate };
  }, [visibleProjectsList, visibleTasks]);

  const completedByDay = useMemo(() => {
    const days: { label: string; count: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = subDays(new Date(), i);
      const count = visibleTasks.filter((t) => t.completedAt && isSameDay(new Date(t.completedAt), d)).length;
      days.push({ label: format(d, 'dd/MM', { locale: vi }), count });
    }
    return days;
  }, [visibleTasks]);

  const statusDistribution = useMemo(
    () =>
      TASK_STATUSES.map((s) => ({
        name: s.label,
        value: visibleTasks.filter((t) => t.status === s.value).length,
        color: PIE_COLORS[s.value],
      })),
    [visibleTasks],
  );

  const recentProjects = useMemo(
    () => [...visibleProjectsList].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 4),
    [visibleProjectsList],
  );

  const upcomingTasks = useMemo(
    () =>
      visibleTasks
        .filter((t) => t.status !== 'done' && t.dueDate)
        .sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''))
        .slice(0, 5),
    [visibleTasks],
  );

  const recentActivities = useMemo(() => {
    // Admin thấy tất cả. Member chỉ thấy hoạt động trong dự án đã tham gia:
    // dự án lọc trực tiếp; nhiệm vụ/bình luận tra projectId qua task;
    // tài liệu tra projectId của tài liệu; loại khác (thành viên...) không gắn
    // dự án nào nên ẩn với member. Không tra được thì ẩn (fail closed).
    if (user.isSuperAdmin || user.role === 'admin') {
      return [...state.activityLogs].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6);
    }
    const taskProject = new Map(state.tasks.map((t) => [t.id, t.projectId]));
    const commentTask = new Map(state.comments.map((c) => [c.id, c.taskId]));
    const docProject = new Map(state.documents.map((d) => [d.id, d.projectId]));
    const projectOf = (a: ActivityLog): string | undefined => {
      if (a.entityType === 'project') return a.entityId;
      if (a.entityType === 'task') return taskProject.get(a.entityId);
      if (a.entityType === 'comment') {
        const taskId = commentTask.get(a.entityId);
        return taskId ? taskProject.get(taskId) : undefined;
      }
      if (a.entityType === 'document') return docProject.get(a.entityId);
      return undefined;
    };
    return [...state.activityLogs]
      .filter((a) => {
        const pid = projectOf(a);
        return pid !== undefined && visibleIds.has(pid);
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 6);
  }, [state.activityLogs, state.tasks, state.comments, state.documents, visibleIds, user]);

  const topWorkload = useMemo(() => {
    // Khối lượng chỉ tính từ nhiệm vụ trong dự án mình thấy (Admin thấy tất cả):
    // 10 nhiệm vụ đang mở = 100%, giống cách tính workload ở lib/db.ts.
    // Member chỉ thấy các thành viên trong dự án mình đã tham gia.
    const isAdminLike = user.isSuperAdmin || user.role === 'admin';
    const openByUser = new Map<string, number>();
    for (const t of visibleTasks) {
      if (t.status === 'done') continue;
      for (const uid of t.assigneeIds) openByUser.set(uid, (openByUser.get(uid) ?? 0) + 1);
    }
    const memberIds = new Set<string>();
    if (!isAdminLike) {
      for (const p of visibleProjectsList) {
        memberIds.add(p.managerId);
        for (const id of p.memberIds) memberIds.add(id);
      }
    }
    return [...state.users]
      .filter((u) => u.status === 'active' && (isAdminLike || memberIds.has(u.id)))
      .map((u) => ({ ...u, workload: Math.min(100, (openByUser.get(u.id) ?? 0) * 10) }))
      .sort((a, b) => (b.workload ?? 0) - (a.workload ?? 0))
      .slice(0, 4);
  }, [state.users, visibleProjectsList, visibleTasks, user]);

  const statCards = [
    { label: 'Dự án đang hoạt động', value: stats.activeProjects, icon: <FolderKanban className="h-5 w-5" />, iconClass: 'bg-primary/10 text-primary' },
    { label: 'Tổng nhiệm vụ', value: stats.totalTasks, icon: <ListTodo className="h-5 w-5" />, iconClass: 'bg-sky-500/10 text-sky-600 dark:text-sky-400' },
    { label: 'Đã hoàn thành', value: stats.doneTasks, icon: <CheckCircle2 className="h-5 w-5" />, iconClass: 'bg-success/10 text-success' },
    { label: 'Quá hạn', value: stats.overdueTasks, icon: <AlertTriangle className="h-5 w-5" />, iconClass: 'bg-destructive/10 text-destructive' },
    { label: 'Tỷ lệ hoàn thành', value: `${stats.completionRate}%`, icon: <TrendingUp className="h-5 w-5" />, iconClass: 'bg-warning/10 text-warning' },
  ];

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{greeting(user.name)}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{todayLong()}</p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        {statCards.map((s) => (
          <Card key={s.label}>
            <CardContent className="flex items-center gap-3 p-4">
              <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', s.iconClass)}>{s.icon}</span>
              <div className="min-w-0">
                <p className="truncate text-xs text-muted-foreground">{s.label}</p>
                <p className="text-xl font-bold">{s.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Tiến độ hoàn thành</CardTitle>
            <CardDescription>Số nhiệm vụ hoàn thành trong 14 ngày qua</CardDescription>
          </CardHeader>
          <CardContent>
            {visibleTasks.length === 0 ? (
              <EmptyState icon={<TrendingUp className="h-6 w-6" />} title="Chưa có dữ liệu" desc="Biểu đồ sẽ hiển thị khi có nhiệm vụ." />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={completedByDay} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} interval={2} />
                  <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: 'hsl(var(--foreground))' }} />
                  <Area type="monotone" dataKey="count" name="Hoàn thành" stroke="hsl(var(--primary))" strokeWidth={2} fill="hsl(var(--primary))" fillOpacity={0.22} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Phân bổ trạng thái</CardTitle>
            <CardDescription>Nhiệm vụ theo từng trạng thái</CardDescription>
          </CardHeader>
          <CardContent>
            {visibleTasks.length === 0 ? (
              <EmptyState icon={<ListTodo className="h-6 w-6" />} title="Chưa có dữ liệu" desc="Biểu đồ sẽ hiển thị khi có nhiệm vụ." />
            ) : (
              <>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={statusDistribution} dataKey="value" nameKey="name" innerRadius={52} outerRadius={80} paddingAngle={3} strokeWidth={0}>
                      {statusDistribution.map((d) => (
                        <Cell key={d.name} fill={d.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-3 flex flex-col gap-2">
                  {statusDistribution.map((d) => (
                    <div key={d.name} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                        {d.name}
                      </span>
                      <span className="font-semibold">{d.value}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent projects + Upcoming */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle>Dự án gần đây</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate('/user/projects')}>
              Xem tất cả <ArrowRight className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="flex flex-col gap-1 p-2">
            {recentProjects.length === 0 && (
              <EmptyState
                icon={<FolderKanban className="h-6 w-6" />}
                title="Chưa có dự án"
                desc="Bạn chưa tham gia dự án nào. Vào trang Dự án để xem hoặc tạo dự án mới."
                action={
                  <Button variant="outline" onClick={() => navigate('/user/projects')}>
                    Đi tới trang Dự án <ArrowRight className="h-4 w-4" />
                  </Button>
                }
              />
            )}
            {recentProjects.map((p) => {
              const progress = projectProgress(state.tasks, p.id);
              return (
                <button key={p.id} onClick={() => navigate(`/user/projects/${p.id}`)} className="rounded-lg p-3 text-left transition-colors hover:bg-accent/50">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-2.5">
                      <span className="h-8 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: p.color }} />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{p.name}</span>
                        <span className="text-xs text-muted-foreground">{p.code}</span>
                      </span>
                    </span>
                    <ProjectStatusBadge status={p.status} />
                  </div>
                  <div className="mt-2.5 flex items-center gap-2">
                    <Progress value={progress} className="flex-1" />
                    <span className="text-xs font-medium text-muted-foreground">{progress}%</span>
                  </div>
                </button>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle>Sắp đến hạn</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate('/user/my-tasks')}>
              Công việc của tôi <ArrowRight className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="flex flex-col gap-1 p-2">
            {upcomingTasks.length === 0 && (
              <EmptyState icon={<CheckCircle2 className="h-6 w-6" />} title="Không có gì sắp đến hạn" desc="Tất cả nhiệm vụ đều đã hoàn thành hoặc chưa có deadline." />
            )}
            {upcomingTasks.map((t) => {
              const due = dueLabel(t.dueDate, t.status);
              const project = state.projects.find((p) => p.id === t.projectId);
              return (
                <button key={t.id} onClick={() => openTask(t.id)} className="rounded-lg p-3 text-left transition-colors hover:bg-accent/50">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{t.title}</p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {t.code} · {project?.name ?? '—'}
                      </p>
                    </div>
                    <PriorityBadge priority={t.priority} />
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <TaskStatusBadge status={t.status} />
                    <span className={cn('text-xs font-medium', DUE_TONE_CLASS[due.tone])}>{due.text}</span>
                  </div>
                </button>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* Activity + Workload */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Hoạt động gần đây</CardTitle>
            <CardDescription>Cập nhật mới nhất từ nhóm của bạn</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col divide-y p-0">
            {recentActivities.length === 0 && (
              <div className="p-4">
                <EmptyState icon={<ListTodo className="h-6 w-6" />} title="Chưa có hoạt động" desc="Mọi thay đổi sẽ được ghi lại tại đây." />
              </div>
            )}
            {recentActivities.map((a) => {
              const actor = userById(state.users, a.actorId);
              return (
                <div key={a.id} className="flex items-start gap-3 px-5 py-3">
                  <Avatar name={actor?.name ?? '?'} avatarUrl={actor?.avatarUrl} size="xs" />
                  <div className="min-w-0 text-sm">
                    <p className="truncate">
                      <span className="font-medium">{actor?.name ?? 'Ai đó'}</span>{' '}
                      <span className="text-muted-foreground">{a.action}</span>{' '}
                      <span className="font-medium">{a.entityName}</span>
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{timeAgo(a.createdAt)}</p>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Khối lượng công việc cao</CardTitle>
            <CardDescription>Thành viên đang chịu tải lớn nhất</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {topWorkload.length === 0 && (
              <EmptyState icon={<ListTodo className="h-6 w-6" />} title="Chưa có dữ liệu" desc="Chưa có thành viên nào trong dự án của bạn." />
            )}
            {topWorkload.map((u) => (
              <div key={u.id} className="flex items-center gap-3">
                <Avatar name={u.name} avatarUrl={u.avatarUrl} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate font-medium">{u.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{u.workload ?? 0}%</span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <Progress value={u.workload ?? 0} className="flex-1" />
                    <Badge tone="muted">{u.title}</Badge>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

    </div>
  );
}
