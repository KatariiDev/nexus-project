import React, { createContext, useContext, useEffect, useMemo, useReducer } from 'react';
import type { SeedData } from '../data/seed';
import { buildSeed } from '../data/seed';
import type { ActivityLog, Notification, Project, Task } from '../types';
import { genId } from '../lib/utils';

export interface AppState extends SeedData {
  authed: boolean;
  theme: 'light' | 'dark';
  sidebarCollapsed: boolean;
}

type Action =
  | { type: 'AUTH_LOGIN'; userId: string }
  | { type: 'AUTH_LOGOUT' }
  | { type: 'SET_THEME'; theme: 'light' | 'dark' }
  | { type: 'TOGGLE_SIDEBAR' }
  | { type: 'PROJECT_ADD'; project: Project }
  | { type: 'PROJECT_UPDATE'; project: Project }
  | { type: 'PROJECT_DELETE'; id: string }
  | { type: 'TASK_ADD'; task: Task }
  | { type: 'TASK_UPDATE'; task: Task }
  | { type: 'TASK_DELETE'; id: string }
  | { type: 'TASK_MOVE'; id: string; status: Task['status'] }
  | { type: 'CHECKLIST_TOGGLE'; id: string }
  | { type: 'CHECKLIST_ADD'; taskId: string; title: string }
  | { type: 'CHECKLIST_DELETE'; id: string }
  | { type: 'COMMENT_ADD'; taskId: string; body: string }
  | { type: 'COMMENT_DELETE'; id: string }
  | { type: 'DEPENDENCY_ADD'; taskId: string; dependsOnId: string }
  | { type: 'DEPENDENCY_DELETE'; id: string }
  | { type: 'NOTIF_READ'; id: string }
  | { type: 'NOTIF_READ_ALL' }
  | { type: 'NOTIF_ADD'; notification: Notification }
  | { type: 'USER_ADD'; name: string; email: string; role: SeedData['users'][number]['role'] }
  | { type: 'USER_UPDATE_ROLE'; id: string; role: SeedData['users'][number]['role'] }
  | { type: 'USER_UPDATE_PROFILE'; id: string; name: string; title: string }
  | { type: 'WORKSPACE_UPDATE'; name: string; timezone: string }
  | { type: 'DOC_ADD'; title: string; content: string; projectId?: string }
  | { type: 'DOC_UPDATE'; id: string; title: string; content: string }
  | { type: 'DOC_DELETE'; id: string }
  | { type: 'RESET_DEMO' };

const STORAGE_KEY = 'nexus-state-v1';

function initState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppState;
      if (parsed && parsed.projects && parsed.tasks) return parsed;
    }
  } catch {
    /* ignore */
  }
  return { ...buildSeed(), authed: false, theme: 'light', sidebarCollapsed: false };
}

function pushActivity(state: AppState, entry: Omit<ActivityLog, 'id' | 'createdAt' | 'actorId'>): ActivityLog[] {
  const log: ActivityLog = {
    ...entry,
    id: genId('ac'),
    actorId: state.currentUserId,
    createdAt: new Date().toISOString(),
  };
  return [log, ...state.activityLogs].slice(0, 200);
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'AUTH_LOGIN':
      return { ...state, authed: true, currentUserId: action.userId };
    case 'AUTH_LOGOUT':
      return { ...state, authed: false };
    case 'SET_THEME':
      return { ...state, theme: action.theme };
    case 'TOGGLE_SIDEBAR':
      return { ...state, sidebarCollapsed: !state.sidebarCollapsed };
    case 'PROJECT_ADD':
      return {
        ...state,
        projects: [action.project, ...state.projects],
        activityLogs: pushActivity(state, { action: 'đã tạo', entityType: 'project', entityId: action.project.id, entityName: action.project.name }),
      };
    case 'PROJECT_UPDATE':
      return {
        ...state,
        projects: state.projects.map((p) => (p.id === action.project.id ? { ...action.project, updatedAt: new Date().toISOString() } : p)),
        activityLogs: pushActivity(state, { action: 'đã cập nhật', entityType: 'project', entityId: action.project.id, entityName: action.project.name }),
      };
    case 'PROJECT_DELETE':
      return { ...state, projects: state.projects.filter((p) => p.id !== action.id) };
    case 'TASK_ADD':
      return {
        ...state,
        tasks: [action.task, ...state.tasks],
        activityLogs: pushActivity(state, { action: 'đã tạo', entityType: 'task', entityId: action.task.id, entityName: action.task.title }),
      };
    case 'TASK_UPDATE': {
      const prev = state.tasks.find((t) => t.id === action.task.id);
      const moved = prev && prev.status !== action.task.status;
      return {
        ...state,
        tasks: state.tasks.map((t) => (t.id === action.task.id ? { ...action.task, updatedAt: new Date().toISOString() } : t)),
        activityLogs: pushActivity(state, {
          action: moved ? 'đã chuyển trạng thái' : 'đã cập nhật',
          entityType: 'task',
          entityId: action.task.id,
          entityName: action.task.title,
        }),
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
        activityLogs: pushActivity(state, { action: 'đã chuyển trạng thái', entityType: 'task', entityId: task.id, entityName: task.title }),
      };
    }
    case 'CHECKLIST_TOGGLE':
      return { ...state, checklists: state.checklists.map((c) => (c.id === action.id ? { ...c, done: !c.done } : c)) };
    case 'CHECKLIST_ADD':
      return { ...state, checklists: [...state.checklists, { id: genId('c'), taskId: action.taskId, title: action.title, done: false }] };
    case 'CHECKLIST_DELETE':
      return { ...state, checklists: state.checklists.filter((c) => c.id !== action.id) };
    case 'COMMENT_ADD':
      return {
        ...state,
        comments: [...state.comments, { id: genId('cm'), taskId: action.taskId, authorId: state.currentUserId, body: action.body, createdAt: new Date().toISOString() }],
        activityLogs: pushActivity(state, {
          action: 'đã bình luận trong',
          entityType: 'task',
          entityId: action.taskId,
          entityName: state.tasks.find((t) => t.id === action.taskId)?.title ?? '',
        }),
      };
    case 'COMMENT_DELETE':
      return { ...state, comments: state.comments.filter((c) => c.id !== action.id) };
    case 'DEPENDENCY_ADD': {
      const exists = state.dependencies.some((d) => d.taskId === action.taskId && d.dependsOnId === action.dependsOnId);
      if (exists || action.taskId === action.dependsOnId) return state;
      return { ...state, dependencies: [...state.dependencies, { id: genId('dep'), taskId: action.taskId, dependsOnId: action.dependsOnId }] };
    }
    case 'DEPENDENCY_DELETE':
      return { ...state, dependencies: state.dependencies.filter((d) => d.id !== action.id) };
    case 'NOTIF_READ':
      return { ...state, notifications: state.notifications.map((n) => (n.id === action.id ? { ...n, read: true } : n)) };
    case 'NOTIF_READ_ALL':
      return { ...state, notifications: state.notifications.map((n) => ({ ...n, read: true })) };
    case 'NOTIF_ADD':
      return { ...state, notifications: [action.notification, ...state.notifications] };
    case 'USER_ADD':
      return {
        ...state,
        users: [...state.users, { id: genId('u'), name: action.name, email: action.email, title: 'Thành viên', role: action.role, status: 'invited' as const, workload: 0 }],
      };
    case 'USER_UPDATE_ROLE':
      return { ...state, users: state.users.map((u) => (u.id === action.id ? { ...u, role: action.role } : u)) };
    case 'USER_UPDATE_PROFILE':
      return { ...state, users: state.users.map((u) => (u.id === action.id ? { ...u, name: action.name, title: action.title } : u)) };
    case 'WORKSPACE_UPDATE':
      return { ...state, workspace: { ...state.workspace, name: action.name, timezone: action.timezone } };
    case 'DOC_ADD':
      return {
        ...state,
        documents: [{ id: genId('doc'), title: action.title, content: action.content, projectId: action.projectId, authorId: state.currentUserId, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, ...state.documents],
      };
    case 'DOC_UPDATE':
      return { ...state, documents: state.documents.map((x) => (x.id === action.id ? { ...x, title: action.title, content: action.content, updatedAt: new Date().toISOString() } : x)) };
    case 'DOC_DELETE':
      return { ...state, documents: state.documents.filter((x) => x.id !== action.id) };
    case 'RESET_DEMO': {
      const seed = buildSeed();
      return { ...seed, authed: state.authed, theme: state.theme, sidebarCollapsed: state.sidebarCollapsed };
    }
    default:
      return state;
  }
}

const AppContext = createContext<{ state: AppState; dispatch: React.Dispatch<Action> } | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, initState);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* ignore */
    }
  }, [state]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', state.theme === 'dark');
  }, [state.theme]);

  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

export function useCurrentUser() {
  const { state } = useApp();
  return state.users.find((u) => u.id === state.currentUserId)!;
}

/* ---------- selectors ---------- */
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

export function userById(users: AppState['users'], id: string) {
  return users.find((u) => u.id === id);
}

export function projectById(projects: Project[], id?: string | null) {
  return projects.find((p) => p.id === id);
}
