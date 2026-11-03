import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { ArrowRight } from 'lucide-react';
import { projectProgress, useApp } from '../../store/AppContext';
import { PageHeader } from '../../components/ui/feedback';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Progress } from '../../components/ui/progress';
import { ColorDot } from '../../components/ui/color-dot';
import { isOverdue } from '../../lib/format';
import { cn } from '../../lib/utils';
import type { ProjectStatus, TaskStatus } from '../../types';
import { PROJECT_STATUSES, TASK_STATUSES, projectRequestTypeLabel } from '../../types';
import { requestName } from './adminHelpers';

// Màu biểu đồ — khớp với Tổng quan bên user (DashboardPage).
const PROJECT_PIE_COLORS: Record<ProjectStatus, string> = {
  planning: '#94A3B8',
  active: '#4F46E5',
  paused: '#F59E0B',
  completed: '#22C55E',
  archived: '#64748B',
};

const TASK_PIE_COLORS: Record<TaskStatus, string> = {
  todo: '#94A3B8',
  in_progress: '#4F46E5',
  in_review: '#F59E0B',
  done: '#22C55E',
};

const CHART_TOOLTIP_STYLE = {
  backgroundColor: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '8px',
  fontSize: 12,
};

export function AdminOverviewPage() {
  const { state } = useApp();
  const navigate = useNavigate();
  const pending = state.projectRequests.filter((r) => r.status === 'pending' && r.type !== 'join_project');
  const overdue = state.tasks.filter((t) => {
    if (t.status === 'done' || !t.dueDate) return false;
    return new Date(t.dueDate) < new Date(new Date().toDateString());
  });

  const cards = [
    { label: 'Yêu cầu chờ duyệt', value: pending.length, tone: 'warning' as const, to: '/admin/approvals' },
    { label: 'Thành viên', value: state.users.length, tone: 'info' as const, to: '/admin/users' },
    { label: 'Dự án', value: state.projects.length, tone: 'primary' as const, to: '/admin/projects' },
    // Không còn trang Nhiệm vụ riêng — card này chỉ hiển thị số, không điều hướng.
    { label: 'Nhiệm vụ quá hạn', value: overdue.length, tone: 'destructive' as const, to: undefined },
  ];

  // Biểu đồ phân bổ trạng thái dự án.
  const projectStatusData = useMemo(
    () =>
      PROJECT_STATUSES.map((s) => ({
        name: s.label,
        value: state.projects.filter((p) => p.status === s.value).length,
        color: PROJECT_PIE_COLORS[s.value],
      })),
    [state.projects],
  );

  // Biểu đồ nhiệm vụ theo trạng thái.
  const taskStatusData = useMemo(
    () =>
      TASK_STATUSES.map((s) => ({
        name: s.label,
        value: state.tasks.filter((t) => t.status === s.value).length,
        color: TASK_PIE_COLORS[s.value],
      })),
    [state.tasks],
  );

  // Xếp hạng dự án theo tiến độ (top 5).
  const rankedProjects = useMemo(
    () =>
      state.projects
        .map((p) => {
          const tasks = state.tasks.filter((t) => t.projectId === p.id);
          const done = tasks.filter((t) => t.status === 'done').length;
          return {
            project: p,
            total: tasks.length,
            done,
            overdue: tasks.filter((t) => isOverdue(t.dueDate, t.status)).length,
            progress: projectProgress(state.tasks, p.id),
          };
        })
        .sort((a, b) => b.progress - a.progress || b.done - a.done)
        .slice(0, 5),
    [state.projects, state.tasks],
  );

  // Dự án cần chú ý: nhiều nhiệm vụ quá hạn nhất.
  const attentionProjects = useMemo(
    () =>
      state.projects
        .map((p) => {
          const tasks = state.tasks.filter((t) => t.projectId === p.id);
          return {
            project: p,
            total: tasks.length,
            overdue: tasks.filter((t) => isOverdue(t.dueDate, t.status)).length,
          };
        })
        .filter((x) => x.overdue > 0)
        .sort((a, b) => b.overdue - a.overdue)
        .slice(0, 5),
    [state.projects, state.tasks],
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Tổng quan quản trị" desc="Tình hình workspace trong một cái nhìn" />
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {cards.map((c) => (
          <Card
            key={c.label}
            className={c.to ? 'cursor-pointer transition-shadow hover:shadow-lift' : undefined}
            onClick={c.to ? () => navigate(c.to as string) : undefined}
          >
            <CardContent className="p-5">
              <p className="text-3xl font-bold">{c.value}</p>
              <p className="mt-1 text-sm text-muted-foreground">{c.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Biểu đồ thống kê */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Dự án theo trạng thái</CardTitle>
            <CardDescription>{state.projects.length} dự án</CardDescription>
          </CardHeader>
          <CardContent>
            {state.projects.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Chưa có dự án nào.</p>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={projectStatusData} dataKey="value" nameKey="name" innerRadius={52} outerRadius={80} paddingAngle={3} strokeWidth={0}>
                      {projectStatusData.map((d) => (
                        <Cell key={d.name} fill={d.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-3 flex flex-col gap-2">
                  {projectStatusData.map((d) => (
                    <div key={d.name} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <ColorDot color={d.color} />
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
        <Card>
          <CardHeader>
            <CardTitle>Nhiệm vụ theo trạng thái</CardTitle>
            <CardDescription>{state.tasks.length} nhiệm vụ · {overdue.length} quá hạn</CardDescription>
          </CardHeader>
          <CardContent>
            {state.tasks.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Chưa có nhiệm vụ nào.</p>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={taskStatusData} dataKey="value" nameKey="name" innerRadius={52} outerRadius={80} paddingAngle={3} strokeWidth={0}>
                      {taskStatusData.map((d) => (
                        <Cell key={d.name} fill={d.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-3 flex flex-col gap-2">
                  {taskStatusData.map((d) => (
                    <div key={d.name} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <ColorDot color={d.color} />
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

      {/* Xếp hạng dự án theo tiến độ */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <div>
            <CardTitle>Xếp hạng dự án</CardTitle>
            <CardDescription>Top 5 dự án theo tiến độ hoàn thành</CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate('/admin/projects')}>
            Xem tất cả <ArrowRight className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {rankedProjects.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-muted-foreground">Chưa có dự án nào.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="w-10 px-5 py-2.5 font-medium">#</th>
                  <th className="px-2 py-2.5 font-medium">Dự án</th>
                  <th className="w-48 px-2 py-2.5 font-medium">Tiến độ</th>
                  <th className="w-24 px-2 py-2.5 text-right font-medium">Hoàn thành</th>
                  <th className="w-20 px-5 py-2.5 text-right font-medium">Quá hạn</th>
                </tr>
              </thead>
              <tbody>
                {rankedProjects.map((r, i) => (
                  <tr
                    key={r.project.id}
                    onClick={() => navigate(`/user/projects/${r.project.id}`)}
                    className="cursor-pointer border-b last:border-0 hover:bg-accent/50"
                  >
                    <td className="px-5 py-3 font-semibold">{i + 1}</td>
                    <td className="px-2 py-3">
                      <p className="font-medium">{r.project.name}</p>
                      <p className="font-mono text-xs text-muted-foreground">{r.project.code}</p>
                    </td>
                    <td className="px-2 py-3">
                      <div className="flex items-center gap-2">
                        <Progress value={r.progress} className="flex-1" />
                        <span className="w-10 text-right font-semibold">{r.progress}%</span>
                      </div>
                    </td>
                    <td className="px-2 py-3 text-right">
                      {r.done}/{r.total}
                    </td>
                    <td className={cn('px-5 py-3 text-right font-semibold', r.overdue > 0 ? 'text-destructive' : 'text-muted-foreground')}>
                      {r.overdue}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {/* Dự án cần chú ý */}
        <Card>
          <CardHeader>
            <CardTitle>Dự án cần chú ý</CardTitle>
            <CardDescription>Nhiều nhiệm vụ quá hạn nhất</CardDescription>
          </CardHeader>
          <CardContent>
            {attentionProjects.length === 0 ? (
              <p className="text-sm text-muted-foreground">Không có dự án nào có nhiệm vụ quá hạn.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {attentionProjects.map((a) => (
                  <li key={a.project.id} className="flex items-center justify-between gap-2 rounded-lg border px-4 py-2.5 text-sm">
                    <button onClick={() => navigate(`/user/projects/${a.project.id}`)} className="min-w-0 flex-1 text-left">
                      <span className="block truncate font-medium hover:underline">{a.project.name}</span>
                      <span className="text-xs text-muted-foreground">{a.total} nhiệm vụ</span>
                    </button>
                    <Badge tone="destructive">{a.overdue} quá hạn</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Yêu cầu mới nhất</CardTitle>
            <CardDescription>Các yêu cầu đang chờ phê duyệt</CardDescription>
          </CardHeader>
          <CardContent>
            {pending.length === 0 ? (
              <p className="text-sm text-muted-foreground">Không có yêu cầu nào đang chờ.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {pending.slice(0, 5).map((r) => (
                  <li key={r.id} className="flex items-center justify-between rounded-lg border px-4 py-2.5 text-sm">
                    <span>
                      <Badge tone="warning" className="mr-2">{projectRequestTypeLabel(r.type)}</Badge>
                      {requestName(r, state)}
                    </span>
                    <Button variant="ghost" size="sm" onClick={() => navigate('/admin/approvals')}>Xem</Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
