import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Archive, ArchiveRestore, ChevronLeft, ChevronRight, FolderOpen, LayoutGrid, List, Pencil, Plus,
  Search, Trash2, UserPlus,
} from 'lucide-react';
import { projectProgress, useApp, useCurrentUser, userById } from '../../store/AppContext';
import {
  canAccessAdmin, canDirectProjectAction, canRequestProjects, isProjectLeader, isProjectMember,
} from '../../lib/roles';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { Badge, PriorityBadge, ProjectStatusBadge } from '../../components/ui/badge';
import { Input, Select } from '../../components/ui/input';
import { Progress } from '../../components/ui/progress';
import { ProjectColorBar } from '../../components/ui/color-dot';
import { ConfirmDialog, EmptyState, PageHeader } from '../../components/ui/feedback';
import { toast } from '../../components/ui/toast';
import { dueLabel } from '../../lib/format';
import { PRIORITIES, PROJECT_STATUSES } from '../../types';
import type { Priority, Project, ProjectStatus } from '../../types';
import { ProjectForm } from './ProjectForm';
import { cn, newId } from '../../lib/utils';
import { ProjectCard } from './ProjectCard';
import { DUE_TONE_CLASS } from './helpers';

export { ProjectDetailPage } from './ProjectDetailPage';

const PAGE_SIZE = 9;

type ScopeFilter = 'all' | 'mine' | 'not-joined';

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

  const requestJoin = async (p: Project) => {
    const ok = await dispatch({ type: 'PROJECT_JOIN_REQUEST', projectId: p.id });
    if (ok) {
      setJoinRequested((s) => (s.includes(p.id) ? s : [...s, p.id]));
      toast('Đã gửi yêu cầu tham gia', `Chủ dự án "${p.name}" sẽ duyệt yêu cầu của bạn.`);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const target = state.projects.find((p) => p.id === deleteId);
    if (isAdmin) {
      const ok = await dispatch({ type: 'PROJECT_DELETE', id: deleteId });
      if (ok) toast('Đã xóa dự án', target?.name, 'success');
    } else {
      // Chủ dự án: gửi yêu cầu để Admin phê duyệt.
      const ok = await dispatch({
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
      if (ok) toast('Đã gửi yêu cầu xóa dự án', 'Admin sẽ phê duyệt trong trang Quản trị.');
    }
    setDeleteId(null);
  };

  const toggleArchive = async (project: Project) => {
    const archived = project.status === 'archived';
    const ok = await dispatch({ type: 'PROJECT_UPDATE', project: { ...project, status: archived ? 'active' : 'archived' } });
    if (ok) toast(archived ? 'Đã kích hoạt dự án' : 'Đã lưu trữ dự án', project.name);
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
                          <ProjectColorBar color={p.color} />
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
