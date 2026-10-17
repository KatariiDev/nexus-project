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
      isSuperAdmin: true,
    },
    {
      id: 'usr-member-02',
      name: 'Nguyá»n VÄn Minh',
      email: 'minh.nguyen@nexus.internal',
      title: 'Frontend Engineer',
      role: 'manager',
      status: 'active',
      workload: 80,
      isSuperAdmin: false,
    },
    {
      id: 'usr-member-03',
      name: 'Tráº§n Thá» Thu Tháº£o',
      email: 'thao.tran@nexus.internal',
      title: 'UI/UX Designer',
      role: 'member',
      status: 'active',
      workload: 45,
      isSuperAdmin: false,
    },
    {
      id: 'usr-member-04',
      name: 'LÃª HoÃ ng Nam',
      email: 'nam.le@nexus.internal',
      title: 'Backend & DevOps',
      role: 'member',
      status: 'active',
      workload: 70,
      isSuperAdmin: false,
    },
  ];

  const labels: Label[] = [
    { id: 'lbl-bug', name: 'bug', color: '#EF4444' },
    { id: 'lbl-feature', name: 'feature', color: '#4F46E5' },
    { id: 'lbl-design', name: 'design', color: '#A855F7' },
    { id: 'lbl-docs', name: 'docs', color: '#16A34A' },
    { id: 'lbl-backend', name: 'backend', color: '#0284C7' },
    { id: 'lbl-frontend', name: 'frontend', color: '#0891B2' },
    { id: 'lbl-urgent', name: 'kháº©n cáº¥p', color: '#F97316' },
  ];

  const projects: Project[] = [
    {
      id: 'prj-nexus-core',
      code: 'NEX-CORE',
      name: 'Há» thá»ng Quáº£n lÃ½ Dá»± Ã¡n Nexus',
      description: 'Ná»n táº£ng quáº£n lÃ½ dá»± Ã¡n mÃ´ hÃ¬nh startup cÃ´ng nghá»: Kanban, Gantt, BÃ¡o cÃ¡o thá»i gian thá»±c.',
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
      description: 'TÃ­ch há»£p xÃ¡c thá»±c thÃ nh viÃªn server Discord ná»i bá», tá»± Äá»ng cáº¥p quyá»n vÃ  thÃ´ng bÃ¡o tiáº¿n Äá».',
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
      description: 'á»¨ng dá»¥ng di Äá»ng iOS/Android cho thÃ nh viÃªn theo dÃµi thÃ´ng bÃ¡o vÃ  trao Äá»i nhanh.',
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
      title: 'TÃ­ch há»£p giao diá»n Halloween Login vÃ o há» thá»ng',
      description: 'Chuyá»n template_login sang React, bá» sung ÄÄng nháº­p Discord kiá»m tra server member vÃ  fallback tÃ i khoáº£n dev.',
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
      title: 'XÃ¢y dá»±ng Discord Server Gatekeeper Guard',
      description: 'Kiá»m tra quyá»n thÃ nh viÃªn server Discord thÃ´ng qua Discord OAuth guilds scope.',
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
      title: 'HoÃ n thiá»n thiáº¿t káº¿ Dark Mode & Hiá»u á»©ng Flashlight',
      description: 'Kiá»m thá»­ cháº¿ Äá» ban ÄÃªm Halloween, con sÃ³i hÃº trÃªn Äá»nh nÃºi vÃ  nhá»n bÃ² theo trá» chuá»t.',
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
      title: 'Cáº¥u hÃ¬nh Supabase Migration & RLS Policies',
      description: 'Äáº£m báº£o cÃ¡c báº£ng profiles, projects, tasks tuÃ¢n thá»§ ÄÃºng Row Level Security cho tá»«ng thÃ nh viÃªn workspace.',
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
    { id: 'chk-01', taskId: 'tsk-01', title: 'Chuyá»n Äá»i CSS sang Vite', done: true },
    { id: 'chk-02', taskId: 'tsk-01', title: 'TÃ­ch há»£p hoáº¡t áº£nh SÃ³i, Nhá»n vÃ  DÃ¢y leo', done: true },
    { id: 'chk-03', taskId: 'tsk-01', title: 'Bá» tÃ­nh nÄng ÄÄng kÃ½ tá»± do', done: true },
    { id: 'chk-04', taskId: 'tsk-01', title: 'ThÃªm nÃºt ÄÄng nháº­p Discord kÃ¨m Äiá»u kiá»n Server', done: true },
    { id: 'chk-05', taskId: 'tsk-02', title: 'Láº¥y danh sÃ¡ch Guilds tá»« Discord API', done: true },
    { id: 'chk-06', taskId: 'tsk-02', title: 'Tá»« chá»i ÄÄng nháº­p náº¿u khÃ´ng thuá»c server', done: false },
  ];

  const comments: TaskComment[] = [
    {
      id: 'cmt-01',
      taskId: 'tsk-01',
      authorId: currentUserId,
      body: 'ÄÃ£ hoÃ n táº¥t ÄÆ°a asset vÃ  hiá»u á»©ng vÃ o public/ vÃ  src/features/auth.',
      createdAt: '2026-10-15T16:30:00Z',
    },
    {
      id: 'cmt-02',
      taskId: 'tsk-02',
      authorId: 'usr-member-04',
      body: 'Scope `guilds` ÄÃ£ sáºµn sÃ ng, cáº§n thÃªm Client ID vÃ  Guild ID vÃ o biáº¿n mÃ´i trÆ°á»ng.',
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
      title: 'Nhiá»m vá»¥ má»i',
      body: 'Báº¡n ÄÃ£ ÄÆ°á»£c phÃ¢n cÃ´ng nhiá»m vá»¥ TÃ­ch há»£p giao diá»n Halloween Login.',
      link: '/tasks',
      read: false,
      createdAt: '2026-10-15T08:05:00Z',
    },
    {
      id: 'notif-02',
      userId: currentUserId,
      kind: 'project',
      title: 'Khá»i Äá»ng dá»± Ã¡n Discord Gatekeeper',
      body: 'Dá»± Ã¡n Discord Gatekeeper & Webhook Bot ÄÃ£ báº¯t Äáº§u triá»n khai.',
      link: '/projects/prj-discord-bot',
      read: true,
      createdAt: '2026-10-10T09:15:00Z',
    },
  ];

  const activityLogs: ActivityLog[] = [
    {
      id: 'log-01',
      actorId: currentUserId,
      action: 'ÄÃ£ hoÃ n thÃ nh',
      entityType: 'task',
      entityId: 'tsk-01',
      entityName: 'TÃ­ch há»£p giao diá»n Halloween Login vÃ o há» thá»ng',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'log-02',
      actorId: 'usr-member-04',
      action: 'ÄÃ£ bÃ¬nh luáº­n trÃªn',
      entityType: 'task',
      entityId: 'tsk-02',
      entityName: 'XÃ¢y dá»±ng Discord Server Gatekeeper Guard',
      createdAt: '2026-10-15T17:00:00Z',
    },
  ];

  const documents: Document[] = [
    {
      id: 'doc-01',
      projectId: 'prj-nexus-core',
      title: 'TÃ i liá»u Kiáº¿n trÃºc Báº£o máº­t & PhÃ¢n quyá»n Ná»i bá»',
      content:
        '# Quy Äá»nh truy cáº­p há» thá»ng Nexus\n\n1. **XÃ¡c thá»±c Discord**:\n   - ThÃ nh viÃªn pháº£i thuá»c Discord Server chÃ­nh thá»©c cá»§a Ban CÃ´ng Nghá».\n   - Khi ÄÄng nháº­p láº§n Äáº§u qua Discord, há» thá»ng tá»± Äá»ng kiá»m tra Guild ID.\n   - Náº¿u khÃ´ng thuá»c Server, phiÃªn ÄÄng nháº­p bá» há»§y bá» ngay láº­p tá»©c.\n\n2. **TÃ i khoáº£n Dá»± phÃ²ng (Fallback)**:\n   - DÃ nh cho nhÃ  phÃ¡t triá»n vÃ  trÆ°á»ng há»£p Discord gáº·p sá»± cá».\n   - Chá» Dev/Admin má»i cÃ³ quyá»n khá»i táº¡o tÃ i khoáº£n dá»± phÃ²ng trá»±c tiáº¿p trong DB.',
      authorId: currentUserId,
      createdAt: '2026-10-15T09:00:00Z',
      updatedAt: '2026-10-15T09:00:00Z',
    },
  ];

  return {
    workspace,
    workspaces: [workspace],
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

