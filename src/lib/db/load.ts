import type {
  ActivityLog,
  ChecklistItem,
  Document,
  Label,
  Notification,
  Project,
  ProjectInvitePayload,
  ProjectRequest,
  Task,
  TaskAttachment,
  TaskComment,
  TaskDependency,
  User,
  Workspace,
  WorkspaceRole,
} from '../../types';
import type {
  DbProfile,
  DbProject,
  DbTask,
  DbWorkspace,
  DbWorkspaceMember,
  Sb,
} from './mappers';
import { mapProject, mapTask, mapUser, normalizeRole } from './mappers';
import { workloadFromOpenCount } from '../utils';
import { formatBytes } from '../format';

/* ================= Tải dữ liệu ================= */

interface Membership {
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
    role: normalizeRole(m.role),
  }));
}

/** Tạo hoặc tham gia workspace chung + profile cho user (RPC security definer). */
export async function bootstrapWorkspace(sb: Sb, name = 'Ban Công Nghệ'): Promise<string> {
  const { data, error } = await sb.rpc('bootstrap_workspace', { ws_name: name });
  if (error) throw error;
  return data as string;
}

export interface WorkspaceBundle {
  workspace: Workspace;
  /** Toàn bộ workspace (chỉ super-admin mới có nhiều hơn 1) — dùng để hiển thị nhãn. */
  workspaces: Workspace[];
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

/**
 * Tải toàn bộ dữ liệu của workspace sau khi đăng nhập.
 * Nếu là Admin tổng (isSuperAdmin) thì tải dữ liệu TẤT CẢ workspace.
 */
export async function loadWorkspaceData(
  sb: Sb, userId: string, workspaceId: string, isSuperAdmin = false,
): Promise<WorkspaceBundle> {
  // Lọc theo workspace — bỏ qua khi là Admin tổng.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const byWs = (q: any) => (isSuperAdmin ? q : q.eq('workspace_id', workspaceId));

  // Lấy dự án trước để giới hạn các truy vấn con theo project_id.
  const projectsRes = await byWs(sb.from('projects').select('*').order('created_at', { ascending: false }));
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
    sb.from('workspace_members').select('user_id, role, profiles(id, name, email, username, title, avatar_url)').eq('workspace_id', workspaceId),
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
    byWs(sb.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(200)),
    byWs(sb.from('documents').select('*').order('updated_at', { ascending: false })),
    byWs(sb.from('project_requests').select('*').order('created_at', { ascending: false }).limit(200)),
  ]);

  for (const r of [wsRes, membersRes, labelsRes, projectMembersRes, tasksRes, assigneesRes, watchersRes, taskLabelsRes, commentsRes, checklistsRes, depsRes, attachmentsRes, notifsRes, logsRes, docsRes, requestsRes]) {
    if (r.error) throw r.error;
  }

  const wsList = (isSuperAdmin
    ? ((wsRes.data ?? []) as DbWorkspace[])
    : [wsRes.data as DbWorkspace]
  ).filter(Boolean);
  const ws = wsList.find((w) => w.id === workspaceId) ?? wsList[0];
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

  // Admin tổng: gộp trùng user (một người có thể ở nhiều workspace), giữ role cao nhất.
  const ROLE_RANK: Record<string, number> = { member: 0, admin: 1 };
  const deduped = new Map<string, User>();
  for (const u of users) {
    const prev = deduped.get(u.id);
    if (!prev) deduped.set(u.id, u);
    else {
      if ((ROLE_RANK[u.role] ?? 0) > (ROLE_RANK[prev.role] ?? 0)) prev.role = u.role;
      if (u.isSuperAdmin) prev.isSuperAdmin = true;
    }
  }
  const finalUsers = [...deduped.values()];

  // workload: suy ra từ số nhiệm vụ đang mở được giao (10 nhiệm vụ mở = 100%)
  const taskById = new Map((tasksRes.data as DbTask[]).map((t) => [t.id, t]));
  const openCount = new Map<string, number>();
  for (const [taskId, ids] of assigneesByTask) {
    const t = taskById.get(taskId);
    if (t && t.status !== 'done') for (const uid of ids) openCount.set(uid, (openCount.get(uid) ?? 0) + 1);
  }
  for (const u of finalUsers) u.workload = workloadFromOpenCount(openCount.get(u.id) ?? 0);

  return {
    workspace: { id: ws.id, name: ws.name, timezone: ws.timezone ?? 'Asia/Ho_Chi_Minh', inviteExpiryDays: ws.invite_expiry_days ?? undefined },
    workspaces: wsList.map((w) => ({ id: w.id, name: w.name, timezone: w.timezone ?? 'Asia/Ho_Chi_Minh', inviteExpiryDays: w.invite_expiry_days ?? undefined })),
    users: finalUsers,
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
        size: formatBytes(a.size_bytes),
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
    documents: ((docsRes.data ?? []) as { id: string; project_id: string | null; title: string; content: string | null; author_id: string; created_at: string; updated_at: string; file_url?: string | null; file_name?: string | null; file_size?: number | null; file_type?: string | null }[])
      .map((d) => ({
        id: d.id, projectId: d.project_id ?? undefined, title: d.title, content: d.content ?? '',
        authorId: d.author_id, createdAt: d.created_at, updatedAt: d.updated_at,
        fileUrl: d.file_url ?? undefined, fileName: d.file_name ?? undefined,
        fileSize: d.file_size ?? undefined, fileType: d.file_type ?? undefined,
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
        payload: (r.payload ?? {}) as Partial<Project> & Partial<ProjectInvitePayload>,
        status: r.status as ProjectRequest['status'],
        requestedBy: r.requested_by,
        reviewedBy: r.reviewed_by ?? undefined,
        reviewNote: r.review_note ?? undefined,
        createdAt: r.created_at,
        reviewedAt: r.reviewed_at ?? undefined,
      })),
  };
}

/* ================= Tài liệu dự án: upload file (bucket project-documents) ================= */

