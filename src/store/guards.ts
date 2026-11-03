import type { Action, AppState } from './appTypes';
import type { Task } from '../types';
import {
  assignableRoles,
  canDirectProjectAction,
  canManageMembers,
  canRequestProjects,
  canReviewProjectRequests,
  canReviewTaskForProject,
  isProjectLeader,
} from '../lib/roles';

/**
 * Quy tắc duyệt nhiệm vụ: task đang ở trạng thái "Chờ duyệt" (in_review)
 * thì chỉ Admin hoặc Leader của dự án chứa task đó mới được chuyển sang
 * trạng thái khác (duyệt → "Hoàn thành", hoặc trả về "Đang thực hiện"/"Cần thực hiện").
 * Thành viên thường vẫn được đưa task vào "Chờ duyệt" (gửi yêu cầu duyệt).
 * Ném Error để dispatch hiện toast và giữ nguyên trạng thái.
 */
export function assertApprovalPermission(state: AppState, action: Action): void {
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
 * Các field của nhiệm vụ thay đổi ngoài trạng thái.
 * Bỏ qua `updatedAt` / `completedAt` vì hệ thống tự cập nhật theo trạng thái.
 * Dùng để phân biệt "thành viên chỉ đổi trạng thái nhiệm vụ của mình"
 * với "thành viên sửa nội dung nhiệm vụ" (bị chặn).
 */
export function taskNonStatusChanges(prev: Task | undefined, next: Task): string[] {
  if (!prev) return ['task'];
  const keys = [
    'title', 'description', 'projectId', 'priority', 'assigneeIds', 'creatorId',
    'watcherIds', 'labelIds', 'startDate', 'dueDate', 'estimateHours', 'actualHours',
    'code', 'createdAt',
  ] as const;
  const changed: string[] = [];
  for (const k of keys) {
    const a = prev[k];
    const b = next[k];
    if (Array.isArray(a) || Array.isArray(b)) {
      if (JSON.stringify(a ?? null) !== JSON.stringify(b ?? null)) changed.push(k);
    } else if (a !== b) {
      changed.push(k);
    }
  }
  return changed;
}

/**
 * Quy tắc quyền trong dự án:
 * - Chỉ Leader của dự án (+ Admin / Admin tổng, đã bypass ở trên) được
 *   tạo / sửa / xóa nhiệm vụ và thêm/gỡ nhiệm vụ phụ thuộc.
 * - Thành viên chỉ được đổi TRẠNG THÁI nhiệm vụ được giao cho mình
 *   (luồng duyệt "Chờ duyệt" vẫn do assertApprovalPermission giữ).
 * - Bình luận / checklist: mọi thành viên dự án vẫn dùng được.
 * Đối với các dự án khác, người dùng không có quyền can thiệp.
 */
export function assertProjectMembership(state: AppState, action: Action): void {
  const me = state.users.find((u) => u.id === state.currentUserId);
  if (!me || me.role === 'admin' || me.isSuperAdmin) return; // Admin có toàn quyền ở mọi dự án

  let targetProjectId: string | undefined;

  if (action.type === 'TASK_ADD') {
    targetProjectId = action.task.projectId;
  } else if (action.type === 'TASK_MOVE' || action.type === 'TASK_DELETE') {
    const task = state.tasks.find((t) => t.id === action.id);
    targetProjectId = task?.projectId;
  } else if (action.type === 'TASK_DECLINE') {
    const task = state.tasks.find((t) => t.id === action.id);
    targetProjectId = task?.projectId;
  } else if (action.type === 'TASK_UPDATE') {
    targetProjectId = action.task.projectId;
  } else if (action.type === 'DEPENDENCY_ADD') {
    const task = state.tasks.find((t) => t.id === action.taskId);
    targetProjectId = task?.projectId;
  } else if (action.type === 'DEPENDENCY_DELETE') {
    const dep = state.dependencies.find((d) => d.id === action.id);
    const task = dep ? state.tasks.find((t) => t.id === dep.taskId) : undefined;
    targetProjectId = task?.projectId;
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
  } else if (action.type === 'PROJECT_INVITE_MEMBER') {
    targetProjectId = action.projectId;
  } else if (action.type === 'PROJECT_INVITE_CANCEL') {
    const req = state.projectRequests.find((r) => r.id === action.id);
    targetProjectId = req?.projectId;
  }

  if (!targetProjectId) return;

  const proj = state.projects.find((p) => p.id === targetProjectId);
  if (!proj) return;

  const isLeader = proj.managerId === state.currentUserId;
  const isMember = proj.memberIds.includes(state.currentUserId);

  if (action.type === 'PROJECT_UPDATE' && !isLeader) {
    throw new Error('Chỉ Admin hoặc Chủ dự án mới được chỉnh sửa dự án này.');
  }

  // Mời thành viên / hủy lời mời: chỉ Leader của dự án (Admin đã bypass ở đầu hàm).
  if ((action.type === 'PROJECT_INVITE_MEMBER' || action.type === 'PROJECT_INVITE_CANCEL') && !isLeader) {
    throw new Error('Chỉ Admin hoặc Chủ dự án mới được mời/hủy lời mời thành viên.');
  }

  // Tạo / xóa nhiệm vụ và thêm/gỡ nhiệm vụ phụ thuộc: chỉ Leader.
  if (
    action.type === 'TASK_ADD' ||
    action.type === 'TASK_DELETE' ||
    action.type === 'DEPENDENCY_ADD' ||
    action.type === 'DEPENDENCY_DELETE'
  ) {
    if (!isLeader) {
      throw new Error(
        action.type === 'TASK_ADD'
          ? 'Chỉ Chủ dự án hoặc Admin mới được tạo nhiệm vụ.'
          : action.type === 'TASK_DELETE'
            ? 'Chỉ Chủ dự án hoặc Admin mới được xóa nhiệm vụ.'
            : 'Chỉ Chủ dự án hoặc Admin mới được thêm/gỡ nhiệm vụ phụ thuộc.',
      );
    }
  }

  // Sửa nhiệm vụ: chỉ Leader, ngoại trừ thành viên đổi TRẠNG THÁI
  // nhiệm vụ được giao cho mình (mọi field khác giữ nguyên).
  if (action.type === 'TASK_UPDATE' && !isLeader) {
    const prev = state.tasks.find((t) => t.id === action.task.id);
    const isAssignee = prev?.assigneeIds.includes(state.currentUserId) ?? false;
    const changed = taskNonStatusChanges(prev, action.task);
    if (!prev || !isAssignee || changed.length > 0) {
      throw new Error('Chỉ Chủ dự án hoặc Admin mới được chỉnh sửa nhiệm vụ. Thành viên chỉ được đổi trạng thái nhiệm vụ của mình.');
    }
  }

  // Đổi trạng thái (kéo-thả / checkbox / thao tác hàng loạt):
  // thành viên chỉ được đổi nhiệm vụ được giao cho mình.
  if (action.type === 'TASK_MOVE' && !isLeader) {
    const task = state.tasks.find((t) => t.id === action.id);
    if (task && !task.assigneeIds.includes(state.currentUserId)) {
      throw new Error('Chỉ Chủ dự án hoặc Admin mới được đổi trạng thái nhiệm vụ của người khác.');
    }
  }

  // Từ chối nhận: chỉ người được giao nhiệm vụ đó mới được từ chối.
  if (action.type === 'TASK_DECLINE' && !isLeader) {
    const task = state.tasks.find((t) => t.id === action.id);
    if (!task || !task.assigneeIds.includes(state.currentUserId)) {
      throw new Error('Chỉ người được giao nhiệm vụ mới được từ chối.');
    }
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
export function assertProjectPermission(state: AppState, action: Action): void {
  const me = state.users.find((u) => u.id === state.currentUserId);
  const role = me?.role ?? 'member';
  const isSuperAdmin = me?.isSuperAdmin ?? false;

  // Duyệt / từ chối yêu cầu: Admin (hoặc Admin tổng) duyệt mọi loại yêu cầu;
  // riêng đơn xin tham gia dự án (`join_project`) do Leader của dự án đó duyệt,
  // còn lời mời vào dự án (`invite_member`) do chính người được mời duyệt.
  if (action.type === 'PROJECT_REQUEST_REVIEW' && !canReviewProjectRequests(role, isSuperAdmin)) {
    const req = state.projectRequests.find((r) => r.id === action.id);
    const proj = req?.projectId ? state.projects.find((p) => p.id === req.projectId) : undefined;
    const isJoinLeader = req?.type === 'join_project' && proj?.managerId === state.currentUserId;
    const isInvitee = req?.type === 'invite_member' && req.payload.invitee_id === state.currentUserId;
    if (!isJoinLeader && !isInvitee) {
      throw new Error('Chỉ Admin mới được duyệt yêu cầu.');
    }
  }
  // Cấu hình workspace (thời hạn lời mời): chỉ Admin.
  if (action.type === 'WORKSPACE_UPDATE_SETTINGS' && !canDirectProjectAction(role, isSuperAdmin)) {
    throw new Error('Chỉ Admin mới được đổi cấu hình.');
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
export function assertMemberPermission(state: AppState, action: Action): void {
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
