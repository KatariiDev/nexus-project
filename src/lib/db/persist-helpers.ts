import type { ActivityLog, Project, ProjectRequest, Task } from '../../types';
import type { Sb } from './mappers';
import { tsToDb } from './mappers';
import { newId } from '../utils';
import { isoToDateInput } from '../format';

/* ================= Ghi thao tác xuống Supabase ================= */

export interface PersistContext {
  workspaceId: string;
  userId: string;
  userName: string;
  /** Admin tổng: thao tác vượt ra ngoài workspace hiện tại (RLS cho phép). */
  isSuperAdmin: boolean;
}

export function buildLog(
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
export function requestTitle(
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
    case 'join_project':
      return `Xin tham gia dự án${name}`;
    case 'invite_member':
      return `Mời vào dự án${name}`;
  }
}

export async function insertLog(sb: Sb, ctx: PersistContext, log: ActivityLog): Promise<void> {
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

export async function syncJoin(
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

export const isConflict = (e: { code?: string }) => e.code === '23505';

/**
 * Lấy id các thành viên có vai trò cho trước — luôn đọc mới từ DB.
 * (state.users chỉ tải một lần lúc đăng nhập nên role có thể đã cũ
 *  nếu vừa được đổi trên Supabase.)
 */
export async function freshRoleUserIds(sb: Sb, workspaceId: string, roles: string[]): Promise<string[]> {
  const { data, error } = await sb
    .from('workspace_members')
    .select('user_id')
    .eq('workspace_id', workspaceId)
    .in('role', roles);
  if (error) throw error;
  return ((data ?? []) as { user_id: string }[]).map((r) => r.user_id);
}

export async function notifyAssignees(
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
 * - requested: có người gửi yêu cầu duyệt (→ in_review) → báo cho Admin + Leader của dự án.
 * - approved: duyệt (in_review → done) → báo cho người thực hiện.
 * - rejected: trả về (in_review → trạng thái khác) → báo cho người thực hiện.
 */
export async function notifyReview(
  sb: Sb,
  ctx: PersistContext,
  task: Task,
  event: 'requested' | 'approved' | 'rejected',
  leaderId?: string,
): Promise<void> {
  const targets =
    event === 'requested'
      ? [...new Set([
          ...(await freshRoleUserIds(sb, ctx.workspaceId, ['admin'])),
          ...(leaderId ? [leaderId] : []),
        ])].filter((id) => id !== ctx.userId)
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

/**
 * Thông báo khi thành viên từ chối nhận nhiệm vụ → báo cho Leader của dự án
 * để xem xét dời deadline hoặc phân bố lại cho thành viên khác.
 * Chỉ gửi cho Leader (theo kế hoạch đã duyệt).
 */
export async function notifyDeclined(
  sb: Sb,
  ctx: PersistContext,
  task: Task,
  reason: string,
  leaderId?: string,
): Promise<void> {
  const targets = leaderId && leaderId !== ctx.userId ? [leaderId] : [];
  if (targets.length === 0) return;
  const rows = targets.map((userId) => ({
    id: newId(),
    user_id: userId,
    kind: 'declined',
    title: 'Có thành viên từ chối nhiệm vụ',
    body: `${ctx.userName} đã từ chối "${task.title}" (lý do: ${reason}).`,
    link: `/user/tasks/${task.id}`,
  }));
  const { error } = await sb.from('notifications').insert(rows);
  if (error) {
    // Kind 'declined' cần chạy file SQL nexus-task-response-db.sql trước
    // (nới CHECK của notifications.kind). Báo rõ để không bị nhầm là lỗi khác.
    throw new Error('Không gửi được thông báo từ chối — hãy kiểm tra đã chạy file SQL nexus-task-response-db.sql chưa.');
  }
}

export function toProjectRow(p: Project, workspaceId: string) {
  return {
    id: p.id,
    workspace_id: workspaceId,
    code: p.code,
    name: p.name,
    description: p.description || '',
    status: p.status,
    priority: p.priority,
    start_date: isoToDateInput(p.startDate) || null,
    end_date: isoToDateInput(p.endDate) || null,
    manager_id: p.managerId || null,
    budget: p.budget ?? null,
    budget_used: p.budgetUsed ?? 0,
    color: p.color,
  };
}

export function toTaskRow(t: Task) {
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
    assigned_at: tsToDb(t.assignedAt),
    declined_by: t.declinedBy ?? null,
    declined_reason: t.declinedReason ?? null,
    declined_at: tsToDb(t.declinedAt),
  };
}

export function throwDb(error: { message?: string } | null, fallback: string): never {
  throw new Error(error?.message || fallback);
}
