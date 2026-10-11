-- ============================================================================
-- Nexus Project — Initial schema
-- Chạy bằng: supabase db push  (hoặc dán vào SQL Editor của Supabase)
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- Helper: updated_at tự động
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ----------------------------------------------------------------------------
-- TABLES
-- ----------------------------------------------------------------------------

-- Hồ sơ người dùng (1-1 với auth.users)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null,
  title text default '',
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();

-- Workspace
create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  timezone text default 'Asia/Ho_Chi_Minh',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create trigger trg_workspaces_updated before update on public.workspaces
  for each row execute function public.set_updated_at();

-- Thành viên workspace + vai trò
create table public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('owner','admin','manager','member','viewer')),
  created_at timestamptz default now(),
  primary key (workspace_id, user_id)
);

-- Dự án
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  code text not null,
  name text not null,
  description text default '',
  status text not null default 'planning'
    check (status in ('planning','active','paused','completed','archived')),
  priority text not null default 'medium'
    check (priority in ('low','medium','high','urgent')),
  start_date date,
  end_date date,
  manager_id uuid references public.profiles(id) on delete set null,
  budget numeric,
  budget_used numeric default 0,
  color text default '#4F46E5',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (workspace_id, code),
  check (end_date is null or start_date is null or end_date >= start_date)
);
create trigger trg_projects_updated before update on public.projects
  for each row execute function public.set_updated_at();
create index idx_projects_workspace on public.projects(workspace_id);
create index idx_projects_status on public.projects(status);

-- Thành viên dự án
create table public.project_members (
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (project_id, user_id)
);

-- Nhiệm vụ
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  code text not null,
  title text not null,
  description text default '',
  status text not null default 'todo'
    check (status in ('todo','in_progress','in_review','done')),
  priority text not null default 'medium'
    check (priority in ('low','medium','high','urgent')),
  creator_id uuid references public.profiles(id) on delete set null,
  start_date timestamptz,
  due_date timestamptz,
  estimate_hours numeric,
  actual_hours numeric,
  completed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (project_id, code)
);
create trigger trg_tasks_updated before update on public.tasks
  for each row execute function public.set_updated_at();
create index idx_tasks_project on public.tasks(project_id);
create index idx_tasks_status on public.tasks(status);
create index idx_tasks_due on public.tasks(due_date);

-- Người thực hiện / người theo dõi
create table public.task_assignees (
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (task_id, user_id)
);
create table public.task_watchers (
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (task_id, user_id)
);

-- Bình luận
create table public.task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  body text not null,
  created_at timestamptz default now()
);
create index idx_comments_task on public.task_comments(task_id);

-- Checklist
create table public.task_checklists (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  title text not null,
  done boolean default false,
  position int default 0,
  created_at timestamptz default now()
);
create index idx_checklists_task on public.task_checklists(task_id);

-- Phụ thuộc giữa nhiệm vụ
create table public.task_dependencies (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  depends_on_id uuid not null references public.tasks(id) on delete cascade,
  created_at timestamptz default now(),
  check (task_id != depends_on_id),
  unique (task_id, depends_on_id)
);

-- Nhãn (theo workspace)
create table public.labels (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  color text not null,
  created_at timestamptz default now(),
  unique (workspace_id, name)
);
create table public.task_labels (
  task_id uuid not null references public.tasks(id) on delete cascade,
  label_id uuid not null references public.labels(id) on delete cascade,
  primary key (task_id, label_id)
);

-- Tệp đính kèm (metadata; file thật lưu trong Storage bucket task-attachments)
create table public.task_attachments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  name text not null,
  path text not null,
  size_bytes bigint,
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now()
);

-- Thông báo
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null,
  title text not null,
  body text default '',
  link text,
  read boolean default false,
  created_at timestamptz default now()
);
create index idx_notifications_user on public.notifications(user_id, created_at desc);

-- Lịch sử hoạt động
create table public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  entity_name text default '',
  created_at timestamptz default now()
);
create index idx_activity_workspace on public.activity_logs(workspace_id, created_at desc);

-- Tài liệu
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  title text not null,
  content text default '',
  author_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create trigger trg_documents_updated before update on public.documents
  for each row execute function public.set_updated_at();
create index idx_documents_workspace on public.documents(workspace_id);
