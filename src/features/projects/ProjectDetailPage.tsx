import { useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  Archive, ArchiveRestore, ChevronLeft, FolderOpen, List, Pause, Pencil, Play, Trash2, UserPlus,
} from 'lucide-react';
import { projectProgress, projectTasks, useApp, useCurrentUser, userById } from '../../store/AppContext';
import {
  canAccessAdmin, canChangeProjectStatus, canInviteToProject, isProjectLeader, isProjectMember,
} from '../../lib/roles';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge, PriorityBadge, ProjectStatusBadge } from '../../components/ui/badge';
import { Avatar } from '../../components/ui/avatar';
import { Progress } from '../../components/ui/progress';
import { ProjectColorBar } from '../../components/ui/color-dot';
import { Tabs } from '../../components/ui/tabs';
import { ConfirmDialog, EmptyState } from '../../components/ui/feedback';
import { Dialog, DialogBody, DialogFooter, DialogHeader } from '../../components/ui/dialog';
import { toast } from '../../components/ui/toast';
import { fmtDate, formatCountdown, isOverdue, timeAgo } from '../../lib/format';
import { cn, newId } from '../../lib/utils';
import type { ProjectRequest } from '../../types';
import { ProjectForm } from './ProjectForm';
import { ProjectTaskBoard } from '../tasks/TasksPage';
import { ProjectDocuments } from '../documents/DocumentsPage';
import { InviteMembersDialog } from './InviteMembersDialog';
import { useNow } from '../../lib/hooks';

type DetailTab = 'overview' | 'tasks' | 'documents' | 'activity';

function fmtCoin(n?: number): string {
  if (n == null) return '—';
  return `${new Intl.NumberFormat('vi-VN').format(n)} coin`;
}

export function ProjectDetailPage() {
  const { id } = useParams();
  const location = useLocation();
  const { state, dispatch } = useApp();
  const me = useCurrentUser();
  const isAdmin = canAccessAdmin(me.role, me.isSuperAdmin);
  const navigate = useNavigate();
  const initialTab = (location.state as { tab?: DetailTab } | null)?.tab;
  const [tab, setTab] = useState<DetailTab>(
    initialTab === 'tasks' || initialTab === 'documents' || initialTab === 'activity' ? initialTab : 'overview',
  );
  const [formOpen, setFormOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [joinRequested, setJoinRequested] = useState(false);
  const [joinReview, setJoinReview] = useState<ProjectRequest | null>(null);
  const [joinBusy, setJoinBusy] = useState(false);
  const [inviteBusy, setInviteBusy] = useState(false);
  const now = useNow();

  const project = state.projects.find((p) => p.id === id);

  // Các useMemo phải đặt TRƯỚC `if (!project) return ...` (Rules of Hooks):
  // nếu dự án biến mất giữa chừng (bị xóa / sang id không tồn tại) mà số hooks
  // thay đổi giữa các lần render thì React ném lỗi "Rendered more hooks...".
  /** Đơn xin tham gia đang chờ duyệt của dự án này (người xin chưa phải thành viên). */
  const joinRequests = useMemo(
    () => {
      if (!project) return [];
      return state.projectRequests
        .filter(
          (r) =>
            r.type === 'join_project' &&
            r.projectId === project.id &&
            r.status === 'pending' &&
            !project.memberIds.includes(r.requestedBy),
        )
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    },
    [state.projectRequests, project],
  );
  /** Lời mời vào dự án này đang chờ mình chấp nhận/từ chối. */
  const myInvite = useMemo(
    () =>
      project
        ? state.projectRequests.find(
            (r) =>
              r.type === 'invite_member' &&
              r.projectId === project.id &&
              r.status === 'pending' &&
              r.payload.invitee_id === me.id,
          )
        : undefined,
    [state.projectRequests, project, me.id],
  );
  /** Lời mời vào dự án đang chờ xử lý (chỉ Leader/Admin thấy). */
  const pendingInvites = useMemo(
    () =>
      project
        ? state.projectRequests.filter(
            (r) => r.type === 'invite_member' && r.projectId === project.id && r.status === 'pending',
          )
        : [],
    [state.projectRequests, project],
  );

  if (!project) {
    return (
      <div className="flex flex-col gap-4">
        <Button variant="outline" className="w-fit" onClick={() => navigate('/user/projects')}>
          <ChevronLeft className="h-4 w-4" /> Quay lại danh sách
        </Button>
        <EmptyState
          icon={<FolderOpen className="h-6 w-6" />}
          title="Không tìm thấy dự án"
          desc="Dự án có thể đã bị xóa hoặc đường dẫn không chính xác."
        />
      </div>
    );
  }

  const tasks = projectTasks(state.tasks, project.id);
  const progress = projectProgress(state.tasks, project.id);
  const done = tasks.filter((t) => t.status === 'done').length;
  const overdue = tasks.filter((t) => isOverdue(t.dueDate, t.status)).length;
  const manager = userById(state.users, project.managerId);
  const members = project.memberIds
    .map((mid) => userById(state.users, mid))
    .filter((u): u is NonNullable<typeof u> => Boolean(u));
  const activities = state.activityLogs
    .filter((a) => a.entityType === 'project' && a.entityId === project.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  /** Mình đã gửi đơn xin vào dự án này và đang chờ duyệt (tính từ đơn đã lưu). */
  const hasPendingJoin = joinRequests.some((r) => r.requestedBy === me.id);
  const myInviteExpired = myInvite?.payload.expires_at
    ? new Date(myInvite.payload.expires_at).getTime() <= now.getTime()
    : false;
  const archived = project.status === 'archived';

  const isLeader = isProjectLeader(project, me.id);
  const isMember = isProjectMember(project, me.id) || isAdmin;
  const canChangeStatus = canChangeProjectStatus(project, me);
  const canInvite = canInviteToProject(project, me);
  const canJoin = !isAdmin && !isProjectMember(project, me.id);
  // Admin xóa trực tiếp; Chủ dự án gửi yêu cầu xóa để Admin duyệt.
  const deleteMode = (isAdmin ? 'direct' : isLeader ? 'request' : 'none') as 'direct' | 'request' | 'none';
  const docs = state.documents.filter((d) => d.projectId === project.id);

  // Người chưa tham gia chỉ xem được Tổng quan (ẩn Nhiệm vụ + Tài liệu + Hoạt động).
  const visibleTabs: { value: DetailTab; label: string }[] = [
    { value: 'overview', label: 'Tổng quan' },
    ...(isMember
      ? [
          { value: 'tasks', label: `Nhiệm vụ (${tasks.length})` },
          { value: 'documents', label: `Tài liệu (${docs.length})` },
          { value: 'activity', label: `Hoạt động (${activities.length})` },
        ] as { value: DetailTab; label: string }[]
      : []),
  ];
  const effectiveTab = visibleTabs.some((t) => t.value === tab) ? tab : 'overview';

  const toggleArchive = async () => {
    const ok = await dispatch({ type: 'PROJECT_UPDATE', project: { ...project, status: archived ? 'active' : 'archived' } });
    if (ok) toast(archived ? 'Đã kích hoạt dự án' : 'Đã lưu trữ dự án', project.name);
  };

  const handleDelete = async () => {
    if (isAdmin) {
      const ok = await dispatch({ type: 'PROJECT_DELETE', id: project.id });
      if (ok) toast('Đã xóa dự án', project.name, 'success');
    } else {
      // Chủ dự án: gửi yêu cầu để Admin phê duyệt.
      const ok = await dispatch({
        type: 'PROJECT_REQUEST_CREATE',
        request: {
          id: newId(),
          workspaceId: state.workspace.id,
          type: 'delete_project',
          projectId: project.id,
          payload: { name: project.name },
          status: 'pending',
          requestedBy: state.currentUserId,
          createdAt: new Date().toISOString(),
        },
      });
      if (ok) toast('Đã gửi yêu cầu xóa dự án', 'Admin sẽ phê duyệt trong trang Quản trị.');
    }
    setConfirmDelete(false);
    navigate('/user/projects');
  };

  /** Chỉ Chủ dự án + Admin được đổi trạng thái trực tiếp (tạm dừng/tiếp tục). */
  const togglePause = async () => {
    const paused = project.status === 'paused';
    const ok = await dispatch({
      type: 'PROJECT_UPDATE',
      project: { ...project, status: paused ? 'active' : 'paused', updatedAt: new Date().toISOString() },
    });
    if (ok) toast(paused ? 'Đã tiếp tục dự án' : 'Đã tạm dừng dự án', project.name);
  };

  const requestJoin = async () => {
    const ok = await dispatch({ type: 'PROJECT_JOIN_REQUEST', projectId: project.id });
    if (ok) {
      setJoinRequested(true);
      toast('Đã gửi yêu cầu tham gia', `Chủ dự án "${project.name}" sẽ duyệt yêu cầu của bạn.`);
    }
  };

  /** Leader duyệt / từ chối một đơn xin tham gia dự án. */
  const reviewJoin = async (approve: boolean) => {
    if (!joinReview) return;
    setJoinBusy(true);
    const req = joinReview;
    try {
      const ok = await dispatch({ type: 'PROJECT_REQUEST_REVIEW', id: req.id, approve });
      if (ok) {
        const requester = userById(state.users, req.requestedBy);
        toast(
          approve ? 'Đã cho phép tham gia dự án' : 'Đã từ chối yêu cầu tham gia',
          approve
            ? `${requester?.name ?? 'Thành viên mới'} đã được thêm vào dự án "${project.name}".`
            : `Đã từ chối ${requester?.name ?? 'người xin tham gia'} vào dự án "${project.name}".`,
        );
        setJoinReview(null);
      }
    } finally {
      setJoinBusy(false);
    }
  };

  /** Chấp nhận / từ chối lời mời vào dự án (chỉ người được mời thấy banner). */
  const reviewInvite = (approve: boolean) => {
    if (!myInvite) return;
    setInviteBusy(true);
    void dispatch({ type: 'PROJECT_REQUEST_REVIEW', id: myInvite.id, approve }).then((ok) => {
      setInviteBusy(false);
      if (!ok) return;
      toast(
        approve ? 'Đã tham gia dự án' : 'Đã từ chối lời mời',
        approve
          ? `Bạn đã trở thành thành viên của dự án "${project.name}".`
          : `Bạn đã từ chối lời mời vào dự án "${project.name}".`,
      );
    });
  };

  /** Leader/Admin hủy một lời mời đang chờ. */
  const cancelInvite = (id: string) => {
    void dispatch({ type: 'PROJECT_INVITE_CANCEL', id }).then((ok) => {
      if (ok) toast('Đã hủy lời mời', 'Lời mời đã được hủy.');
    });
  };

  const stats = [
    { label: 'Tiến độ', value: `${progress}%`, extra: <Progress value={progress} className="mt-2" /> },
    { label: 'Tổng nhiệm vụ', value: String(tasks.length) },
    { label: 'Đã hoàn thành', value: String(done) },
    { label: 'Quá hạn', value: String(overdue), danger: overdue > 0 },
  ];

  return (
    <div className="flex flex-col gap-5">
      <Button variant="ghost" className="w-fit -ml-2" onClick={() => navigate('/user/projects')}>
        <ChevronLeft className="h-4 w-4" /> Danh sách dự án
      </Button>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <ProjectColorBar color={project.color} className="mt-1 h-10 w-2" />
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <Badge tone="muted">{project.code}</Badge>
              <ProjectStatusBadge status={project.status} />
              <PriorityBadge priority={project.priority} showDot />
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canJoin ? (
            <Button size="sm" disabled={joinRequested || hasPendingJoin} onClick={requestJoin}>
              <UserPlus className="h-4 w-4" />
              {joinRequested || hasPendingJoin ? 'Đã gửi yêu cầu tham gia' : 'Xin tham gia'}
            </Button>
          ) : (
            <>
              {canInvite && (
                <Button variant="outline" size="sm" onClick={() => setInviteOpen(true)}>
                  <UserPlus className="h-4 w-4" /> Mời thành viên
                </Button>
              )}
              {canChangeStatus && (
                <Button variant="outline" size="sm" onClick={() => setFormOpen(true)}>
                  <Pencil className="h-4 w-4" /> Sửa
                </Button>
              )}
              {!archived && canChangeStatus && (
                <Button variant="outline" size="sm" onClick={togglePause}>
                  {project.status === 'paused' ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                  {project.status === 'paused' ? 'Tiếp tục' : 'Tạm dừng'}
                </Button>
              )}
              {canChangeStatus && (
                <Button variant="outline" size="sm" onClick={toggleArchive}>
                  {archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                  {archived ? 'Kích hoạt' : 'Lưu trữ'}
                </Button>
              )}
              {deleteMode !== 'none' && (
                <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => setConfirmDelete(true)}>
                  <Trash2 className="h-4 w-4" /> {isAdmin ? 'Xóa' : 'Yêu cầu xóa'}
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Banner lời mời: chỉ người được mời thấy, còn hạn mới hiện. */}
      {myInvite && !myInviteExpired && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-primary/40 bg-primary/10 px-4 py-3">
          <UserPlus className="h-5 w-5 shrink-0 text-primary" />
          <p className="min-w-0 flex-1 text-sm">
            <span className="font-medium">Bạn được mời vào dự án này</span>
            <span className="text-muted-foreground">
              {' '}bởi {userById(state.users, myInvite.requestedBy)?.name ?? 'Ai đó'}
              {myInvite.payload.expires_at ? ` · ${formatCountdown(myInvite.payload.expires_at, now)}` : ''}
            </span>
          </p>
          <div className="flex shrink-0 gap-2">
            <Button size="sm" disabled={inviteBusy} onClick={() => reviewInvite(true)}>
              Chấp nhận
            </Button>
            <Button variant="outline" size="sm" disabled={inviteBusy} onClick={() => reviewInvite(false)}>
              Từ chối
            </Button>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">{s.label}</p>
              <p className={cn('mt-1 text-2xl font-bold', s.danger && 'text-destructive')}>{s.value}</p>
              {s.extra}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Budget */}
      {project.budget != null && (
        <Card>
          <CardContent className="p-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="font-medium">Ngân sách</span>
              <span className="text-muted-foreground">
                Đã dùng <span className="font-semibold text-foreground">{fmtCoin(project.budgetUsed ?? 0)}</span> / {fmtCoin(project.budget)}
              </span>
            </div>
            <Progress value={project.budget > 0 ? ((project.budgetUsed ?? 0) / project.budget) * 100 : 0} />
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs<DetailTab>
        value={effectiveTab}
        onChange={setTab}
        tabs={visibleTabs}
      />

      {effectiveTab === 'overview' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Mô tả</CardTitle>
            </CardHeader>
            <CardContent>
              {project.description ? (
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{project.description}</p>
              ) : (
                <p className="text-sm text-muted-foreground">Chưa có mô tả cho dự án này.</p>
              )}
              <dl className="mt-5 grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-muted-foreground">Chủ dự án (Leader)</dt>
                  <dd className="mt-0.5 font-medium">{manager?.name ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Ngày bắt đầu</dt>
                  <dd className="mt-0.5 font-medium">{fmtDate(project.startDate)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Ngày kết thúc</dt>
                  <dd className="mt-0.5 font-medium">{fmtDate(project.endDate)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Ngân sách</dt>
                  <dd className="mt-0.5 font-medium">{fmtCoin(project.budget)}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Thành viên ({members.length})</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {members.length === 0 && <p className="text-sm text-muted-foreground">Chưa có thành viên.</p>}
              {members.map((m) => (
                <div key={m.id} className="flex items-center gap-3">
                  <Avatar name={m.name} avatarUrl={m.avatarUrl} size="sm" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {m.name} {m.id === project.managerId && <Badge tone="primary" className="ml-1">Leader</Badge>}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{m.title || 'Thành viên'}</p>
                  </div>
                </div>
              ))}
              {canInvite && (
                <Button variant="outline" size="sm" className="mt-1" onClick={() => setInviteOpen(true)}>
                  <UserPlus className="h-4 w-4" /> Mời thành viên
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {effectiveTab === 'tasks' && <ProjectTaskBoard projectId={project.id} />}

      {effectiveTab === 'documents' && <ProjectDocuments projectId={project.id} />}

      {effectiveTab === 'activity' && (
        <div className="flex flex-col gap-4">
          {isLeader && joinRequests.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Yêu cầu tham gia ({joinRequests.length})</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col divide-y p-0">
                {joinRequests.map((r) => {
                  const requester = userById(state.users, r.requestedBy);
                  return (
                    <button
                      key={r.id}
                      onClick={() => setJoinReview(r)}
                      className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-accent/60"
                    >
                      <Avatar name={requester?.name ?? '?'} avatarUrl={requester?.avatarUrl} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{requester?.name ?? 'Ai đó'}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {requester?.title || requester?.email || 'Thành viên'} · {timeAgo(r.createdAt)}
                        </span>
                      </span>
                      <span className="shrink-0 text-xs font-medium text-primary">Xem & duyệt</span>
                    </button>
                  );
                })}
              </CardContent>
            </Card>
          )}
          {(isLeader || isAdmin) && pendingInvites.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Lời mời đang chờ ({pendingInvites.length})</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col divide-y p-0">
                {pendingInvites.map((r) => {
                  const invitee = userById(state.users, r.payload.invitee_id ?? '');
                  const inviter = userById(state.users, r.requestedBy);
                  return (
                    <div key={r.id} className="flex items-center gap-3 p-4">
                      <Avatar name={invitee?.name ?? '?'} avatarUrl={invitee?.avatarUrl} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{invitee?.name ?? 'Ai đó'}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {inviter?.name ?? '—'} mời · {timeAgo(r.createdAt)}
                          {r.payload.expires_at ? ` · ${formatCountdown(r.payload.expires_at, now)}` : ''}
                        </span>
                      </span>
                      <Button variant="ghost" size="sm" onClick={() => cancelInvite(r.id)}>
                        Hủy
                      </Button>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}
          <Card>
            <CardContent className="flex flex-col divide-y p-0">
              {activities.length === 0 && (
                <div className="p-5">
                  <EmptyState icon={<List className="h-6 w-6" />} title="Chưa có hoạt động" desc="Mọi thay đổi trên dự án sẽ được ghi lại tại đây." />
                </div>
              )}
              {activities.map((a) => {
                const actor = userById(state.users, a.actorId);
                return (
                  <div key={a.id} className="flex items-start gap-3 p-4">
                    <Avatar name={actor?.name ?? '?'} avatarUrl={actor?.avatarUrl} size="xs" />
                    <div className="min-w-0 text-sm">
                      <p>
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
        </div>
      )}

      <ProjectForm open={formOpen} initial={project} onClose={() => setFormOpen(false)} />
      <InviteMembersDialog project={project} open={inviteOpen} onClose={() => setInviteOpen(false)} />
      <Dialog open={joinReview !== null} onClose={() => setJoinReview(null)}>
        <DialogHeader title="Yêu cầu tham gia dự án" desc={`"${project.name}"`} onClose={() => setJoinReview(null)} />
        <DialogBody className="flex flex-col gap-4">
          {joinReview &&
            (() => {
              const requester = userById(state.users, joinReview.requestedBy);
              return (
                <>
                  <div className="flex items-center gap-3">
                    <Avatar name={requester?.name ?? '?'} avatarUrl={requester?.avatarUrl} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{requester?.name ?? 'Ai đó'}</p>
                      <p className="truncate text-xs text-muted-foreground">{requester?.title || 'Thành viên'}</p>
                    </div>
                  </div>
                  <dl className="flex flex-col gap-2 text-sm">
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted-foreground">Email</dt>
                      <dd className="min-w-0 truncate font-medium">{requester?.email ?? '—'}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted-foreground">Gửi lúc</dt>
                      <dd className="font-medium">{timeAgo(joinReview.createdAt)}</dd>
                    </div>
                  </dl>
                  <p className="text-sm text-muted-foreground">
                    Cho phép thì người này được thêm vào dự án ngay. Từ chối thì đơn sẽ biến mất khỏi danh sách chờ.
                  </p>
                </>
              );
            })()}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" disabled={joinBusy} onClick={() => reviewJoin(false)}>
            Từ chối
          </Button>
          <Button disabled={joinBusy} onClick={() => reviewJoin(true)}>
            Cho phép
          </Button>
        </DialogFooter>
      </Dialog>
      <ConfirmDialog
        open={confirmDelete}
        title={isAdmin ? 'Xóa dự án?' : 'Gửi yêu cầu xóa dự án?'}
        desc={isAdmin ? `Dự án "${project.name}" sẽ bị xóa khỏi workspace. Hành động này không thể hoàn tác.` : 'Yêu cầu của bạn sẽ được gửi đến Admin để phê duyệt.'}
        confirmLabel={isAdmin ? 'Xóa dự án' : 'Gửi yêu cầu'}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
