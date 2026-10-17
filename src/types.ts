export type WorkspaceRole = 'owner' | 'admin' | 'manager' | 'member' | 'viewer';

export type ProjectStatus = 'planning' | 'active' | 'paused' | 'completed' | 'archived';
export type Priority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskStatus = 'todo' | 'in_progress' | 'in_review' | 'done';

export interface User {
  id: string;
  name: string;
  email: string;
  title: string;
  role: WorkspaceRole;
  status: 'active' | 'invited';
  avatarUrl?: string;
  username?: string;
  workload?: number; // 0-100 estimated capacity
}

export interface Workspace {
  id: string;
  name: string;
  timezone: string;
}

export interface Project {
  id: string;
  code: string;
  name: string;
  description: string;
  status: ProjectStatus;
  priority: Priority;
  startDate: string;
  endDate: string;
  managerId: string;
  memberIds: string[];
  budget?: number;
  budgetUsed?: number;
  color: string;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  code: string;
  title: string;
  description: string;
  projectId: string;
  status: TaskStatus;
  priority: Priority;
  assigneeIds: string[];
  creatorId: string;
  watcherIds: string[];
  startDate?: string;
  dueDate?: string;
  labelIds: string[];
  estimateHours?: number;
  actualHours?: number;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface ChecklistItem {
  id: string;
  taskId: string;
  title: string;
  done: boolean;
}

export interface TaskComment {
  id: string;
  taskId: string;
  authorId: string;
  body: string;
  createdAt: string;
}

export interface TaskDependency {
  id: string;
  taskId: string;
  dependsOnId: string;
}

export interface Label {
  id: string;
  name: string;
  color: string;
}

export interface TaskAttachment {
  id: string;
  taskId: string;
  name: string;
  size: string;
  uploadedBy: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  kind: 'assigned' | 'due_soon' | 'overdue' | 'comment' | 'project' | 'member' | 'review';
  title: string;
  body: string;
  link?: string;
  read: boolean;
  createdAt: string;
}

/** Yêu cầu phê duyệt liên quan đến dự án (member gửi → Owner/Admin duyệt). */
export type ProjectRequestType = 'create_project' | 'pause_project' | 'delete_project';
export type ProjectRequestStatus = 'pending' | 'approved' | 'rejected';

export interface ProjectRequest {
  id: string;
  workspaceId: string;
  type: ProjectRequestType;
  /** Có giá trị với pause/delete; null với create (dự án chưa tồn tại). */
  projectId?: string;
  /** Dữ liệu dự án muốn tạo (chỉ dùng với create_project). */
  payload: Partial<Project>;
  status: ProjectRequestStatus;
  requestedBy: string;
  reviewedBy?: string;
  reviewNote?: string;
  createdAt: string;
  reviewedAt?: string;
}

export const PROJECT_REQUEST_TYPES: { value: ProjectRequestType; label: string }[] = [
  { value: 'create_project', label: 'Tạo dự án' },
  { value: 'pause_project', label: 'Tạm dừng dự án' },
  { value: 'delete_project', label: 'Xóa dự án' },
];

export function projectRequestTypeLabel(t: ProjectRequestType): string {
  return PROJECT_REQUEST_TYPES.find((x) => x.value === t)?.label ?? t;
}

export interface ActivityLog {
  id: string;
  actorId: string;
  action: string;
  entityType: 'project' | 'task' | 'comment' | 'member' | 'document';
  entityId: string;
  entityName: string;
  createdAt: string;
}

export interface Document {
  id: string;
  projectId?: string;
  title: string;
  content: string;
  authorId: string;
  createdAt: string;
  updatedAt: string;
}

export const TASK_STATUSES: { value: TaskStatus; label: string }[] = [
  { value: 'todo', label: 'Cần thực hiện' },
  { value: 'in_progress', label: 'Đang thực hiện' },
  { value: 'in_review', label: 'Đang chờ duyệt' },
  { value: 'done', label: 'Hoàn thành' },
];

export const PROJECT_STATUSES: { value: ProjectStatus; label: string }[] = [
  { value: 'planning', label: 'Lập kế hoạch' },
  { value: 'active', label: 'Đang thực hiện' },
  { value: 'paused', label: 'Tạm dừng' },
  { value: 'completed', label: 'Hoàn thành' },
  { value: 'archived', label: 'Lưu trữ' },
];

export const PRIORITIES: { value: Priority; label: string }[] = [
  { value: 'low', label: 'Thấp' },
  { value: 'medium', label: 'Trung bình' },
  { value: 'high', label: 'Cao' },
  { value: 'urgent', label: 'Khẩn cấp' },
];

export const WORKSPACE_ROLES: { value: WorkspaceRole; label: string; desc: string }[] = [
  { value: 'owner', label: 'Owner', desc: 'Toàn quyền workspace' },
  { value: 'admin', label: 'Admin', desc: 'Quản trị workspace và thành viên' },
  { value: 'manager', label: 'Project Manager', desc: 'Quản lý các dự án được phân quyền' },
  { value: 'member', label: 'Member', desc: 'Thực hiện và cập nhật nhiệm vụ' },
  { value: 'viewer', label: 'Viewer', desc: 'Chỉ xem dữ liệu được cấp quyền' },
];

export function taskStatusLabel(s: TaskStatus): string {
  return TASK_STATUSES.find((x) => x.value === s)?.label ?? s;
}
export function projectStatusLabel(s: ProjectStatus): string {
  return PROJECT_STATUSES.find((x) => x.value === s)?.label ?? s;
}
export function priorityLabel(p: Priority): string {
  return PRIORITIES.find((x) => x.value === p)?.label ?? p;
}
export function roleLabel(r: WorkspaceRole): string {
  return WORKSPACE_ROLES.find((x) => x.value === r)?.label ?? r;
}
