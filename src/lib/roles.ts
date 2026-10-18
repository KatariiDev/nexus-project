import type { WorkspaceRole } from '../types';

/**
 * Phân cấp vai trò:
 * - Admin: Quản trị viên hệ thống — duyệt yêu cầu tạo dự án, xem tiến độ mọi nhóm, vào /admin.
 * - Member: Thành viên — ai cũng có thể gửi yêu cầu tạo dự án lên Admin để làm Leader của dự án đó;
 *   hoặc được mời tham gia các dự án với tư cách Member.
 * - Project Leader: Người đề xuất/quản lý dự án (managerId) — có quyền duyệt nhiệm vụ (in_review -> done)
 *   của dự án mình phụ trách.
 * - Viewer: Chỉ xem.
 */

export const isAdmin = (role: WorkspaceRole): boolean => role === 'admin';
export const isOwner = (role: WorkspaceRole): boolean => role === 'owner' || role === 'admin';

/** Được duyệt yêu cầu dự án (chỉ Admin). */
export const canReviewProjectRequests = (role: WorkspaceRole): boolean => role === 'admin';

/** Được gửi yêu cầu tạo/tạm dừng/xóa dự án lên Admin (mọi thành viên, trừ viewer). */
export const canRequestProjects = (role: WorkspaceRole): boolean => role !== 'viewer';

/** Được tạo/tạm dừng/xóa dự án trực tiếp, không cần duyệt (chỉ Admin). */
export const canDirectProjectAction = (role: WorkspaceRole): boolean => role === 'admin';

/** Được vào khu vực /admin/* (chỉ Admin). */
export const canAccessAdmin = (role: WorkspaceRole): boolean => role === 'admin';

/** Được duyệt / trả về nghiệm thu nhiệm vụ đang chờ duyệt (CHỈ DUY NHẤT ADMIN). */
export const canReviewTasks = (role: WorkspaceRole): boolean => role === 'admin';

/** Được mời thành viên, đổi vai trò cấp Workspace (Admin). */
export const canManageMembers = (role: WorkspaceRole): boolean =>
  role === 'admin' || role === 'owner';

/**
 * Các vai trò mà một người được phép gán cho người khác.
 */
export function assignableRoles(role: WorkspaceRole): WorkspaceRole[] {
  if (role === 'admin') return ['admin', 'member', 'viewer'];
  if (role === 'owner') return ['member', 'viewer'];
  return [];
}
