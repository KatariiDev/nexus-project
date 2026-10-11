-- ============================================================================
-- Nexus Project — Row Level Security
-- Nguyên tắc: mọi dữ liệu thuộc về workspace; chỉ thành viên workspace mới thấy.
-- Ghi dữ liệu yêu cầu vai trò phù hợp (viewer chỉ đọc).
-- ============================================================================

-- Helpers (security definer để tránh đệ quy RLS)
create or replace function public.is_ws_member(ws uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = ws and user_id = auth.uid()
  );
$$;

create or replace function public.ws_role(ws uuid)
returns text language sql security definer stable as $$
  select role from public.workspace_members
  where workspace_id = ws and user_id = auth.uid();
$$;

create or replace function public.project_ws(pid uuid)
returns uuid language sql security definer stable as $$
  select workspace_id from public.projects where id = pid;
$$;

create or replace function public.task_ws(tid uuid)
returns uuid language sql security definer stable as $$
  select p.workspace_id from public.projects p
  join public.tasks t on t.project_id = p.id
  where t.id = tid;
$$;

-- Bật RLS cho tất cả bảng
alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.tasks enable row level security;
alter table public.task_assignees enable row level security;
alter table public.task_watchers enable row level security;
alter table public.task_comments enable row level security;
alter table public.task_checklists enable row level security;
alter table public.task_dependencies enable row level security;
alter table public.labels enable row level security;
alter table public.task_labels enable row level security;
alter table public.task_attachments enable row level security;
alter table public.notifications enable row level security;
alter table public.activity_logs enable row level security;
alter table public.documents enable row level security;

-- profiles: đọc khi cùng workspace; sửa chính mình
create policy p_profiles_read on public.profiles for select to authenticated
  using (true);
create policy p_profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy p_profiles_insert on public.profiles for insert to authenticated
  with check (id = auth.uid());

-- workspaces
create policy p_ws_read on public.workspaces for select to authenticated
  using (public.is_ws_member(id));
create policy p_ws_insert on public.workspaces for insert to authenticated
  with check (true);
create policy p_ws_update on public.workspaces for update to authenticated
  using (public.ws_role(id) in ('owner','admin')) with check (public.ws_role(id) in ('owner','admin'));
create policy p_ws_delete on public.workspaces for delete to authenticated
  using (public.ws_role(id) = 'owner');

-- workspace_members
create policy p_wsm_read on public.workspace_members for select to authenticated
  using (public.is_ws_member(workspace_id));
create policy p_wsm_write on public.workspace_members for all to authenticated
  using (public.ws_role(workspace_id) in ('owner','admin'))
  with check (public.ws_role(workspace_id) in ('owner','admin'));

-- projects
create policy p_proj_read on public.projects for select to authenticated
  using (public.is_ws_member(workspace_id));
create policy p_proj_insert on public.projects for insert to authenticated
  with check (public.is_ws_member(workspace_id) and public.ws_role(workspace_id) in ('owner','admin','manager'));
create policy p_proj_update on public.projects for update to authenticated
  using (public.ws_role(workspace_id) in ('owner','admin','manager'))
  with check (public.ws_role(workspace_id) in ('owner','admin','manager'));
create policy p_proj_delete on public.projects for delete to authenticated
  using (public.ws_role(workspace_id) in ('owner','admin'));

-- project_members
create policy p_pm_read on public.project_members for select to authenticated
  using (public.is_ws_member(public.project_ws(project_id)));
create policy p_pm_write on public.project_members for all to authenticated
  using (public.ws_role(public.project_ws(project_id)) in ('owner','admin','manager'))
  with check (public.ws_role(public.project_ws(project_id)) in ('owner','admin','manager'));

-- tasks
create policy p_task_read on public.tasks for select to authenticated
  using (public.is_ws_member(public.project_ws(project_id)));
create policy p_task_insert on public.tasks for insert to authenticated
  with check (public.is_ws_member(public.project_ws(project_id))
    and public.ws_role(public.project_ws(project_id)) in ('owner','admin','manager','member'));
create policy p_task_update on public.tasks for update to authenticated
  using (public.ws_role(public.project_ws(project_id)) in ('owner','admin','manager','member'))
  with check (public.ws_role(public.project_ws(project_id)) in ('owner','admin','manager','member'));
create policy p_task_delete on public.tasks for delete to authenticated
  using (public.ws_role(public.project_ws(project_id)) in ('owner','admin','manager'));

-- task_assignees / watchers / comments / checklists / dependencies / labels-link
create policy p_ta_all on public.task_assignees for all to authenticated
  using (public.is_ws_member(public.task_ws(task_id)))
  with check (public.ws_role(public.task_ws(task_id)) in ('owner','admin','manager','member'));
create policy p_tw_all on public.task_watchers for all to authenticated
  using (public.is_ws_member(public.task_ws(task_id)))
  with check (public.ws_role(public.task_ws(task_id)) in ('owner','admin','manager','member'));
create policy p_tc_read on public.task_comments for select to authenticated
  using (public.is_ws_member(public.task_ws(task_id)));
create policy p_tc_write on public.task_comments for insert to authenticated
  with check (public.ws_role(public.task_ws(task_id)) in ('owner','admin','manager','member'));
create policy p_tc_del on public.task_comments for delete to authenticated
  using (author_id = auth.uid() or public.ws_role(public.task_ws(task_id)) in ('owner','admin'));
create policy p_tcl_all on public.task_checklists for all to authenticated
  using (public.is_ws_member(public.task_ws(task_id)))
  with check (public.ws_role(public.task_ws(task_id)) in ('owner','admin','manager','member'));
create policy p_td_all on public.task_dependencies for all to authenticated
  using (public.is_ws_member(public.task_ws(task_id)))
  with check (public.ws_role(public.task_ws(task_id)) in ('owner','admin','manager','member'));
create policy p_tl_all on public.task_labels for all to authenticated
  using (public.is_ws_member(public.task_ws(task_id)))
  with check (public.ws_role(public.task_ws(task_id)) in ('owner','admin','manager','member'));

-- labels
create policy p_label_read on public.labels for select to authenticated
  using (public.is_ws_member(workspace_id));
create policy p_label_write on public.labels for all to authenticated
  using (public.ws_role(workspace_id) in ('owner','admin','manager','member'))
  with check (public.ws_role(workspace_id) in ('owner','admin','manager','member'));

-- attachments metadata
create policy p_att_read on public.task_attachments for select to authenticated
  using (public.is_ws_member(public.task_ws(task_id)));
create policy p_att_write on public.task_attachments for all to authenticated
  using (public.ws_role(public.task_ws(task_id)) in ('owner','admin','manager','member'))
  with check (public.ws_role(public.task_ws(task_id)) in ('owner','admin','manager','member'));

-- notifications: chỉ chủ sở hữu
create policy p_notif_all on public.notifications for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- activity_logs
create policy p_act_read on public.activity_logs for select to authenticated
  using (workspace_id is null or public.is_ws_member(workspace_id));
create policy p_act_insert on public.activity_logs for insert to authenticated
  with check (workspace_id is null or public.is_ws_member(workspace_id));

-- documents
create policy p_doc_read on public.documents for select to authenticated
  using (public.is_ws_member(workspace_id));
create policy p_doc_write on public.documents for all to authenticated
  using (public.ws_role(workspace_id) in ('owner','admin','manager','member'))
  with check (public.ws_role(workspace_id) in ('owner','admin','manager','member'));

-- ----------------------------------------------------------------------------
-- Storage: bucket task-attachments
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public) values ('task-attachments', 'task-attachments', false)
  on conflict (id) do nothing;

create policy p_storage_read on storage.objects for select to authenticated
  using (bucket_id = 'task-attachments');
create policy p_storage_write on storage.objects for insert to authenticated
  with check (bucket_id = 'task-attachments');
create policy p_storage_del on storage.objects for delete to authenticated
  using (bucket_id = 'task-attachments');
