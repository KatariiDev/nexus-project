import { createContext, useContext } from 'react';
import type { Action, AppState } from './appTypes';
import type { Project, Task, User } from '../types';

interface AppContextValue {
  state: AppState;
  dispatch: (action: Action) => Promise<boolean>;
  signOut: () => Promise<void>;
  /** Tải lại toàn bộ dữ liệu workspace từ Supabase (dùng cho nút tải lại / realtime). */
  refresh: () => Promise<void>;
  loginDev?: (email: string) => Promise<void>;
}

export const AppContext = createContext<AppContextValue | null>(null);

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
