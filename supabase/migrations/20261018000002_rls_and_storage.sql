-- ============================================================================
-- NEXUS PROJECT — MIGRATION 03: ROW LEVEL SECURITY (RLS) & STORAGE
-- ============================================================================
-- Mục đích:
--   1. Định nghĩa các hàm helper SECURITY DEFINER tối ưu cho kiểm tra quyền.
--   2. Thiết lập RLS chuẩn xác theo phân cấp:
--      ADMIN (cao nhất) > OWNER > MANAGER > MEMBER > VIEWER (chỉ xem).
--   3. Cho phép thành viên gửi thông báo (notifications) chéo cho nhau khi
--      giao việc, bình luận, gửi/duyệt yêu cầu dự án.
--   4. Khởi tạo Storage Bucket 'task-attachments' và các policy bảo mật file.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- PHẦN 1: HÀM HELPER KIỂM TRA QUYỀN WORKSPACE
-- ----------------------------------------------------------------------------

-- Kiểm tra user hiện tại có thuộc workspace không
create or replace function public.is_ws_member(ws_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = ws_id and user_id = auth.uid()
  );
$$;

-- Lấy role của user hiện tại trong workspace
create or replace function public.ws_role(ws_id uuid)
returns text
language sql
security definer
stable
set search_path = public
as $$
  select role from public.workspace_members
  where workspace_id = ws_id and user_id = auth.uid();
$$;

-- Lấy workspace_id từ project_id
create or replace function public.project_ws(p_id uuid)
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select workspace_id from public.projects where id = p_id;
$$;

-- Lấy workspace_id từ task_id
create or replace function public.task_ws(t_id uuid)
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select p.workspace_id
  from public.tasks t
  join public.projects p on p.id = t.project_id
  where t.id = t_id;
$$;

-- Kiểm tra user có phải là Admin, Leader hoặc Member của dự án cụ thể không
create or replace function public.is_project_member(p_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.project_members where project_id = p_id and user_id = auth.uid()
  ) or exists (
    select 1 from public.projects where id = p_id and manager_id = auth.uid()
  ) or (public.ws_role(public.project_ws(p_id)) = 'admin');
$$;

-- Kiểm tra user có phải là Admin, Leader hoặc Member của dự án chứa task này không
create or replace function public.is_task_project_member(t_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.is_project_member(t.project_id)
  from public.tasks t
  where t.id = t_id;
$$;

-- ----------------------------------------------------------------------------
-- PHẦN 2: BẬT RLS TRÊN TOÀN BỘ 18 BẢNG
-- ----------------------------------------------------------------------------
alter table public.profiles          enable row level security;
alter table public.workspaces        enable row level security;
alter table public.workspace_members enable row level security;
alter table public.projects          enable row level security;
alter table public.project_members   enable row level security;
alter table public.project_requests  enable row level security;
alter table public.tasks             enable row level security;
alter table public.task_assignees    enable row level security;
alter table public.task_watchers     enable row level security;
alter table public.task_comments     enable row level security;
alter table public.task_checklists   enable row level security;
alter table public.task_dependencies enable row level security;
alter table public.labels            enable row level security;
alter table public.task_labels       enable row level security;
alter table public.task_attachments  enable row level security;
alter table public.notifications     enable row level security;
alter table public.activity_logs     enable row level security;
alter table public.documents         enable row level security;

-- ----------------------------------------------------------------------------
-- PHẦN 3: POLICIES CHO PROFILES & WORKSPACES
-- ----------------------------------------------------------------------------

-- 1. PROFILES: Mọi user đã đăng nhập đều đọc được hồ sơ đồng đội;
--    User tự sửa hồ sơ của mình (hoặc Admin/Owner cùng workspace cập nhật).
create policy p_profiles_select on public.profiles
  for select using (auth.uid() is not null);

create policy p_profiles_insert on public.profiles
  for insert with check (id = auth.uid());

create policy p_profiles_update on public.profiles
  for update using (
    id = auth.uid()
    or exists (
      select 1
      from public.workspace_members wm_me
      join public.workspace_members wm_target
        on wm_target.workspace_id = wm_me.workspace_id
      where wm_me.user_id = auth.uid()
        and wm_me.role in ('admin', 'owner')
        and wm_target.user_id = public.profiles.id
    )
  );

-- 2. WORKSPACES: Thành viên đọc; Admin/Owner cập nhật cấu hình workspace.
create policy p_ws_select on public.workspaces
  for select using (public.is_ws_member(id));

create policy p_ws_insert on public.workspaces
  for insert with check (created_by = auth.uid());

create policy p_ws_update on public.workspaces
  for update using (public.ws_role(id) in ('admin', 'owner'));

create policy p_ws_delete on public.workspaces
  for delete using (public.ws_role(id) = 'admin');

-- 3. WORKSPACE_MEMBERS: Đọc danh sách thành viên cùng workspace; Admin/Owner quản lý.
create policy p_wsm_select on public.workspace_members
  for select using (user_id = auth.uid() or public.is_ws_member(workspace_id));

create policy p_wsm_insert on public.workspace_members
  for insert with check (public.ws_role(workspace_id) in ('admin', 'owner'));

create policy p_wsm_update on public.workspace_members
  for update using (public.ws_role(workspace_id) in ('admin', 'owner'));

create policy p_wsm_delete on public.workspace_members
  for delete using (public.ws_role(workspace_id) in ('admin', 'owner') or user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- PHẦN 4: POLICIES CHO DỰ ÁN & PHÊ DUYỆT DỰ ÁN
-- ----------------------------------------------------------------------------

-- 4. PROJECTS: Thành viên đọc; Admin/Owner/Manager tạo & sửa; Admin/Owner xóa.
create policy p_proj_select on public.projects
  for select using (public.is_ws_member(workspace_id));

create policy p_proj_insert on public.projects
  for insert with check (public.ws_role(workspace_id) in ('admin', 'owner', 'manager'));

create policy p_proj_update on public.projects
  for update using (
    public.ws_role(workspace_id) in ('admin', 'owner', 'manager')
    or manager_id = auth.uid()
  );

create policy p_proj_delete on public.projects
  for delete using (public.ws_role(workspace_id) in ('admin', 'owner'));

-- 5. PROJECT_MEMBERS: Thành viên đọc; Admin hoặc Leader dự án quản lý.
create policy p_pm_select on public.project_members
  for select using (public.is_ws_member(public.project_ws(project_id)));

create policy p_pm_write on public.project_members
  for all using (
    public.ws_role(public.project_ws(project_id)) in ('admin', 'owner')
    or exists (select 1 from public.projects p where p.id = project_id and p.manager_id = auth.uid())
  )
  with check (
    public.ws_role(public.project_ws(project_id)) in ('admin', 'owner')
    or exists (select 1 from public.projects p where p.id = project_id and p.manager_id = auth.uid())
  );

-- 6. PROJECT_REQUESTS:
--    - Thành viên trong workspace xem được yêu cầu.
--    - Mọi thành viên workspace được gửi yêu cầu tạo/tạm dừng/xóa dự án lên Admin.
--    - Khi được duyệt, người gửi yêu cầu sẽ làm Leader dự án.
--    - Chỉ Admin được duyệt/từ chối (hoặc người gửi tự sửa/hủy khi còn pending).
create policy p_preq_select on public.project_requests
  for select using (public.is_ws_member(workspace_id));

create policy p_preq_insert on public.project_requests
  for insert with check (
    requested_by = auth.uid()
    and public.is_ws_member(workspace_id)
  );

create policy p_preq_update on public.project_requests
  for update using (
    public.ws_role(workspace_id) = 'admin'
    or (requested_by = auth.uid() and status = 'pending')
  );

create policy p_preq_delete on public.project_requests
  for delete using (
    public.ws_role(workspace_id) = 'admin'
    or (requested_by = auth.uid() and status = 'pending')
  );

-- ----------------------------------------------------------------------------
-- PHẦN 5: POLICIES CHO TASKS & CÁC BẢNG PHỤ TRỢ
-- ----------------------------------------------------------------------------

-- 7. TASKS:
--    - Mọi thành viên workspace đều được XEM (chỉ xem / Viewer đối với dự án mình không tham gia).
--    - CHỈ THÀNH VIÊN HOẶC LEADER CỦA DỰ ÁN (hoặc Admin) mới được tạo và cập nhật task.
--    - Admin, Leader dự án hoặc người tạo task được xóa.
create policy p_tasks_select on public.tasks
  for select using (public.is_ws_member(public.project_ws(project_id)));

create policy p_tasks_insert on public.tasks
  for insert with check (public.is_project_member(project_id));

create policy p_tasks_update on public.tasks
  for update using (public.is_project_member(project_id));

create policy p_tasks_delete on public.tasks
  for delete using (
    public.ws_role(public.project_ws(project_id)) = 'admin'
    or exists (select 1 from public.projects p where p.id = project_id and p.manager_id = auth.uid())
    or creator_id = auth.uid()
  );

-- 8. TASK_ASSIGNEES: Chỉ thành viên của dự án mới được phân công
create policy p_ta_select on public.task_assignees
  for select using (public.is_ws_member(public.task_ws(task_id)));

create policy p_ta_write on public.task_assignees
  for all using (public.is_task_project_member(task_id))
  with check (public.is_task_project_member(task_id));

-- 9. TASK_WATCHERS: Chỉ thành viên dự án
create policy p_tw_select on public.task_watchers
  for select using (public.is_ws_member(public.task_ws(task_id)));

create policy p_tw_write on public.task_watchers
  for all using (public.is_task_project_member(task_id))
  with check (public.is_task_project_member(task_id));

-- 10. TASK_COMMENTS: Chỉ thành viên dự án mới được bình luận
create policy p_tc_select on public.task_comments
  for select using (public.is_ws_member(public.task_ws(task_id)));

create policy p_tc_insert on public.task_comments
  for insert with check (
    author_id = auth.uid()
    and public.is_task_project_member(task_id)
  );

create policy p_tc_delete on public.task_comments
  for delete using (
    author_id = auth.uid()
    or public.ws_role(public.task_ws(task_id)) = 'admin'
    or exists (
      select 1 from public.tasks t
      join public.projects p on p.id = t.project_id
      where t.id = task_id and p.manager_id = auth.uid()
    )
  );

-- 11. TASK_CHECKLISTS: Chỉ thành viên dự án
create policy p_tcl_select on public.task_checklists
  for select using (public.is_ws_member(public.task_ws(task_id)));

create policy p_tcl_write on public.task_checklists
  for all using (public.is_task_project_member(task_id))
  with check (public.is_task_project_member(task_id));

-- 12. TASK_DEPENDENCIES: Chỉ thành viên dự án
create policy p_td_select on public.task_dependencies
  for select using (public.is_ws_member(public.task_ws(task_id)));

create policy p_td_write on public.task_dependencies
  for all using (public.is_task_project_member(task_id))
  with check (public.is_task_project_member(task_id));

-- 13. LABELS
create policy p_labels_select on public.labels
  for select using (public.is_ws_member(workspace_id));

create policy p_labels_write on public.labels
  for all using (public.ws_role(workspace_id) in ('admin', 'owner', 'manager', 'member'))
  with check (public.ws_role(workspace_id) in ('admin', 'owner', 'manager', 'member'));

-- 14. TASK_LABELS: Chỉ thành viên dự án
create policy p_tl_select on public.task_labels
  for select using (public.is_ws_member(public.task_ws(task_id)));

create policy p_tl_write on public.task_labels
  for all using (public.is_task_project_member(task_id))
  with check (public.is_task_project_member(task_id));

-- 15. TASK_ATTACHMENTS: Chỉ thành viên dự án
create policy p_att_select on public.task_attachments
  for select using (public.is_ws_member(public.task_ws(task_id)));

create policy p_att_write on public.task_attachments
  for all using (public.is_task_project_member(task_id))
  with check (public.is_task_project_member(task_id));

-- ----------------------------------------------------------------------------
-- PHẦN 6: POLICIES CHO NOTIFICATIONS, ACTIVITY_LOGS & DOCUMENTS
-- ----------------------------------------------------------------------------

-- 16. NOTIFICATIONS:
--     - User chỉ đọc/đánh dấu đã đọc/xóa thông báo của chính mình.
--     - Mọi thành viên (không phải Viewer) được phép tạo thông báo gửi cho
--       đồng đội (khi giao việc, bình luận, gửi/duyệt yêu cầu dự án).
create policy p_notif_select on public.notifications
  for select using (user_id = auth.uid());

create policy p_notif_insert on public.notifications
  for insert with check (
    user_id = auth.uid()
    or exists (
      select 1 from public.workspace_members wm
      where wm.user_id = auth.uid()
        and wm.role in ('admin', 'owner', 'manager', 'member')
    )
  );

create policy p_notif_update on public.notifications
  for update using (user_id = auth.uid());

create policy p_notif_delete on public.notifications
  for delete using (user_id = auth.uid());

-- 17. ACTIVITY_LOGS: Thành viên đọc; Mọi vai trò trừ Viewer được ghi log.
create policy p_logs_select on public.activity_logs
  for select using (public.is_ws_member(workspace_id));

create policy p_logs_insert on public.activity_logs
  for insert with check (
    public.ws_role(workspace_id) in ('admin', 'owner', 'manager', 'member')
  );

-- 18. DOCUMENTS: Thành viên đọc; Mọi vai trò trừ Viewer tạo/sửa;
--     Tác giả hoặc Admin/Owner/Manager được xóa.
create policy p_docs_select on public.documents
  for select using (public.is_ws_member(workspace_id));

create policy p_docs_insert on public.documents
  for insert with check (
    public.ws_role(workspace_id) in ('admin', 'owner', 'manager', 'member')
  );

create policy p_docs_update on public.documents
  for update using (
    public.ws_role(workspace_id) in ('admin', 'owner', 'manager', 'member')
  );

create policy p_docs_delete on public.documents
  for delete using (
    author_id = auth.uid()
    or public.ws_role(workspace_id) in ('admin', 'owner', 'manager')
  );

-- ----------------------------------------------------------------------------
-- PHẦN 7: STORAGE BUCKET CHO TỆP ĐÍNH KÈM (task-attachments)
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('task-attachments', 'task-attachments', false)
on conflict (id) do nothing;

drop policy if exists p_storage_att_read on storage.objects;
drop policy if exists p_storage_att_insert on storage.objects;
drop policy if exists p_storage_att_delete on storage.objects;

-- Đường dẫn file quy ước: <workspace_id>/<task_id>/<filename>
create policy p_storage_att_read on storage.objects
  for select using (
    bucket_id = 'task-attachments'
    and public.is_ws_member((storage.foldername(name))[1]::uuid)
  );

create policy p_storage_att_insert on storage.objects
  for insert with check (
    bucket_id = 'task-attachments'
    and public.ws_role((storage.foldername(name))[1]::uuid) in ('admin', 'owner', 'manager', 'member')
  );

create policy p_storage_att_delete on storage.objects
  for delete using (
    bucket_id = 'task-attachments'
    and public.ws_role((storage.foldername(name))[1]::uuid) in ('admin', 'owner', 'manager')
  );

