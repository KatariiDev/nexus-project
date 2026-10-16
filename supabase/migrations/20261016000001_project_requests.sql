-- ============================================================================
-- Nexus Project — Quy trình phê duyệt dự án
-- Bảng `project_requests`: member gửi yêu cầu tạo / tạm dừng / xóa dự án,
-- Owner/Admin duyệt hoặc từ chối trên trang /admin.
-- ============================================================================

create table if not exists public.project_requests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  type text not null check (type in ('create_project', 'pause_project', 'delete_project')),
  project_id uuid references public.projects(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  requested_by uuid not null references public.profiles(id) on delete cascade,
  reviewed_by uuid references public.profiles(id) on delete set null,
  review_note text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create index if not exists idx_project_requests_workspace
  on public.project_requests (workspace_id, status, created_at desc);

alter table public.project_requests enable row level security;

-- Thành viên workspace được xem yêu cầu trong workspace của mình
drop policy if exists p_preq_read on public.project_requests;
create policy p_preq_read on public.project_requests for select to authenticated
  using (public.is_ws_member(workspace_id));

-- Thành viên được tạo yêu cầu cho chính mình (luôn ở trạng thái pending)
drop policy if exists p_preq_insert on public.project_requests;
create policy p_preq_insert on public.project_requests for insert to authenticated
  with check (
    requested_by = auth.uid()
    and status = 'pending'
    and public.is_ws_member(workspace_id)
  );

-- Chỉ Owner/Admin được duyệt / từ chối (update)
drop policy if exists p_preq_review on public.project_requests;
create policy p_preq_review on public.project_requests for update to authenticated
  using (public.ws_role(workspace_id) in ('owner','admin'))
  with check (public.ws_role(workspace_id) in ('owner','admin'));

-- Không có policy delete: yêu cầu lưu lại làm lịch sử, không xóa trực tiếp.
