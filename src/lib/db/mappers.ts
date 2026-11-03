import type { SupabaseClient } from '@supabase/supabase-js';
import type { Project, Task, User, WorkspaceRole } from '../../types';
import { DEFAULT_PROJECT_COLOR } from '../../types';
import { dateInputToISO } from '../format';

export type Sb = SupabaseClient;

/* ================= Kiểu dòng DB ================= */

export interface DbProfile {
  id: string;
  name: string;
  email: string;
  username?: string | null;
  title: string | null;
  avatar_url: string | null;
  is_super_admin: boolean | null;
}
export interface DbWorkspace {
  id: string;
  name: string;
  timezone: string | null;
  invite_expiry_days: number | null;
}
export interface DbWorkspaceMember {
  workspace_id: string;
  user_id: string;
  role: string;
}
export interface DbProject {
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
export interface DbTask {
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
  assigned_at: string | null;
  declined_by: string | null;
  declined_reason: string | null;
  declined_at: string | null;
  created_at: string;
  updated_at: string;
}

/* ================= Mapper DB -> App ================= */

/** Chuỗi rỗng -> null (cho cột timestamptz). */
export const tsToDb = (iso?: string | null): string | null => (iso && iso.trim() !== '' ? iso : null);
const num = (v: number | string | null | undefined): number | undefined =>
  v === null || v === undefined || v === '' ? undefined : Number(v);

export function mapUser(p: DbProfile, role: string): User {
  let mappedUsername = p.username ?? undefined;
  if (!mappedUsername && p.email) {
    const prefix = p.email.split('@')[0];
    mappedUsername = prefix.toLowerCase() === 'trantuongvan' ? '_trantuongvan' : prefix;
  }
  if (mappedUsername?.toLowerCase() === 'trantuongvan') {
    mappedUsername = '_trantuongvan';
  }
  return {
    id: p.id,
    name: p.name,
    email: p.email,
    title: p.title ?? '',
    role: normalizeRole(role),
    status: 'active',
    avatarUrl: p.avatar_url ?? undefined,
    username: mappedUsername,
    isSuperAdmin: Boolean((p as unknown as { is_super_admin?: boolean }).is_super_admin),
  };
}

/**
 * Chuẩn hóa vai trò từ DB về 2 vai trò Admin / Member.
 * DB vẫn có thể chứa giá trị cũ ('owner'/'manager'/'viewer'/'leader') —
 * các giá trị cũ đều về 'member' (fail closed: không tự nâng quyền cho ai).
 * CHECK trên DB đã migrate về 2 giá trị từ 01/11/2026; hàm này giữ lại làm
 * lưới an toàn phòng khi DB còn sót giá trị cũ.
 */
export function normalizeRole(role: string): WorkspaceRole {
  if (role === 'admin' || role === 'member') return role;
  return 'member';
}

export function mapProject(r: DbProject, memberIds: string[]): Project {
  return {
    id: r.id,
    code: r.code,
    name: r.name,
    description: r.description ?? '',
    status: r.status as Project['status'],
    priority: r.priority as Project['priority'],
    startDate: dateInputToISO(r.start_date ?? '') ?? '',
    endDate: dateInputToISO(r.end_date ?? '') ?? '',
    managerId: r.manager_id ?? '',
    memberIds,
    budget: num(r.budget),
    budgetUsed: num(r.budget_used) ?? 0,
    color: r.color ?? DEFAULT_PROJECT_COLOR,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function mapTask(r: DbTask, assigneeIds: string[], watcherIds: string[], labelIds: string[]): Task {
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
    assignedAt: r.assigned_at ?? undefined,
    declinedBy: r.declined_by ?? undefined,
    declinedReason: r.declined_reason ?? undefined,
    declinedAt: r.declined_at ?? undefined,
  };
}

