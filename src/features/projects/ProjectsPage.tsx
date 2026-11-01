import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  Archive,
  ArchiveRestore,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  FolderOpen,
  LayoutGrid,
  List,
  Mail,
  MoreVertical,
  Pause,
  Pencil,
  Play,
  Plus,
  Search,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import { projectProgress, projectTasks, useApp, useCurrentUser, userById } from '../../store/AppContext';
import {
  canAccessAdmin,
  canChangeProjectStatus,
  canDirectProjectAction,
  canInviteToProject,
  canRequestProjects,
  isProjectLeader,
  isProjectMember,
} from '../../lib/roles';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge, PriorityBadge, ProjectStatusBadge } from '../../components/ui/badge';
import { Field, Input, Select } from '../../components/ui/input';
import { Avatar, AvatarStack } from '../../components/ui/avatar';
import { Progress } from '../../components/ui/progress';
import { Tabs } from '../../components/ui/tabs';
import { ConfirmDialog, EmptyState, PageHeader } from '../../components/ui/feedback';
import { Dialog, DialogBody, DialogFooter, DialogHeader } from '../../components/ui/dialog';
import { Dropdown, DropdownItem, DropdownSeparator } from '../../components/ui/dropdown';
import { toast } from '../../components/ui/toast';
import { dueLabel, fmtDate, isOverdue, timeAgo } from '../../lib/format';
import { getSupabase } from '../../lib/supabase';
import { PRIORITIES, PROJECT_STATUSES } from '../../types';
import type { Priority, Project, ProjectRequest, ProjectStatus, User } from '../../types';
import { ProjectForm } from './ProjectForm';
import { ProjectTaskBoard } from '../tasks/TasksPage';
import { ProjectDocuments } from '../documents/DocumentsPage';
import { cn, newId } from '../../lib/utils';

const PAGE_SIZE = 9;
const DUE_TONE_CLASS: Record<string, string> = {
  overdue: 'text-destructive',
  today: 'text-warning',
  tomorrow: 'text-primary',
  soon: 'text-primary',
  done: 'text-success',
  normal: 'text-muted-foreground',
};

function fmtCoin(n?: number): string {
  if (n == null) return '—';
  return `${new Intl.NumberFormat('vi-VN').format(n)} coin`;
}

type ScopeFilter = 'all' | 'mine' | 'not-joined';

/* ================= ProjectsPage ================= */

type SortKey = 'newest' | 'deadline' | 'progress';

export function ProjectsPage() {
  const { state, dispatch } = useApp();
  const me = useCurrentUser();
  const canDirect = canDirectProjectAction(me.role, me.isSuperAdmin);
  const canRequest = canRequestProjects(me.role);
  const canCreate = canDirect || canRequest;
  const isAdmin = canAccessAdmin(me.role, me.isSuperAdmin);
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ProjectStatus>('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | Priority>('all');
  const [managerFilter, setManagerFilter] = useState('all');
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>(() => (isAdmin ? 'all' : 'mine'));
  const [sort, setSort] = useState<SortKey>('newest');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [page, setPage] = useState(1);
  const [formState, setFormState] = useState<{ open: boolean; initial?: Project }>({ open: false });
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [joinRequested, setJoinRequested] = useState<string[]>([]);

  /** Id các dự án mình đã gửi đơn xin tham gia đang chờ duyệt (lưu trong DB, không mất khi tải lại trang). */
  const pendingJoinIds = useMemo(
    () =>
      new Set(
        state.projectRequests
          .filter((r) => r.type === 'join_project' && r.status === 'pending' && r.requestedBy === me.id)
          .map((r) => r.projectId)
          .filter((id): id is string => Boolean(id)),
      ),
    [state.projectRequests, me.id],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = state.projects.filter((p) => {
      if (q && !`${p.name} ${p.code} ${p.description}`.toLowerCase().includes(q)) return false;
      // Mặc định ẩn dự án đã lưu trữ; chọn "Lưu trữ" trong bộ lọc để xem lại.
      if (statusFilter === 'all' ? p.status === 'archived' : p.status !== statusFilter) return false;
      if (priorityFilter !== 'all' && p.priority !== priorityFilter) return false;
      if (managerFilter !== 'all' && p.managerId !== managerFilter) return false;
      const joined = isProjectMember(p, me.id);
      if (scopeFilter === 'mine' && !joined) return false;
      if (scopeFilter === 'not-joined' && joined) return false;
      return true;
    });
    const progressOf = (p: Project) => projectProgress(state.tasks, p.id);
    switch (sort) {
      case 'deadline':
        list.sort((a, b) => (a.endDate || '9999').localeCompare(b.endDate || '9999'));
        break;
      case 'progress':
        list.sort((a, b) => progressOf(b) - progressOf(a));
        break;
      default:
        list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }
    return list;
  }, [state.projects, state.tasks, query, statusFilter, priorityFilter, managerFilter, scopeFilter, sort, me.id]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const resetPage = () => setPage(1);

  const openCreate = () => setFormState({ open: true });
  const openEdit = (project: Project) => setFormState({ open: true, initial: project });

  /** Quyền thao tác trên một dự án (theo từng dự án, không theo vai trò workspace). */
  const permsFor = (p: Project) => {
    const leader = isProjectLeader(p, me.id);
    return {
      canEdit: isAdmin || leader,
      // Admin xóa trực tiếp; Leader gửi yêu cầu xóa để Admin duyệt.
      deleteMode: (isAdmin ? 'direct' : leader ? 'request' : 'none') as 'direct' | 'request' | 'none',
      canJoin: !isAdmin && !isProjectMember(p, me.id),
    };
  };

  const requestJoin = (p: Project) => {
    void dispatch({ type: 'PROJECT_JOIN_REQUEST', projectId: p.id }).then(() => {
      setJoinRequested((s) => (s.includes(p.id) ? s : [...s, p.id]));
      toast('Đã gửi yêu cầu tham gia', `Chủ dự án "${p.name}" sẽ duyệt yêu cầu của bạn.`);
    });
  };

  const handleDelete = () => {
    if (!deleteId) return;
    const target = state.projects.find((p) => p.id === deleteId);
    if (isAdmin) {
      dispatch({ type: 'PROJECT_DELETE', id: deleteId });
      toast('Đã xóa dự án', target?.name, 'success');
    } else {
      // Chủ dự án: gửi yêu cầu để Admin phê duyệt.
      dispatch({
        type: 'PROJECT_REQUEST_CREATE',
        request: {
          id: newId(),
          workspaceId: state.workspace.id,
          type: 'delete_project',
          projectId: deleteId,
          payload: { name: target?.name },
          status: 'pending',
          requestedBy: state.currentUserId,
          createdAt: new Date().toISOString(),
        },
      });
      toast('Đã gửi yêu cầu xóa dự án', 'Admin sẽ phê duyệt trong trang Quản trị.');
    }
    setDeleteId(null);
  };

  const toggleArchive = (project: Project) => {
    const archived = project.status === 'archived';
    dispatch({ type: 'PROJECT_UPDATE', project: { ...project, status: archived ? 'active' : 'archived' } });
    toast(archived ? 'Đã kích hoạt dự án' : 'Đã lưu trữ dự án', project.name);
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Dự án"
        desc={`${filtered.length} dự án · Quản lý toàn bộ dự án của workspace`}
        actions={
          canCreate ? (
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" /> Tạo dự án
            </Button>
          ) : undefined
        }
      />

      {/* Toolbar */}
      <Card>
        <CardContent className="flex flex-col gap-3 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Tìm kiếm theo tên, mã hoặc mô tả..."
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  resetPage();
                }}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select
                className="w-auto"
                value={scopeFilter}
                onChange={(e) => {
                  setScopeFilter(e.target.value as ScopeFilter);
                  resetPage();
                }}
                aria-label="Phạm vi dự án"
              >
                <option value="all">Tất cả dự án</option>
                <option value="mine">Dự án của tôi</option>
                <option value="not-joined">Chưa tham gia</option>
              </Select>
              <Select
                className="w-auto"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as 'all' | ProjectStatus);
                  resetPage();
                }}
              >
                <option value="all">Mọi trạng thái</option>
                {PROJECT_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </Select>
              <Select
                className="w-auto"
                value={priorityFilter}
                onChange={(e) => {
                  setPriorityFilter(e.target.value as 'all' | Priority);
                  resetPage();
                }}
              >
                <option value="all">Mọi ưu tiên</option>
                {PRIORITIES.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </Select>
              <Select
                className="w-auto"
                value={managerFilter}
                onChange={(e) => {
                  setManagerFilter(e.target.value);
                  resetPage();
                }}
              >
                <option value="all">Mọi Chủ dự án</option>
                {state.users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </Select>
              <Select className="w-auto" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
                <option value="newest">Mới nhất</option>
                <option value="deadline">Hạn gần nhất</option>
                <option value="progress">Tiến độ cao nhất</option>
              </Select>
              <div className="inline-flex items-center gap-1 rounded-lg bg-muted p-1">
                <button
                  aria-label="Xem dạng lưới"
                  onClick={() => setView('grid')}
                  className={cn('rounded-md p-1.5 transition-colors', view === 'grid' ? 'bg-card text-foreground shadow-soft' : 'text-muted-foreground hover:text-foreground')}
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
                <button
                  aria-label="Xem dạng danh sách"
                  onClick={() => setView('list')}
                  className={cn('rounded-md p-1.5 transition-colors', view === 'list' ? 'bg-card text-foreground shadow-soft' : 'text-muted-foreground hover:text-foreground')}
                >
                  <List className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Content */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<FolderOpen className="h-6 w-6" />}
          title="Không tìm thấy dự án"
          desc={
            scopeFilter === 'not-joined'
              ? 'Bạn đã tham gia tất cả dự án trong workspace.'
              : scopeFilter === 'mine'
                ? 'Bạn chưa tham gia dự án nào. Chuyển sang mục "Chưa tham gia" để xin tham gia.'
                : 'Thử thay đổi bộ lọc hoặc tạo một dự án mới.'
          }
          action={
            canCreate ? (
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4" /> Tạo dự án
              </Button>
            ) : undefined
          }
        />
      ) : view === 'grid' ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {pageItems.map((p) => {
            const perms = permsFor(p);
            return (
              <ProjectCard
                key={p.id}
                project={p}
                onEdit={openEdit}
                onToggleArchive={toggleArchive}
                onDelete={(id) => setDeleteId(id)}
                canEdit={perms.canEdit}
                deleteMode={perms.deleteMode}
                canJoin={perms.canJoin}
                joinRequested={pendingJoinIds.has(p.id) || joinRequested.includes(p.id)}
                onJoin={() => requestJoin(p)}
              />
            );
          })}
        </div>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Tên dự án</th>
                  <th className="px-4 py-3 font-medium">Mã</th>
                  <th className="px-4 py-3 font-medium">Trạng thái</th>
                  <th className="px-4 py-3 font-medium">Ưu tiên</th>
                  <th className="px-4 py-3 font-medium">Tiến độ</th>
                  <th className="px-4 py-3 font-medium">Chủ dự án</th>
                  <th className="px-4 py-3 font-medium">Hạn</th>
                  <th className="px-4 py-3 text-right font-medium">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((p) => {
                  const progress = projectProgress(state.tasks, p.id);
                  const manager = userById(state.users, p.managerId);
                  const due = dueLabel(p.endDate, p.status === 'completed' ? 'done' : undefined);
                  const perms = permsFor(p);
                  const joined = pendingJoinIds.has(p.id) || joinRequested.includes(p.id);
                  return (
                    <tr key={p.id} onClick={() => navigate(`/user/projects/${p.id}`)} className="cursor-pointer border-b last:border-0 hover:bg-accent/50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <span className="h-8 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: p.color }} />
                          <span className="font-medium">{p.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone="muted">{p.code}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <ProjectStatusBadge status={p.status} />
                      </td>
                      <td className="px-4 py-3">
                        <PriorityBadge priority={p.priority} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex min-w-[140px] items-center gap-2">
                          <Progress value={progress} className="flex-1" />
                          <span className="text-xs text-muted-foreground">{progress}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">{manager?.name ?? '—'}</td>
                      <td className={cn('whitespace-nowrap px-4 py-3', DUE_TONE_CLASS[due.tone])}>{due.text}</td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        {perms.canJoin ? (
                          <div className="flex items-center justify-end">
                            <Button size="sm" disabled={joined} onClick={() => requestJoin(p)}>
                              <UserPlus className="h-4 w-4" />
                              {joined ? 'Đã gửi yêu cầu' : 'Xin tham gia'}
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-1">
                            {perms.canEdit && (
                              <>
                                <Button variant="ghost" size="icon" aria-label="Chỉnh sửa" onClick={() => openEdit(p)}>
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  aria-label={p.status === 'archived' ? 'Kích hoạt' : 'Lưu trữ'}
                                  onClick={() => toggleArchive(p)}
                                >
                                  {p.status === 'archived' ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                                </Button>
                              </>
                            )}
                            {perms.deleteMode !== 'none' && (
                              <Button variant="ghost" size="icon" aria-label="Xóa" onClick={() => setDeleteId(p.id)} className="hover:text-destructive">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Pagination */}
      {filtered.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Hiển thị {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} / {filtered.length} dự án
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}>
              <ChevronLeft className="h-4 w-4" /> Trước
            </Button>
            <span className="text-sm text-muted-foreground">
              Trang {safePage} / {totalPages}
            </span>
            <Button variant="outline" size="sm" disabled={safePage >= totalPages} onClick={() => setPage(safePage + 1)}>
              Sau <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <ProjectForm open={formState.open} initial={formState.initial} onClose={() => setFormState({ open: false })} />
      <ConfirmDialog
        open={deleteId !== null}
        title={isAdmin ? 'Xóa dự án?' : 'Gửi yêu cầu xóa dự án?'}
        desc={isAdmin ? 'Dự án sẽ bị xóa khỏi workspace. Hành động này không thể hoàn tác.' : 'Yêu cầu của bạn sẽ được gửi đến Admin để phê duyệt.'}
        confirmLabel={isAdmin ? 'Xóa dự án' : 'Gửi yêu cầu'}
        onCancel={() => setDeleteId(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}

/* ---------------- ProjectCard ---------------- */

function ProjectCard({
  project,
  onEdit,
  onToggleArchive,
  onDelete,
  canEdit,
  deleteMode,
  canJoin,
  joinRequested,
  onJoin,
}: {
  project: Project;
  onEdit: (p: Project) => void;
  onToggleArchive: (p: Project) => void;
  onDelete: (id: string) => void;
  canEdit: boolean;
  deleteMode: 'direct' | 'request' | 'none';
  canJoin: boolean;
  joinRequested: boolean;
  onJoin: () => void;
}) {
  const { state } = useApp();
  const navigate = useNavigate();
  const progress = projectProgress(state.tasks, project.id);
  const manager = userById(state.users, project.managerId);
  const members = project.memberIds
    .map((id) => userById(state.users, id))
    .filter((u): u is User => Boolean(u));
  const due = dueLabel(project.endDate, project.status === 'completed' ? 'done' : undefined);
  const archived = project.status === 'archived';

  return (
    <Card
      onClick={() => navigate(`/user/projects/${project.id}`)}
      className="cursor-pointer overflow-hidden transition-shadow hover:shadow-lift"
    >
      <div className="h-1.5" style={{ backgroundColor: project.color }} />
      <CardContent className="flex flex-col gap-3 p-5 pt-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold">{project.name}</h3>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <Badge tone="muted">{project.code}</Badge>
              <ProjectStatusBadge status={project.status} />
              <PriorityBadge priority={project.priority} showDot />
            </div>
          </div>
          {(canEdit || deleteMode !== 'none') && (
            <div onClick={(e) => e.stopPropagation()}>
              <Dropdown
                align="right"
                trigger={
                  <Button variant="ghost" size="icon" aria-label="Tùy chọn dự án">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                }
              >
                {canEdit && (
                  <>
                    <DropdownItem icon={<Pencil className="h-4 w-4" />} label="Chỉnh sửa" onClick={() => onEdit(project)} />
                    <DropdownItem
                      icon={archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                      label={archived ? 'Kích hoạt' : 'Lưu trữ'}
                      desc={archived ? 'Đưa dự án hoạt động trở lại' : 'Tạm ẩn khỏi danh sách chính'}
                      onClick={() => onToggleArchive(project)}
                    />
                  </>
                )}
                {deleteMode !== 'none' && (
                  <>
                    <DropdownSeparator />
                    <DropdownItem icon={<Trash2 className="h-4 w-4" />} label={deleteMode === 'direct' ? 'Xóa dự án' : 'Yêu cầu xóa dự án'} danger onClick={() => onDelete(project.id)} />
                  </>
                )}
              </Dropdown>
            </div>
          )}
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Tiến độ</span>
            <span className="font-semibold">{progress}%</span>
          </div>
          <Progress value={progress} />
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className={cn('inline-flex items-center gap-1.5', DUE_TONE_CLASS[due.tone])}>
            <CalendarDays className="h-4 w-4" />
            {due.text}
          </span>
          <AvatarStack users={members} max={4} />
        </div>

        <div className="flex items-center gap-2 border-t pt-3 text-xs text-muted-foreground">
          <Users className="h-3.5 w-3.5" />
          <span className="truncate">
            Chủ dự án: <span className="font-medium text-foreground">{manager?.name ?? '—'}</span>
          </span>
        </div>

        {canJoin && (
          <div onClick={(e) => e.stopPropagation()} className="pt-1">
            <Button size="sm" className="w-full" disabled={joinRequested} onClick={onJoin}>
              <UserPlus className="h-4 w-4" />
              {joinRequested ? 'Đã gửi yêu cầu tham gia' : 'Xin tham gia'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ---------------- InviteMembersDialog ---------------- */

/** Mời thành viên vào dự án: thêm người đã có trong workspace, hoặc mời bằng email (chỉ Admin). */
function InviteMembersDialog({ project, open, onClose }: { project: Project; open: boolean; onClose: () => void }) {
  const { state, dispatch } = useApp();
  const me = useCurrentUser();
  const isAdmin = canAccessAdmin(me.role, me.isSuperAdmin);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelected([]);
      setEmail('');
    }
  }, [open ]);

  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase();
    return state.users.filter((u) => {
      if (project.memberIds.includes(u.id) || u.id === project.managerId) return false;
      if (!q) return true;
      return `${u.name} ${u.email} ${u.title || ''}`.toLowerCase().includes(q);
    });
  }, [state.users, project, query]);

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const addSelected = () => {
    if (selected.length === 0) return;
    setBusy(true);
    void dispatch({
      type: 'PROJECT_UPDATE',
      project: { ...project, memberIds: Array.from(new Set([...project.memberIds, ...selected])) },
    }).then(() => {
      toast('Đã thêm thành viên', `${selected.length} người đã tham gia dự án "${project.name}".`);
      setSelected([]);
      setBusy(false);
      onClose();
    });
  };

  const inviteByEmail = async () => {
    const clean = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(clean)) {
      toast('Email không hợp lệ', 'Vui lòng nhập đúng định dạng email.', 'error');
      return;
    }
    setBusy(true);
    try {
      const sb = getSupabase();
      const { data: profile } = await sb.from('profiles').select('id').ilike('email', clean).maybeSingle();
      const profileId = (profile as { id: string } | null)?.id;
      if (!profileId) {
        toast('Không tìm thấy tài khoản', `Email ${clean} chưa đăng ký tài khoản Nexus. Người này cần đăng ký trước.`, 'error');
        return;
      }
      if (profileId === me.id) {
        toast('Không thể mời chính mình', 'Bạn đã ở trong dự án này rồi.', 'error');
        return;
      }
      if (!state.users.some((u) => u.id === profileId)) {
        await dispatch({ type: 'USER_ADD', email: clean, role: 'member' });
        const { data: wm } = await sb
          .from('workspace_members')
          .select('user_id')
          .eq('workspace_id', state.workspace.id)
          .eq('user_id', profileId)
          .maybeSingle();
        if (!wm) {
          toast('Không thêm được vào workspace', 'Vui lòng thử lại.', 'error');
          return;
        }
      }
      await dispatch({
        type: 'PROJECT_UPDATE',
        project: { ...project, memberIds: Array.from(new Set([...project.memberIds, profileId])) },
      });
      toast('Đã mời thành viên', `${clean} đã tham gia dự án "${project.name}".`);
      setEmail('');
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} wide>
      <DialogHeader title="Mời thành viên" desc={`Thêm thành viên vào dự án "${project.name}".`} onClose={onClose} />
      <DialogBody className="flex flex-col gap-4">
        <Field label="Tìm thành viên trong workspace">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm theo tên, email, chức danh..."
            />
          </div>
        </Field>
        <div className="max-h-56 overflow-y-auto rounded-md border border-input p-2">
          {candidates.length === 0 && (
            <p className="px-2 py-3 text-sm text-muted-foreground">
              {query ? 'Không tìm thấy thành viên nào.' : 'Mọi thành viên trong workspace đều đã ở trong dự án.'}
            </p>
          )}
          {candidates.map((u) => (
            <label key={u.id} className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 hover:bg-accent">
              <input
                type="checkbox"
                checked={selected.includes(u.id)}
                onChange={() => toggle(u.id)}
                className="h-4 w-4 accent-primary"
              />
              <Avatar name={u.name} avatarUrl={u.avatarUrl} size="xs" />
              <span className="text-sm">
                <span className="font-medium">{u.name}</span>
                <span className="text-muted-foreground"> · {u.email}</span>
              </span>
            </label>
          ))}
        </div>
        {isAdmin && (
          <Field label="Hoặc mời người mới bằng email">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@congty.vn"
                  type="email"
                />
              </div>
              <Button variant="outline" disabled={busy} onClick={() => void inviteByEmail()}>
                Mời qua email
              </Button>
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">Người này phải đã đăng ký tài khoản Nexus trước; họ sẽ được thêm vào workspace rồi vào dự án.</p>
          </Field>
        )}
      </DialogBody>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Hủy
        </Button>
        <Button disabled={selected.length === 0 || busy} onClick={addSelected}>
          <UserPlus className="h-4 w-4" />
          Thêm {selected.length > 0 ? `${selected.length} thành viên` : 'vào dự án'}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

/* ================= ProjectDetailPage ================= */

type DetailTab = 'overview' | 'tasks' | 'documents' | 'activity';

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

  const project = state.projects.find((p) => p.id === id);

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
  /** Đơn xin tham gia đang chờ duyệt của dự án này (người xin chưa phải thành viên). */
  const joinRequests = useMemo(
    () =>
      state.projectRequests
        .filter(
          (r) =>
            r.type === 'join_project' &&
            r.projectId === project.id &&
            r.status === 'pending' &&
            !project.memberIds.includes(r.requestedBy),
        )
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [state.projectRequests, project.id, project.memberIds],
  );
  /** Mình đã gửi đơn xin vào dự án này và đang chờ duyệt (tính từ đơn đã lưu). */
  const hasPendingJoin = joinRequests.some((r) => r.requestedBy === me.id);
  const archived = project.status === 'archived';

  const isLeader = isProjectLeader(project, me.id);
  const isMember = isProjectMember(project, me.id) || isAdmin;
  const canChangeStatus = canChangeProjectStatus(project, me);
  const canInvite = canInviteToProject(project, me);
  const canJoin = !isAdmin && !isProjectMember(project, me.id);
  // Admin xóa trực tiếp; Chủ dự án gửi yêu cầu xóa để Admin duyệt.
  const deleteMode = (isAdmin ? 'direct' : isLeader ? 'request' : 'none') as 'direct' | 'request' | 'none';
  const docs = state.documents.filter((d) => d.projectId === project.id);

  // Người chưa tham gia chỉ xem được Tổng quan + Nhiệm vụ (ẩn Hoạt động + Tài liệu).
  const visibleTabs: { value: DetailTab; label: string }[] = [
    { value: 'overview', label: 'Tổng quan' },
    { value: 'tasks', label: `Nhiệm vụ (${tasks.length})` },
    ...(isMember
      ? [
          { value: 'documents', label: `Tài liệu (${docs.length})` },
          { value: 'activity', label: `Hoạt động (${activities.length})` },
        ] as { value: DetailTab; label: string }[]
      : []),
  ];
  const effectiveTab = visibleTabs.some((t) => t.value === tab) ? tab : 'overview';

  const toggleArchive = () => {
    dispatch({ type: 'PROJECT_UPDATE', project: { ...project, status: archived ? 'active' : 'archived' } });
    toast(archived ? 'Đã kích hoạt dự án' : 'Đã lưu trữ dự án', project.name);
  };

  const handleDelete = () => {
    if (isAdmin) {
      dispatch({ type: 'PROJECT_DELETE', id: project.id });
      toast('Đã xóa dự án', project.name, 'success');
    } else {
      // Chủ dự án: gửi yêu cầu để Admin phê duyệt.
      dispatch({
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
      toast('Đã gửi yêu cầu xóa dự án', 'Admin sẽ phê duyệt trong trang Quản trị.');
    }
    setConfirmDelete(false);
    navigate('/user/projects');
  };

  /** Chỉ Chủ dự án + Admin được đổi trạng thái trực tiếp (tạm dừng/tiếp tục). */
  const togglePause = () => {
    const paused = project.status === 'paused';
    dispatch({
      type: 'PROJECT_UPDATE',
      project: { ...project, status: paused ? 'active' : 'paused', updatedAt: new Date().toISOString() },
    });
    toast(paused ? 'Đã tiếp tục dự án' : 'Đã tạm dừng dự án', project.name);
  };

  const requestJoin = () => {
    void dispatch({ type: 'PROJECT_JOIN_REQUEST', projectId: project.id }).then(() => {
      setJoinRequested(true);
      toast('Đã gửi yêu cầu tham gia', `Chủ dự án "${project.name}" sẽ duyệt yêu cầu của bạn.`);
    });
  };

  /** Leader duyệt / từ chối một đơn xin tham gia dự án. */
  const reviewJoin = (approve: boolean) => {
    if (!joinReview) return;
    setJoinBusy(true);
    const req = joinReview;
    void dispatch({ type: 'PROJECT_REQUEST_REVIEW', id: req.id, approve })
      .then(() => {
        const requester = userById(state.users, req.requestedBy);
        toast(
          approve ? 'Đã cho phép tham gia dự án' : 'Đã từ chối yêu cầu tham gia',
          approve
            ? `${requester?.name ?? 'Thành viên mới'} đã được thêm vào dự án "${project.name}".`
            : `Đã từ chối ${requester?.name ?? 'người xin tham gia'} vào dự án "${project.name}".`,
        );
        setJoinReview(null);
      })
      .finally(() => setJoinBusy(false));
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
          <span className="mt-1 h-10 w-2 shrink-0 rounded-full" style={{ backgroundColor: project.color }} />
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
