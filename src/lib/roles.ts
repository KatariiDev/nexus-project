import type { WorkspaceRole } from '../types';

/**
 * Phân cấp vai trò: Admin > Owner > Manager > Member > Viewer.
 *
 * - Admin: cao nhất — phê duyệt yêu cầu dự án, xem tiến độ mọi nhóm, vào /admin.
 * - Owner: gửi yêu cầu tạo/tạm dừng/xóa dự án lên Admin; mời thành viên và
 *   phân công Manager/Member/Viewer; duyệt nhiệm vụ của nhóm mình.
 * - Manager/Member: thực hiện nhiệm vụ được giao.
 * - Viewer: chỉ xem.
 */

export const isAdmin = (role: WorkspaceRole): boolean => role === 'admin';
export const isOwner = (role: WorkspaceRole): boolean => role === 'owner';

/** Được duyệt yêu cầu dự án (chỉ Admin). */
export const canReviewProjectRequests = (role: WorkspaceRole): boolean => role === 'admin';

/** Được gửi yêu cầu tạo/tạm dừng/xóa dự án lên Admin (Owner; Admin làm trực tiếp). */
export const canRequestProjects = (role: WorkspaceRole): boolean =>
  role === 'owner' || role === 'admin';

/** Được tạo/tạm dừng/xóa dự án trực tiếp, không cần duyệt (chỉ Admin). */
export const canDirectProjectAction = (role: WorkspaceRole): boolean => role === 'admin';

/** Được vào khu vực /admin/* (chỉ Admin). */
export const canAccessAdmin = (role: WorkspaceRole): boolean => role === 'admin';

/** Được duyệt / trả về nhiệm vụ đang chờ duyệt (Admin + Owner). */
export const canReviewTasks = (role: WorkspaceRole): boolean =>
  role === 'admin' || role === 'owner';

/** Được mời thành viên, đổi vai trò (Admin + Owner). */
export const canManageMembers = (role: WorkspaceRole): boolean =>
  role === 'admin' || role === 'owner';

/**
 * Các vai trò mà một người được phép gán cho người khác.
 * Owner chỉ được phân công Manager/Member/Viewer; Admin được gán mọi vai trò.
 */
export function assignableRoles(role: WorkspaceRole): WorkspaceRole[] {
  if (role === 'admin') return ['owner', 'admin', 'manager', 'member', 'viewer'];
  if (role === 'owner') return ['manager', 'member', 'viewer'];
  return [];
}
