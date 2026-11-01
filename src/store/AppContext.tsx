/**
 * Store trung tâm của Nexus Project.
 *
 * Kiến trúc: mọi thao tác của người dùng đi qua `dispatch` — bất đồng bộ.
 * 1. `persistAction` (lib/db.ts) ghi thay đổi xuống Supabase trước.
 * 2. Nếu thành công, reducer cập nhật state cục bộ để UI phản hồi ngay.
 * 3. Nếu thất bại, state giữ nguyên và UI báo lỗi.
 *
 * Nhờ đó components không cần biết gì về Supabase: chúng chỉ dispatch
 * action như trước, còn việc đồng bộ DB do lớp này đảm nhiệm.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from 'react';
import { getSupabase, isSupabaseConfigured } from '../lib/supabase';
import {
  bootstrapWorkspace,
  fetchIsSuperAdmin,
  fetchMyMemberships,
  loadWorkspaceData,
  persistAction,
  type PersistContext,
  type WorkspaceBundle,
} from '../lib/db';
import { createMockWorkspaceBundle } from '../features/auth/mockData';
import {
  verifyDiscordGuildMembership,
  getDiscordDisplayName,
  syncDiscordProfile,
  extractStoredProviderToken,
  persistProviderToken,
} from '../features/auth/discordAuth';
import { toast } from '../components/ui/toast';
import {
  assignableRoles,
  canDirectProjectAction,
  canManageMembers,
  canRequestProjects,
  canReviewProjectRequests,
  canReviewTaskForProject,
  isProjectLeader,
} from '../lib/roles';
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

export interface AppState {
  authed: boolean;
  loading: boolean;
  configError: boolean;
  workspace: Workspace;
  /** Toàn bộ workspace (Admin tổng thấy tất cả; người thường chỉ có 1). */
  workspaces: Workspace[];
  users: User[];
  currentUserId: string;
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
  theme: 'light' | 'dark';
  sidebarCollapsed: boolean;
}

/** Action do components dispatch (public API của store). */
export type Action =
  | { type: 'SET_THEME'; theme: 'light' | 'dark' }
  | { type: 'TOGGLE_SIDEBAR' }
  | { type: 'PROJECT_ADD'; project: Project }
  | { type: 'PROJECT_UPDATE'; project: Project }
  | { type: 'PROJECT_DELETE'; id: string }
  | { type: 'PROJECT_JOIN_REQUEST'; projectId: string }
  | { type: 'PROJECT_REQUEST_CREATE'; request: ProjectRequest }
  | { type: 'PROJECT_REQUEST_REVIEW'; id: string; approve: boolean; note?: string }
  | { type: 'TASK_ADD'; task: Task }
  | { type: 'TASK_UPDATE'; task: Task }
  | { type: 'TASK_DELETE'; id: string }
  | { type: 'TASK_MOVE'; id: string; status: Task['status'] }
  | { type: 'CHECKLIST_TOGGLE'; id: string }
  | { type: 'CHECKLIST_ADD'; id: string; taskId: string; title: string }
  | { type: 'CHECKLIST_DELETE'; id: string }
  | { type: 'COMMENT_ADD'; id: string; taskId: string; body: string }
  | { type: 'COMMENT_DELETE'; id: string }
  | { type: 'DEPENDENCY_ADD'; id: string; taskId: string; dependsOnId: string }
  | { type: 'DEPENDENCY_DELETE'; id: string }
  | { type: 'NOTIF_READ'; id: string }
  | { type: 'NOTIF_READ_ALL' }
  | { type: 'USER_ADD'; email: string; role: WorkspaceRole }
  | { type: 'USER_UPDATE_ROLE'; id: string; role: WorkspaceRole }
  | { type: 'USER_UPDATE_PROFILE'; id: string; name: string; title: string }
  | { type: 'WORKSPACE_UPDATE'; name: string; timezone: string }
  | { type: 'DOC_ADD'; title: string; content: string; projectId?: string; fileUrl?: string; fileName?: string; fileSize?: number; fileType?: string }
  | { type: 'DOC_UPDATE'; id: string; title: string; content: string }
  | { type: 'DOC_DELETE'; id: string };

/**
 * Action nội bộ: gồm Action đã được `persistAction` làm giàu
 * (kèm log/user/doc/task đã ghi xuống DB) + các action vòng đời session.
 */
export type RichAction =
  | (Action & {
      log?: ActivityLog;
      user?: User;
      doc?: Document;
      task?: Task;
      project?: Project;
      request?: ProjectRequest;
      projectDeletedId?: string;
    })
  | { type: 'HYDRATE'; bundle: WorkspaceBundle; userId: string }
  | { type: 'SESSION_END' }
  | { type: 'BOOT_DONE' }
  | { type: 'BOOT_CONFIG_ERROR' };

const THEME_KEY = 'nexus-theme';
const SIDEBAR_KEY = 'nexus-sidebar-collapsed';
const WORKSPACE_KEY = 'nexus-workspace-id';

function readTheme(): 'light' | 'dark' {
  try {
    return (localStorage.getItem(THEME_KEY) as 'light' | 'dark' | null) ?? 'light';
  } catch {
    return 'light';
  }
}

function emptyState(): AppState {
  let sidebarCollapsed = false;
  try {
    sidebarCollapsed = localStorage.getItem(SIDEBAR_KEY) === '1';
  } catch { /* ignore */ }
  return {
    authed: false,
    loading: true,
    configError: false,
    workspace: { id: '', name: '', timezone: 'Asia/Ho_Chi_Minh' },
    workspaces: [],
    users: [],
    currentUserId: '',
    labels: [],
    projects: [],
    tasks: [],
    checklists: [],
    comments: [],
    dependencies: [],
    attachments: [],
    notifications: [],
    activityLogs: [],
    documents: [],
    projectRequests: [],
    theme: readTheme(),
    sidebarCollapsed,
  };
}

function withLog(logs: ActivityLog[], log?: ActivityLog): ActivityLog[] {
  return log ? [log, ...logs].slice(0, 200) : logs;
}

function reducer(state: AppState, action: RichAction): AppState {
  switch (action.type) {
    case 'HYDRATE':
      return {
        ...state,
        authed: true,
        loading: false,
        workspace: action.bundle.workspace,
        workspaces: action.bundle.workspaces,
        users: action.bundle.users,
        currentUserId: action.userId,
        labels: action.bundle.labels,
        projects: action.bundle.projects,
        tasks: action.bundle.tasks,
        checklists: action.bundle.checklists,
        comments: action.bundle.comments,
        dependencies: action.bundle.dependencies,
        attachments: action.bundle.attachments,
        notifications: action.bundle.notifications,
        activityLogs: action.bundle.activityLogs,
        documents: action.bundle.documents,
        projectRequests: action.bundle.projectRequests,
      };
    case 'SESSION_END':
      return { ...emptyState(), loading: false, theme: state.theme };
    case 'BOOT_DONE':
      return { ...state, loading: false };
    case 'BOOT_CONFIG_ERROR':
      return { ...state, loading: false, configError: true };
    case 'SET_THEME':
      return { ...state, theme: action.theme };
    case 'TOGGLE_SIDEBAR':
      return { ...state, sidebarCollapsed: !state.sidebarCollapsed };
    case 'PROJECT_ADD':
      return {
        ...state,
        projects: [action.project, ...state.projects],
        activityLogs: withLog(state.activityLogs, action.log),
      };
    case 'PROJECT_UPDATE':
      return {
        ...state,
        projects: state.projects.map((p) =>
          p.id === action.project.id ? { ...action.project, updatedAt: new Date().toISOString() } : p),
        activityLogs: withLog(state.activityLogs, action.log),
      };
    case 'PROJECT_DELETE':
      return { ...state, projects: state.projects.filter((p) => p.id !== action.id) };
    case 'PROJECT_REQUEST_CREATE':
      return {
        ...state,
        projectRequests: [action.request, ...state.projectRequests],
        activityLogs: withLog(state.activityLogs, action.log),
      };
    case 'PROJECT_JOIN_REQUEST':
      return action.request
        ? { ...state, projectRequests: [action.request, ...state.projectRequests] }
        : state;
    case 'PROJECT_REQUEST_REVIEW': {
      let projects = state.projects;
      if (action.project) {
        projects = projects.some((p) => p.id === action.project!.id)
          ? projects.map((p) => (p.id === action.project!.id ? action.project! : p))
          : [action.project!, ...projects];
      }
      if (action.projectDeletedId) {
        const delId = action.projectDeletedId;
        projects = projects.filter((p) => p.id !== delId);
      }
      return {
        ...state,
        projects,
        projectRequests: state.projectRequests.map((r) => (r.id === action.request!.id ? action.request! : r)),
        activityLogs: withLog(state.activityLogs, action.log),
      };
    }
    case 'TASK_ADD':
      return {
        ...state,
        tasks: [action.task, ...state.tasks],
        activityLogs: withLog(state.activityLogs, action.log),
      };
    case 'TASK_UPDATE': {
      const task = action.task;
      return {
        ...state,
        tasks: state.tasks.map((t) => (t.id === task.id ? { ...task, updatedAt: new Date().toISOString() } : t)),
        activityLogs: withLog(state.activityLogs, action.log),
      };
    }
    case 'TASK_DELETE':
      return {
        ...state,
        tasks: state.tasks.filter((t) => t.id !== action.id),
        checklists: state.checklists.filter((c) => c.taskId !== action.id),
        comments: state.comments.filter((c) => c.taskId !== action.id),
        dependencies: state.dependencies.filter((d) => d.taskId !== action.id && d.dependsOnId !== action.id),
      };
    case 'TASK_MOVE': {
      const task = state.tasks.find((t) => t.id === action.id);
      if (!task) return state;
      const updated: Task = {
        ...task,
        status: action.status,
        updatedAt: new Date().toISOString(),
        completedAt: action.status === 'done' ? new Date().toISOString() : undefined,
      };
      return {
        ...state,
        tasks: state.tasks.map((t) => (t.id === action.id ? updated : t)),
        activityLogs: withLog(state.activityLogs, action.log),
      };
    }
    case 'CHECKLIST_TOGGLE':
      return { ...state, checklists: state.checklists.map((c) => (c.id === action.id ? { ...c, done: !c.done } : c)) };
    case 'CHECKLIST_ADD':
      return {
        ...state,
        checklists: [...state.checklists, { id: action.id, taskId: action.taskId, title: action.title, done: false }],
      };
    case 'CHECKLIST_DELETE':
      return { ...state, checklists: state.checklists.filter((c) => c.id !== action.id) };
    case 'COMMENT_ADD':
      return {
        ...state,
        comments: [
          ...state.comments,
          { id: action.id, taskId: action.taskId, authorId: state.currentUserId, body: action.body, createdAt: new Date().toISOString() },
        ],
        activityLogs: withLog(state.activityLogs, action.log),
      };
    case 'COMMENT_DELETE':
      return { ...state, comments: state.comments.filter((c) => c.id !== action.id) };
    case 'DEPENDENCY_ADD': {
      const exists = state.dependencies.some((d) => d.taskId === action.taskId && d.dependsOnId === action.dependsOnId);
      if (exists || action.taskId === action.dependsOnId) return state;
      return {
        ...state,
        dependencies: [...state.dependencies, { id: action.id, taskId: action.taskId, dependsOnId: action.dependsOnId }],
      };
    }
    case 'DEPENDENCY_DELETE':
      return { ...state, dependencies: state.dependencies.filter((d) => d.id !== action.id) };
    case 'NOTIF_READ':
      return { ...state, notifications: state.notifications.map((n) => (n.id === action.id ? { ...n, read: true } : n)) };
    case 'NOTIF_READ_ALL':
      return { ...state, notifications: state.notifications.map((n) => ({ ...n, read: true })) };
    case 'USER_ADD':
      return action.user ? { ...state, users: [...state.users, action.user] } : state;
    case 'USER_UPDATE_ROLE':
      return { ...state, users: state.users.map((u) => (u.id === action.id ? { ...u, role: action.role } : u)) };
    case 'USER_UPDATE_PROFILE':
      return { ...state, users: state.users.map((u) => (u.id === action.id ? { ...u, name: action.name, title: action.title } : u)) };
    case 'WORKSPACE_UPDATE':
      return { ...state, workspace: { ...state.workspace, name: action.name, timezone: action.timezone } };
    case 'DOC_ADD':
      return action.doc ? { ...state, documents: [action.doc, ...state.documents] } : state;
    case 'DOC_UPDATE':
      return {
        ...state,
        documents: state.documents.map((x) =>
          x.id === action.id ? { ...x, title: action.title, content: action.content, updatedAt: new Date().toISOString() } : x),
      };
    case 'DOC_DELETE':
      return { ...state, documents: state.documents.filter((x) => x.id !== action.id) };
    default:
      return state;
  }
}

interface AppContextValue {
  state: AppState;
  dispatch: (action: Action) => Promise<boolean>;
  signOut: () => Promise<void>;
  /** Tải lại toàn bộ dữ liệu workspace từ Supabase (dùng cho nút tải lại / realtime). */
  refresh: () => Promise<void>;
  loginDev?: (email: string) => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, baseDispatch] = useReducer(reducer, undefined, emptyState);
  const stateRef = useRef(state);
  stateRef.current = state;
  const ctxRef = useRef<PersistContext | null>(null);
  const loadedRef = useRef(false);

  /** Nạp workspace đang hoạt động cho user (tự bootstrap nếu là tài khoản mới). */
  const loadForUser = useCallback(async (userId: string, userName: string) => {
    const sb = getSupabase();
    let memberships = await fetchMyMemberships(sb, userId);
    if (memberships.length === 0) {
      await bootstrapWorkspace(sb);
      memberships = await fetchMyMemberships(sb, userId);
      if (memberships.length === 0) throw new Error('Không tạo được workspace cho tài khoản mới.');
    }
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(WORKSPACE_KEY);
    } catch { /* ignore */ }
    const active = memberships.find((m) => m.workspaceId === saved) ?? memberships[0];
    const isSuperAdmin = await fetchIsSuperAdmin(sb, userId);
    ctxRef.current = { workspaceId: active.workspaceId, userId, userName, isSuperAdmin };
    const bundle = await loadWorkspaceData(sb, userId, active.workspaceId, isSuperAdmin);
    try {
      localStorage.setItem(WORKSPACE_KEY, active.workspaceId);
    } catch { /* ignore */ }

    // Đồng bộ tên hiển thị & avatar Discord vào user hiện tại trong bundle.users
    let discordUsername: string | null = null;
    let discordServerName: string | null = null;
    let discordAvatarUrl: string | null = null;
    try {
      discordUsername =
        localStorage.getItem('nexus_discord_username') || sessionStorage.getItem('nexus_discord_username');
      discordServerName =
        localStorage.getItem('nexus_discord_server_name') || sessionStorage.getItem('nexus_discord_server_name');
      discordAvatarUrl =
        localStorage.getItem('nexus_discord_avatar_url') || sessionStorage.getItem('nexus_discord_avatar_url');
    } catch { /* ignore */ }
    const finalName = discordServerName || userName;
    bundle.users = bundle.users.map((u) => {
      if (u.id === userId) {
        const cleanUsername = discordUsername
          ? (discordUsername.toLowerCase() === 'trantuongvan' ? '_trantuongvan' : discordUsername)
          : u.username;
        return {
          ...u,
          name: finalName || u.name,
          username: cleanUsername,
          avatarUrl: discordAvatarUrl || u.avatarUrl,
        };
      }
      return u;
    });

    baseDispatch({ type: 'HYDRATE', bundle, userId });
  }, []);

  /** Tải lại toàn bộ dữ liệu workspace (giữ nguyên theme/sidebar và dữ liệu Discord profile). */
  const refresh = useCallback(async () => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    const sb = getSupabase();
    const bundle = await loadWorkspaceData(sb, ctx.userId, ctx.workspaceId);

    // Đồng bộ tên hiển thị & avatar Discord vào user hiện tại trong bundle.users
    let discordUsername: string | null = null;
    let discordServerName: string | null = null;
    let discordAvatarUrl: string | null = null;
    try {
      discordUsername =
        localStorage.getItem('nexus_discord_username') || sessionStorage.getItem('nexus_discord_username');
      discordServerName =
        localStorage.getItem('nexus_discord_server_name') || sessionStorage.getItem('nexus_discord_server_name');
      discordAvatarUrl =
        localStorage.getItem('nexus_discord_avatar_url') || sessionStorage.getItem('nexus_discord_avatar_url');
    } catch { /* ignore */ }
    const finalName = discordServerName || ctx.userName;
    bundle.users = bundle.users.map((u) => {
      if (u.id === ctx.userId) {
        const cleanUsername = discordUsername
          ? (discordUsername.toLowerCase() === 'trantuongvan' ? '_trantuongvan' : discordUsername)
          : u.username;
        return {
          ...u,
          name: finalName || u.name,
          username: cleanUsername,
          avatarUrl: discordAvatarUrl || u.avatarUrl,
        };
      }
      return u;
    });

    baseDispatch({ type: 'HYDRATE', bundle, userId: ctx.userId });
  }, []);

  // Khởi tạo session + lắng nghe thay đổi auth
  useEffect(() => {
    if (!isSupabaseConfigured) {
      baseDispatch({ type: 'BOOT_CONFIG_ERROR' });
      return;
    }
    const sb = getSupabase();
    let cancelled = false;

    /**
     * Kiểm tra xem tài khoản đăng nhập qua Discord có thuộc Discord Server nội bộ hay không.
     * Nếu không thuộc: sign out ngay, lưu lý do vào sessionStorage và từ chối cấp quyền.
     */
    const checkDiscordGatekeeper = async (
      session: {
        user: { id: string; app_metadata?: { provider?: string }; identities?: Array<{ provider: string }> };
        provider_token?: string | null;
      },
    ): Promise<boolean> => {
      const isDiscordUser =
        session.user.app_metadata?.provider === 'discord' ||
        session.user.identities?.some((id) => id.provider === 'discord');

      if (!isDiscordUser) return true;

      let providerToken = session.provider_token || extractStoredProviderToken();
      if (providerToken) {
        persistProviderToken(providerToken);
      }

      if (providerToken) {
        const { allowed, reason } = await verifyDiscordGuildMembership(providerToken);
        if (!allowed) {
          try {
            sessionStorage.setItem('nexus_auth_error', reason || 'Tài khoản Discord không thuộc Server nội bộ.');
            sessionStorage.removeItem(`discord_verified_${session.user.id}`);
          } catch { /* ignore */ }
          try {
            await sb.auth.signOut();
          } catch { /* ignore */ }
          return false;
        } else {
          try {
            sessionStorage.setItem(`discord_verified_${session.user.id}`, 'true');
          } catch { /* ignore */ }
          return true;
        }
      }

      try {
        const isVerified = sessionStorage.getItem(`discord_verified_${session.user.id}`) === 'true';
        if (isVerified) return true;
      } catch { /* ignore */ }

      return true;
    };

    let isProcessing = false;

    const processSession = async (
      session: {
        user: { id: string; email?: string; app_metadata?: { provider?: string }; identities?: Array<{ provider: string; id?: string; identity_data?: Record<string, unknown> }>; user_metadata?: Record<string, unknown> };
        provider_token?: string | null;
      } | null,
    ) => {
      if (cancelled || isProcessing || loadedRef.current) return;
      if (!session) {
        baseDispatch({ type: 'BOOT_DONE' });
        return;
      }

      isProcessing = true;
      try {
        let providerToken = session.provider_token || extractStoredProviderToken();
        if (providerToken) {
          persistProviderToken(providerToken);
        }

        const allowed = await checkDiscordGatekeeper(session);
        if (!allowed) {
          loadedRef.current = false;
          ctxRef.current = null;
          baseDispatch({ type: 'SESSION_END' });
          return;
        }

        // Tự động đồng bộ tên hiển thị (ưu tiên tên riêng trong server BCN) & avatar Discord vào public.profiles
        const { name: displayName } = await syncDiscordProfile(sb, session.user, providerToken);

        loadedRef.current = true;
        await loadForUser(session.user.id, displayName || getDiscordDisplayName(session.user));
      } catch (e) {
        console.error('Không tải được dữ liệu:', e);
        baseDispatch({ type: 'BOOT_DONE' });
      } finally {
        isProcessing = false;
      }
    };

    (async () => {
      try {
        const { data: { session }, error } = await sb.auth.getSession();
        if (error) throw error;
        if (cancelled) return;
        await processSession(session);
      } catch (e) {
        console.error('Không tải được dữ liệu:', e);
        if (!cancelled) baseDispatch({ type: 'BOOT_DONE' });
      }
    })();

    const { data: { subscription } } = sb.auth.onAuthStateChange(async (event, session) => {
      if (cancelled) return;
      if (event === 'SIGNED_OUT') {
        loadedRef.current = false;
        ctxRef.current = null;
        baseDispatch({ type: 'SESSION_END' });
      } else if (session && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')) {
        await processSession(session);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [loadForUser]);

  // Theme + sidebar: áp class dark và lưu localStorage
  useEffect(() => {
    document.documentElement.classList.toggle('dark', state.theme === 'dark');
    try {
      localStorage.setItem(THEME_KEY, state.theme);
      localStorage.setItem(SIDEBAR_KEY, state.sidebarCollapsed ? '1' : '0');
    } catch { /* ignore */ }
  }, [state.theme, state.sidebarCollapsed]);

  /**
   * Đồng bộ realtime: khi có thay đổi trên Supabase (từ chính mình ở tab khác
   * hay từ thành viên khác), tự tải lại dữ liệu workspace sau một nhịp debounce.
   * RLS đảm bảo chỉ nhận sự kiện của những dòng mình được phép xem.
   */
  useEffect(() => {
    const ctx = ctxRef.current;
    if (!state.authed || !ctx) return;
    const sb = getSupabase();
    let timer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    const scheduleRefresh = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        if (!cancelled) refresh().catch((e) => console.error('Realtime refresh thất bại:', e));
      }, 1200);
    };

    const channel = sb
      .channel(`workspace:${ctx.workspaceId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'project_requests' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_logs' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'documents' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'workspace_members' }, scheduleRefresh)
      .subscribe();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      sb.removeChannel(channel);
    };
  }, [state.authed, refresh]);

/**
 * Quy tắc duyệt nhiệm vụ: task đang ở trạng thái "Chờ duyệt" (in_review)
 * thì chỉ Admin hoặc Leader của dự án chứa task đó mới được chuyển sang
 * trạng thái khác (duyệt → "Hoàn thành", hoặc trả về "Đang thực hiện"/"Cần thực hiện").
 * Thành viên thường vẫn được đưa task vào "Chờ duyệt" (gửi yêu cầu duyệt).
 * Ném Error để dispatch hiện toast và giữ nguyên trạng thái.
 */
function assertApprovalPermission(state: AppState, action: Action): void {
  if (action.type !== 'TASK_MOVE' && action.type !== 'TASK_UPDATE') return;
  const taskId = action.type === 'TASK_MOVE' ? action.id : action.task.id;
  const nextStatus = action.type === 'TASK_MOVE' ? action.status : action.task.status;
  const prev = state.tasks.find((t) => t.id === taskId);
  if (!prev || prev.status !== 'in_review' || nextStatus === 'in_review') return;
  const me = state.users.find((u) => u.id === state.currentUserId);
  const project = state.projects.find((p) => p.id === prev.projectId);
  const isLeader = project ? isProjectLeader(project, state.currentUserId) : false;
  if (!me || !canReviewTaskForProject(me.role, me.isSuperAdmin ?? false, isLeader)) {
    throw new Error('Nhiệm vụ đang chờ duyệt nghiệm thu — chỉ Admin hoặc Chủ dự án mới được duyệt hoàn thành hoặc trả về.');
  }
}

/**
 * Quy tắc quyền trong dự án:
 * Người dùng chỉ có quyền tạo task, sửa task, bình luận, checklist trong các dự án
 * mà mình là Member hoặc Leader (hoặc tài khoản là Admin / Admin tổng).
 * Đối với các dự án khác, người dùng không có quyền can thiệp.
 */
function assertProjectMembership(state: AppState, action: Action): void {
  const me = state.users.find((u) => u.id === state.currentUserId);
  if (!me || me.role === 'admin' || me.isSuperAdmin) return; // Admin có toàn quyền ở mọi dự án

  let targetProjectId: string | undefined;

  if (action.type === 'TASK_ADD') {
    targetProjectId = action.task.projectId;
  } else if (action.type === 'TASK_MOVE' || action.type === 'TASK_DELETE') {
    const task = state.tasks.find((t) => t.id === action.id);
    targetProjectId = task?.projectId;
  } else if (action.type === 'TASK_UPDATE') {
    targetProjectId = action.task.projectId;
  } else if (action.type === 'COMMENT_ADD') {
    const task = state.tasks.find((t) => t.id === action.taskId);
    targetProjectId = task?.projectId;
  } else if (action.type === 'CHECKLIST_ADD' || action.type === 'CHECKLIST_TOGGLE' || action.type === 'CHECKLIST_DELETE') {
    const cl = state.checklists.find((c) => c.id === action.id);
    const taskId = action.type === 'CHECKLIST_ADD' ? action.taskId : cl?.taskId;
    const task = state.tasks.find((t) => t.id === taskId);
    targetProjectId = task?.projectId;
  } else if (action.type === 'PROJECT_UPDATE') {
    targetProjectId = action.project.id;
  }

  if (!targetProjectId) return;

  const proj = state.projects.find((p) => p.id === targetProjectId);
  if (!proj) return;

  const isLeader = proj.managerId === state.currentUserId;
  const isMember = proj.memberIds.includes(state.currentUserId);

  if (action.type === 'PROJECT_UPDATE' && !isLeader) {
    throw new Error('Chỉ Admin hoặc Chủ dự án mới được chỉnh sửa dự án này.');
  }

  if (!isLeader && !isMember) {
    throw new Error('Bạn không phải thành viên của dự án này nên không có quyền thao tác.');
  }
}

/**
 * Quy tắc phê duyệt dự án: Member gửi yêu cầu tạo dự án để Admin duyệt.
 * Người gửi yêu cầu khi được duyệt sẽ làm Leader (Chủ dự án) của dự án đó.
 * Chỉ Admin được duyệt hoặc từ chối yêu cầu.
 * Đổi trạng thái dự án (tạm dừng/lưu trữ/...) chỉ Leader của dự án đó + Admin
 * làm trực tiếp — thành viên khác không gửi yêu cầu tạm dừng/xóa nữa.
 */
function assertProjectPermission(state: AppState, action: Action): void {
  const me = state.users.find((u) => u.id === state.currentUserId);
  const role = me?.role ?? 'member';
  const isSuperAdmin = me?.isSuperAdmin ?? false;

  // Duyệt / từ chối yêu cầu: Admin (hoặc Admin tổng) duyệt mọi loại yêu cầu;
  // riêng đơn xin tham gia dự án (`join_project`) do Leader của dự án đó duyệt.
  if (action.type === 'PROJECT_REQUEST_REVIEW' && !canReviewProjectRequests(role, isSuperAdmin)) {
    const req = state.projectRequests.find((r) => r.id === action.id);
    const proj = req?.projectId ? state.projects.find((p) => p.id === req.projectId) : undefined;
    const isJoinLeader = req?.type === 'join_project' && proj?.managerId === state.currentUserId;
    if (!isJoinLeader) {
      throw new Error('Chỉ Admin mới được duyệt yêu cầu.');
    }
  }
  // Member gửi yêu cầu tạo dự án; yêu cầu tạm dừng/xóa (nếu còn) phải là Leader của dự án đó.
  if (action.type === 'PROJECT_REQUEST_CREATE') {
    if (action.request.projectId) {
      const proj = state.projects.find((p) => p.id === action.request.projectId);
      const isLeader = proj ? isProjectLeader(proj, state.currentUserId) : false;
      if (!isLeader && !canDirectProjectAction(role, isSuperAdmin)) {
        throw new Error('Chỉ Chủ dự án mới được gửi yêu cầu cho dự án này.');
      }
    } else if (!canRequestProjects(role)) {
      throw new Error('Chỉ thành viên workspace mới được gửi yêu cầu tạo dự án.');
    }
  }
  // Admin làm trực tiếp, không cần qua duyệt.
  if (canDirectProjectAction(role, isSuperAdmin)) return;

  if (action.type === 'PROJECT_ADD') {
    throw new Error('Bạn cần gửi yêu cầu tạo dự án để Admin phê duyệt.');
  }
  if (action.type === 'PROJECT_DELETE') {
    throw new Error('Chỉ Admin hoặc Chủ dự án mới được xóa dự án này.');
  }
  if (action.type === 'PROJECT_UPDATE') {
    const prev = state.projects.find((p) => p.id === action.project.id);
    if (prev && prev.status !== 'paused' && action.project.status === 'paused' && !isProjectLeader(prev, state.currentUserId)) {
      throw new Error('Chỉ Admin hoặc Chủ dự án mới được tạm dừng dự án này.');
    }
  }
}

/** Phân quyền quản lý thành viên: chỉ Admin được thêm thành viên / gán vai trò. */
function assertMemberPermission(state: AppState, action: Action): void {
  if (action.type !== 'USER_UPDATE_ROLE' && action.type !== 'USER_ADD') return;
  const me = state.users.find((u) => u.id === state.currentUserId);
  const role = me?.role ?? 'member';
  if (!canManageMembers(role)) {
    throw new Error('Chỉ Admin mới được quản lý thành viên.');
  }
  const targetRole = action.role;
  if (!assignableRoles(role).includes(targetRole)) {
    throw new Error('Bạn không được phép gán vai trò này.');
  }
}

  const dispatch = useCallback(async (action: Action): Promise<boolean> => {
    // SET_THEME / TOGGLE_SIDEBAR chỉ là trạng thái giao diện cục bộ
    if (action.type === 'SET_THEME' || action.type === 'TOGGLE_SIDEBAR') {
      baseDispatch(action);
      return true;
    }
    const ctx = ctxRef.current;
    if (!ctx) return false;
    try {
      assertApprovalPermission(stateRef.current, action);
      assertProjectPermission(stateRef.current, action);
      assertMemberPermission(stateRef.current, action);
      assertProjectMembership(stateRef.current, action);
      const enriched = await persistAction(getSupabase(), ctx, stateRef.current, action);
      baseDispatch(enriched);
      return true;
    } catch (e) {
      toast('Không thể lưu thay đổi', e instanceof Error ? e.message : 'Đã xảy ra lỗi.', 'error');
      return false;
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await getSupabase().auth.signOut();
    } catch {
      /* auth listener sẽ dọn state qua SESSION_END */
    }
  }, []);

  const loginDev = useCallback(async (email: string) => {
    const bundle = createMockWorkspaceBundle(email);
    const userId = bundle.users[0]?.id || 'usr-admin-01';
    baseDispatch({ type: 'HYDRATE', bundle, userId });
  }, []);

  const value = useMemo(
    () => ({ state, dispatch, signOut, refresh, loginDev }),
    [state, dispatch, signOut, refresh, loginDev],
  );
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

export function useCurrentUser(): User {
  const { state } = useApp();
  const found = state.users.find((u) => u.id === state.currentUserId);
  let cachedUsername: string | undefined;
  let cachedServerName: string | undefined;
  let cachedAvatarUrl: string | undefined;
  if (typeof localStorage !== 'undefined') {
    try {
      cachedUsername =
        localStorage.getItem('nexus_discord_username') ||
        sessionStorage.getItem('nexus_discord_username') ||
        undefined;
      cachedServerName =
        localStorage.getItem('nexus_discord_server_name') ||
        sessionStorage.getItem('nexus_discord_server_name') ||
        undefined;
      cachedAvatarUrl =
        localStorage.getItem('nexus_discord_avatar_url') ||
        sessionStorage.getItem('nexus_discord_avatar_url') ||
        undefined;
    } catch { /* ignore */ }
  }

  // Priority: Discord cached username > found.username > email prefix
  let resolvedUsername = cachedUsername || found?.username;
  if (!resolvedUsername && found?.email) {
    const prefix = found.email.split('@')[0];
    resolvedUsername = prefix.toLowerCase() === 'trantuongvan' ? '_trantuongvan' : prefix;
  }
  if (resolvedUsername?.toLowerCase() === 'trantuongvan') {
    resolvedUsername = '_trantuongvan';
  }

  const resolvedName = cachedServerName || found?.name || '—';
  const resolvedAvatarUrl = cachedAvatarUrl || found?.avatarUrl;

  if (found) {
    return {
      ...found,
      name: resolvedName,
      username: resolvedUsername,
      avatarUrl: resolvedAvatarUrl,
    };
  }

  return {
    id: state.currentUserId,
    name: resolvedName,
    email: '',
    title: '',
    role: 'member',
    status: 'active',
    username: resolvedUsername,
    avatarUrl: resolvedAvatarUrl,
  };
}

/* ---------- selectors (giữ nguyên để components không phải sửa) ---------- */
export function projectTasks(tasks: Task[], projectId: string): Task[] {
  return tasks.filter((t) => t.projectId === projectId);
}

export function projectProgress(tasks: Task[], projectId: string): number {
  const list = projectTasks(tasks, projectId);
  if (list.length === 0) return 0;
  const done = list.filter((t) => t.status === 'done').length;
  return Math.round((done / list.length) * 100);
}

export function taskById(tasks: Task[], id?: string | null): Task | undefined {
  return tasks.find((t) => t.id === id);
}

export function userById(users: User[], id: string) {
  return users.find((u) => u.id === id);
}

export function projectById(projects: Project[], id?: string | null) {
  return projects.find((p) => p.id === id);
}
