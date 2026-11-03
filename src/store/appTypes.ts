import type { WorkspaceBundle } from '../lib/db';
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
  /** Toàn bộ workspace (Admin tổng thấy tất cả; người thường chỉ có 1). */
  workspaces: Workspace[];
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
  | { type: 'PROJECT_JOIN_REQUEST'; projectId: string }
  | { type: 'PROJECT_INVITE_MEMBER'; projectId: string; inviteeIds: string[] }
  | { type: 'PROJECT_INVITE_CANCEL'; id: string }
  | { type: 'WORKSPACE_UPDATE_SETTINGS'; inviteExpiryDays: number }
  | { type: 'PROJECT_REQUEST_CREATE'; request: ProjectRequest }
  | { type: 'PROJECT_REQUEST_REVIEW'; id: string; approve: boolean; note?: string }
  | { type: 'TASK_ADD'; task: Task }
  | { type: 'TASK_UPDATE'; task: Task }
  | { type: 'TASK_DELETE'; id: string }
  | { type: 'TASK_MOVE'; id: string; status: Task['status'] }
  | { type: 'TASK_DECLINE'; id: string; reason: string }
  | { type: 'TASK_AUTO_ACCEPT'; id: string }
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
  | { type: 'DOC_ADD'; title: string; content: string; projectId?: string; fileUrl?: string; fileName?: string; fileSize?: number; fileType?: string }
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
      requests?: ProjectRequest[];
      projectDeletedId?: string;
    })
  | { type: 'HYDRATE'; bundle: WorkspaceBundle; userId: string }
  | { type: 'SESSION_END' }
  | { type: 'BOOT_DONE' }
  | { type: 'BOOT_CONFIG_ERROR' };

