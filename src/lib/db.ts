/**
 * Lớp truy cập dữ liệu Supabase cho Nexus Project.
 *
 * - Định nghĩa kiểu dòng DB (snake_case) và hàm map sang kiểu của app (camelCase).
 * - Tải toàn bộ dữ liệu của một workspace sau khi đăng nhập.
 * - `persistAction`: ghi mỗi thao tác của người dùng xuống Supabase trước,
 *   rồi trả về action đã làm giàu (id/log) để reducer cập nhật state cục bộ.
 *   Nếu ghi DB thất bại, action không được áp dụng và UI báo lỗi.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  ActivityLog,
  ChecklistItem,
  Document,
  Label,
  Notification,
  Project,
  ProjectRequest,
  Task,
  TaskAttachment,
  TaskComment,
  TaskDependency,
  User,
  Workspace,
  WorkspaceRole,
} from '../types';
import type { Action, AppState } from '../store/AppContext';
import { newId } from './utils';

type Sb = SupabaseClient;

/* ================= Kiểu dòng DB ================= */

interface DbProfile {
  id: string;
  name: string;
  email: string;
  title: string | null;
  avatar_url: string | null;
}
interface DbWorkspace {
  id: string;
  name: string;
  timezone: string | null;
}
interface DbWorkspaceMember {
  workspace_id: string;
  user_id: string;
  role: string;
}
interface DbProject {
  id: string;
  code: string;
  name: string;
  description: string | null;
  status: string;
  priority: string;
  start_date: string | null;
  end_date: string | null;
  manager_id: string | null;
  budget: number | string | null;
  budget_used: number | string | null;
  color: string | null;
  created_at: string;
  updated_at: string;
}
interface DbTask {
  id: string;
  project_id: string;
  code: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  creator_id: string | null;
  start_date: string | null;
  due_date: string | null;
  estimate_hours: number | string | null;
  actual_hours: number | string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

/* ================= Mapper DB -> App ================= */

/** 'YYYY-MM-DD' -> 'YYYY-MM-DDT00:00:00' để khớp định dạng ngày app đang dùng. */
const dateToApp = (d: string | null): string => (d ? `${d.slice(0, 10)}T00:00:00` : '');
/** ISO datetime -> 'YYYY-MM-DD' (cho cột date) hoặc null. */
const dateToDb = (iso?: string): string | null => (iso ? iso.slice(0, 10) : null);
/** Chuỗi rỗng -> null (cho cột timestamptz). */
const tsToDb = (iso?: string): string | null => (iso && iso.trim() !== '' ? iso : null);
const num = (v: number | string | null | undefined): number | undefined =>
  v === null || v === undefined || v === '' ? undefined : Number(v);

function mapUser(p: DbProfile, role: string): User {
  return {
    id: p.id,
    name: p.name,
    email: p.email,
    title: p.title ?? '',
    role: role as WorkspaceRole,
    status: 'active',
  };
}

function mapProject(r: DbProject, memberIds: string[]): Project {
  return {
    id: r.id,
    code: r.code,
    name: r.name,
    description: r.description ?? '',
    status: r.status as Project['status'],
    priority: r.priority as Project['priority'],
    startDate: dateToApp(r.start_date),
    endDate: dateToApp(r.end_date),
    managerId: r.manager_id ?? '',
    memberIds,
    budget: num(r.budget),
    budgetUsed: num(r.budget_used) ?? 0,
    color: r.color ?? '#4F46E5',
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function mapTask(r: DbTask, assigneeIds: string[], watcherIds: string[], labelIds: string[]): Task {
  return {
    id: r.id,
    code: r.code,
    title: r.title,
    description: r.description ?? '',
    projectId: r.project_id,
    status: r.status as Task['status'],
    priority: r.priority as Task['priority'],
    assigneeIds,
    creatorId: r.creator_id ?? '',
    watcherIds,
    startDate: r.start_date ?? undefined,
    dueDate: r.due_date ?? undefined,
    labelIds,
    estimateHours: num(r.estimate_hours),
    actualHours: num(r.actual_hours),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    completedAt: r.completed_at ?? undefined,
  };
}

/* ================= Tải dữ liệu ================= */

export interface Membership {
  workspaceId: string;
  role: WorkspaceRole;
}

export async function fetchMyMemberships(sb: Sb, userId: string): Promise<Membership[]> {
  const { data, error } = await sb
    .from('workspace_members')
    .select('workspace_id, role')
    .eq('user_id', userId);
  if (error) throw error;
  return ((data ?? []) as unknown as DbWorkspaceMember[]).map((m) => ({
    workspaceId: m.workspace_id,
    role: m.role as WorkspaceRole,
  }));
}

/** Tạo workspace + profile + quyền owner cho user mới (RPC security definer). */
export async function bootstrapWorkspace(sb: Sb, name = 'Workspace của tôi'): Promise<string> {
  const { data, error } = await sb.rpc('bootstrap_workspace', { ws_name: name });
  if (error) throw error;
  return data as string;
}

export interface WorkspaceBundle {
  workspace: Workspace;
  users: User[];
  labels: Label[];
  projects: Project[];
  tasks: Task[];
  checklists: ChecklistItem[];
  comments: TaskComment[];
  dependencies: TaskDependency[];
  attachments: TaskAttachment[];
  notifications: Notification[];
  activityLogs: ActivityLog[];
  documents: Document[];
  projectRequests: ProjectRequest[];
}

/** Tải toàn bộ dữ liệu của workspace sau khi đăng nhập. */
export async function loadWorkspaceData(sb: Sb, userId: string, workspaceId: string): Promise<WorkspaceBundle> {
  // Lấy dự án trước để giới hạn các truy vấn con theo project_id.
  const projectsRes = await sb.from('projects').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false });
  if (projectsRes.error) throw projectsRes.error;
  const projectIds = (projectsRes.data as DbProject[]).map((p) => p.id);
  const projectIdFilter = projectIds.length > 0 ? projectIds : ['00000000-0000-0000-0000-000000000000'];

  const [
    wsRes,
    membersRes,
    labelsRes,
    projectMembersRes,
    tasksRes,
    assigneesRes,
    watchersRes,
    taskLabelsRes,
    commentsRes,
    checklistsRes,
    depsRes,
    attachmentsRes,
    notifsRes,
    logsRes,
    docsRes,
    requestsRes,
  ] = await Promise.all([
    sb.from('workspaces').select('*').eq('id', workspaceId).single(),
    sb.from('workspace_members').select('user_id, role, profiles(id, name, email, title)').eq('workspace_id', workspaceId),
    sb.from('labels').select('*').eq('workspace_id', workspaceId),
    sb.from('project_members').select('project_id, user_id').in('project_id', projectIdFilter),
    sb.from('tasks').select('*').in('project_id', projectIdFilter).order('created_at', { ascending: false }),
    sb.from('task_assignees').select('task_id, user_id'),
    sb.from('task_watchers').select('task_id, user_id'),
    sb.from('task_labels').select('task_id, label_id'),
    sb.from('task_comments').select('*').order('created_at', { ascending: true }),
    sb.from('task_checklists').select('*').order('created_at', { ascending: true }),
    sb.from('task_dependencies').select('*'),
    sb.from('task_attachments').select('*').order('created_at', { ascending: true }),
    sb.from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(100),
    sb.from('activity_logs').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false }).limit(200),
    sb.from('documents').select('*').eq('workspace_id', workspaceId).order('updated_at', { ascending: false }),
    sb.from('project_requests').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false }).limit(200),
  ]);

  for (const r of [wsRes, membersRes, labelsRes, projectMembersRes, tasksRes, assigneesRes, watchersRes, taskLabelsRes, commentsRes, checklistsRes, depsRes, attachmentsRes, notifsRes, logsRes, docsRes, requestsRes]) {
    if (r.error) throw r.error;
  }

  const ws = wsRes.data as DbWorkspace;
  const projectIdSet = new Set((projectsRes.data as DbProject[]).map((p) => p.id));
  const taskIds = new Set((tasksRes.data as DbTask[]).map((t) => t.id));

  const memberIdsByProject = new Map<string, string[]>();
  for (const m of (projectMembersRes.data ?? []) as { project_id: string; user_id: string }[]) {
    if (!projectIdSet.has(m.project_id)) continue;
    const list = memberIdsByProject.get(m.project_id) ?? [];
    list.push(m.user_id);
    memberIdsByProject.set(m.project_id, list);
  }

  const byTask = (rows: { task_id: string; ref: string }[]): Map<string, string[]> => {
    const map = new Map<string, string[]>();
    for (const r of rows) {
      if (!taskIds.has(r.task_id)) continue;
      const list = map.get(r.task_id) ?? [];
      list.push(r.ref);
      map.set(r.task_id, list);
    }
    return map;
  };
  const assigneesByTask = byTask(((assigneesRes.data ?? []) as { task_id: string; user_id: string }[]).map((r) => ({ task_id: r.task_id, ref: r.user_id })));
  const watchersByTask = byTask(((watchersRes.data ?? []) as { task_id: string; user_id: string }[]).map((r) => ({ task_id: r.task_id, ref: r.user_id })));
  const labelsByTask = byTask(((taskLabelsRes.data ?? []) as { task_id: string; label_id: string }[]).map((r) => ({ task_id: r.task_id, ref: r.label_id })));

  const users = ((membersRes.data ?? []) as unknown as { user_id: string; role: string; profiles: DbProfile }[])
    .filter((m) => m.profiles)
    .map((m) => mapUser(m.profiles, m.role));

  // workload: suy ra từ số nhiệm vụ đang mở được giao (10 nhiệm vụ mở = 100%)
  const taskById = new Map((tasksRes.data as DbTask[]).map((t) => [t.id, t]));
  const openCount = new Map<string, number>();
  for (const [taskId, ids] of assigneesByTask) {
    const t = taskById.get(taskId);
    if (t && t.status !== 'done') for (const uid of ids) openCount.set(uid, (openCount.get(uid) ?? 0) + 1);
  }
  for (const u of users) u.workload = Math.min(100, (openCount.get(u.id) ?? 0) * 10);

  return {
    workspace: { id: ws.id, name: ws.name, timezone: ws.timezone ?? 'Asia/Ho_Chi_Minh' },
    users,
    labels: ((labelsRes.data ?? []) as { id: string; name: string; color: string }[]).map((l) => ({
      id: l.id, name: l.name, color: l.color,
    })),
    projects: (projectsRes.data as DbProject[]).map((p) => mapProject(p, memberIdsByProject.get(p.id) ?? [])),
    tasks: (tasksRes.data as DbTask[]).map((t) =>
      mapTask(t, assigneesByTask.get(t.id) ?? [], watchersByTask.get(t.id) ?? [], labelsByTask.get(t.id) ?? [])),
    checklists: ((checklistsRes.data ?? []) as { id: string; task_id: string; title: string; done: boolean }[])
      .filter((c) => taskIds.has(c.task_id))
      .map((c) => ({ id: c.id, taskId: c.task_id, title: c.title, done: c.done })),
    comments: ((commentsRes.data ?? []) as { id: string; task_id: string; author_id: string; body: string; created_at: string }[])
      .filter((c) => taskIds.has(c.task_id))
      .map((c) => ({ id: c.id, taskId: c.task_id, authorId: c.author_id, body: c.body, createdAt: c.created_at })),
    dependencies: ((depsRes.data ?? []) as { id: string; task_id: string; depends_on_id: string }[])
      .filter((d) => taskIds.has(d.task_id) && taskIds.has(d.depends_on_id))
      .map((d) => ({ id: d.id, taskId: d.task_id, dependsOnId: d.depends_on_id })),
    attachments: ((attachmentsRes.data ?? []) as { id: string; task_id: string; name: string; size_bytes: number | null; uploaded_by: string; created_at: string }[])
      .filter((a) => taskIds.has(a.task_id))
      .map((a) => ({
        id: a.id, taskId: a.task_id, name: a.name,
        size: a.size_bytes ? formatBytes(a.size_bytes) : '—',
        uploadedBy: a.uploaded_by, createdAt: a.created_at,
      })),
    notifications: ((notifsRes.data ?? []) as { id: string; user_id: string; kind: string; title: string; body: string; link: string | null; read: boolean; created_at: string }[])
      .map((n) => ({
        id: n.id, userId: n.user_id, kind: n.kind as Notification['kind'], title: n.title,
        body: n.body ?? '', link: n.link ?? undefined, read: n.read, createdAt: n.created_at,
      })),
    activityLogs: ((logsRes.data ?? []) as { id: string; actor_id: string; action: string; entity_type: string; entity_id: string; entity_name: string; created_at: string }[])
      .map((l) => ({
        id: l.id, actorId: l.actor_id, action: l.action,
        entityType: l.entity_type as ActivityLog['entityType'], entityId: l.entity_id,
        entityName: l.entity_name ?? '', createdAt: l.created_at,
      })),
    documents: ((docsRes.data ?? []) as { id: string; project_id: string | null; title: string; content: string | null; author_id: string; created_at: string; updated_at: string }[])
      .map((d) => ({
        id: d.id, projectId: d.project_id ?? undefined, title: d.title, content: d.content ?? '',
        authorId: d.author_id, createdAt: d.created_at, updatedAt: d.updated_at,
      })),
    projectRequests: ((requestsRes.data ?? []) as {
      id: string; workspace_id: string; type: string; project_id: string | null;
      payload: Record<string, unknown>; status: string; requested_by: string;
      reviewed_by: string | null; review_note: string | null;
      created_at: string; reviewed_at: string | null;
    }[])
      .map((r) => ({
        id: r.id,
        workspaceId: r.workspace_id,
        type: r.type as ProjectRequest['type'],
        projectId: r.project_id ?? undefined,
        payload: (r.payload ?? {}) as Partial<Project>,
        status: r.status as ProjectRequest['status'],
        requestedBy: r.requested_by,
        reviewedBy: r.reviewed_by ?? undefined,
        reviewNote: r.review_note ?? undefined,
        createdAt: r.created_at,
        reviewedAt: r.reviewed_at ?? undefined,
      })),
  };
}

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

/* ================= Ghi thao tác xuống Supabase ================= */

export interface PersistContext {
  workspaceId: string;
  userId: string;
  userName: string;
}

/** Action sau khi làm giàu: reducer dùng thêm log/user/doc đã tạo. */
export type RichAction = Action & {
  log?: ActivityLog;
  user?: User;
  doc?: Document;
  task?: Task;
  project?: Project;
  request?: ProjectRequest;
  projectDeletedId?: string;
};

function buildLog(
  ctx: PersistContext,
  action: string,
  entityType: ActivityLog['entityType'],
  entityId: string,
  entityName: string,
): ActivityLog {
  return {
    id: newId(),
    actorId: ctx.userId,
    action,
    entityType,
    entityId,
    entityName,
    createdAt: new Date().toISOString(),
  };
}

/** Tiêu đề hiển thị cho một yêu cầu phê duyệt dự án. */
function requestTitle(
  r: Pick<ProjectRequest, 'type' | 'payload'>,
  fallbackName?: string,
): string {
  const rawName =
    typeof r.payload?.name === 'string' && r.payload.name ? r.payload.name : fallbackName;
  const name = rawName ? ` "${rawName}"` : '';
  switch (r.type) {
    case 'create_project':
      return `Tạo dự án${name}`;
    case 'pause_project':
      return `Tạm dừng dự án${name}`;
    case 'delete_project':
      return `Xóa dự án${name}`;
  }
}

async function insertLog(sb: Sb, ctx: PersistContext, log: ActivityLog): Promise<void> {
  const { error } = await sb.from('activity_logs').insert({
    id: log.id,
    workspace_id: ctx.workspaceId,
    actor_id: log.actorId,
    action: log.action,
    entity_type: log.entityType,
    entity_id: log.entityId,
    entity_name: log.entityName,
  });
  if (error) throw error;
}

async function syncJoin(
  sb: Sb,
  table: 'project_members' | 'task_assignees' | 'task_watchers' | 'task_labels',
  ownerCol: 'project_id' | 'task_id',
  ownerId: string,
  memberCol: 'user_id' | 'label_id',
  prevIds: string[],
  nextIds: string[],
): Promise<void> {
  const prev = new Set(prevIds);
  const next = new Set(nextIds);
  const toAdd = [...next].filter((id) => !prev.has(id));
  const toRemove = [...prev].filter((id) => !next.has(id));
  if (toAdd.length > 0) {
    const { error } = await sb.from(table).insert(
      toAdd.map((id) => ({ [ownerCol]: ownerId, [memberCol]: id })),
    );
    if (error && !isConflict(error)) throw error;
  }
  if (toRemove.length > 0) {
    const { error } = await sb.from(table).delete().eq(ownerCol, ownerId).in(memberCol, toRemove);
    if (error) throw error;
  }
}

const isConflict = (e: { code?: string }) => e.code === '23505';

async function notifyAssignees(
  sb: Sb,
  ctx: PersistContext,
  task: Task,
  assigneeIds: string[],
): Promise<void> {
  const targets = assigneeIds.filter((id) => id !== ctx.userId);
  if (targets.length === 0) return;
  const rows = targets.map((userId) => ({
    id: newId(),
    user_id: userId,
    kind: 'assigned',
    title: 'Bạn được giao nhiệm vụ mới',
    body: `${ctx.userName} đã giao cho bạn "${task.title}".`,
    link: `/user/tasks/${task.id}`,
  }));
  const { error } = await sb.from('notifications').insert(rows);
  if (error) throw error;
}

/**
 * Thông báo quy trình duyệt nhiệm vụ:
 * - requested: có người gửi yêu cầu duyệt (→ in_review) → báo cho Owner/Admin.
 * - approved: admin duyệt (in_review → done) → báo cho người thực hiện.
 * - rejected: admin trả về (in_review → trạng thái khác) → báo cho người thực hiện.
 */
async function notifyReview(
  sb: Sb,
  ctx: PersistContext,
  users: User[],
  task: Task,
  event: 'requested' | 'approved' | 'rejected',
): Promise<void> {
  const targets =
    event === 'requested'
      ? users.filter((u) => (u.role === 'owner' || u.role === 'admin') && u.id !== ctx.userId).map((u) => u.id)
      : task.assigneeIds.filter((id) => id !== ctx.userId);
  if (targets.length === 0) return;
  const meta = {
    requested: { title: 'Có nhiệm vụ chờ duyệt', body: `${ctx.userName} đã gửi "${task.title}" chờ duyệt.` },
    approved: { title: 'Nhiệm vụ đã được duyệt', body: `"${task.title}" đã được ${ctx.userName} duyệt.` },
    rejected: { title: 'Nhiệm vụ bị trả về', body: `"${task.title}" đã bị ${ctx.userName} trả về.` },
  }[event];
  const rows = targets.map((userId) => ({
    id: newId(),
    user_id: userId,
    kind: 'review',
    title: meta.title,
    body: meta.body,
    link: `/user/tasks/${task.id}`,
  }));
  const { error } = await sb.from('notifications').insert(rows);
  if (error) throw error;
}

function toProjectRow(p: Project, workspaceId: string) {
  return {
    id: p.id,
    workspace_id: workspaceId,
    code: p.code,
    name: p.name,
    description: p.description || '',
    status: p.status,
    priority: p.priority,
    start_date: dateToDb(p.startDate),
    end_date: dateToDb(p.endDate),
    manager_id: p.managerId || null,
    budget: p.budget ?? null,
    budget_used: p.budgetUsed ?? 0,
    color: p.color,
  };
}

function toTaskRow(t: Task) {
  return {
    id: t.id,
    project_id: t.projectId,
    code: t.code,
    title: t.title,
    description: t.description || '',
    status: t.status,
    priority: t.priority,
    creator_id: t.creatorId || null,
    start_date: tsToDb(t.startDate),
    due_date: tsToDb(t.dueDate),
    estimate_hours: t.estimateHours ?? null,
    actual_hours: t.actualHours ?? null,
    completed_at: tsToDb(t.completedAt),
  };
}

function throwDb(error: { message?: string } | null, fallback: string): never {
  throw new Error(error?.message || fallback);
}

/**
 * Ghi một action xuống Supabase, trả về action đã làm giàu để reducer áp dụng.
 * Ném lỗi khi ghi thất bại — caller sẽ báo lỗi và KHÔNG cập nhật state cục bộ.
 */
export async function persistAction(
  sb: Sb,
  ctx: PersistContext,
  state: AppState,
  action: Action,
): Promise<RichAction> {
  switch (action.type) {
    case 'SET_THEME':
    case 'TOGGLE_SIDEBAR':
      return action;

    case 'PROJECT_ADD': {
      const { error } = await sb.from('projects').insert(toProjectRow(action.project, ctx.workspaceId));
      if (error) throwDb(error, 'Không tạo được dự án (mã dự án có thể đã tồn tại).');
      await syncJoin(sb, 'project_members', 'project_id', action.project.id, 'user_id', [], action.project.memberIds);
      const log = buildLog(ctx, 'đã tạo', 'project', action.project.id, action.project.name);
      await insertLog(sb, ctx, log);
      return { ...action, log };
    }

    case 'PROJECT_UPDATE': {
      const prev = state.projects.find((p) => p.id === action.project.id);
      const { error } = await sb.from('projects').update(toProjectRow(action.project, ctx.workspaceId)).eq('id', action.project.id);
      if (error) throwDb(error, 'Không cập nhật được dự án.');
      await syncJoin(sb, 'project_members', 'project_id', action.project.id, 'user_id', prev?.memberIds ?? [], action.project.memberIds);
      const log = buildLog(ctx, 'đã cập nhật', 'project', action.project.id, action.project.name);
      await insertLog(sb, ctx, log);
      return { ...action, log };
    }

    case 'PROJECT_DELETE': {
      const { error } = await sb.from('projects').delete().eq('id', action.id);
      if (error) throwDb(error, 'Không xóa được dự án.');
      return action;
    }

    case 'PROJECT_REQUEST_CREATE': {
      const r = action.request;
      const { error } = await sb.from('project_requests').insert({
        id: r.id,
        workspace_id: ctx.workspaceId,
        type: r.type,
        project_id: r.projectId ?? null,
        payload: r.payload as Record<string, unknown>,
        status: 'pending',
        requested_by: ctx.userId,
      });
      if (error) throwDb(error, 'Không gửi được yêu cầu.');
      const log = buildLog(ctx, 'đã gửi yêu cầu', 'project', r.projectId ?? r.id, requestTitle(r));
      await insertLog(sb, ctx, log);
      // Báo cho Owner/Admin biết có yêu cầu mới cần duyệt.
      const admins = state.users.filter((u) => (u.role === 'owner' || u.role === 'admin') && u.id !== ctx.userId);
      if (admins.length > 0) {
        const rows = admins.map((u) => ({
          id: newId(),
          user_id: u.id,
          kind: 'project',
          title: 'Yêu cầu mới cần phê duyệt',
          body: `${ctx.userName} đã gửi yêu cầu "${requestTitle(r)}".`,
          link: '/admin/approvals',
        }));
        const { error: nErr } = await sb.from('notifications').insert(rows);
        if (nErr) throw nErr;
      }
      return { ...action, log };
    }

    case 'PROJECT_REQUEST_REVIEW': {
      const req = state.projectRequests.find((x) => x.id === action.id);
      if (!req) throwDb(new Error('not found'), 'Không tìm thấy yêu cầu.');
      if (req.status !== 'pending') throwDb(new Error('already reviewed'), 'Yêu cầu đã được xử lý trước đó.');
      const reqProject = req.projectId ? state.projects.find((x) => x.id === req.projectId) : undefined;
      const title = requestTitle(req, reqProject?.name);
      const now = new Date().toISOString();
      const status = action.approve ? 'approved' : 'rejected';
      const { error } = await sb
        .from('project_requests')
        .update({ status, reviewed_by: ctx.userId, review_note: action.note ?? null, reviewed_at: now })
        .eq('id', action.id);
      if (error) throwDb(error, 'Không cập nhật được yêu cầu.');

      // Thi hành yêu cầu khi được duyệt.
      let executedLog: ActivityLog | undefined;
      let reviewedProject: Project | undefined;
      let deletedProjectId: string | undefined;
      if (action.approve) {
        if (req.type === 'create_project') {
          const p = req.payload as Partial<Project>;
          const project: Project = {
            id: newId(),
            code: String(p.code ?? ''),
            name: String(p.name ?? 'Dự án mới'),
            description: String(p.description ?? ''),
            status: 'planning',
            priority: (p.priority as Project['priority']) ?? 'medium',
            startDate: String(p.startDate ?? now.slice(0, 10)),
            endDate: String(p.endDate ?? now.slice(0, 10)),
            managerId: String(p.managerId ?? ctx.userId),
            memberIds: Array.isArray(p.memberIds) ? (p.memberIds as string[]) : [ctx.userId],
            budget: typeof p.budget === 'number' ? p.budget : undefined,
            color: String(p.color ?? '#4F46E5'),
            createdAt: now,
            updatedAt: now,
          };
          const { error: cErr } = await sb.from('projects').insert(toProjectRow(project, ctx.workspaceId));
          if (cErr) throwDb(cErr, 'Không tạo được dự án (mã dự án có thể đã tồn tại).');
          await syncJoin(sb, 'project_members', 'project_id', project.id, 'user_id', [], project.memberIds);
          reviewedProject = project;
          executedLog = buildLog(ctx, 'đã duyệt yêu cầu tạo', 'project', project.id, project.name);
          await insertLog(sb, ctx, executedLog);
        } else if (req.type === 'pause_project' && req.projectId) {
          const proj = state.projects.find((x) => x.id === req.projectId);
          if (proj) {
            const updated = { ...proj, status: 'paused' as const, updatedAt: now };
            const { error: uErr } = await sb.from('projects').update(toProjectRow(updated, ctx.workspaceId)).eq('id', proj.id);
            if (uErr) throwDb(uErr, 'Không tạm dừng được dự án.');
            reviewedProject = updated;
            executedLog = buildLog(ctx, 'đã duyệt yêu cầu tạm dừng', 'project', proj.id, proj.name);
            await insertLog(sb, ctx, executedLog);
          }
        } else if (req.type === 'delete_project' && req.projectId) {
          const proj = state.projects.find((x) => x.id === req.projectId);
          const { error: dErr } = await sb.from('projects').delete().eq('id', req.projectId);
          if (dErr) throwDb(dErr, 'Không xóa được dự án.');
          deletedProjectId = req.projectId;
          if (proj) {
            executedLog = buildLog(ctx, 'đã duyệt yêu cầu xóa', 'project', proj.id, proj.name);
            await insertLog(sb, ctx, executedLog);
          }
        }
      }

      // Báo kết quả cho người yêu cầu.
      if (req.requestedBy !== ctx.userId) {
        const verb = action.approve ? 'đã được duyệt' : 'đã bị từ chối';
        const { error: nErr } = await sb.from('notifications').insert({
          id: newId(),
          user_id: req.requestedBy,
          kind: 'project',
          title: `Yêu cầu ${verb}`,
          body: `Yêu cầu "${title}" của bạn ${verb}${action.note ? `: ${action.note}` : '.'}`,
          link: '/user/projects',
        });
        if (nErr) throw nErr;
      }
      const reviewed: ProjectRequest = {
        ...req, status, reviewedBy: ctx.userId,
        reviewNote: action.note ?? undefined, reviewedAt: now,
      };
      return { ...action, request: reviewed, log: executedLog, project: reviewedProject, projectDeletedId: deletedProjectId };
    }

    case 'TASK_ADD': {
      const { error } = await sb.from('tasks').insert(toTaskRow(action.task));
      if (error) throwDb(error, 'Không tạo được nhiệm vụ.');
      await syncJoin(sb, 'task_assignees', 'task_id', action.task.id, 'user_id', [], action.task.assigneeIds);
      await syncJoin(sb, 'task_watchers', 'task_id', action.task.id, 'user_id', [], action.task.watcherIds);
      await syncJoin(sb, 'task_labels', 'task_id', action.task.id, 'label_id', [], action.task.labelIds);
      const log = buildLog(ctx, 'đã tạo', 'task', action.task.id, action.task.title);
      await insertLog(sb, ctx, log);
      await notifyAssignees(sb, ctx, action.task, action.task.assigneeIds);
      return { ...action, log };
    }

    case 'TASK_UPDATE': {
      const prev = state.tasks.find((t) => t.id === action.task.id);
      const statusChanged = prev && prev.status !== action.task.status;
      let completedAt = action.task.completedAt;
      if (statusChanged) {
        completedAt = action.task.status === 'done' ? new Date().toISOString() : undefined;
      }
      const task = { ...action.task, completedAt };
      const { error } = await sb.from('tasks').update(toTaskRow(task)).eq('id', task.id);
      if (error) throwDb(error, 'Không cập nhật được nhiệm vụ.');
      await syncJoin(sb, 'task_assignees', 'task_id', task.id, 'user_id', prev?.assigneeIds ?? [], task.assigneeIds);
      await syncJoin(sb, 'task_watchers', 'task_id', task.id, 'user_id', prev?.watcherIds ?? [], task.watcherIds);
      await syncJoin(sb, 'task_labels', 'task_id', task.id, 'label_id', prev?.labelIds ?? [], task.labelIds);
      // Chỉ ghi log cho sự kiện đáng chú ý (đổi trạng thái / đổi người thực hiện), tránh spam.
      const assigneesChanged =
        prev && [...task.assigneeIds].sort().join() !== [...prev.assigneeIds].sort().join();
      let log: ActivityLog | undefined;
      if (statusChanged || assigneesChanged) {
        log = buildLog(ctx, statusChanged ? 'đã chuyển trạng thái' : 'đã cập nhật người thực hiện', 'task', task.id, task.title);
        await insertLog(sb, ctx, log);
      }
      if (prev) {
        const added = task.assigneeIds.filter((id) => !prev.assigneeIds.includes(id));
        await notifyAssignees(sb, ctx, task, added);
      }
      if (statusChanged) {
        const wasReview = prev?.status === 'in_review';
        if (!wasReview && task.status === 'in_review') {
          await notifyReview(sb, ctx, state.users, task, 'requested');
        } else if (wasReview && task.status === 'done') {
          await notifyReview(sb, ctx, state.users, task, 'approved');
        } else if (wasReview) {
          await notifyReview(sb, ctx, state.users, task, 'rejected');
        }
      }
      return { ...action, task, log };
    }

    case 'TASK_MOVE': {
      const task = state.tasks.find((t) => t.id === action.id);
      if (!task) return action;
      const wasReview = task.status === 'in_review';
      const completedAt = action.status === 'done' ? new Date().toISOString() : null;
      const { error } = await sb.from('tasks').update({ status: action.status, completed_at: completedAt }).eq('id', action.id);
      if (error) throwDb(error, 'Không chuyển trạng thái được.');
      const log = buildLog(ctx, 'đã chuyển trạng thái', 'task', task.id, task.title);
      await insertLog(sb, ctx, log);
      if (!wasReview && action.status === 'in_review') {
        await notifyReview(sb, ctx, state.users, task, 'requested');
      } else if (wasReview && action.status === 'done') {
        await notifyReview(sb, ctx, state.users, task, 'approved');
      } else if (wasReview) {
        await notifyReview(sb, ctx, state.users, task, 'rejected');
      }
      return { ...action, log };
    }

    case 'TASK_DELETE': {
      const { error } = await sb.from('tasks').delete().eq('id', action.id);
      if (error) throwDb(error, 'Không xóa được nhiệm vụ.');
      return action;
    }

    case 'CHECKLIST_TOGGLE': {
      const item = state.checklists.find((c) => c.id === action.id);
      if (!item) return action;
      const { error } = await sb.from('task_checklists').update({ done: !item.done }).eq('id', action.id);
      if (error) throwDb(error, 'Không cập nhật được checklist.');
      return action;
    }

    case 'CHECKLIST_ADD': {
      const { error } = await sb.from('task_checklists').insert({
        id: action.id, task_id: action.taskId, title: action.title, done: false,
      });
      if (error) throwDb(error, 'Không thêm được mục checklist.');
      return action;
    }

    case 'CHECKLIST_DELETE': {
      const { error } = await sb.from('task_checklists').delete().eq('id', action.id);
      if (error) throwDb(error, 'Không xóa được mục checklist.');
      return action;
    }

    case 'COMMENT_ADD': {
      const { error } = await sb.from('task_comments').insert({
        id: action.id, task_id: action.taskId, author_id: ctx.userId, body: action.body,
      });
      if (error) throwDb(error, 'Không gửi được bình luận.');
      const task = state.tasks.find((t) => t.id === action.taskId);
      const log = buildLog(ctx, 'đã bình luận trong', 'task', action.taskId, task?.title ?? '');
      await insertLog(sb, ctx, log);
      return { ...action, log };
    }

    case 'COMMENT_DELETE': {
      const { error } = await sb.from('task_comments').delete().eq('id', action.id);
      if (error) throwDb(error, 'Không xóa được bình luận.');
      return action;
    }

    case 'DEPENDENCY_ADD': {
      const { error } = await sb.from('task_dependencies').insert({
        id: action.id, task_id: action.taskId, depends_on_id: action.dependsOnId,
      });
      if (error) {
        if (isConflict(error)) throw new Error('Phụ thuộc này đã tồn tại.');
        throwDb(error, 'Không thêm được phụ thuộc.');
      }
      return action;
    }

    case 'DEPENDENCY_DELETE': {
      const { error } = await sb.from('task_dependencies').delete().eq('id', action.id);
      if (error) throwDb(error, 'Không gỡ được phụ thuộc.');
      return action;
    }

    case 'NOTIF_READ': {
      const { error } = await sb.from('notifications').update({ read: true }).eq('id', action.id).eq('user_id', ctx.userId);
      if (error) throwDb(error, 'Không đánh dấu được thông báo.');
      return action;
    }

    case 'NOTIF_READ_ALL': {
      const { error } = await sb.from('notifications').update({ read: true }).eq('user_id', ctx.userId).eq('read', false);
      if (error) throwDb(error, 'Không đánh dấu được thông báo.');
      return action;
    }

    case 'USER_ADD': {
      // Thêm thành viên đã có tài khoản Nexus vào workspace bằng email.
      const { data: profile, error: findErr } = await sb
        .from('profiles')
        .select('id, name, email, title')
        .eq('email', action.email.trim().toLowerCase())
        .maybeSingle();
      if (findErr) throwDb(findErr, 'Không tìm được thành viên.');
      if (!profile) throw new Error(`Email ${action.email} chưa đăng ký tài khoản Nexus. Người này cần đăng ký trước.`);
      if (profile.id === ctx.userId) throw new Error('Đây là tài khoản của chính bạn.');
      const { error: insErr } = await sb.from('workspace_members').insert({
        workspace_id: ctx.workspaceId, user_id: profile.id, role: action.role,
      });
      if (insErr) {
        if (isConflict(insErr)) throw new Error('Thành viên này đã có trong workspace.');
        throwDb(insErr, 'Không thêm được thành viên.');
      }
      const p = profile as DbProfile;
      const user: User = mapUser(p, action.role);
      user.workload = 0;
      return { ...action, user };
    }

    case 'USER_UPDATE_ROLE': {
      const { error } = await sb.from('workspace_members')
        .update({ role: action.role })
        .eq('workspace_id', ctx.workspaceId)
        .eq('user_id', action.id);
      if (error) throwDb(error, 'Không đổi được vai trò.');
      return action;
    }

    case 'USER_UPDATE_PROFILE': {
      const { error } = await sb.from('profiles')
        .update({ name: action.name, title: action.title })
        .eq('id', action.id);
      if (error) throwDb(error, 'Không cập nhật được hồ sơ.');
      return action;
    }

    case 'WORKSPACE_UPDATE': {
      const { error } = await sb.from('workspaces')
        .update({ name: action.name, timezone: action.timezone })
        .eq('id', ctx.workspaceId);
      if (error) throwDb(error, 'Không cập nhật được workspace.');
      return action;
    }

    case 'DOC_ADD': {
      const doc: Document = {
        id: newId(),
        title: action.title,
        content: action.content,
        projectId: action.projectId,
        authorId: ctx.userId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const { error } = await sb.from('documents').insert({
        id: doc.id,
        workspace_id: ctx.workspaceId,
        project_id: doc.projectId ?? null,
        title: doc.title,
        content: doc.content,
        author_id: doc.authorId,
      });
      if (error) throwDb(error, 'Không tạo được tài liệu.');
      return { ...action, doc };
    }

    case 'DOC_UPDATE': {
      const { error } = await sb.from('documents')
        .update({ title: action.title, content: action.content })
        .eq('id', action.id);
      if (error) throwDb(error, 'Không cập nhật được tài liệu.');
      return action;
    }

    case 'DOC_DELETE': {
      const { error } = await sb.from('documents').delete().eq('id', action.id);
      if (error) throwDb(error, 'Không xóa được tài liệu.');
      return action;
    }

    default:
      return action;
  }
}
