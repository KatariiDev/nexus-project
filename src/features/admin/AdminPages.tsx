import { useMemo, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, CheckCircle2, ClipboardList, History, LayoutDashboard,
  ShieldCheck, Users, Briefcase, XCircle, Inbox,
} from 'lucide-react';
import { useApp, useCurrentUser } from '../../store/AppContext';
import { PageHeader, EmptyState } from '../../components/ui/feedback';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input, Field, Textarea } from '../../components/ui/input';
import { Dialog, DialogHeader, DialogBody, DialogFooter } from '../../components/ui/dialog';
import { Tabs } from '../../components/ui/tabs';
import { Avatar } from '../../components/ui/avatar';
import { toast } from '../../components/ui/toast';
import { timeAgo } from '../../lib/format';
import { cn } from '../../lib/utils';
import { canAccessAdmin } from '../../lib/roles';
import type { ProjectRequest, ProjectRequestStatus } from '../../types';
import { projectRequestTypeLabel } from '../../types';

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
  const pending = state.projectRequests.filter((r) => r.status === 'pending').length;

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
                {me.username ? (me.username.startsWith('@') ? me.username : `@${me.username}`) : 'Admin'}
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

export function AdminOverviewPage() {
  const { state } = useApp();
  const navigate = useNavigate();
  const pending = state.projectRequests.filter((r) => r.status === 'pending');
  const overdue = state.tasks.filter((t) => {
    if (t.status === 'done' || !t.dueDate) return false;
    return new Date(t.dueDate) < new Date(new Date().toDateString());
  });

  const cards = [
    { label: 'Yêu cầu chờ duyệt', value: pending.length, tone: 'warning' as const, to: '/admin/approvals' },
    { label: 'Thành viên', value: state.users.length, tone: 'info' as const, to: '/admin/users' },
    { label: 'Dự án', value: state.projects.length, tone: 'primary' as const, to: '/admin/projects' },
    { label: 'Nhiệm vụ quá hạn', value: overdue.length, tone: 'destructive' as const, to: '/user/tasks' },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Tổng quan quản trị" desc="Tình hình workspace trong một cái nhìn" />
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label} className="cursor-pointer transition-shadow hover:shadow-lift" onClick={() => navigate(c.to)}>
            <CardContent className="p-5">
              <p className="text-3xl font-bold">{c.value}</p>
              <p className="mt-1 text-sm text-muted-foreground">{c.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardContent className="p-5">
          <h3 className="font-semibold">Yêu cầu mới nhất</h3>
          {pending.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">Không có yêu cầu nào đang chờ.</p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2">
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

  const pending = useMemo(
    () => state.projectRequests.filter((r) => r.status === 'pending')
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)),
    [state.projectRequests],
  );
  const done = useMemo(
    () => state.projectRequests.filter((r) => r.status !== 'pending')
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)),
    [state.projectRequests],
  );

  const approve = (r: ProjectRequest) => {
    setBusy(true);
    void dispatch({ type: 'PROJECT_REQUEST_REVIEW', id: r.id, approve: true })
      .then(() => toast('Đã duyệt yêu cầu', requestName(r, state)))
      .finally(() => setBusy(false));
  };

  const reject = () => {
    if (!rejectTarget) return;
    setBusy(true);
    void dispatch({ type: 'PROJECT_REQUEST_REVIEW', id: rejectTarget.id, approve: false, note: note.trim() || undefined })
      .then(() => {
        toast('Đã từ chối yêu cầu', requestName(rejectTarget, state));
        setRejectTarget(null);
        setNote('');
      })
      .finally(() => setBusy(false));
  };

  const renderCard = (r: ProjectRequest) => {
    const p = r.projectId ? state.projects.find((x) => x.id === r.projectId) : undefined;
    return (
      <Card key={r.id}>
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
            <div className="flex gap-2">
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
