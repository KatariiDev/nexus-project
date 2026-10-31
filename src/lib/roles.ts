import type { Project, User, WorkspaceRole } from '../types';

/**
 * Phân quyền Nexus — chỉ còn 3 vai trò: Admin / Leader / Member.
 *
 * - Admin: quản trị toàn hệ thống — duyệt yêu cầu tạo dự án, vào /admin,
 *   gán vai trò workspace cho người khác, xem mọi dự án.
 * - Leader: Chủ dự án — là người yêu cầu tạo dự án lên Admin (khi được duyệt
 *   thì `managerId` của dự án = người yêu cầu). Leader quyết định trạng thái
 *   và duyệt nhiệm vụ của CHÍNH dự án mình làm chủ (`managerId`).
 *   Leader là vai trò theo từng dự án, không phải quyền toàn workspace.
 * - Member: mọi người không phải Admin — chỉ thấy và thao tác trong các dự án
 *   mình đã tham gia (memberIds hoặc là Leader của dự án đó).
 */

export const isAdmin = (role: WorkspaceRole): boolean => role === 'admin';

/** Người dùng có phải là Leader (Chủ dự án) của dự án này không. */
export const isProjectLeader = (project: Project, userId: string): boolean =>
  project.managerId === userId;

/** Người dùng có phải là thành viên của dự án này không (Leader mặc định đã tính). */
export const isProjectMember = (project: Project, userId: string): boolean =>
  project.managerId === userId || project.memberIds.includes(userId);

/**
 * Danh sách dự án mà người dùng được thấy.
 * Admin (hoặc Admin tổng) thấy tất cả; Member chỉ thấy dự án mình đã tham gia.
 * LƯU Ý: đây chỉ là ẩn ở FE — dữ liệu workspace vẫn được tải về đầy đủ.
 */
export function visibleProjects(projects: Project[], me: User): Project[] {
  if (me.isSuperAdmin || me.role === 'admin') return projects;
  return projects.filter((p) => isProjectMember(p, me.id));
}

/** Được duyệt yêu cầu dự án (Admin trong workspace, hoặc Admin tổng). */
export const canReviewProjectRequests = (role: WorkspaceRole, isSuperAdmin = false): boolean =>
  isSuperAdmin || role === 'admin';

/**
 * Được gửi yêu cầu tạo dự án lên Admin (chỉ Leader; Admin làm trực tiếp).
 * Member muốn làm Leader thì Admin cần nâng vai trò workspace của họ lên Leader trước.
 */
export const canRequestProjects = (role: WorkspaceRole): boolean =>
  role === 'leader' || role === 'admin';

/** Được tạo dự án trực tiếp, không cần duyệt (chỉ Admin). */
export const canDirectProjectAction = (role: WorkspaceRole): boolean => role === 'admin';

/** Được vào khu vực /admin/* (Admin trong workspace, hoặc Admin tổng toàn hệ thống). */
export const canAccessAdmin = (role: WorkspaceRole, isSuperAdmin = false): boolean =>
  isSuperAdmin || role === 'admin';

/**
 * Được duyệt / trả về nhiệm vụ đang chờ duyệt của một dự án:
 * Admin (hoặc Admin tổng) hoặc Leader của chính dự án đó.
 */
export const canReviewTaskForProject = (
  role: WorkspaceRole,
  isSuperAdmin: boolean,
  isLeader: boolean,
): boolean => isSuperAdmin || role === 'admin' || isLeader;

/** Được đổi trạng thái dự án (Leader của dự án đó + Admin). */
export const canChangeProjectStatus = (
  project: Project,
  me: User,
): boolean =>
  me.isSuperAdmin || me.role === 'admin' || isProjectLeader(project, me.id);

/** Được mời thành viên vào dự án (Leader của dự án đó + Admin). */
export const canInviteToProject = (project: Project, me: User): boolean =>
  canChangeProjectStatus(project, me);

/** Được mời thành viên vào workspace, đổi vai trò (chỉ Admin). */
export const canManageMembers = (role: WorkspaceRole): boolean => role === 'admin';

/** Các vai trò mà một người được phép gán cho người khác (chỉ Admin gán). */
export function assignableRoles(role: WorkspaceRole): WorkspaceRole[] {
  if (role === 'admin') return ['admin', 'leader', 'member'];
  return [];
}
