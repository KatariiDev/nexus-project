import type { WorkspaceBundle } from '../../lib/db';
import type {
  ActivityLog,
  ChecklistItem,
  Document,
  Label,
  Notification,
  Project,
  Task,
  TaskAttachment,
  TaskComment,
  TaskDependency,
  User,
  Workspace,
} from '../../types';

export function createMockWorkspaceBundle(userName = 'Dev Admin', userEmail = 'dev@nexus.internal'): WorkspaceBundle {
  const currentUserId = 'usr-admin-01';
  const workspaceId = 'ws-nexus-startup';

  const workspace: Workspace = {
    id: workspaceId,
    name: 'Nexus Startup Workspace',
    timezone: 'Asia/Ho_Chi_Minh',
  };

  const users: User[] = [
    {
      id: currentUserId,
      name: userName,
      email: userEmail,
      title: 'Lead Developer / Admin',
      role: 'owner',
      status: 'active',
      workload: 65,
    },
    {
      id: 'usr-member-02',
      name: 'Nguyễn Văn Minh',
      email: 'minh.nguyen@nexus.internal',
      title: 'Frontend Engineer',
      role: 'manager',
      status: 'active',
      workload: 80,
    },
    {
      id: 'usr-member-03',
      name: 'Trần Thị Thu Thảo',
      email: 'thao.tran@nexus.internal',
      title: 'UI/UX Designer',
      role: 'member',
      status: 'active',
      workload: 45,
    },
    {
      id: 'usr-member-04',
      name: 'Lê Hoàng Nam',
      email: 'nam.le@nexus.internal',
      title: 'Backend & DevOps',
      role: 'member',
      status: 'active',
      workload: 70,
    },
  ];

  const labels: Label[] = [
    { id: 'lbl-bug', name: 'bug', color: '#EF4444' },
    { id: 'lbl-feature', name: 'feature', color: '#4F46E5' },
    { id: 'lbl-design', name: 'design', color: '#A855F7' },
    { id: 'lbl-docs', name: 'docs', color: '#16A34A' },
    { id: 'lbl-backend', name: 'backend', color: '#0284C7' },
    { id: 'lbl-frontend', name: 'frontend', color: '#0891B2' },
    { id: 'lbl-urgent', name: 'khẩn cấp', color: '#F97316' },
  ];

  const projects: Project[] = [
    {
      id: 'prj-nexus-core',
      code: 'NEX-CORE',
      name: 'Hệ thống Quản lý Dự án Nexus',
      description: 'Nền tảng quản lý dự án mô hình startup công nghệ: Kanban, Gantt, Báo cáo thời gian thực.',
      status: 'active',
      priority: 'high',
      startDate: '2026-10-01T00:00:00',
      endDate: '2026-12-31T00:00:00',
      managerId: currentUserId,
      memberIds: [currentUserId, 'usr-member-02', 'usr-member-03', 'usr-member-04'],
      budget: 150000000,
      budgetUsed: 42000000,
      color: '#4F46E5',
      createdAt: '2026-10-01T08:00:00Z',
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'prj-discord-bot',
      code: 'DISCORD-GATE',
      name: 'Discord Gatekeeper & Webhook Bot',
      description: 'Tích hợp xác thực thành viên server Discord nội bộ, tự động cấp quyền và thông báo tiến độ.',
      status: 'active',
      priority: 'urgent',
      startDate: '2026-10-10T00:00:00',
      endDate: '2026-11-15T00:00:00',
      managerId: 'usr-member-04',
      memberIds: [currentUserId, 'usr-member-04'],
      budget: 30000000,
      budgetUsed: 8500000,
      color: '#5865F2',
      createdAt: '2026-10-10T09:00:00Z',
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'prj-mobile-app',
      code: 'NEX-MOBILE',
      name: 'Nexus Mobile Companion App',
      description: 'Ứng dụng di động iOS/Android cho thành viên theo dõi thông báo và trao đổi nhanh.',
      status: 'planning',
      priority: 'medium',
      startDate: '2026-11-01T00:00:00',
      endDate: '2027-02-28T00:00:00',
      managerId: 'usr-member-02',
      memberIds: [currentUserId, 'usr-member-02', 'usr-member-03'],
      budget: 90000000,
      budgetUsed: 5000000,
      color: '#0891B2',
      createdAt: '2026-10-12T10:00:00Z',
      updatedAt: new Date().toISOString(),
    },
  ];

  const tasks: Task[] = [
    {
      id: 'tsk-01',
      code: 'NEX-101',
      title: 'Tích hợp giao diện Halloween Login vào hệ thống',
      description: 'Chuyển template_login sang React, bổ sung đăng nhập Discord kiểm tra server member và fallback tài khoản dev.',
      projectId: 'prj-nexus-core',
      status: 'done',
      priority: 'urgent',
      assigneeIds: [currentUserId],
      creatorId: currentUserId,
      watcherIds: ['usr-member-02'],
      startDate: '2026-10-15T00:00:00',
      dueDate: '2026-10-18T00:00:00',
      labelIds: ['lbl-feature', 'lbl-frontend'],
      estimateHours: 12,
      actualHours: 8,
      createdAt: '2026-10-15T08:00:00Z',
      updatedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    },
    {
      id: 'tsk-02',
      code: 'NEX-102',
      title: 'Xây dựng Discord Server Gatekeeper Guard',
      description: 'Kiểm tra quyền thành viên server Discord thông qua Discord OAuth guilds scope.',
      projectId: 'prj-discord-bot',
      status: 'in_progress',
      priority: 'high',
      assigneeIds: ['usr-member-04', currentUserId],
      creatorId: currentUserId,
      watcherIds: [currentUserId],
      startDate: '2026-10-14T00:00:00',
      dueDate: '2026-10-22T00:00:00',
      labelIds: ['lbl-backend', 'lbl-feature'],
      estimateHours: 16,
      actualHours: 9,
      createdAt: '2026-10-14T11:00:00Z',
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'tsk-03',
      code: 'NEX-103',
      title: 'Hoàn thiện thiết kế Dark Mode & Hiệu ứng Flashlight',
      description: 'Kiểm thử chế độ ban đêm Halloween, con sói hú trên đỉnh núi và nhện bò theo trỏ chuột.',
      projectId: 'prj-nexus-core',
      status: 'in_review',
      priority: 'medium',
      assigneeIds: ['usr-member-03'],
      creatorId: currentUserId,
      watcherIds: ['usr-member-02'],
      startDate: '2026-10-13T00:00:00',
      dueDate: '2026-10-19T00:00:00',
      labelIds: ['lbl-design', 'lbl-frontend'],
      estimateHours: 10,
      actualHours: 10,
      createdAt: '2026-10-13T14:00:00Z',
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'tsk-04',
      code: 'NEX-104',
      title: 'Cấu hình Supabase Migration & RLS Policies',
      description: 'Đảm bảo các bảng profiles, projects, tasks tuân thủ đúng Row Level Security cho từng thành viên workspace.',
      projectId: 'prj-nexus-core',
      status: 'todo',
      priority: 'high',
      assigneeIds: ['usr-member-04'],
      creatorId: currentUserId,
      watcherIds: [],
      startDate: '2026-10-20T00:00:00',
      dueDate: '2026-10-26T00:00:00',
      labelIds: ['lbl-backend'],
      estimateHours: 14,
      createdAt: '2026-10-15T15:00:00Z',
      updatedAt: new Date().toISOString(),
    },
  ];

  const checklists: ChecklistItem[] = [
    { id: 'chk-01', taskId: 'tsk-01', title: 'Chuyển đổi CSS sang Vite', done: true },
    { id: 'chk-02', taskId: 'tsk-01', title: 'Tích hợp hoạt ảnh Sói, Nhện và Dây leo', done: true },
    { id: 'chk-03', taskId: 'tsk-01', title: 'Bỏ tính năng đăng ký tự do', done: true },
    { id: 'chk-04', taskId: 'tsk-01', title: 'Thêm nút đăng nhập Discord kèm điều kiện Server', done: true },
    { id: 'chk-05', taskId: 'tsk-02', title: 'Lấy danh sách Guilds từ Discord API', done: true },
    { id: 'chk-06', taskId: 'tsk-02', title: 'Từ chối đăng nhập nếu không thuộc server', done: false },
  ];

  const comments: TaskComment[] = [
    {
      id: 'cmt-01',
      taskId: 'tsk-01',
      authorId: currentUserId,
      body: 'Đã hoàn tất đưa asset và hiệu ứng vào public/ và src/features/auth.',
      createdAt: '2026-10-15T16:30:00Z',
    },
    {
      id: 'cmt-02',
      taskId: 'tsk-02',
      authorId: 'usr-member-04',
      body: 'Scope `guilds` đã sẵn sàng, cần thêm Client ID và Guild ID vào biến môi trường.',
      createdAt: '2026-10-15T17:00:00Z',
    },
  ];

  const dependencies: TaskDependency[] = [
    { id: 'dep-01', taskId: 'tsk-04', dependsOnId: 'tsk-01' },
  ];

  const attachments: TaskAttachment[] = [
    {
      id: 'att-01',
      taskId: 'tsk-01',
      name: 'login-template-spec.pdf',
      size: '2.4 MB',
      uploadedBy: currentUserId,
      createdAt: '2026-10-15T10:00:00Z',
    },
  ];

  const notifications: Notification[] = [
    {
      id: 'notif-01',
      userId: currentUserId,
      kind: 'assigned',
      title: 'Nhiệm vụ mới',
      body: 'Bạn đã được phân công nhiệm vụ Tích hợp giao diện Halloween Login.',
      link: '/tasks',
      read: false,
      createdAt: '2026-10-15T08:05:00Z',
    },
    {
      id: 'notif-02',
      userId: currentUserId,
      kind: 'project',
      title: 'Khởi động dự án Discord Gatekeeper',
      body: 'Dự án Discord Gatekeeper & Webhook Bot đã bắt đầu triển khai.',
      link: '/projects/prj-discord-bot',
      read: true,
      createdAt: '2026-10-10T09:15:00Z',
    },
  ];

  const activityLogs: ActivityLog[] = [
    {
      id: 'log-01',
      actorId: currentUserId,
      action: 'đã hoàn thành',
      entityType: 'task',
      entityId: 'tsk-01',
      entityName: 'Tích hợp giao diện Halloween Login vào hệ thống',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'log-02',
      actorId: 'usr-member-04',
      action: 'đã bình luận trên',
      entityType: 'task',
      entityId: 'tsk-02',
      entityName: 'Xây dựng Discord Server Gatekeeper Guard',
      createdAt: '2026-10-15T17:00:00Z',
    },
  ];

  const documents: Document[] = [
    {
      id: 'doc-01',
      projectId: 'prj-nexus-core',
      title: 'Tài liệu Kiến trúc Bảo mật & Phân quyền Nội bộ',
      content:
        '# Quy định truy cập hệ thống Nexus\n\n1. **Xác thực Discord**:\n   - Thành viên phải thuộc Discord Server chính thức của Ban Công Nghệ.\n   - Khi đăng nhập lần đầu qua Discord, hệ thống tự động kiểm tra Guild ID.\n   - Nếu không thuộc Server, phiên đăng nhập bị hủy bỏ ngay lập tức.\n\n2. **Tài khoản Dự phòng (Fallback)**:\n   - Dành cho nhà phát triển và trường hợp Discord gặp sự cố.\n   - Chỉ Dev/Admin mới có quyền khởi tạo tài khoản dự phòng trực tiếp trong DB.',
      authorId: currentUserId,
      createdAt: '2026-10-15T09:00:00Z',
      updatedAt: '2026-10-15T09:00:00Z',
    },
  ];

  return {
    workspace,
    users,
    labels,
    projects,
    tasks,
    checklists,
    comments,
    dependencies,
    attachments,
    notifications,
    activityLogs,
    documents,
    projectRequests: [],
  };
}

