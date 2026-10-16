import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Archive,
  ArchiveRestore,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  FolderOpen,
  LayoutGrid,
  List,
  MoreVertical,
  Pause,
  Pencil,
  Play,
  Plus,
  Search,
  Trash2,
  Users,
} from 'lucide-react';
import { projectProgress, projectTasks, useApp, useCurrentUser, userById } from '../../store/AppContext';
import { canDirectProjectAction, canRequestProjects } from '../../lib/roles';
import { useUI } from '../../components/layout/UIContext';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge, PriorityBadge, ProjectStatusBadge, TaskStatusBadge } from '../../components/ui/badge';
import { Input, Select } from '../../components/ui/input';
import { Avatar, AvatarStack } from '../../components/ui/avatar';
import { Progress } from '../../components/ui/progress';
import { Tabs } from '../../components/ui/tabs';
import { ConfirmDialog, EmptyState, PageHeader } from '../../components/ui/feedback';
import { Dropdown, DropdownItem, DropdownSeparator } from '../../components/ui/dropdown';
import { toast } from '../../components/ui/toast';
import { dueLabel, fmtDate, isOverdue, timeAgo } from '../../lib/format';
import { PRIORITIES, PROJECT_STATUSES } from '../../types';
import type { Priority, Project, ProjectStatus } from '../../types';
import { ProjectForm } from './ProjectForm';
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

function fmtVND(n?: number): string {
  if (n == null) return '—';
  return `${new Intl.NumberFormat('vi-VN').format(n)} ₫`;
}

/* ================= ProjectsPage ================= */

type SortKey = 'newest' | 'deadline' | 'progress';

export function ProjectsPage() {
  const { state, dispatch } = useApp();
  const me = useCurrentUser();
  const canDirect = canDirectProjectAction(me.role);
  const canRequest = canRequestProjects(me.role);
  const canCreate = canDirect || canRequest;
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ProjectStatus>('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | Priority>('all');
  const [managerFilter, setManagerFilter] = useState('all');
  const [sort, setSort] = useState<SortKey>('newest');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [page, setPage] = useState(1);
  const [formState, setFormState] = useState<{ open: boolean; initial?: Project }>({ open: false });
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = state.projects.filter((p) => {
      if (q && !`${p.name} ${p.code} ${p.description}`.toLowerCase().includes(q)) return false;
      // Mặc định ẩn dự án đã lưu trữ; chọn "Lưu trữ" trong bộ lọc để xem lại.
      if (statusFilter === 'all' ? p.status === 'archived' : p.status !== statusFilter) return false;
      if (priorityFilter !== 'all' && p.priority !== priorityFilter) return false;
      if (managerFilter !== 'all' && p.managerId !== managerFilter) return false;
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
  }, [state.projects, state.tasks, query, statusFilter, priorityFilter, managerFilter, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const resetPage = () => setPage(1);

  const openCreate = () => setFormState({ open: true });
  const openEdit = (project: Project) => setFormState({ open: true, initial: project });

  const handleDelete = () => {
    if (!deleteId) return;
    const target = state.projects.find((p) => p.id === deleteId);
    if (canDirect) {
      dispatch({ type: 'PROJECT_DELETE', id: deleteId });
      toast('Đã xóa dự án', target?.name, 'success');
    } else {
      // Owner: gửi yêu cầu để Admin phê duyệt.
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
              <Plus className="h-4 w-4" /> {canDirect ? 'Tạo dự án' : 'Yêu cầu tạo dự án'}
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
                <option value="all">Mọi quản lý</option>
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
          desc="Thử thay đổi bộ lọc hoặc tạo một dự án mới."
          action={
            canCreate ? (
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4" /> {canDirect ? 'Tạo dự án' : 'Yêu cầu tạo dự án'}
              </Button>
            ) : undefined
          }
        />
      ) : view === 'grid' ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {pageItems.map((p) => (
            <ProjectCard key={p.id} project={p} onEdit={openEdit} onToggleArchive={toggleArchive} onDelete={(id) => setDeleteId(id)} canDelete={canCreate} />
          ))}
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
                  <th className="px-4 py-3 font-medium">Quản lý</th>
                  <th className="px-4 py-3 font-medium">Hạn</th>
                  <th className="px-4 py-3 text-right font-medium">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((p) => {
                  const progress = projectProgress(state.tasks, p.id);
                  const manager = userById(state.users, p.managerId);
                  const due = dueLabel(p.endDate, p.status === 'completed' ? 'done' : undefined);
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
                        <div className="flex items-center justify-end gap-1">
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
                          <Button variant="ghost" size="icon" aria-label="Xóa" onClick={() => setDeleteId(p.id)} className="hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
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
        title={canDirect ? 'Xóa dự án?' : 'Gửi yêu cầu xóa dự án?'}
        desc={canDirect ? 'Dự án sẽ bị xóa khỏi workspace. Hành động này không thể hoàn tác.' : 'Yêu cầu của bạn sẽ được gửi đến Admin để phê duyệt.'}
        confirmLabel={canDirect ? 'Xóa dự án' : 'Gửi yêu cầu'}
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
  canDelete,
}: {
  project: Project;
  onEdit: (p: Project) => void;
  onToggleArchive: (p: Project) => void;
  onDelete: (id: string) => void;
  canDelete: boolean;
}) {
  const { state } = useApp();
  const navigate = useNavigate();
  const progress = projectProgress(state.tasks, project.id);
  const manager = userById(state.users, project.managerId);
  const memberNames = project.memberIds
    .map((id) => userById(state.users, id)?.name)
    .filter((n): n is string => Boolean(n));
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
          <div onClick={(e) => e.stopPropagation()}>
            <Dropdown
              align="right"
              trigger={
                <Button variant="ghost" size="icon" aria-label="Tùy chọn dự án">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              }
            >
              <DropdownItem icon={<Pencil className="h-4 w-4" />} label="Chỉnh sửa" onClick={() => onEdit(project)} />
              <DropdownItem
                icon={archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                label={archived ? 'Kích hoạt' : 'Lưu trữ'}
                desc={archived ? 'Đưa dự án hoạt động trở lại' : 'Tạm ẩn khỏi danh sách chính'}
                onClick={() => onToggleArchive(project)}
              />
              {canDelete && (
                <>
                  <DropdownSeparator />
                  <DropdownItem icon={<Trash2 className="h-4 w-4" />} label="Xóa dự án" danger onClick={() => onDelete(project.id)} />
                </>
              )}
            </Dropdown>
          </div>
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
          <AvatarStack names={memberNames} max={4} />
        </div>

        <div className="flex items-center gap-2 border-t pt-3 text-xs text-muted-foreground">
          <Users className="h-3.5 w-3.5" />
          <span className="truncate">
            Quản lý: <span className="font-medium text-foreground">{manager?.name ?? '—'}</span>
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

/* ================= ProjectDetailPage ================= */

type DetailTab = 'overview' | 'tasks' | 'activity';

export function ProjectDetailPage() {
  const { id } = useParams();
  const { state, dispatch } = useApp();
  const me = useCurrentUser();
  const canDirect = canDirectProjectAction(me.role);
  const canRequest = canRequestProjects(me.role);
  const canModify = canDirect || canRequest;
  const { openTask } = useUI();
  const navigate = useNavigate();
  const [tab, setTab] = useState<DetailTab>('overview');
  const [formOpen, setFormOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

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
  const archived = project.status === 'archived';

  const toggleArchive = () => {
    dispatch({ type: 'PROJECT_UPDATE', project: { ...project, status: archived ? 'active' : 'archived' } });
    toast(archived ? 'Đã kích hoạt dự án' : 'Đã lưu trữ dự án', project.name);
  };

  const handleDelete = () => {
    if (canDirect) {
      dispatch({ type: 'PROJECT_DELETE', id: project.id });
      toast('Đã xóa dự án', project.name, 'success');
    } else {
      // Owner: gửi yêu cầu để Admin phê duyệt.
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

  const togglePause = () => {
    const paused = project.status === 'paused';
    if (paused) {
      // Tiếp tục dự án: áp dụng ngay cho mọi vai trò.
      dispatch({ type: 'PROJECT_UPDATE', project: { ...project, status: 'active', updatedAt: new Date().toISOString() } });
      toast('Đã tiếp tục dự án', project.name);
    } else if (canDirect) {
      dispatch({ type: 'PROJECT_UPDATE', project: { ...project, status: 'paused', updatedAt: new Date().toISOString() } });
      toast('Đã tạm dừng dự án', project.name);
    } else {
      // Owner: gửi yêu cầu tạm dừng để Admin phê duyệt.
      dispatch({
        type: 'PROJECT_REQUEST_CREATE',
        request: {
          id: newId(),
          workspaceId: state.workspace.id,
          type: 'pause_project',
          projectId: project.id,
          payload: { name: project.name },
          status: 'pending',
          requestedBy: state.currentUserId,
          createdAt: new Date().toISOString(),
        },
      });
      toast('Đã gửi yêu cầu tạm dừng dự án', 'Admin sẽ phê duyệt trong trang Quản trị.');
    }
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
          <Button variant="outline" size="sm" onClick={() => setFormOpen(true)}>
            <Pencil className="h-4 w-4" /> Sửa
          </Button>
          {!archived && canModify && (
            <Button variant="outline" size="sm" onClick={togglePause}>
              {project.status === 'paused' ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
              {project.status === 'paused' ? 'Tiếp tục' : canDirect ? 'Tạm dừng' : 'Yêu cầu tạm dừng'}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={toggleArchive}>
            {archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
            {archived ? 'Kích hoạt' : 'Lưu trữ'}
          </Button>
          {canModify && (
            <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="h-4 w-4" /> {canDirect ? 'Xóa' : 'Yêu cầu xóa'}
            </Button>
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
                Đã dùng <span className="font-semibold text-foreground">{fmtVND(project.budgetUsed ?? 0)}</span> / {fmtVND(project.budget)}
              </span>
            </div>
            <Progress value={project.budget > 0 ? ((project.budgetUsed ?? 0) / project.budget) * 100 : 0} />
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs<DetailTab>
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'overview', label: 'Tổng quan' },
          { value: 'tasks', label: `Nhiệm vụ (${tasks.length})` },
          { value: 'activity', label: `Hoạt động (${activities.length})` },
        ]}
      />

      {tab === 'overview' && (
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
                  <dt className="text-muted-foreground">Người quản lý</dt>
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
                  <dd className="mt-0.5 font-medium">{fmtVND(project.budget)}</dd>
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
                  <Avatar name={m.name} size="sm" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {m.name} {m.id === project.managerId && <Badge tone="primary" className="ml-1">Quản lý</Badge>}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{m.title}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {tab === 'tasks' && (
        <Card>
          <CardContent className="flex flex-col divide-y p-0">
            {tasks.length === 0 && (
              <div className="p-5">
                <EmptyState icon={<List className="h-6 w-6" />} title="Chưa có nhiệm vụ" desc="Dự án này chưa có nhiệm vụ nào." />
              </div>
            )}
            {tasks.map((t) => {
              const due = dueLabel(t.dueDate, t.status);
              const assignees = t.assigneeIds
                .map((aid) => userById(state.users, aid)?.name)
                .filter((n): n is string => Boolean(n));
              return (
                <button key={t.id} onClick={() => openTask(t.id)} className="flex flex-col gap-2 p-4 text-left transition-colors hover:bg-accent/50 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{t.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{t.code}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <TaskStatusBadge status={t.status} />
                    <PriorityBadge priority={t.priority} />
                    <span className={cn('text-xs font-medium', DUE_TONE_CLASS[due.tone])}>{due.text}</span>
                    {assignees.length > 0 && <AvatarStack names={assignees} max={3} size="xs" />}
                  </div>
                </button>
              );
            })}
          </CardContent>
        </Card>
      )}

      {tab === 'activity' && (
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
                  <Avatar name={actor?.name ?? '?'} size="xs" />
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
      )}

      <ProjectForm open={formOpen} initial={project} onClose={() => setFormOpen(false)} />
      <ConfirmDialog
        open={confirmDelete}
        title={canDirect ? 'Xóa dự án?' : 'Gửi yêu cầu xóa dự án?'}
        desc={canDirect ? `Dự án "${project.name}" sẽ bị xóa khỏi workspace. Hành động này không thể hoàn tác.` : 'Yêu cầu của bạn sẽ được gửi đến Admin để phê duyệt.'}
        confirmLabel={canDirect ? 'Xóa dự án' : 'Gửi yêu cầu'}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
