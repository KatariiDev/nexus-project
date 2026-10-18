-- ============================================================================
-- NEXUS PROJECT — MIGRATION 01: CLEAN RESET & CORE SCHEMA
-- ============================================================================
-- Mục đích:
--   1. Xóa sạch toàn bộ bảng, trigger, function cũ bị xung đột trên schema public.
--   2. Khởi tạo lại từ đầu 18 bảng dữ liệu chuẩn xác 100% với codebase TypeScript.
--   3. Thiết lập đầy đủ khóa ngoại (ON DELETE CASCADE), Ràng buộc (CHECK),
--      Chỉ mục (INDEX) và Trigger tự động cập nhật updated_at.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- PHẦN 1: DỌN SẠCH SCHEMA CŨ (CLEAN DROP)
-- ----------------------------------------------------------------------------
drop trigger if exists on_auth_user_created on auth.users;
drop trigger if exists on_auth_user_updated on auth.users;

drop table if exists public.documents cascade;
drop table if exists public.activity_logs cascade;
drop table if exists public.notifications cascade;
drop table if exists public.task_attachments cascade;
drop table if exists public.task_labels cascade;
drop table if exists public.labels cascade;
drop table if exists public.task_dependencies cascade;
drop table if exists public.task_checklists cascade;
drop table if exists public.task_comments cascade;
drop table if exists public.task_watchers cascade;
drop table if exists public.task_assignees cascade;
drop table if exists public.tasks cascade;
drop table if exists public.project_requests cascade;
drop table if exists public.project_members cascade;
drop table if exists public.projects cascade;
drop table if exists public.workspace_members cascade;
drop table if exists public.workspaces cascade;
drop table if exists public.profiles cascade;

drop function if exists public.bootstrap_workspace(text) cascade;
drop function if exists public.handle_new_user() cascade;
drop function if exists public.set_updated_at() cascade;
drop function if exists public.is_ws_member(uuid) cascade;
drop function if exists public.ws_role(uuid) cascade;
drop function if exists public.project_ws(uuid) cascade;
drop function if exists public.task_ws(uuid) cascade;

-- ----------------------------------------------------------------------------
-- PHẦN 2: EXTENSIONS & TRIGGER HELPER
-- ----------------------------------------------------------------------------
create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- PHẦN 3: BẢNG HỒ SƠ & WORKSPACE (HỢP NHẤT DISCORD OAUTH + EMAIL)
-- ----------------------------------------------------------------------------

-- 1. Hồ sơ người dùng (1-1 với auth.users)
-- Hỗ trợ cả đăng nhập Discord (lưu tên server BCN, username Discord, avatar_url)
-- và đăng nhập Email/Password dự phòng.
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  name        text not null default '',
  email       text not null default '',
  username    text,
  title       text default '',
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index idx_profiles_email_lower on public.profiles (lower(email));
create index idx_profiles_username_lower on public.profiles (lower(username));

create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- 2. Workspace
create table public.workspaces (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  timezone    text not null default 'Asia/Ho_Chi_Minh',
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger trg_workspaces_updated_at
  before update on public.workspaces
  for each row execute function public.set_updated_at();

-- 3. Thành viên Workspace & Phân quyền (Admin > Owner > Manager > Member > Viewer)
create table public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  role         text not null default 'member'
               check (role in ('admin', 'owner', 'manager', 'member', 'viewer')),
  created_at   timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create index idx_workspace_members_user on public.workspace_members(user_id);

-- ----------------------------------------------------------------------------
-- PHẦN 4: DỰ ÁN & YÊU CẦU PHÊ DUYỆT DỰ ÁN
-- ----------------------------------------------------------------------------

-- 4. Dự án (Projects)
create table public.projects (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  code         text not null,
  name         text not null,
  description  text default '',
  status       text not null default 'planning'
               check (status in ('planning', 'active', 'paused', 'completed', 'archived')),
  priority     text not null default 'medium'
               check (priority in ('low', 'medium', 'high', 'urgent')),
  start_date   date,
  end_date     date,
  manager_id   uuid references public.profiles(id) on delete set null,
  budget       numeric(14, 2) default 0,
  budget_used  numeric(14, 2) default 0,
  color        text default '#4F46E5',
  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (workspace_id, code)
);

create index idx_projects_workspace on public.projects(workspace_id);

create trigger trg_projects_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

-- 5. Thành viên tham gia Dự án (N-N)
create table public.project_members (
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

create index idx_project_members_user on public.project_members(user_id);

-- 6. Yêu cầu phê duyệt dự án (Owner gửi -> Admin phê duyệt)
create table public.project_requests (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  type         text not null
               check (type in ('create_project', 'pause_project', 'delete_project')),
  project_id   uuid references public.projects(id) on delete cascade,
  payload      jsonb not null default '{}'::jsonb,
  status       text not null default 'pending'
               check (status in ('pending', 'approved', 'rejected')),
  requested_by uuid not null references public.profiles(id) on delete cascade,
  reviewed_by  uuid references public.profiles(id) on delete set null,
  review_note  text,
  created_at   timestamptz not null default now(),
  reviewed_at  timestamptz
);

create index idx_project_requests_ws_status on public.project_requests(workspace_id, status, created_at desc);

-- ----------------------------------------------------------------------------
-- PHẦN 5: NHIỆM VỤ (TASKS) & CÁC BẢNG PHỤ TRỢ
-- ----------------------------------------------------------------------------

-- 7. Nhiệm vụ (Tasks)
create table public.tasks (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null references public.projects(id) on delete cascade,
  code           text not null,
  title          text not null,
  description    text default '',
  status         text not null default 'todo'
                 check (status in ('todo', 'in_progress', 'in_review', 'done')),
  priority       text not null default 'medium'
                 check (priority in ('low', 'medium', 'high', 'urgent')),
  creator_id     uuid references public.profiles(id) on delete set null,
  start_date     date,
  due_date       date,
  estimate_hours numeric(8, 2),
  actual_hours   numeric(8, 2),
  completed_at   timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (project_id, code)
);

create index idx_tasks_project on public.tasks(project_id);
create index idx_tasks_status on public.tasks(status);
create index idx_tasks_due_date on public.tasks(due_date);

create trigger trg_tasks_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

-- 8. Người được giao việc (Task Assignees)
create table public.task_assignees (
  task_id    uuid not null references public.tasks(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (task_id, user_id)
);

create index idx_task_assignees_user on public.task_assignees(user_id);

-- 9. Người theo dõi nhiệm vụ (Task Watchers)
create table public.task_watchers (
  task_id    uuid not null references public.tasks(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (task_id, user_id)
);

-- 10. Bình luận nhiệm vụ (Task Comments)
create table public.task_comments (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references public.tasks(id) on delete cascade,
  author_id  uuid not null references public.profiles(id) on delete cascade,
  body       text not null,
  created_at timestamptz not null default now()
);

create index idx_task_comments_task on public.task_comments(task_id);

-- 11. Danh sách kiểm tra (Task Checklists)
create table public.task_checklists (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references public.tasks(id) on delete cascade,
  title      text not null,
  done       boolean not null default false,
  position   int not null default 0,
  created_at timestamptz not null default now()
);

create index idx_task_checklists_task on public.task_checklists(task_id);

-- 12. Phụ thuộc giữa các nhiệm vụ (Task Dependencies)
create table public.task_dependencies (
  id            uuid primary key default gen_random_uuid(),
  task_id       uuid not null references public.tasks(id) on delete cascade,
  depends_on_id uuid not null references public.tasks(id) on delete cascade,
  created_at    timestamptz not null default now(),
  check (task_id <> depends_on_id),
  unique (task_id, depends_on_id)
);

-- 13. Nhãn phân loại trong Workspace (Labels)
create table public.labels (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name         text not null,
  color        text not null default '#6366F1',
  created_at   timestamptz not null default now(),
  unique (workspace_id, name)
);

-- 14. Gắn nhãn cho nhiệm vụ (Task Labels)
create table public.task_labels (
  task_id  uuid not null references public.tasks(id) on delete cascade,
  label_id uuid not null references public.labels(id) on delete cascade,
  primary key (task_id, label_id)
);

-- 15. Tệp đính kèm nhiệm vụ (Task Attachments)
create table public.task_attachments (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid not null references public.tasks(id) on delete cascade,
  name        text not null,
  path        text not null,
  size_bytes  bigint not null default 0,
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- PHẦN 6: THÔNG BÁO, NHẬT KÝ HOẠT ĐỘNG & TÀI LIỆU
-- ----------------------------------------------------------------------------

-- 16. Thông báo cá nhân (Notifications)
create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  kind       text not null
             check (kind in ('assigned', 'due_soon', 'overdue', 'comment', 'project', 'member', 'review')),
  title      text not null,
  body       text default '',
  link       text,
  read       boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_notifications_user_read on public.notifications(user_id, read, created_at desc);

-- 17. Nhật ký hoạt động (Activity Logs)
create table public.activity_logs (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor_id     uuid references public.profiles(id) on delete set null,
  action       text not null,
  entity_type  text not null
               check (entity_type in ('project', 'task', 'comment', 'member', 'document')),
  entity_id    text not null,
  entity_name  text not null,
  created_at   timestamptz not null default now()
);

create index idx_activity_logs_workspace on public.activity_logs(workspace_id, created_at desc);

-- 18. Tài liệu dự án / workspace (Documents)
create table public.documents (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id   uuid references public.projects(id) on delete set null,
  title        text not null,
  content      text default '',
  author_id    uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index idx_documents_workspace on public.documents(workspace_id);

create trigger trg_documents_updated_at
  before update on public.documents
  for each row execute function public.set_updated_at();

