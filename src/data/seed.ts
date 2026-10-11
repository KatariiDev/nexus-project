import type {
  User, Workspace, Project, Task, ChecklistItem, TaskComment,
  TaskDependency, Label, TaskAttachment, Notification, ActivityLog, Document,
} from '../types';
import { addDaysISO } from '../lib/format';

const now = new Date();
const d = (days: number, h = 9): string => addDaysISO(now, days).replace(/T\d{2}:\d{2}:\d{2}$/, `T${String(h).padStart(2, '0')}:00:00`);

export interface SeedData {
  workspace: Workspace;
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
}

export function buildSeed(): SeedData {
  const users: User[] = [
    { id: 'u1', name: 'Nguyễn Minh Anh', email: 'minhanh@nexus.vn', title: 'Product Owner', role: 'owner', status: 'active', workload: 72 },
    { id: 'u2', name: 'Trần Đức Huy', email: 'duchuy@nexus.vn', title: 'Tech Lead', role: 'admin', status: 'active', workload: 85 },
    { id: 'u3', name: 'Lê Thu Trang', email: 'thutrang@nexus.vn', title: 'Project Manager', role: 'manager', status: 'active', workload: 64 },
    { id: 'u4', name: 'Phạm Quốc Bảo', email: 'quocbao@nexus.vn', title: 'Frontend Developer', role: 'member', status: 'active', workload: 91 },
    { id: 'u5', name: 'Hoàng Mai Linh', email: 'mailinh@nexus.vn', title: 'UI/UX Designer', role: 'member', status: 'active', workload: 58 },
    { id: 'u6', name: 'Vũ Thanh Tùng', email: 'thanhtung@nexus.vn', title: 'Backend Developer', role: 'member', status: 'active', workload: 88 },
    { id: 'u7', name: 'Đặng Phương Nhi', email: 'phuongnhi@nexus.vn', title: 'Content & QA', role: 'member', status: 'active', workload: 43 },
    { id: 'u8', name: 'Bùi Hoàng Nam', email: 'hoangnam@nexus.vn', title: 'Intern', role: 'viewer', status: 'invited', workload: 12 },
  ];

  const labels: Label[] = [
    { id: 'l1', name: 'bug', color: '#EF4444' },
    { id: 'l2', name: 'feature', color: '#4F46E5' },
    { id: 'l3', name: 'design', color: '#A855F7' },
    { id: 'l4', name: 'docs', color: '#16A34A' },
    { id: 'l5', name: 'backend', color: '#0284C7' },
    { id: 'l6', name: 'frontend', color: '#0891B2' },
    { id: 'l7', name: 'khẩn cấp', color: '#F97316' },
  ];

  const projects: Project[] = [
    {
      id: 'p1', code: 'NEX-001', name: 'Nền tảng thương mại điện tử',
      description: 'Xây dựng nền tảng bán hàng đa kênh với giỏ hàng, thanh toán và quản lý đơn hàng tập trung.',
      status: 'active', priority: 'high', startDate: d(-70), endDate: d(65),
      managerId: 'u3', memberIds: ['u1', 'u3', 'u4', 'u6', 'u7'],
      budget: 850_000_000, budgetUsed: 420_000_000, color: '#4F46E5',
      createdAt: d(-70), updatedAt: d(-1),
    },
    {
      id: 'p2', code: 'NEX-002', name: 'Ứng dụng Mobile Banking',
      description: 'Ứng dụng ngân hàng số với đăng nhập sinh trắc học, chuyển khoản tức thì và quản lý tài chính cá nhân.',
      status: 'active', priority: 'urgent', startDate: d(-45), endDate: d(30),
      managerId: 'u2', memberIds: ['u1', 'u2', 'u5', 'u6'],
      budget: 1_200_000_000, budgetUsed: 780_000_000, color: '#0284C7',
      createdAt: d(-45), updatedAt: d(-1),
    },
    {
      id: 'p3', code: 'NEX-003', name: 'Hệ thống CRM nội bộ',
      description: 'Hệ thống quản lý quan hệ khách hàng nội bộ, tích hợp pipeline bán hàng và chăm sóc khách hàng.',
      status: 'planning', priority: 'medium', startDate: d(10), endDate: d(120),
      managerId: 'u3', memberIds: ['u3', 'u5', 'u6'],
      budget: 600_000_000, budgetUsed: 45_000_000, color: '#A855F7',
      createdAt: d(-12), updatedAt: d(-2),
    },
    {
      id: 'p4', code: 'NEX-004', name: 'Website marketing công ty',
      description: 'Làm mới website giới thiệu công ty, tối ưu chuyển đổi và SEO.',
      status: 'paused', priority: 'low', startDate: d(-90), endDate: d(20),
      managerId: 'u3', memberIds: ['u3', 'u5', 'u7'],
      color: '#16A34A', createdAt: d(-90), updatedAt: d(-20),
    },
    {
      id: 'p5', code: 'NEX-005', name: 'Tích hợp cổng thanh toán',
      description: 'Tích hợp VNPay và MoMo cho toàn bộ sản phẩm của công ty.',
      status: 'completed', priority: 'high', startDate: d(-120), endDate: d(-15),
      managerId: 'u2', memberIds: ['u2', 'u6', 'u4'],
      budget: 300_000_000, budgetUsed: 285_000_000, color: '#F97316',
      createdAt: d(-120), updatedAt: d(-15),
    },
  ];

  type T = Partial<Task> & { id: string; title: string; projectId: string };
  const mk = (t: T, i: number): Task => {
    const p = projects.find((x) => x.id === t.projectId)!;
    return {
      code: `${p.code}-${String(i).padStart(2, '0')}`,
      description: '',
      status: 'todo',
      priority: 'medium',
      assigneeIds: [],
      creatorId: 'u1',
      watcherIds: [],
      labelIds: [],
      createdAt: d(-30),
      updatedAt: d(-1),
      ...t,
    } as Task;
  };

  const tasks: Task[] = [
    mk({ id: 't1', title: 'Thiết kế hệ thống giỏ hàng', projectId: 'p1', status: 'in_progress', priority: 'high', assigneeIds: ['u4'], creatorId: 'u3', startDate: d(-10), dueDate: d(3), labelIds: ['l2', 'l6'], estimateHours: 24, actualHours: 14, description: 'Thiết kế luồng thêm/sửa/xóa sản phẩm trong giỏ, áp dụng mã giảm giá và tính phí vận chuyển.' }, 1),
    mk({ id: 't2', title: 'Xây dựng API thanh toán', projectId: 'p1', status: 'in_progress', priority: 'urgent', assigneeIds: ['u6'], creatorId: 'u2', startDate: d(-8), dueDate: d(5), labelIds: ['l5', 'l2', 'l7'], estimateHours: 32, actualHours: 20, description: 'API tạo đơn thanh toán, xử lý callback và đối soát giao dịch.' }, 2),
    mk({ id: 't3', title: 'Tối ưu tốc độ tải trang chủ', projectId: 'p1', status: 'todo', priority: 'medium', assigneeIds: ['u4'], creatorId: 'u3', startDate: d(2), dueDate: d(10), labelIds: ['l6'], estimateHours: 12, description: 'Mục tiêu LCP dưới 2.5s: lazy-load ảnh, code splitting, cache CDN.' }, 3),
    mk({ id: 't4', title: 'Viết tài liệu API cho đối tác', projectId: 'p1', status: 'todo', priority: 'low', assigneeIds: ['u7'], creatorId: 'u3', startDate: d(5), dueDate: d(15), labelIds: ['l4'], estimateHours: 8 }, 4),
    mk({ id: 't5', title: 'Kiểm thử bảo mật đăng nhập', projectId: 'p1', status: 'in_review', priority: 'high', assigneeIds: ['u6'], creatorId: 'u2', watcherIds: ['u1'], startDate: d(-6), dueDate: d(-2), labelIds: ['l5', 'l1'], estimateHours: 16, actualHours: 18, description: 'Pentest luồng đăng nhập: brute-force, session fixation, rate limiting.' }, 5),
    mk({ id: 't6', title: 'Thiết kế trang chi tiết sản phẩm', projectId: 'p1', status: 'done', priority: 'medium', assigneeIds: ['u4'], creatorId: 'u3', startDate: d(-30), dueDate: d(-20), labelIds: ['l3', 'l6'], estimateHours: 16, actualHours: 15, completedAt: d(-18), description: 'Layout gallery ảnh, variant sản phẩm, đánh giá và Q&A.' }, 6),
    mk({ id: 't7', title: 'Tích hợp đơn vị vận chuyển', projectId: 'p1', status: 'todo', priority: 'medium', assigneeIds: ['u6'], creatorId: 'u3', startDate: d(8), dueDate: d(20), labelIds: ['l5'], estimateHours: 20 }, 7),
    mk({ id: 't8', title: 'Sửa lỗi hiển thị giá trên mobile', projectId: 'p1', status: 'in_progress', priority: 'urgent', assigneeIds: ['u4', 'u1'], creatorId: 'u1', watcherIds: ['u3'], startDate: d(-4), dueDate: d(-1), labelIds: ['l1', 'l6', 'l7'], estimateHours: 6, actualHours: 4, description: 'Giá bị tràn khung trên màn hình dưới 360px. Khách hàng báo từ sáng qua.' }, 8),

    mk({ id: 't9', title: 'Màn hình đăng nhập sinh trắc học', projectId: 'p2', status: 'in_progress', priority: 'urgent', assigneeIds: ['u5'], creatorId: 'u2', startDate: d(-5), dueDate: d(2), labelIds: ['l2', 'l6', 'l7'], estimateHours: 20, actualHours: 12, description: 'Face ID / vân tay cho iOS và Android, fallback về PIN.' }, 1),
    mk({ id: 't10', title: 'Mã hóa dữ liệu giao dịch', projectId: 'p2', status: 'in_review', priority: 'urgent', assigneeIds: ['u6'], creatorId: 'u2', startDate: d(-7), dueDate: d(1), labelIds: ['l5', 'l7'], estimateHours: 24, actualHours: 26, description: 'AES-256 cho dữ liệu nhạy cảm, key rotation 90 ngày.' }, 2),
    mk({ id: 't11', title: 'Thiết kế dashboard tài khoản', projectId: 'p2', status: 'done', priority: 'high', assigneeIds: ['u5'], creatorId: 'u2', startDate: d(-25), dueDate: d(-10), labelIds: ['l3'], estimateHours: 18, actualHours: 20, completedAt: d(-9) }, 3),
    mk({ id: 't12', title: 'Tích hợp thông báo đẩy', projectId: 'p2', status: 'todo', priority: 'medium', assigneeIds: ['u5'], creatorId: 'u2', startDate: d(3), dueDate: d(8), labelIds: ['l2'], estimateHours: 10, description: 'Push cho biến động số dư, nhắc thanh toán hóa đơn.' }, 4),
    mk({ id: 't13', title: 'Kiểm thử hiệu năng app', projectId: 'p2', status: 'todo', priority: 'high', assigneeIds: ['u1'], creatorId: 'u2', startDate: d(1), dueDate: d(4), labelIds: ['l5'], estimateHours: 12, description: 'Load test 10k concurrent users, đo thời gian phản hồi API.' }, 5),
    mk({ id: 't14', title: 'Sửa crash khi chuyển khoản', projectId: 'p2', status: 'in_progress', priority: 'urgent', assigneeIds: ['u6'], creatorId: 'u1', watcherIds: ['u2'], startDate: d(-6), dueDate: d(-3), labelIds: ['l1', 'l7'], estimateHours: 8, actualHours: 10, description: 'App crash khi chuyển khoản trên Android 12. Log đã đính kèm.' }, 6),
    mk({ id: 't15', title: 'Viết chính sách bảo mật', projectId: 'p2', status: 'todo', priority: 'low', assigneeIds: ['u7'], creatorId: 'u2', startDate: d(10), dueDate: d(25), labelIds: ['l4'], estimateHours: 8 }, 7),

    mk({ id: 't16', title: 'Khảo sát yêu cầu nghiệp vụ', projectId: 'p3', status: 'in_progress', priority: 'medium', assigneeIds: ['u3'], creatorId: 'u3', startDate: d(-3), dueDate: d(6), estimateHours: 16, actualHours: 6, description: 'Phỏng vấn team sales và CSKH, tổng hợp thành BRD.' }, 1),
    mk({ id: 't17', title: 'Thiết kế schema database', projectId: 'p3', status: 'todo', priority: 'high', assigneeIds: ['u6'], creatorId: 'u3', startDate: d(7), dueDate: d(12), labelIds: ['l5'], estimateHours: 12 }, 2),
    mk({ id: 't18', title: 'Prototype giao diện quản lý khách hàng', projectId: 'p3', status: 'todo', priority: 'medium', assigneeIds: ['u5'], creatorId: 'u3', startDate: d(8), dueDate: d(14), labelIds: ['l3', 'l6'], estimateHours: 16 }, 3),
    mk({ id: 't19', title: 'Lập kế hoạch triển khai', projectId: 'p3', status: 'done', priority: 'low', assigneeIds: ['u3'], creatorId: 'u1', startDate: d(-12), dueDate: d(-5), completedAt: d(-5), estimateHours: 8, actualHours: 8 }, 4),

    mk({ id: 't20', title: 'Viết nội dung landing page', projectId: 'p4', status: 'todo', priority: 'low', assigneeIds: ['u7'], creatorId: 'u3', startDate: d(20), dueDate: d(30), labelIds: ['l4'], estimateHours: 10 }, 1),
    mk({ id: 't21', title: 'Thiết kế banner hero', projectId: 'p4', status: 'in_review', priority: 'medium', assigneeIds: ['u5'], creatorId: 'u3', startDate: d(-15), dueDate: d(-8), labelIds: ['l3'], estimateHours: 8, actualHours: 9 }, 2),
    mk({ id: 't22', title: 'Tối ưu SEO cơ bản', projectId: 'p4', status: 'todo', priority: 'low', assigneeIds: ['u7'], creatorId: 'u3', startDate: d(25), dueDate: d(35), estimateHours: 6 }, 3),

    mk({ id: 't23', title: 'Tích hợp VNPay sandbox', projectId: 'p5', status: 'done', priority: 'high', assigneeIds: ['u6'], creatorId: 'u2', startDate: d(-60), dueDate: d(-40), labelIds: ['l5'], estimateHours: 20, actualHours: 18, completedAt: d(-42) }, 1),
    mk({ id: 't24', title: 'Tích hợp MoMo', projectId: 'p5', status: 'done', priority: 'high', assigneeIds: ['u6'], creatorId: 'u2', startDate: d(-50), dueDate: d(-35), labelIds: ['l5'], estimateHours: 20, actualHours: 22, completedAt: d(-36) }, 2),
    mk({ id: 't25', title: 'Xử lý callback giao dịch', projectId: 'p5', status: 'done', priority: 'high', assigneeIds: ['u4'], creatorId: 'u2', startDate: d(-45), dueDate: d(-30), labelIds: ['l5'], estimateHours: 16, actualHours: 14, completedAt: d(-31) }, 3),
    mk({ id: 't26', title: 'Tài liệu hướng dẫn tích hợp', projectId: 'p5', status: 'done', priority: 'medium', assigneeIds: ['u7'], creatorId: 'u2', startDate: d(-30), dueDate: d(-20), labelIds: ['l4'], estimateHours: 8, actualHours: 8, completedAt: d(-20) }, 4),
  ];

  const checklists: ChecklistItem[] = [
    { id: 'c1', taskId: 't1', title: 'Thiết kế wireframe giỏ hàng', done: true },
    { id: 'c2', taskId: 't1', title: 'Áp dụng mã giảm giá', done: true },
    { id: 'c3', taskId: 't1', title: 'Tính phí vận chuyển theo khu vực', done: false },
    { id: 'c4', taskId: 't2', title: 'Endpoint tạo đơn thanh toán', done: true },
    { id: 'c5', taskId: 't2', title: 'Xử lý callback', done: false },
    { id: 'c6', taskId: 't2', title: 'Đối soát cuối ngày', done: false },
    { id: 'c7', taskId: 't9', title: 'Đăng ký Face ID iOS', done: true },
    { id: 'c8', taskId: 't9', title: 'Vân tay Android', done: false },
    { id: 'c9', taskId: 't9', title: 'Fallback PIN 6 số', done: false },
  ];

  const comments: TaskComment[] = [
    { id: 'cm1', taskId: 't8', authorId: 'u3', body: '@Nguyễn Minh Anh khách hàng vừa gọi lại, họ cần fix này trước cuối ngày mai nhé.', createdAt: d(-1, 10) },
    { id: 'cm2', taskId: 't8', authorId: 'u1', body: 'Đã xác định nguyên nhân do CSS grid, đang fix. Chiều nay sẽ có bản test.', createdAt: d(-1, 14) },
    { id: 'cm3', taskId: 't5', authorId: 'u2', body: 'Kết quả pentest vòng 1 đã có, còn 2 finding mức medium cần xử lý.', createdAt: d(-3, 16) },
    { id: 'cm4', taskId: 't14', authorId: 'u6', body: 'Crash do null pointer ở payment SDK version cũ. Đề xuất nâng lên 3.2.1.', createdAt: d(-2, 11) },
    { id: 'cm5', taskId: 't14', authorId: 'u2', body: 'Đồng ý, nâng SDK và test regression trước khi release.', createdAt: d(-2, 15) },
    { id: 'cm6', taskId: 't1', authorId: 'u4', body: 'Đã xong phần mã giảm giá, còn tính phí ship theo khu vực.', createdAt: d(-2, 9) },
    { id: 'cm7', taskId: 't21', authorId: 'u3', body: 'Banner bản 2 đẹp hơn rồi, chờ duyệt lần cuối.', createdAt: d(-9, 10) },
  ];

  const dependencies: TaskDependency[] = [
    { id: 'dep1', taskId: 't7', dependsOnId: 't2' },
    { id: 'dep2', taskId: 't10', dependsOnId: 't9' },
    { id: 'dep3', taskId: 't17', dependsOnId: 't16' },
  ];

  const attachments: TaskAttachment[] = [
    { id: 'a1', taskId: 't14', name: 'crash-log-android12.txt', size: '48 KB', uploadedBy: 'u1', createdAt: d(-6, 10) },
    { id: 'a2', taskId: 't5', name: 'pentest-report-v1.pdf', size: '1.2 MB', uploadedBy: 'u6', createdAt: d(-3, 16) },
  ];

  const notifications: Notification[] = [
    { id: 'n1', userId: 'u1', kind: 'assigned', title: 'Bạn được giao nhiệm vụ mới', body: 'Trần Đức Huy đã giao cho bạn "Kiểm thử hiệu năng app".', link: '/tasks/t13', read: false, createdAt: d(-1, 9) },
    { id: 'n2', userId: 'u1', kind: 'overdue', title: 'Nhiệm vụ quá hạn', body: '"Sửa lỗi hiển thị giá trên mobile" đã quá hạn 1 ngày.', link: '/tasks/t8', read: false, createdAt: d(0, 8) },
    { id: 'n3', userId: 'u1', kind: 'comment', title: 'Lê Thu Trang đã nhắc đến bạn', body: 'Trong "Sửa lỗi hiển thị giá trên mobile": khách hàng cần fix trước cuối ngày mai.', link: '/tasks/t8', read: false, createdAt: d(-1, 10) },
    { id: 'n4', userId: 'u1', kind: 'due_soon', title: 'Sắp đến hạn', body: '"Kiểm thử hiệu năng app" đến hạn trong 4 ngày.', link: '/tasks/t13', read: true, createdAt: d(-2, 8) },
    { id: 'n5', userId: 'u1', kind: 'project', title: 'Dự án hoàn thành', body: '"Tích hợp cổng thanh toán" đã được đánh dấu hoàn thành.', link: '/projects/p5', read: true, createdAt: d(-15, 17) },
    { id: 'n6', userId: 'u1', kind: 'member', title: 'Thành viên mới', body: 'Bùi Hoàng Nam đã được mời vào workspace.', link: '/team', read: true, createdAt: d(-4, 9) },
    { id: 'n7', userId: 'u1', kind: 'assigned', title: 'Bạn được giao nhiệm vụ mới', body: 'Bạn được thêm vào "Sửa lỗi hiển thị giá trên mobile".', link: '/tasks/t8', read: true, createdAt: d(-4, 14) },
  ];

  const activityLogs: ActivityLog[] = [
    { id: 'ac1', actorId: 'u4', action: 'đã cập nhật', entityType: 'task', entityId: 't8', entityName: 'Sửa lỗi hiển thị giá trên mobile', createdAt: d(0, 9) },
    { id: 'ac2', actorId: 'u1', action: 'đã bình luận trong', entityType: 'task', entityId: 't8', entityName: 'Sửa lỗi hiển thị giá trên mobile', createdAt: d(-1, 14) },
    { id: 'ac3', actorId: 'u3', action: 'đã bình luận trong', entityType: 'task', entityId: 't8', entityName: 'Sửa lỗi hiển thị giá trên mobile', createdAt: d(-1, 10) },
    { id: 'ac4', actorId: 'u2', action: 'đã giao', entityType: 'task', entityId: 't13', entityName: 'Kiểm thử hiệu năng app cho Nguyễn Minh Anh', createdAt: d(-1, 9) },
    { id: 'ac5', actorId: 'u6', action: 'đã bình luận trong', entityType: 'task', entityId: 't14', entityName: 'Sửa crash khi chuyển khoản', createdAt: d(-2, 11) },
    { id: 'ac6', actorId: 'u4', action: 'đã bình luận trong', entityType: 'task', entityId: 't1', entityName: 'Thiết kế hệ thống giỏ hàng', createdAt: d(-2, 9) },
    { id: 'ac7', actorId: 'u2', action: 'đã chuyển trạng thái', entityType: 'task', entityId: 't10', entityName: 'Mã hóa dữ liệu giao dịch sang Đang chờ duyệt', createdAt: d(-2, 17) },
    { id: 'ac8', actorId: 'u2', action: 'đã bình luận trong', entityType: 'task', entityId: 't5', entityName: 'Kiểm thử bảo mật đăng nhập', createdAt: d(-3, 16) },
    { id: 'ac9', actorId: 'u1', action: 'đã mời', entityType: 'member', entityId: 'u8', entityName: 'Bùi Hoàng Nam vào workspace', createdAt: d(-4, 9) },
    { id: 'ac10', actorId: 'u3', action: 'đã tạo', entityType: 'project', entityId: 'p3', entityName: 'Hệ thống CRM nội bộ', createdAt: d(-12, 10) },
    { id: 'ac11', actorId: 'u2', action: 'đã đánh dấu hoàn thành', entityType: 'project', entityId: 'p5', entityName: 'Tích hợp cổng thanh toán', createdAt: d(-15, 17) },
    { id: 'ac12', actorId: 'u3', action: 'đã tạm dừng', entityType: 'project', entityId: 'p4', entityName: 'Website marketing công ty', createdAt: d(-20, 15) },
  ];

  const documents: Document[] = [
    { id: 'doc1', projectId: 'p1', title: 'Kế hoạch dự án Q4', content: 'Mục tiêu quý 4: hoàn thành MVP thương mại điện tử, ra mắt mobile banking beta và khởi động CRM nội bộ...', authorId: 'u1', createdAt: d(-25), updatedAt: d(-3) },
    { id: 'doc2', title: 'Quy trình phát triển sản phẩm', content: '1. Thu thập yêu cầu → 2. Thiết kế → 3. Phát triển → 4. Kiểm thử → 5. Triển khai → 6. Vận hành...', authorId: 'u2', createdAt: d(-60), updatedAt: d(-10) },
    { id: 'doc3', projectId: 'p2', title: 'Yêu cầu bảo mật Mobile Banking', content: 'Tất cả dữ liệu nhạy cảm phải mã hóa AES-256. Phiên đăng nhập hết hạn sau 15 phút không hoạt động...', authorId: 'u2', createdAt: d(-40), updatedAt: d(-5) },
    { id: 'doc4', title: 'Brand guideline 2026', content: 'Màu chủ đạo Indigo #4F46E5, font Inter, bo góc 8-12px, tone giọng thân thiện và chuyên nghiệp...', authorId: 'u5', createdAt: d(-50), updatedAt: d(-20) },
  ];

  return {
    workspace: { id: 'w1', name: 'Nexus Workspace', timezone: 'Asia/Ho_Chi_Minh' },
    users,
    currentUserId: 'u1',
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
  };
}
