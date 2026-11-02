import { useMemo, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import {
  ArrowLeft, ArrowRight, CheckCircle2, ClipboardList, History, LayoutDashboard,
  ShieldCheck, Users, Briefcase, XCircle, Inbox,
} from 'lucide-react';
import { projectProgress, useApp, useCurrentUser } from '../../store/AppContext';
import { PageHeader, EmptyState } from '../../components/ui/feedback';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Progress } from '../../components/ui/progress';
import { Input, Field, Textarea } from '../../components/ui/input';
import { Dialog, DialogHeader, DialogBody, DialogFooter } from '../../components/ui/dialog';
import { Tabs } from '../../components/ui/tabs';
import { Avatar } from '../../components/ui/avatar';
import { toast } from '../../components/ui/toast';
import { fmtDate, fmtDateTime, isOverdue, timeAgo } from '../../lib/format';
import { cn } from '../../lib/utils';
import { canAccessAdmin } from '../../lib/roles';
import type { ProjectRequest, ProjectRequestStatus, ProjectStatus, TaskStatus } from '../../types';
import { PROJECT_STATUSES, TASK_STATUSES, priorityLabel, projectRequestTypeLabel, projectStatusLabel } from '../../types';

const ADMIN_NAV = [
  { to: '/admin/overview', label: 'Tổng quan', icon: LayoutDashboard, end: true },
  { to: '/admin/approvals', label: 'Phê duyệt', icon: ShieldCheck },
  { to: '/admin/users', label: 'Người dùng', icon: Users },
  { to: '/admin/projects', label: 'Dự án', icon: Briefcase },
  { to: '/admin/logs', label: 'Nhật ký', icon: History },
];

/** Tên workspace từ id — dùng khi Admin tổng xem dữ liệu nhiều workspace. */
function wsName(state: ReturnType<typeof useApp>['state'], workspaceId?: string): string {
  if (!workspaceId) return '';
  return state.workspaces.find((w) => w.id === workspaceId)?.name ?? '';
}

/** Layout riêng cho khu vực /admin/* — chỉ Admin vào được (guard ở router). */
export function AdminShell() {
  const { state } = useApp();
  const me = useCurrentUser();
  const pending = state.projectRequests.filter((r) => r.status === 'pending' && r.type !== 'join_project').length;

  return (
    <div className="flex min-h-screen bg-background">
      {/* Aside trái */}
      <aside className="flex h-screen w-60 shrink-0 flex-col border-r bg-card">
        <div className="flex h-16 items-center gap-2.5 border-b px-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div className="leading-tight">
            <p className="font-bold tracking-tight">Quản trị</p>
            <p className="truncate text-xs text-muted-foreground">{state.workspace.name}</p>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto p-3">
          <ul className="flex flex-col gap-1">
            {ADMIN_NAV.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                    )
                  }
                >
                  <item.icon className="h-[18px] w-[18px] shrink-0" />
                  <span className="truncate">{item.label}</span>
                  {item.to === '/admin/approvals' && pending > 0 && (
                    <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[11px] font-semibold text-white">
                      {pending}
                    </span>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="border-t p-3">
          <div className="flex items-center gap-3 rounded-md p-2">
            <Avatar name={me.name} avatarUrl={me.avatarUrl} size="sm" />
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-sm font-semibold">{me.name}</p>
              <p className="truncate text-xs font-mono text-muted-foreground">
                {me.username}
              </p>
            </div>
          </div>
          <Button variant="outline" className="mt-2 w-full" onClick={() => (window.location.href = '/user')}>
            <ArrowLeft className="h-4 w-4" /> Về trang người dùng
          </Button>
        </div>
      </aside>
      {/* Nội dung */}
      <main className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

/* ================= Tổng quan ================= */

/* ================= Tổng quan ================= */

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

function requestName(r: ProjectRequest, state: ReturnType<typeof useApp>['state']): string {
  if (r.type === 'create_project') return String(r.payload?.name ?? 'Dự án mới');
  const p = state.projects.find((x) => x.id === r.projectId);
  return p ? p.name : '(dự án đã xóa)';
}

function userName(state: ReturnType<typeof useApp>['state'], id?: string): string {
  return state.users.find((u) => u.id === id)?.name ?? '—';
}

/* ================= Phê duyệt ================= */

const statusTone: Record<ProjectRequestStatus, 'warning' | 'success' | 'muted'> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'muted',
};

const statusLabel: Record<ProjectRequestStatus, string> = {
  pending: 'Chờ duyệt',
  approved: 'Đã duyệt',
  rejected: 'Đã từ chối',
};

export function ApprovalsPage() {
  const { state, dispatch } = useApp();
  const [tab, setTab] = useState<'pending' | 'done'>('pending');
  const [rejectTarget, setRejectTarget] = useState<ProjectRequest | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  // Yêu cầu đang xem chi tiết (bấm vào box) — xem xong mới Duyệt/Từ chối.
  const [selected, setSelected] = useState<ProjectRequest | null>(null);

  // Đơn xin tham gia dự án (`join_project`) do Leader duyệt trong tab Hoạt động,
  // không hiện ở trang Phê duyệt của Admin.
  const pending = useMemo(
    () => state.projectRequests.filter((r) => r.status === 'pending' && r.type !== 'join_project')
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)),
    [state.projectRequests],
  );
  const done = useMemo(
    () => state.projectRequests.filter((r) => r.status !== 'pending' && r.type !== 'join_project')
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)),
    [state.projectRequests],
  );

  // Dự án + nhiệm vụ của yêu cầu đang xem chi tiết (dùng cho dialog chi tiết).
  const selProject = selected?.projectId
    ? state.projects.find((x) => x.id === selected.projectId)
    : undefined;
  const selTasks = selProject ? state.tasks.filter((t) => t.projectId === selProject.id) : [];
  const selMemberNames = (selected?.payload?.memberIds ?? [])
    .map((id) => userName(state, id))
    .filter((n) => n !== '—');

  const approve = (r: ProjectRequest) => {
    setBusy(true);
    void dispatch({ type: 'PROJECT_REQUEST_REVIEW', id: r.id, approve: true })
      .then((ok) => {
        if (ok) toast('Đã duyệt yêu cầu', requestName(r, state));
      })
      .finally(() => setBusy(false));
  };

  const reject = () => {
    if (!rejectTarget) return;
    setBusy(true);
    void dispatch({ type: 'PROJECT_REQUEST_REVIEW', id: rejectTarget.id, approve: false, note: note.trim() || undefined })
      .then((ok) => {
        if (!ok) return;
        toast('Đã từ chối yêu cầu', requestName(rejectTarget, state));
        setRejectTarget(null);
        setNote('');
      })
      .finally(() => setBusy(false));
  };

  const renderCard = (r: ProjectRequest) => {
    const p = r.projectId ? state.projects.find((x) => x.id === r.projectId) : undefined;
    return (
      <Card key={r.id} className="cursor-pointer transition-shadow hover:shadow-lift" onClick={() => setSelected(r)}>
        <CardContent className="flex flex-col gap-3 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="primary">{projectRequestTypeLabel(r.type)}</Badge>
            <Badge tone={statusTone[r.status]}>{statusLabel[r.status]}</Badge>
            {wsName(state, r.workspaceId) && <Badge tone="info">{wsName(state, r.workspaceId)}</Badge>}
            <span className="ml-auto text-xs text-muted-foreground">{timeAgo(r.createdAt)}</span>
          </div>
          <p className="text-lg font-semibold">{requestName(r, state)}</p>
          {r.type === 'create_project' && r.payload?.description ? (
            <p className="text-sm text-muted-foreground">{String(r.payload.description)}</p>
          ) : null}
          {p && (
            <p className="text-sm text-muted-foreground">
              Mã dự án: <span className="font-mono">{p.code}</span>
            </p>
          )}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Avatar
              name={userName(state, r.requestedBy)}
              avatarUrl={state.users.find((u) => u.id === r.requestedBy)?.avatarUrl}
              size="sm"
            />
            <span>Người yêu cầu: <b className="text-foreground">{userName(state, r.requestedBy)}</b></span>
          </div>
          {r.status !== 'pending' && (
            <div className="rounded-lg bg-muted p-3 text-sm">
              <p>
                {r.status === 'approved' ? 'Đã duyệt' : 'Đã từ chối'} bởi{' '}
                <b>{userName(state, r.reviewedBy)}</b>
                {r.reviewedAt ? ` · ${timeAgo(r.reviewedAt)}` : ''}
              </p>
              {r.reviewNote ? <p className="mt-1 text-muted-foreground">Lý do: {r.reviewNote}</p> : null}
            </div>
          )}
          {r.status === 'pending' && (
            <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
              <Button size="sm" onClick={() => approve(r)} disabled={busy}>
                <CheckCircle2 className="h-4 w-4" /> Duyệt
              </Button>
              <Button size="sm" variant="outline" onClick={() => setRejectTarget(r)} disabled={busy}>
                <XCircle className="h-4 w-4" /> Từ chối
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Phê duyệt yêu cầu"
        desc={`${pending.length} yêu cầu đang chờ xử lý`}
      />
      <Tabs
        tabs={[
          { value: 'pending', label: `Chờ duyệt (${pending.length})`, icon: <Inbox className="h-4 w-4" /> },
          { value: 'done', label: `Đã xử lý (${done.length})`, icon: <ClipboardList className="h-4 w-4" /> },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'pending' && pending.length === 0 && (
        <EmptyState icon={<ShieldCheck className="h-6 w-6" />} title="Không có yêu cầu chờ duyệt" desc="Mọi yêu cầu đã được xử lý." />
      )}
      {tab === 'done' && done.length === 0 && (
        <EmptyState icon={<ClipboardList className="h-6 w-6" />} title="Chưa có yêu cầu nào được xử lý" />
      )}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {(tab === 'pending' ? pending : done).map(renderCard)}
      </div>

      <Dialog open={!!rejectTarget} onClose={() => setRejectTarget(null)}>
        <DialogHeader title="Từ chối yêu cầu" desc="Nhập lý do để người yêu cầu hiểu rõ (không bắt buộc)." />
        <DialogBody>
          <Field label="Lý do từ chối">
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="VD: Dự án trùng với dự án X đang chạy..." rows={3} />
          </Field>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => setRejectTarget(null)}>Hủy</Button>
          <Button variant="destructive" onClick={reject} disabled={busy}>
            {busy ? 'Đang xử lý...' : 'Xác nhận từ chối'}
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Dialog xem chi tiết yêu cầu trước khi phê duyệt */}
      <Dialog open={!!selected} onClose={() => setSelected(null)} wide>
        {selected && (
          <>
            <DialogHeader
              title={requestName(selected, state)}
              desc={`${projectRequestTypeLabel(selected.type)} · ${statusLabel[selected.status]}`}
              onClose={() => setSelected(null)}
            />
            <DialogBody>
              <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-muted-foreground">Người yêu cầu</dt>
                  <dd className="mt-1 flex items-center gap-2 text-sm font-medium">
                    <Avatar
                      name={userName(state, selected.requestedBy)}
                      avatarUrl={state.users.find((u) => u.id === selected.requestedBy)?.avatarUrl}
                      size="sm"
                    />
                    {userName(state, selected.requestedBy)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Thời gian gửi</dt>
                  <dd className="mt-1 text-sm font-medium">{fmtDateTime(selected.createdAt)}</dd>
                </div>
                {wsName(state, selected.workspaceId) && (
                  <div>
                    <dt className="text-xs text-muted-foreground">Workspace</dt>
                    <dd className="mt-1 text-sm font-medium">{wsName(state, selected.workspaceId)}</dd>
                  </div>
                )}
                {selected.type === 'create_project' && (
                  <>
                    {selected.payload.code && (
                      <div>
                        <dt className="text-xs text-muted-foreground">Mã dự án</dt>
                        <dd className="mt-1 font-mono text-sm font-medium">{selected.payload.code}</dd>
                      </div>
                    )}
                    {selected.payload.priority && (
                      <div>
                        <dt className="text-xs text-muted-foreground">Mức ưu tiên</dt>
                        <dd className="mt-1 text-sm font-medium">{priorityLabel(selected.payload.priority)}</dd>
                      </div>
                    )}
                    <div>
                      <dt className="text-xs text-muted-foreground">Ngân sách</dt>
                      <dd className="mt-1 text-sm font-medium">
                        {selected.payload.budget != null
                          ? `${Number(selected.payload.budget).toLocaleString('vi-VN')} coin`
                          : '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Ngày bắt đầu</dt>
                      <dd className="mt-1 text-sm font-medium">{fmtDate(selected.payload.startDate)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Ngày kết thúc</dt>
                      <dd className="mt-1 text-sm font-medium">{fmtDate(selected.payload.endDate)}</dd>
                    </div>
                    {selected.payload.managerId && (
                      <div>
                        <dt className="text-xs text-muted-foreground">Chủ dự án</dt>
                        <dd className="mt-1 text-sm font-medium">{userName(state, selected.payload.managerId)}</dd>
                      </div>
                    )}
                    <div className="sm:col-span-2">
                      <dt className="text-xs text-muted-foreground">Thành viên ({selMemberNames.length})</dt>
                      <dd className="mt-1 text-sm font-medium">
                        {selMemberNames.length > 0 ? selMemberNames.join(', ') : '—'}
                      </dd>
                    </div>
                    {selected.payload.description && (
                      <div className="sm:col-span-2">
                        <dt className="text-xs text-muted-foreground">Mô tả</dt>
                        <dd className="mt-1 whitespace-pre-wrap text-sm">{selected.payload.description}</dd>
                      </div>
                    )}
                  </>
                )}
                {selected.type !== 'create_project' && selProject && (
                  <>
                    <div>
                      <dt className="text-xs text-muted-foreground">Mã dự án</dt>
                      <dd className="mt-1 font-mono text-sm font-medium">{selProject.code}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Trạng thái hiện tại</dt>
                      <dd className="mt-1 text-sm font-medium">{projectStatusLabel(selProject.status)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Chủ dự án</dt>
                      <dd className="mt-1 text-sm font-medium">{userName(state, selProject.managerId)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Thành viên</dt>
                      <dd className="mt-1 text-sm font-medium">{selProject.memberIds.length} người</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Nhiệm vụ</dt>
                      <dd className="mt-1 text-sm font-medium">
                        {selTasks.length} nhiệm vụ ({selTasks.filter((t) => t.status === 'done').length} hoàn thành)
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Ngân sách</dt>
                      <dd className="mt-1 text-sm font-medium">
                        {selProject.budget != null
                          ? `${Number(selProject.budget).toLocaleString('vi-VN')} coin`
                          : '—'}
                      </dd>
                    </div>
                  </>
                )}
              </dl>
              {selected.status !== 'pending' && (
                <div className="mt-4 rounded-lg bg-muted p-3 text-sm">
                  <p>
                    {selected.status === 'approved' ? 'Đã duyệt' : 'Đã từ chối'} bởi{' '}
                    <b>{userName(state, selected.reviewedBy)}</b>
                    {selected.reviewedAt ? ` · ${timeAgo(selected.reviewedAt)}` : ''}
                  </p>
                  {selected.reviewNote ? <p className="mt-1 text-muted-foreground">Lý do: {selected.reviewNote}</p> : null}
                </div>
              )}
            </DialogBody>
            <DialogFooter>
              {selected.status === 'pending' ? (
                <>
                  <Button variant="outline" onClick={() => setSelected(null)}>Đóng</Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      const r = selected;
                      setSelected(null);
                      setRejectTarget(r);
                    }}
                  >
                    <XCircle className="h-4 w-4" /> Từ chối
                  </Button>
                  <Button
                    onClick={() => {
                      approve(selected);
                      setSelected(null);
                    }}
                    disabled={busy}
                  >
                    <CheckCircle2 className="h-4 w-4" /> Duyệt
                  </Button>
                </>
              ) : (
                <Button variant="outline" onClick={() => setSelected(null)}>Đóng</Button>
              )}
            </DialogFooter>
          </>
        )}
      </Dialog>
    </div>
  );
}

/* ================= Nhật ký hoạt động ================= */

export function AdminLogsPage() {
  const { state } = useApp();
  const [q, setQ] = useState('');
  const logs = useMemo(() => {
    const kw = q.trim().toLowerCase();
    return state.activityLogs.filter((l) => {
      if (!kw) return true;
      const actor = userName(state, l.actorId).toLowerCase();
      return (
        l.action.toLowerCase().includes(kw) ||
        (l.entityName ?? '').toLowerCase().includes(kw) ||
        actor.includes(kw)
      );
    }).slice(0, 200);
  }, [state.activityLogs, state.users, q]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Nhật ký hoạt động" desc="Toàn bộ thao tác trong workspace (200 bản ghi gần nhất)" />
      <div className="max-w-sm">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm theo người, hành động, tên..." />
      </div>
      <Card>
        <CardContent className="p-0">
          <ul className="divide-y">
            {logs.map((l) => (
              <li key={l.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                <Avatar
                  name={userName(state, l.actorId)}
                  avatarUrl={state.users.find((u) => u.id === l.actorId)?.avatarUrl}
                  size="sm"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate">
                    <b>{userName(state, l.actorId)}</b> {l.action}{' '}
                    <span className="text-muted-foreground">({l.entityType})</span>{' '}
                    <b className="truncate">{l.entityName}</b>
                  </p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(l.createdAt)}</span>
              </li>
            ))}
            {logs.length === 0 && (
              <li className="px-5 py-8 text-center text-sm text-muted-foreground">Không có bản ghi nào.</li>
            )}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

/** Guard dùng trong router: chỉ Admin được vào /admin/*. */
export function RequireAdmin({ children }: { children: React.ReactNode }) {
  const me = useCurrentUser();
  if (!canAccessAdmin(me.role, me.isSuperAdmin)) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
        <ShieldCheck className="h-12 w-12 text-muted-foreground" />
        <h1 className="text-xl font-bold">Không có quyền truy cập</h1>
        <p className="text-sm text-muted-foreground">Khu vực này chỉ dành cho Admin.</p>
        <Button onClick={() => (window.location.href = '/user')}>
          <ArrowLeft className="h-4 w-4" /> Về trang người dùng
        </Button>
      </div>
    );
  }
  return <>{children}</>;
}
