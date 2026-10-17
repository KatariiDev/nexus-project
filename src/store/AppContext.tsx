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
  canReviewTasks,
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
  | { type: 'DOC_ADD'; title: string; content: string; projectId?: string }
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
  dispatch: (action: Action) => Promise<void>;
  signOut: () => Promise<void>;
  loginDev: (nameOrEmail?: string) => void;
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
    ctxRef.current = { workspaceId: active.workspaceId, userId, userName };
    const bundle = await loadWorkspaceData(sb, userId, active.workspaceId);
    try {
      localStorage.setItem(WORKSPACE_KEY, active.workspaceId);
    } catch { /* ignore */ }

    // Đồng bộ tên hiển thị & username Discord vào user hiện tại trong bundle.users
    let discordUsername: string | null = null;
    let discordServerName: string | null = null;
    try {
      discordUsername =
        localStorage.getItem('nexus_discord_username') || sessionStorage.getItem('nexus_discord_username');
      discordServerName =
        localStorage.getItem('nexus_discord_server_name') || sessionStorage.getItem('nexus_discord_server_name');
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
        };
      }
      return u;
    });

    baseDispatch({ type: 'HYDRATE', bundle, userId });
  }, []);

  /** Đăng nhập ở chế độ nội bộ / xem trước khi chưa kết nối Supabase */
  const loginDev = useCallback((nameOrEmail = 'Dev Admin') => {
    const isEmail = nameOrEmail.includes('@');
    const name = isEmail ? nameOrEmail.split('@')[0] : nameOrEmail;
    const email = isEmail ? nameOrEmail : `${name.toLowerCase()}@nexus.internal`;
    const bundle = createMockWorkspaceBundle(name, email);
    const userId = bundle.users[0].id;
    try {
      localStorage.setItem('nexus-dev-session', JSON.stringify({ name, email }));
    } catch { /* ignore */ }
    ctxRef.current = { workspaceId: bundle.workspace.id, userId, userName: name };
    baseDispatch({ type: 'HYDRATE', bundle, userId });
  }, []);

  // Khởi tạo session + lắng nghe thay đổi auth
  useEffect(() => {
    // Kiểm tra xem có phiên đăng nhập xem trước nội bộ được lưu không
    let devSession: { name: string; email: string } | null = null;
    try {
      const saved = localStorage.getItem('nexus-dev-session');
      if (saved) devSession = JSON.parse(saved);
    } catch { /* ignore */ }

    if (!isSupabaseConfigured) {
      if (devSession) {
        const bundle = createMockWorkspaceBundle(devSession.name, devSession.email);
        const userId = bundle.users[0].id;
        ctxRef.current = { workspaceId: bundle.workspace.id, userId, userName: devSession.name };
        baseDispatch({ type: 'HYDRATE', bundle, userId });
      } else {
        baseDispatch({ type: 'BOOT_DONE' });
      }
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
        console.error('Không tải được session ban đầu:', e);
        if (!cancelled) baseDispatch({ type: 'BOOT_DONE' });
      }
    })();

    const { data: { subscription } } = sb.auth.onAuthStateChange(async (event, session) => {
      if (cancelled) return;
      if (event === 'SIGNED_OUT') {
        loadedRef.current = false;
        ctxRef.current = null;
        try {
          sessionStorage.clear();
        } catch { /* ignore */ }
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
 * Quy tắc duyệt nhiệm vụ: task đang ở trạng thái "Chờ duyệt" (in_review)
 * thì chỉ Owner/Admin mới được chuyển sang trạng thái khác
 * (duyệt → "Hoàn thành", hoặc trả về "Đang thực hiện"/"Cần thực hiện").
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
  if (!me || !canReviewTasks(me.role)) {
    throw new Error('Nhiệm vụ đang chờ duyệt — chỉ Admin/Owner mới được duyệt hoặc trả về.');
  }
}

/**
 * Quy tắc phê duyệt dự án: thành viên thường không được tự tạo / tạm dừng /
 * xóa dự án — phải gửi yêu cầu để Owner/Admin duyệt. Chỉ Owner/Admin được
 * duyệt hoặc từ chối yêu cầu.
 */
function assertProjectPermission(state: AppState, action: Action): void {
  const me = state.users.find((u) => u.id === state.currentUserId);
  const role = me?.role ?? 'viewer';

  // Chỉ Admin được duyệt / từ chối yêu cầu.
  if (action.type === 'PROJECT_REQUEST_REVIEW' && !canReviewProjectRequests(role)) {
    throw new Error('Chỉ Admin mới được duyệt yêu cầu.');
  }
  // Chỉ Owner (và Admin) được gửi yêu cầu.
  if (action.type === 'PROJECT_REQUEST_CREATE' && !canRequestProjects(role)) {
    throw new Error('Chỉ Owner mới được gửi yêu cầu đến Admin.');
  }
  // Admin làm trực tiếp, không cần qua duyệt.
  if (canDirectProjectAction(role)) return;

  if (action.type === 'PROJECT_ADD') {
    throw new Error(
      role === 'owner'
        ? 'Bạn cần gửi yêu cầu tạo dự án để Admin phê duyệt.'
        : 'Chỉ Owner mới được gửi yêu cầu tạo dự án.',
    );
  }
  if (action.type === 'PROJECT_DELETE') {
    throw new Error(
      role === 'owner'
        ? 'Bạn cần gửi yêu cầu xóa dự án để Admin phê duyệt.'
        : 'Chỉ Owner mới được gửi yêu cầu xóa dự án.',
    );
  }
  if (action.type === 'PROJECT_UPDATE') {
    const prev = state.projects.find((p) => p.id === action.project.id);
    if (prev && prev.status !== 'paused' && action.project.status === 'paused') {
      throw new Error(
        role === 'owner'
          ? 'Bạn cần gửi yêu cầu tạm dừng dự án để Admin phê duyệt.'
          : 'Chỉ Owner mới được gửi yêu cầu tạm dừng dự án.',
      );
    }
  }
}

/**
 * Phân quyền quản lý thành viên: Owner chỉ được phân công
 * Manager/Member/Viewer; chỉ Admin được gán vai trò Owner/Admin.
 */
function assertMemberPermission(state: AppState, action: Action): void {
  if (action.type !== 'USER_UPDATE_ROLE' && action.type !== 'USER_ADD') return;
  const me = state.users.find((u) => u.id === state.currentUserId);
  const role = me?.role ?? 'viewer';
  if (!canManageMembers(role)) {
    throw new Error('Chỉ Owner/Admin mới được quản lý thành viên.');
  }
  const targetRole = action.role;
  if (!assignableRoles(role).includes(targetRole)) {
    throw new Error('Bạn không được phép gán vai trò này.');
  }
}

  const dispatch = useCallback(async (action: Action) => {
    // SET_THEME / TOGGLE_SIDEBAR chỉ là trạng thái giao diện cục bộ
    if (action.type === 'SET_THEME' || action.type === 'TOGGLE_SIDEBAR') {
      baseDispatch(action);
      return;
    }
    // Khi đang chạy preview mà chưa có Supabase, cập nhật state trực tiếp
    if (!isSupabaseConfigured) {
      baseDispatch(action as RichAction);
      return;
    }
    const ctx = ctxRef.current;
    if (!ctx) return;
    try {
      assertApprovalPermission(stateRef.current, action);
      assertProjectPermission(stateRef.current, action);
      assertMemberPermission(stateRef.current, action);
      const enriched = await persistAction(getSupabase(), ctx, stateRef.current, action);
      baseDispatch(enriched);
    } catch (e) {
      toast('Không thể lưu thay đổi', e instanceof Error ? e.message : 'Đã xảy ra lỗi.', 'error');
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      localStorage.removeItem('nexus-dev-session');
      sessionStorage.clear();
    } catch { /* ignore */ }
    if (isSupabaseConfigured) {
      try {
        await getSupabase().auth.signOut();
      } catch {
        /* auth listener sẽ dọn state qua SESSION_END */
      }
    }
    loadedRef.current = false;
    ctxRef.current = null;
    baseDispatch({ type: 'SESSION_END' });
  }, []);

  const value = useMemo(
    () => ({ state, dispatch, signOut, loginDev }),
    [state, dispatch, signOut, loginDev],
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

  if (found) {
    return {
      ...found,
      name: resolvedName,
      username: resolvedUsername,
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
